export const SESSION_COOKIE = 'session' // sent as __Host-session
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 32 random bytes, base64url encoded. Only its hash is stored. */
export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
