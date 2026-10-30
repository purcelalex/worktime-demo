import type { Db } from './db/client'

export interface Env {
  DB: D1Database
}

export interface Auth {
  userId: string
  username: string
  role: 'owner' | 'admin' | 'manager' | 'employee'
  orgId: string
  orgName: string
  orgKind: 'demo' | 'real'
}

export interface AppEnv {
  Bindings: Env
  Variables: { db: Db; auth: Auth }
}
