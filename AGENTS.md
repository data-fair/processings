# Data Fair Processings — Agent Guidelines

## Project Overview

`@data-fair/processings` is a sister service of `data-fair`. It runs scheduled and on-demand
processings (NPM-installable plugins) that ingest, transform and publish datasets into a
running `data-fair` instance. The project is a monorepo with four workspaces:

- `api/` — Express REST API
- `worker/` — Polling worker that runs the processings tasks in child processes
- `ui/` — Vue 3 + Vuetify SPA (built with Vite)
- `shared/` — TypeScript types and helpers shared between api, worker and ui

## Dev environment

Docker runs the containers (nginx, simple-directory, data-fair, registry, elasticsearch, mongo; optional profiles
`events`, `openapi-viewer` and `maildev`); the api, the worker and the ui run as node processes.

- `npm run dev` — the containers (`npm run dev-deps`), then the api, the worker and the ui in the terminal (Ctrl+C
  stops them), at `http://localhost:5900/processings/dev`. Their logs are in `dev/logs/` (`DEV_LOG_DIR`,
  `DEV_LOG_PREFIX`); `npm run dev` accepts docker compose arguments (`npm run dev -- --profile events`).
- `npm run dev-deps` — the containers only, plus `npm run dev-setup`.
- `npm run dev-setup` — idempotent builds (types, ui), no container.
- `npm run dev:api`, `dev:worker`, `dev:ui` — one process each, with the variables of `.env` exported.
- `npm run stop-dev-deps` — stops the containers.

Default ports (5900-5914) are in `dev/default.env`, copied to `.env` the first time: `.env` overrides it and is
never overwritten. Production names (`MONGO_URL`, `PRIVATE_DIRECTORY_URL`, `PRIVATE_REGISTRY_URL`,
`DATA_FAIR_URL`, `PRIVATE_DATA_FAIR_URL`, `DATA_FAIR_API_KEY`...) override `api/config/development.mjs` and
`worker/config/development.mjs`. Optional containers: `events` (notifications; without it the api and the worker
log a failure per pushed event, an empty `EVENTS_PORT` turns the integration off), `openapi-viewer` (API docs) and
`maildev` (catches the mails of simple-directory and of the worker's transport, plugins' `sendMail`).

- Read the logs before restarting: nodemon (api, worker) and vite (ui) already reload on file changes.
- Do not start, stop or restart the dev processes or containers of the user: ask.
- Never `npm ci` / `npm install` while the env runs.
- If a service is down, do not try to fix the infrastructure: read its logs (`dev/logs/`, or
  `docker compose logs <service>` for a container) and report the problem to the user with the relevant lines.

The dev environment also serves as the test environment: the Playwright test suite hits the
running dev API, dev worker and dev UI. There is no separate test server.
Design specs and implementation plans are not kept in this repository; durable architecture docs live in `docs/architecture/`.

### Test sub-space

The tests own the simple-directory accounts whose ids start with `test_processings_`
(@tests/support/sd-fixtures.ts: `test_processings_superadmin`, a simple-directory admin, `test_processings_org1`
with its admin, contributor, users, department admin and scope NHI, `test_processings_org2`, a partner of org1, and
the `alone` and `outsider` accounts; password `passwd`, email `<id>@test.com`). `tests/global-setup.ts` upserts
them through simple-directory's test API before the spec files load, and `tests/state-setup.ts`, under a lock
against a second concurrent run, cleans and seeds them again, cleans the sub-space here and sets up the worker's
data-fair key (below). The dev world `test_demo_` (`npm run dev-world`, run by `dev-deps`,
@dev/resources/demo-world.json, login `test_demo_dev@example.org` / `passwd`, a simple-directory admin) is never
cleaned by the tests.

Everything a test creates belongs to the sub-space: owners under `test_processings_`, and the fixture plugins'
registry artefacts `@test_processings_…` (`tests/support/registry.ts`, uploaded with the registry's internal
secret on its private URL). The suite never cleans anything in the registry: a fixture upload replaces the
previous one, and registry's own prefixed clean removes them.

**The worker's data-fair key.** The worker runs the plugins, whose data-fair requests carry an API key in admin
mode acting as the processing's owner (`x-account`). `tests/support/data-fair.ts` creates it through data-fair's
API, as `test_processings_superadmin` in admin mode on its own settings, and hands it to the worker through
`PUT /api/v1/test-env/data-fair-api-key`: in development, without `DATA_FAIR_API_KEY`, the worker reads it from
its database before each run and gives it to the run's process (`worker/src/utils/data-fair-api-key.ts`). The
tests never write into another service's database. For manual work, run the tests once, or set
`DATA_FAIR_API_KEY` in `.env` (an admin mode key with `asAccount`, created in data-fair by a super admin).

### Test-env API

When `NODE_ENV=development` the API exposes `/api/v1/test-env`:
- `DELETE /?prefix=test_<suite>_` — delete the processings, runs and limits of the accounts of that prefix, and
  the worker locks of those processings; 400 without a valid prefix, 204 after the clean. Several suites can share
  one processings service: the clean of one prefix never touches another one
  (`tests/features/test-env/test-env.api.spec.ts`)
- `GET /pending-tasks?prefix=test_<suite>_` — the runs of that prefix in `triggered`/`scheduled`/`running` status
- `GET /raw-processing/:id`, `PATCH /raw-processing/:id`, `GET /raw-run/:id`, `POST /docs/:collection`,
  `GET /docs/:collection/:id` — raw mongo docs
- `PUT /data-fair-api-key` — the worker's data-fair key (above)
- `POST /set-env`, `POST /set-config` — runtime overrides of the whole API process, for testing: they answer only
  a direct call (not through the proxy) while this checkout's own test run holds its stateful lock
  (`dev/logs/stateful-tests.lock`), 403 otherwise
- `DELETE /plugins` — wipe the installed plugins directory

These endpoints are used by the Playwright support helpers in `tests/support/`.

### Testing

```bash
npm test                          # all tests (no --max-failures: one flake must not hide the rest)
npm run test-unit                 # unit tests only
npm run test-api                  # API tests only
npm run test-api-fast             # API tests, stop at the first failure (iteration)
npm run test-e2e                  # e2e tests only
npx playwright test path/to/file  # specific file
```

The run writes per-test durations to `dev/logs/test-timings.json`, and keeps a trace and a
screenshot of each failing test in `test-results/` (`npx playwright show-trace <zip>`).
Timeout: 30 s per test, hooks included; specs that run plugins through the worker call
`test.slow()` instead of raising it. `clean()` fails, naming the runs, when the worker is
still busy after 10 s: the culprit is the test that left them.

e2e specs log in through the simple-directory API (`tests/fixtures/login.ts`, one login per
user and worker, renewed after 10 min) and turn off lib-vue's keepalive with a future
`sd-keepalive` localStorage timestamp, so no page ever rotates the shared exchange token.

Tests are organized under `tests/features/<topic>/<name>.{unit,api,e2e}.spec.ts`.
The `state-setup` project pings `/api/v1/test-env/pending-tasks`, seeds the test sub-space and sets up the
data-fair API key of the worker. Pure logic goes to unit specs; api specs cover the HTTP contract and the
worker; e2e specs only cover user flows and what only a browser can check.

The `e2e` project depends on `e2e-warmup` (`tests/e2e-warmup.ts`), which walks the list
and edit routes once before the specs run, so a cold Vite transforms them first. Dependency
discovery is off: a blank page there with a module named in the console means a commonjs
dependency is missing from `optimizeDeps.include` in `ui/vite.config.ts` (use the exact import
specifier). Running an e2e spec alone still goes through the warmup.

When iterating on changes always run only the related test cases.

Quality gates:

| When | Where | What |
|---|---|---|
| commit | `.husky/pre-commit` | `npm run lint` |
| push | `.husky/pre-push` → `dev/pre-push.sh` | type check, all unit tests, the `@smoke` api/e2e set, and the api/e2e spec files changed since `origin/master` |
| pull request | `pull-requests.yml` → `reuse-quality.yml` | lint, builds, type check, audit, then the whole unit/api/e2e suite (1 retry) |
| release tag | `releases.yml` → `reuse-quality.yml` | the same, before building the images |

`npm run quality` still runs the whole gate locally. A test joins the `@smoke` set
(`test('...', { tag: '@smoke' }, ...)`) only if it is fast and covers a core flow (create,
permissions, run, edit form); check its duration in `dev/logs/test-timings.json`.

### Linting & Type Checking

```bash
npm run lint             # ESLint (root + ui workspace)
npm run lint-fix         # auto-fix
npm run check-types      # TypeScript
```

### Building

```bash
npm run build-types      # generate type definitions for shared schemas
npm -w ui run build      # build the Vue SPA
```

## Logging

Server code (`api/`, the worker's parent process, `shared/`) logs through
`import log from '@data-fair/lib-node/log.js'` (pino: JSON on stdout in production, pretty in dev); the
full API is in the "Logging" section of the `@data-fair/lib-node` README. eslint `no-console` enforces it.

- `log.info|warn|alert|error(msg, { code?, err?, ...fields })`: `code` is a **static string**, ids go in their
  own fields, the error in `err`, never in the message.
- `error` is for internal failures only (counted in `df_logs`, alerting). A plugin that fails, or a run
  killed for its memory, is `warn`.
- The actor of a request comes from `session.middleware()`'s log context, never passed by hand. The worker
  runs each run in `withLogContext({ processingId, runId, ...ownerLogFields(owner) })`
  (`shared/log-fields.ts`, the owner* names of data-fair); plugin output is cut with `truncateLogValue`.
- The task child process (`worker/src/task/index.ts`, `task.ts`) keeps `console`: the parent reads its
  stdout (`<running>`, memory samples) and shows its stderr to the user. The parent relays the other lines
  as `task-stdout` / `task-stderr` log lines.
- `debug` call sites are unchanged, their output is redirected into the logger.
- Run logs shown in the UI (the `log` given to plugins) are a separate thing, stored on the run document.
