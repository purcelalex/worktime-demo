import { spawnSync } from 'node:child_process'

function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`setup step failed: ${args.join(' ')}`)
}

// Bring the local database up to date, then recreate the local-only test
// account (and clear its data) before each run.
export default function globalSetup() {
  run(['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local'])
  run(['node_modules/tsx/dist/cli.mjs', 'scripts/e2e-setup.ts'])
}
