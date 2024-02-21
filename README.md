# data-fair/processings

Periodically import / export data between Data Fair and other services.

## Development

Run service and dependencies in dev mode:

```sh
npm run dev-deps
npm run dev-api
npm run dev-ui
```

Or Run the zellij command :

*first time instructions*
```sh
curl https://sh.rustup.rs -sSf | sh
# choose 1
cargo install --locked zellij
# in processings
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install
```

```sh
npm run dev-zellij
```

Test built nuxt distributable in dev:

```sh
# first set proxyNuxt to false in config/development.js
NODE_ENV=development npm run build
npm run dev-api
```

Run test suite:

```sh
npm run test
```

Test building the docker image:

```sh
docker build --network=host -t processings-dev .
# don't expect the following line to work fully, it will be missing service dependencies, etc.
docker run --network=host --env PORT=8081 processings-dev
```

Tests the builds of the Docker images :

- Install act

```sh
brew install act
```

*if you don't have homebrew yet*
```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- Tests the builds individually

```sh
act workflow_dispatch -W '.github/workflows/test-build.yml' -j build-api
act workflow_dispatch -W '.github/workflows/test-build.yml' -j build-ui
act workflow_dispatch -W '.github/workflows/test-build.yml' -j build-worker
```
