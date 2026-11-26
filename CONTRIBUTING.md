# Contribution guidelines

## Prerequisites

- A Javascript/Typescript IDE with [Vue.js](https://vuejs.org/) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) support.
- A recent [Docker](https://docs.docker.com/engine/install/) installation.
- [Node.js](https://nodejs.org/) v24.22.1 or later, the version in `.nvmrc`

## Install dependencies

```sh
npm ci
docker compose pull       # at first and then once in a while
```

## Start the development environment

```sh
npm run dev                            # core containers, then the api, the worker and the ui
npm run dev -- --profile events        # with an optional container (events, openapi-viewer, maildev)
```

`npm run dev` copies `dev/default.env` to `.env` the first time (fixed ports 5900-5914; `.env` overrides them
and is never overwritten), builds the types and the UI once, starts the containers, then the api, the worker and
the ui in the terminal. Ctrl+C stops them. The dev page is at `http://localhost:5900/processings/dev`, the process
logs in `dev/logs/`. `npm run dev-deps` starts only the containers; `npm run dev:api`, `dev:worker` and `dev:ui`
run one process each, with the variables of `.env` exported.

## Stop the development environment

Ctrl+C, then:

```sh
npm run stop-dev-deps
```

## Working on types

Update the types based on schemas :

```sh
npm run build-types
```

## Building and running the Docker images

Build the images :

```sh
docker build --progress=plain --target=main -t data-fair/processings:dev .
docker build --progress=plain --target=worker -t data-fair/processings/worker:dev .
```

## Running the tests

The test suite runs against the running dev environment (`npm run dev`):

```sh
npm run test
```
