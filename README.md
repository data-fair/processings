# data-fair/processings

Periodically import / export data between Data Fair and other services.

## Development

Run service and dependencies in dev mode:

```sh
npm run dev-deps
npm run dev-api
npm run dev-ui
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

Run the zellij command :

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
