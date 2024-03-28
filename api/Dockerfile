#################################
# install root dev deps and build types
FROM node:20.11.1-alpine3.19 AS builder

RUN npm i -g clean-modules@3.0.4

WORKDIR /app/
ADD /package.json .
ADD /package-lock.json .
ADD /api/package.json api/

RUN npm -w api --include-workspace-root ci --no-audit --no-fund

ADD /api api
ADD /contract contract
ADD /shared shared
ADD /upgrade upgrade
RUN npm run build-types-api

##########################
# copy deps and build and assemble actual dist
FROM node:20.11.1-alpine3.19
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app/

COPY --from=builder /app/upgrade /app/upgrade
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/contract /app/contract
COPY --from=builder /app/api /app/api
COPY --from=builder /app/node_modules /app/node_modules

ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /app/api

EXPOSE 8080

# USER node
# This would be great to use, but not possible as the volumes are mounted as root

CMD ["node", "--max-http-header-size", "64000", "index.js"]
