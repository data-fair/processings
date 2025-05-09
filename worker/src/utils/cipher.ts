import config from '#config'
import { createHash, createDecipheriv } from 'node:crypto'

export type CipheredContent = { iv: string, alg: 'aes256', data: string }

// the secret key for cipher/decipher is a simple hash of config.cipherPassword
const hash = createHash('sha256')
hash.update(config.cipherPassword)
const securityKey = hash.digest()

export const decipher = (cipheredContent: CipheredContent | string): string => {
  if (typeof cipheredContent === 'string') return cipheredContent
  const decipher = createDecipheriv(cipheredContent.alg, securityKey, Buffer.from(cipheredContent.iv, 'hex'))
  let content = decipher.update(cipheredContent.data, 'hex', 'utf-8')
  content += decipher.final('utf8')
  return content
}
