# Plugin isolation

Plugin code runs in two places, with different exposure to a plugin's own bugs:

- The worker runs each run in a child process (`worker/src/task/`): an uncaught error or an unhandled `'error'`
  event raised by a plugin kills that run only.
- The API imports the plugin and calls its `prepare` hook in its own process, on every save
  (`prepareProcessing` in `api/src/processings/router.ts`). Nothing guards that call: an uncaught exception
  thrown asynchronously by the plugin or one of its dependencies (a socket's unhandled `'error'` event, for
  example) crashes the whole API, not only the request.

catalogs faced the same exposure and wraps each plugin call in a guard
([shared/plugin-guard.ts](https://github.com/data-fair/catalogs/blob/master/shared/plugin-guard.ts)): the call
runs in an `AsyncLocalStorage` context, an uncaught error raised inside it is logged and fails that call while
the process keeps running, repeated errors from the same plugin exit the process, and API calls get a timeout.
Porting it to the `prepare` call would close this gap.
