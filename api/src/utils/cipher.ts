import config from '#config'
import { createHash, randomBytes, createCipheriv } from 'node:crypto'

export type CipheredContent = { iv: string, alg: 'aes256', data: string }

// the secret key for cipher/decipher is a simple hash of config.cipherPassword
const hash = createHash('sha256')
hash.update(config.cipherPassword)
const securityKey = hash.digest()

export const cipher = (content: string): CipheredContent => {
  const initVector = randomBytes(16)
  const algo = 'aes256'
  const cipher = createCipheriv(algo, securityKey, initVector)
  let encryptedData = cipher.update(content, 'utf-8', 'hex')
  encryptedData += cipher.final('hex')
  return {
    iv: initVector.toString('hex'),
    alg: algo,
    data: encryptedData
  }
}
