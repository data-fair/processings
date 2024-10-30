import type { Account } from '@data-fair/lib-express'

export type { Limit } from './limit/index.js'
export type { Permission } from './permission/index.js'
export type { Plugin } from './plugin/index.js'
export type { Processing } from './processing/index.js'
export type { Run } from './run/index.js'

export type AccountKeys = Pick<Account, 'type' | 'id' | 'department'>
