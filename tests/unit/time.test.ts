import { describe, expect, it } from 'vitest'
import { belongsToPeriod, clippedDuration } from '../../src/worker/lib/time'
import { hashPassword, verifyPassword } from '../../src/worker/lib/password'

describe('clippedDuration', () => {
  it('returns the full duration for an entry inside the period', () => {
    expect(clippedDuration(100, 200, 0, 1000, 5000)).toBe(100)
  })
  it('clips at both boundaries', () => {
    expect(clippedDuration(-50, 50, 0, 1000, 5000)).toBe(50)
    expect(clippedDuration(950, 2000, 0, 1000, 5000)).toBe(50)
    expect(clippedDuration(-50, 2000, 0, 1000, 5000)).toBe(1000)
  })
  it('counts a running entry up to now, but never past the period end', () => {
    expect(clippedDuration(100, null, 0, 1000, 400)).toBe(300)
    expect(clippedDuration(100, null, 0, 1000, 5000)).toBe(900)
  })
  it('is never negative', () => {
    expect(clippedDuration(2000, 3000, 0, 1000, 5000)).toBe(0)
    expect(clippedDuration(100, null, 0, 1000, 50)).toBe(0)
  })
})

describe('belongsToPeriod', () => {
  it('detects overlap', () => {
    expect(belongsToPeriod(100, 200, 0, 1000)).toBe(true)
    expect(belongsToPeriod(-10, 5, 0, 1000)).toBe(true)
    expect(belongsToPeriod(900, null, 0, 1000)).toBe(true)
  })
  it('excludes entries entirely outside', () => {
    expect(belongsToPeriod(-10, 0, 0, 1000)).toBe(false)
    expect(belongsToPeriod(1000, 1500, 0, 1000)).toBe(false)
  })
})

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('example-pass-A1!')
    expect(hash.startsWith('pbkdf2-sha256$100000$')).toBe(true) // scan:allow (format check, not a real hash)
    expect(await verifyPassword('example-pass-A1!', hash)).toBe(true)
    expect(await verifyPassword('example-pass-B2!', hash)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
  it('uses a fresh salt each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })
})
