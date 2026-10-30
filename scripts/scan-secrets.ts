/**
 * Secret scanner. Fails (exit 1) when files that must never be published are
 * present, or when file contents look like credentials. It never prints the
 * secret itself, only the file, line and rule.
 *
 *   tsx scripts/scan-secrets.ts --staged          files staged for the next commit (pre-commit hook)
 *   tsx scripts/scan-secrets.ts --tracked         every file git tracks
 *   tsx scripts/scan-secrets.ts --history         every line ever added in the git history
 *   tsx scripts/scan-secrets.ts <directory>       every file under a directory (for exports)
 *
 * A line containing the marker "scan:allow" is skipped (for test-only constants).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORDS } from './demo-words'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN_PATHS: [RegExp, string][] = [
  [/(^|\/)secrets\//, 'secrets folder'],
  [/(^|\/)\.dev\.vars(\.|$)(?!example)/, 'local environment file (.dev.vars)'],
  [/(^|\/)\.env(\.(?!example$).*)?$/, 'environment file (.env)'],
  [/\.generated\.sql$/, 'generated seed SQL (contains password hashes)'],
  [/demo-credentials/, 'demo credentials file'],
  [/(^|\/)\.wrangler\//, 'Wrangler local state'],
  [/(^|\/)node_modules\//, 'node_modules'],
  [/(^|\/)\.claude\//, 'local AI tooling folder'],
  [/(^|\/)\.git\//, 'git internals'],
]

const words = WORDS.join('|')
const CONTENT_RULES: [RegExp, string][] = [
  [new RegExp(`\\b(${words})-(${words})-\\d{2}[!#$%&*?]`), 'generated demo password shape'],
  [/pbkdf2-sha256\$\d+\$/, 'password hash'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, 'GitHub fine-grained token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bsk-[A-Za-z0-9_-]{32,}\b/, 'API secret key (sk-...)'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b(CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY)\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/, 'Cloudflare API token'],
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.wrangler', 'playwright-report', 'test-results', 'coverage'])
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|zip|gz|pdf)$/i
const MAX_BYTES = 2_000_000

interface Finding {
  file: string
  line?: number
  rule: string
}

/** Exact credentials of this machine's demo accounts, when the private file exists. */
function loadExactSecrets(): string[] {
  const file = join(ROOT, 'secrets', 'demo-credentials.json')
  if (!existsSync(file)) return []
  const store = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { password?: string; hash?: string }>
  return Object.values(store).flatMap((c) => [c.password, c.hash].filter((v): v is string => Boolean(v)))
}

function scanText(file: string, text: string, exact: string[], findings: Finding[], lineOffset = 0) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('scan:allow')) continue
    for (const [pattern, rule] of CONTENT_RULES) {
      if (pattern.test(line)) findings.push({ file, line: i + 1 + lineOffset, rule })
    }
    for (const secret of exact) {
      if (line.includes(secret)) findings.push({ file, line: i + 1 + lineOffset, rule: 'an actual demo credential of this machine' })
    }
  }
}

function scanFile(root: string, rel: string, exact: string[], findings: Finding[]) {
  const normal = rel.split(sep).join('/')
  for (const [pattern, rule] of FORBIDDEN_PATHS) {
    if (pattern.test(normal)) findings.push({ file: normal, rule: `forbidden path: ${rule}` })
  }
  const full = join(root, rel)
  if (BINARY.test(normal) || !existsSync(full)) return
  const info = statSync(full)
  if (!info.isFile() || info.size > MAX_BYTES) return
  scanText(normal, readFileSync(full, 'utf8'), exact, findings)
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...walk(join(dir, entry.name), base))
    } else {
      out.push(relative(base, join(dir, entry.name)))
    }
  }
  return out
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

function main() {
  const arg = process.argv[2] ?? '--tracked'
  const exact = loadExactSecrets()
  const findings: Finding[] = []
  let scanned = 0

  if (arg === '--history') {
    // Every line ever added, plus every path ever touched.
    for (const file of new Set(git('log', '--all', '--name-only', '--pretty=format:').split('\n').filter(Boolean))) {
      for (const [pattern, rule] of FORBIDDEN_PATHS) {
        if (pattern.test(file)) findings.push({ file, rule: `forbidden path in history: ${rule}` })
      }
    }
    const added = git('log', '--all', '-p', '--no-color', '--pretty=format:')
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .join('\n')
    scanText('(git history)', added, exact, findings)
    scanned = added.split('\n').length
  } else if (arg === '--staged' || arg === '--tracked') {
    const files = (arg === '--staged' ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR') : git('ls-files'))
      .split('\n')
      .filter(Boolean)
    for (const rel of files) {
      scanFile(ROOT, rel, exact, findings)
      scanned++
    }
  } else {
    const dir = resolve(arg)
    for (const rel of walk(dir)) {
      scanFile(dir, rel, exact, findings)
      scanned++
    }
  }

  if (findings.length === 0) {
    console.log(`Secret scan clean (${scanned} ${arg === '--history' ? 'added lines' : 'files'} checked, ${exact.length ? 'with' : 'without'} exact-match of local credentials).`)
    return
  }
  console.error(`SECRET SCAN FAILED: ${findings.length} finding(s). Values are not printed.`)
  for (const f of findings) console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.rule}`)
  process.exit(1)
}

main()
