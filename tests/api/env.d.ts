declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    TEST_MIGRATIONS: import('@cloudflare/vitest-plugin').D1Migration[]
  }
}

declare namespace Cloudflare {
  interface Exports {
    default: { fetch(request: Request): Promise<Response> }
  }
}
