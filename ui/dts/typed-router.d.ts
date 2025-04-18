/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// Generated by unplugin-vue-router. ‼️ DO NOT MODIFY THIS FILE ‼️
// It's recommended to commit this file.
// Make sure to add this file to your tsconfig.json file as an "includes" or "files" entry.

declare module 'vue-router/auto-routes' {
  import type {
    RouteRecordInfo,
    ParamValue,
    ParamValueOneOrMore,
    ParamValueZeroOrMore,
    ParamValueZeroOrOne,
  } from 'vue-router'

  /**
   * Route name map generated by unplugin-vue-router
   */
  export interface RouteNamedMap {
    '/admin/': RouteRecordInfo<'/admin/', '/admin', Record<never, never>, Record<never, never>>,
    '/admin/plugins': RouteRecordInfo<'/admin/plugins', '/admin/plugins', Record<never, never>, Record<never, never>>,
    '/processings/': RouteRecordInfo<'/processings/', '/processings', Record<never, never>, Record<never, never>>,
    '/processings/[id]': RouteRecordInfo<'/processings/[id]', '/processings/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
    '/processings/new': RouteRecordInfo<'/processings/new', '/processings/new', Record<never, never>, Record<never, never>>,
    '/runs/[id]': RouteRecordInfo<'/runs/[id]', '/runs/:id', { id: ParamValue<true> }, { id: ParamValue<false> }>,
  }
}
