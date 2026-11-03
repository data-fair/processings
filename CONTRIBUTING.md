# Contribution guidelines

## Prerequisites

- A Javascript/Typescript IDE with [Vue.js](https://vuejs.org/) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) support.
- A recent [Docker](https://docs.docker.com/engine/install/) installation.
- [Node.js](https://nodejs.org/) v24.22.1 or later, the version in `.nvmrc`

## Install dependencies

```sh
npm ci
npx --no df-dev setup     # .env with free ports (kept if it exists, --force to redraw), types, UI build
docker compose pull       # at first and then once in a while
```

## Start the development environment

```sh
npm run dev-zellij                                        # core containers + ui, api, worker
npm run dev-zellij -- --services events,openapi-viewer    # with the optional containers
```

This opens a [zellij](https://zellij.dev/) (>= 0.44) session named after the checkout directory, or attaches to it if it runs. Start it from a shell on the `.nvmrc` Node version. The dev URL is in the footer. From another terminal: `npx --no df-dev status`, `npx --no df-dev logs <pane>`, `npx --no df-dev restart <pane>`, `npx --no df-dev up <service>`.

## Stop the development environment

Quit zellij, then:

```sh
npm run stop-dev-deps
```

## Worktrees

Each checkout has its own `.env` with random ports, so you can run multiple worktrees side by side :

```sh
npx --no df-worktree feat-xyz          # from the main checkout: ../processings_feat-xyz, installed and built
npx --no df-worktree-delete feat-xyz   # its containers, volumes and zellij session, then the worktree
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

Run the test suite :

```sh
npm run test
```
