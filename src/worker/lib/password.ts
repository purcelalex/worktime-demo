// PBKDF2-SHA256 through WebCrypto. 100,000 iterations is the maximum the Workers
// runtime allows. Demo passwords are long random strings, so this is adequate;
// real accounts will use magic links and passkeys instead of passwords.
const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256
const PREFIX = 'pbkdf2-sha256'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const s = atob(value)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iterations, salt, hash] = stored.split('$')
  if (prefix !== PREFIX || !iterations || !salt || !hash) return false
  const expected = fromBase64(hash)
  const actual = await derive(password, fromBase64(salt), Number(iterations))
  return constantTimeEqual(actual, expected)
}

let dummyHash: Promise<string> | undefined

/**
 * Verifies against a throwaway hash so that an unknown username costs the same
 * time as a wrong password and does not reveal which accounts exist.
 */
export async function verifyDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('not-a-real-password')
  await verifyPassword(password, await dummyHash)
  return false
}
