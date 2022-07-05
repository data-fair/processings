# data-fair/processings

Periodically import / export data between Data Fair and other services.

## Development

Run service and dependencies in dev mode:

```
npm run dev-deps
npm run dev-server
npm run dev-client
```

Test built nuxt distributable in dev:

```
# first set proxyNuxt to false in config/development.js
NODE_ENV=development npm run build
npm run dev-server
```

Run test suite:

```
npm run test
```

Test building the docker image:

```
docker build --network=host -t processings-dev .
// don't expect the following line to work fully, it will be missing service dependencies, etc.
docker run --network=host --env PORT=8081 processings-dev
```