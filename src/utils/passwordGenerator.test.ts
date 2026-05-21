// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { generatePassword, passwordStrength, PASSWORD_STRENGTH_LABEL } from './passwordGenerator'

describe('generatePassword', () => {
  it('throws when length < 4', () => {
    expect(() => generatePassword(3)).toThrow(/>= 4/)
  })

  it('returns string of requested length', () => {
    expect(generatePassword(16)).toHaveLength(16)
    expect(generatePassword(8)).toHaveLength(8)
    expect(generatePassword(32)).toHaveLength(32)
  })

  it('contains at least one of each required class (upper/lower/digit/symbol)', () => {
    // 100 次循环放大随机覆盖,降低误差
    for (let i = 0; i < 100; i++) {
      const pw = generatePassword(12)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[!@#$%^&*\-_=+]/)
    }
  })

  it('excludes ambiguous characters (0/O/I/l/1)', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(20)
      expect(pw).not.toMatch(/[0OIl1]/)
    }
  })

  it('excludes shell/sql dangerous symbols (\' " ` \\ ;)', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(20)
      expect(pw).not.toMatch(/['"`\\;]/)
    }
  })

  it('produces different outputs across calls (entropy sanity)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) seen.add(generatePassword(16))
    expect(seen.size).toBeGreaterThan(15)
  })
})

describe('passwordStrength', () => {
  it('returns 0 for short / empty', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('1234567')).toBe(0)
  })

  it('grants 1 point for each present class on length ≥ 8', () => {
    expect(passwordStrength('abcdefgh')).toBe(0) // 8 chars, only lower, no mix → 0
    expect(passwordStrength('Abcdefgh')).toBe(1) // upper+lower
    expect(passwordStrength('Abcdef12')).toBe(2) // upper+lower + digit
    expect(passwordStrength('Abcdef1!')).toBe(3) // + symbol
  })

  it('extra point at length ≥ 12', () => {
    expect(passwordStrength('Abcdef1!XyzW')).toBe(4) // all classes + len 12
  })

  it('caps at 4 (extreme)', () => {
    expect(passwordStrength('A!a1A!a1A!a1A!a1')).toBeLessThanOrEqual(4)
  })

  it('PASSWORD_STRENGTH_LABEL has 5 entries indexable by score', () => {
    expect(PASSWORD_STRENGTH_LABEL).toHaveLength(5)
    expect(PASSWORD_STRENGTH_LABEL[0]).toBe('极弱')
    expect(PASSWORD_STRENGTH_LABEL[4]).toBe('极强')
  })
})
