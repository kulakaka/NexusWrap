import { join } from 'path'
import http, { Server } from 'http'

import { IocContract } from '@adonisjs/fold'
import { Knex } from 'knex'
import Koa, { DefaultState, DefaultContext } from 'koa'
import bodyParser from 'koa-bodyparser'
import session from 'koa-session'
import cors from '@koa/cors'
import { Logger } from 'pino'
import Router from '@koa/router'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { koaMiddleware } from '@as-integrations/koa'

import { IAppConfig } from './config/app'
import { addResolversToSchema } from '@graphql-tools/schema'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadSchemaSync } from '@graphql-tools/load'
import { resolvers } from './graphql/resolvers'
import { ClientService } from './client/service'
import { GrantService } from './grant/service'
import { InteractionService } from './interaction/service'
import {
  CreateContext,
  ContinueContext,
  GrantRoutes,
  RevokeContext as GrantRevokeContext
} from './grant/routes'
import {
  StartContext,
  GetContext,
  ChooseContext,
  FinishContext
} from './interaction/routes'
import {
  AccessTokenRoutes,
  IntrospectContext,
  RevokeContext,
  RotateContext
} from './accessToken/routes'
import { createValidatorMiddleware, HttpMethod } from '@interledger/openapi'

import {
  grantInitiationHttpsigMiddleware,
  grantContinueHttpsigMiddleware,
  tokenHttpsigMiddleware
} from './signature/middleware'
import { AccessService } from './access/service'
import { AccessTokenService } from './accessToken/service'
import { InteractionRoutes } from './interaction/routes'

export interface AppContextData extends DefaultContext {
  logger: Logger
  container: AppContainer
  // Set by @koa/router
  params: { [key: string]: string }
  // Set by koa-generic-session
  session: { [key: string]: string }
}

export type AppContext = Koa.ParameterizedContext<DefaultState, AppContextData>

export interface ApolloContext {
  container: IocContract<AppServices>
  logger: Logger
}

export interface DatabaseCleanupRule {
  /**
   * the name of the column containing the starting time from which the age will be computed
   * ex: `createdAt` or `updatedAt`
   */
  absoluteStartTimeColumnName: string
  /**
   * the name of the column containing the time offset, in seconds, since
   * `absoluteStartTimeColumnName`, which specifies when the row expires
   */
  expirationOffsetColumnName: string
  /**
   * the minimum number of days since expiration before rows of
   * this table will be considered safe to delete during clean up
   */
  defaultExpirationOffsetDays: number
}

export interface AppServices {
  logger: Promise<Logger>
  knex: Promise<Knex>
  config: Promise<IAppConfig>
  clientService: Promise<ClientService>
  grantService: Promise<GrantService>
  interactionService: Promise<InteractionService>
  accessService: Promise<AccessService>
  accessTokenRoutes: Promise<AccessTokenRoutes>
  accessTokenService: Promise<AccessTokenService>
  grantRoutes: Promise<GrantRoutes>
  interactionRoutes: Promise<InteractionRoutes>
}

export type AppContainer = IocContract<AppServices>

export class App {
  private authServer!: Server
  private introspectionServer!: Server
  private adminServer!: Server
  private logger!: Logger
  private config!: IAppConfig
  private databaseCleanupRules!: {
    [tableName: string]: DatabaseCleanupRule | undefined
  }
  public isShuttingDown = false

  public constructor(private container: IocContract<AppServices>) {}

  /**
   * The boot function exists because the functions that we register on the container with the `bind` method are async.
   * We then need to await this function when we call use - which can't be done in the constructor. This is a first pass to
   * get the container working. We can refactor this in future. Perhaps don't use private members and just pass around the container?
   * Or provide start / shutdown methods on the services in the container?
   */
  public async boot(): Promise<void> {
    this.config = await this.container.use('config')
    this.logger = await this.container.use('logger')

    this.databaseCleanupRules = {
      accessTokens: {
        absoluteStartTimeColumnName: 'createdAt',
        expirationOffsetColumnName: 'expiresIn',
        defaultExpirationOffsetDays: this.config.accessTokenDeletionDays
      }
    }

    if (this.config.env !== 'test') {
      for (let i = 0; i < this.config.databaseCleanupWorkers; i++) {
        process.nextTick(() => this.processDatabaseCleanup())
      }
    }
  }

  public async startAdminServer(port: number | string): Promise<void> {
    const koa = await this.createKoaServer()
    const httpServer = http.createServer(koa.callback())

    // Load schema from the file
    const schema = loadSchemaSync(join(__dirname, './graphql/schema.graphql'), {
      loaders: [new GraphQLFileLoader()]
    })

    // Add resolvers to the schema
    const schemaWithResolvers = addResolversToSchema({
      schema,
      resolvers
    })

    // Setup Apollo
    const apolloServer = new ApolloServer({
      schema: schemaWithResolvers,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
    })

    await apolloServer.start()

    koa.use(bodyParser())

    koa.use(
      async (
        ctx: {
          path: string
          status: number
        },
        next: Koa.Next
      ): Promise<void> => {
        if (ctx.path !== '/graphql') {
          ctx.status = 404
        } else {
          return next()
        }
      }
    )

    koa.use(
      koaMiddleware(apolloServer, {
        context: async (): Promise<ApolloContext> => {
          return {
            container: this.container,
            logger: await this.container.use('logger')
          }
        }
      })
    )

    this.adminServer = httpServer.listen(port)
  }

  public async startAuthServer(port: number | string): Promise<void> {
    const koa = await this.createKoaServer()

    const router = new Router<DefaultState, AppContext>()
    router.use(bodyParser())
    router.get('/healthz', (ctx: AppContext): void => {
      ctx.status = 200
    })

    router.get('/discovery', (ctx: AppContext): void => {
      ctx.body = {
        grant_request_endpoint: '/',
        interaction_start_modes_supported: ['redirect'],
        interaction_finish_modes_supported: ['redirect']
      }
    })

    const accessTokenRoutes = await this.container.use('accessTokenRoutes')
    const grantRoutes = await this.container.use('grantRoutes')
    const interactionRoutes = await this.container.use('interactionRoutes')
    const openApi = await this.container.use('openApi')

    /* Back-channel GNAP Routes */
    // Grant Initiation
    router.post<DefaultState, CreateContext>(
      '/',
      createValidatorMiddleware<CreateContext>(openApi.authServerSpec, {
        path: '/',
        method: HttpMethod.POST
      }),
      grantInitiationHttpsigMiddleware,
      grantRoutes.create
    )

    // Grant Continue
    router.post<DefaultState, ContinueContext>(
      '/continue/:id',
      createValidatorMiddleware<ContinueContext>(openApi.authServerSpec, {
        path: '/continue/{id}',
        method: HttpMethod.POST
      }),
      grantContinueHttpsigMiddleware,
      grantRoutes.continue
    )

    // Grant Cancel
    router.delete<DefaultState, GrantRevokeContext>(
      '/continue/:id',
      createValidatorMiddleware<GrantRevokeContext>(openApi.authServerSpec, {
        path: '/continue/{id}',
        method: HttpMethod.DELETE
      }),
      grantContinueHttpsigMiddleware,
      grantRoutes.revoke
    )

    // Token Rotation
    router.post<DefaultState, RotateContext>(
      '/token/:id',
      createValidatorMiddleware<RotateContext>(openApi.authServerSpec, {
        path: '/token/{id}',
        method: HttpMethod.POST
      }),
      tokenHttpsigMiddleware,
      accessTokenRoutes.rotate
    )

    // Token Revocation
    router.delete<DefaultState, RevokeContext>(
      '/token/:id',
      createValidatorMiddleware<RevokeContext>(openApi.authServerSpec, {
        path: '/token/{id}',
        method: HttpMethod.DELETE
      }),
      tokenHttpsigMiddleware,
      accessTokenRoutes.revoke
    )

    /* Front Channel Routes */

    // Interaction start
    router.get<DefaultState, StartContext>(
      '/interact/:id/:nonce',
      createValidatorMiddleware<StartContext>(openApi.idpSpec, {
        path: '/interact/{id}/{nonce}',
        method: HttpMethod.GET
      }),
      interactionRoutes.start
    )

    // Interaction finish
    router.get<DefaultState, FinishContext>(
      '/interact/:id/:nonce/finish',
      createValidatorMiddleware<FinishContext>(openApi.idpSpec, {
        path: '/interact/{id}/{nonce}/finish',
        method: HttpMethod.GET
      }),
      interactionRoutes.finish
    )

    // Grant lookup
    router.get<DefaultState, GetContext>(
      '/grant/:id/:nonce',
      createValidatorMiddleware<GetContext>(openApi.idpSpec, {
        path: '/grant/{id}/{nonce}',
        method: HttpMethod.GET
      }),
      interactionRoutes.details
    )

    // Grant accept/reject
    router.post<DefaultState, ChooseContext>(
      '/grant/:id/:nonce/:choice',
      createValidatorMiddleware<ChooseContext>(openApi.idpSpec, {
        path: '/grant/{id}/{nonce}/{choice}',
        method: HttpMethod.POST
      }),
      interactionRoutes.acceptOrReject
    )

    koa.use(cors())
    koa.keys = [this.config.cookieKey]
    koa.use(
      session(
        {
          key: 'sessionId',
          maxAge: 60 * 1000,
          signed: true
        },
        // Only accepts Middleware<DefaultState, DefaultContext> for some reason, this.koa is Middleware<DefaultState, AppContext>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        koa as any
      )
    )

    koa.use(router.middleware())
    koa.use(router.routes())

    this.authServer = koa.listen(port)
  }

  public async startIntrospectionServer(port: number | string): Promise<void> {
    const koa = await this.createKoaServer()

    const router = new Router<DefaultState, AppContext>()
    router.use(bodyParser())
    router.get('/healthz', (ctx: AppContext): void => {
      ctx.status = 200
    })

    const accessTokenRoutes = await this.container.use('accessTokenRoutes')
    const openApi = await this.container.use('openApi')

    // Token Introspection
    router.post<DefaultState, IntrospectContext>(
      '/',
      createValidatorMiddleware<IntrospectContext>(
        openApi.tokenIntrospectionSpec,
        {
          path: '/',
          method: HttpMethod.POST
        }
      ),
      accessTokenRoutes.introspect
    )

    koa.use(cors())
    koa.use(router.middleware())
    koa.use(router.routes())

    this.introspectionServer = koa.listen(port)
  }

  private async createKoaServer(): Promise<Koa<Koa.DefaultState, AppContext>> {
    const koa = new Koa<DefaultState, AppContext>({
      proxy: this.config.trustProxy
    })

    koa.context.container = this.container
    koa.context.logger = await this.container.use('logger')

    koa.use(
      async (
        ctx: {
          status: number
          set: (arg0: string, arg1: string) => void
          body: string
        },
        next: () => void | PromiseLike<void>
      ): Promise<void> => {
        if (this.isShuttingDown) {
          ctx.status = 503
          ctx.set('Connection', 'close')
          ctx.body = 'Server is in the process of restarting'
        } else {
          return next()
        }
      }
    )

    return koa
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true

    if (this.authServer) {
      await this.stopServer(this.authServer)
    }
    if (this.adminServer) {
      await this.stopServer(this.adminServer)
    }
    if (this.introspectionServer) {
      await this.stopServer(this.introspectionServer)
    }
  }

  private async stopServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err)
        }

        resolve()
      })
    })
  }

  public getAdminPort(): number {
    return this.getPort(this.adminServer)
  }

  public getAuthPort(): number {
    return this.getPort(this.authServer)
  }

  public getIntrospectionPort(): number {
    return this.getPort(this.introspectionServer)
  }

  private getPort(server: Server): number {
    const address = server?.address()
    if (address && !(typeof address == 'string')) {
      return address.port
    }
    return 0
  }

  private async processDatabaseCleanup(): Promise<void> {
    const knex = await this.container.use('knex')

    const tableNames = Object.keys(this.databaseCleanupRules)
    for (const tableName of tableNames) {
      const rule = this.databaseCleanupRules[tableName]
      if (rule) {
        try {
          /**
           * NOTE: do not remove seemingly pointless interpolations such as '${'??'}'
           * because they are necessary for preventing SQL injection attacks
           */
          await knex(tableName)
            .whereRaw(
              `?? + make_interval(0, 0, 0, 0, 0, 0, ??) + interval '${'??'}' < NOW()`,
              [
                rule.absoluteStartTimeColumnName,
                rule.expirationOffsetColumnName,
                `${rule.defaultExpirationOffsetDays} days`
              ]
            )
            .del()
        } catch (err) {
          this.logger.warn(
            { error: err instanceof Error && err.message, tableName },
            'processDatabaseCleanup error'
          )
        }
      }
    }
  }
}
