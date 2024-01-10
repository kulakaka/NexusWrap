import { v4 } from 'uuid'
import { TransactionOrKnex } from 'objection'

import { BaseService } from '../shared/baseService'
import { generateToken } from '../shared/utils'
import { Grant, isRevokedGrant } from '../grant/model'
import { ClientService } from '../client/service'
import { AccessToken } from './model'

export interface AccessTokenService {
  getByManagementId(managementId: string): Promise<AccessToken | undefined>
  introspect(tokenValue: string): Promise<Grant | undefined>
  create(grantId: string, trx?: TransactionOrKnex): Promise<AccessToken>
  revoke(id: string, trx?: TransactionOrKnex): Promise<AccessToken | undefined>
  revokeByGrantId(grantId: string, trx?: TransactionOrKnex): Promise<number>
  rotate(id: string, trx?: TransactionOrKnex): Promise<AccessToken | undefined>
}

interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
  clientService: ClientService
  accessTokenExpirySeconds: number
}

export async function createAccessTokenService({
  logger,
  knex,
  clientService,
  accessTokenExpirySeconds
}: ServiceDependencies): Promise<AccessTokenService> {
  const log = logger.child({
    service: 'TokenService'
  })

  const deps: ServiceDependencies = {
    logger: log,
    knex,
    clientService,
    accessTokenExpirySeconds
  }

  return {
    getByManagementId: (managementId: string) =>
      getByManagementId(managementId),
    introspect: (tokenValue: string) => introspect(deps, tokenValue),
    revoke: (id: string, trx?: TransactionOrKnex) => revoke(deps, id, trx),
    revokeByGrantId: (grantId: string, trx?: TransactionOrKnex) =>
      revokeByGrantId(deps, grantId, trx),
    create: (grantId: string, trx?: TransactionOrKnex) =>
      createAccessToken(deps, grantId, trx),
    rotate: (id: string) => rotate(deps, id)
  }
}

function isTokenExpired(token: AccessToken): boolean {
  const now = new Date(Date.now())
  const expiresAt = token.createdAt.getTime() + token.expiresIn * 1000
  return expiresAt < now.getTime()
}

async function getByManagementId(
  managementId: string
): Promise<AccessToken | undefined> {
  return AccessToken.query()
    .findOne('managementId', managementId)
    .withGraphFetched('grant')
}

async function introspect(
  deps: ServiceDependencies,
  tokenValue: string
): Promise<Grant | undefined> {
  const token = await AccessToken.query(deps.knex)
    .findOne({ value: tokenValue })
    .withGraphFetched('grant.access')

  if (!token) return
  if (isTokenExpired(token)) {
    return undefined
  } else {
    if (!token.grant || isRevokedGrant(token.grant)) {
      return undefined
    }

    return token.grant
  }
}

async function revoke(
  deps: ServiceDependencies,
  id: string,
  trx?: TransactionOrKnex
): Promise<AccessToken | undefined> {
  return AccessToken.query(trx || deps.knex)
    .deleteById(id)
    .returning('*')
    .first()
}

async function revokeByGrantId(
  deps: ServiceDependencies,
  grantId: string,
  trx?: TransactionOrKnex
): Promise<number> {
  return await AccessToken.query(trx || deps.knex)
    .delete()
    .where('grantId', grantId)
}

async function createAccessToken(
  deps: ServiceDependencies,
  grantId: string,
  trx?: TransactionOrKnex
): Promise<AccessToken> {
  return AccessToken.query(trx || deps.knex).insert({
    value: generateToken(),
    managementId: v4(),
    grantId,
    expiresIn: deps.accessTokenExpirySeconds
  })
}

async function rotate(
  deps: ServiceDependencies,
  id: string,
  trx?: TransactionOrKnex
): Promise<AccessToken | undefined> {
  const revokedToken = await revoke(deps, id, trx)

  if (!revokedToken) {
    deps.logger.warn({ tokenId: id }, 'Could not revoke access token')
    return undefined
  }

  return createAccessToken(deps, revokedToken.grantId, trx)
}
