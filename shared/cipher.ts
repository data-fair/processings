import type { CipheredContent } from '#api/type/processing/index.js'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const getSecurityKey = (password: string): Buffer => {
  return createHash('sha256').update(password).digest()
}

export const cipher = (content: CipheredContent | string, cipherPassword: string): CipheredContent => {
  const securityKey = getSecurityKey(cipherPassword)
  if (typeof content !== 'string') return content

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

export const decipher = (cipheredContent: CipheredContent | string, cipherPassword: string): string => {
  const securityKey = getSecurityKey(cipherPassword)

  if (typeof cipheredContent === 'string') return cipheredContent
  const decipher = createDecipheriv(cipheredContent.alg, securityKey, Buffer.from(cipheredContent.iv, 'hex'))
  let content = decipher.update(cipheredContent.data, 'hex', 'utf-8')
  content += decipher.final('utf8')
  return content
}
