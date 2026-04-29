import { test, expect } from '@playwright/test'
import { cipher, decipher } from '../../../shared/cipher.ts'

test.describe('shared/cipher', () => {
  test('round-trips plain strings', () => {
    const ciphered = cipher('hello world', 'pwd')
    expect(typeof ciphered).toBe('object')
    expect(ciphered.alg).toBe('aes256')
    expect(ciphered.iv).toMatch(/^[0-9a-f]{32}$/)
    expect(ciphered.data).toMatch(/^[0-9a-f]+$/)
    expect(decipher(ciphered, 'pwd')).toBe('hello world')
  })

  test('round-trips multi-byte UTF-8 strings', () => {
    const value = 'éàü 漢字 🚀'
    expect(decipher(cipher(value, 'pwd'), 'pwd')).toBe(value)
  })

  test('produces a fresh IV per call (non-deterministic ciphertext)', () => {
    const a = cipher('same value', 'pwd')
    const b = cipher('same value', 'pwd')
    expect(typeof a === 'object' && typeof b === 'object').toBe(true)
    if (typeof a === 'object' && typeof b === 'object') {
      expect(a.iv).not.toBe(b.iv)
      expect(a.data).not.toBe(b.data)
    }
  })

  test('cipher passes through already-ciphered content unchanged', () => {
    const ciphered = cipher('hello', 'pwd')
    const passthrough = cipher(ciphered, 'pwd')
    expect(passthrough).toBe(ciphered)
  })

  test('decipher passes through plain string unchanged', () => {
    expect(decipher('not-encrypted', 'pwd')).toBe('not-encrypted')
  })

  test('decipher fails when password does not match', () => {
    const ciphered = cipher('secret', 'good-pwd')
    expect(() => decipher(ciphered, 'bad-pwd')).toThrow()
  })
})
