import * as crypto from 'crypto'
import dotenv from 'dotenv'

function envString(name: string, value: string): string {
  const envValue = process.env[name]
  return envValue == null ? value : envValue
}

function envInt(name: string, value: number): number {
  const envValue = process.env[name]
  return envValue == null ? value : parseInt(envValue)
}

function envBool(name: string, value: boolean): boolean {
  const envValue = process.env[name]
  return envValue == null ? value : envValue === 'true'
}
export type IAppConfig = typeof Config

dotenv.config({
  path: process.env.ENV_FILE || '.env'
})

export const Config = {
  logLevel: envString('LOG_LEVEL', 'info'),
  adminPort: envInt('ADMIN_PORT', 3003),
  authPort: envInt('AUTH_PORT', 3006),
  introspectionPort: envInt('INTROSPECTION_PORT', 3007),
  env: envString('NODE_ENV', 'development'),
  trustProxy: envBool('TRUST_PROXY', false),
  databaseUrl:
    process.env.NODE_ENV === 'test'
      ? `${process.env.AUTH_DATABASE_URL}_${process.env.JEST_WORKER_ID}`
      : envString(
          'AUTH_DATABASE_URL',
          'postgresql://postgres:password@localhost:5432/auth_development'
        ),
  identityServerDomain: envString(
    'IDENTITY_SERVER_DOMAIN',
    'http://localhost:3030/mock-idp/'
  ),
  identityServerSecret: envString('IDENTITY_SERVER_SECRET', 'replace-me'),
  authServerDomain: envString(
    'AUTH_SERVER_DOMAIN',
    `http://localhost:${envInt('AUTH_PORT', 3006)}`
  ),
  waitTimeSeconds: envInt('WAIT_SECONDS', 5),
  cookieKey: envString('COOKIE_KEY', crypto.randomBytes(32).toString('hex')),
  interactionExpirySeconds: envInt('INTERACTION_EXPIRY_SECONDS', 10 * 60), // Default 10 minutes
  accessTokenExpirySeconds: envInt('ACCESS_TOKEN_EXPIRY_SECONDS', 10 * 60), // Default 10 minutes
  databaseCleanupWorkers: envInt('DATABASE_CLEANUP_WORKERS', 1),
  accessTokenDeletionDays: envInt('ACCESS_TOKEN_DELETION_DAYS', 30),
  incomingPaymentInteraction: envBool('INCOMING_PAYMENT_INTERACTION', false),
  quoteInteraction: envBool('QUOTE_INTERACTION', false),
  listAllInteraction: envBool('LIST_ALL_ACCESS_INTERACTION', true)
}
