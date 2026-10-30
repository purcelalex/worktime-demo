import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach } from 'vitest'
import { newClientIp } from './helpers'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

beforeEach(() => {
  newClientIp()
})
