#################################
# install root dev deps and build types
FROM node:20.15.1-alpine3.20 AS builder

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .
RUN npm ci --workspaces=false --no-audit --no-fund --omit=optional

ADD shared shared
ADD api api
RUN npm run build-types-api

##########################
# install api prod deps
FROM node:20.15.1-alpine3.20 AS installer

RUN npm i -g clean-modules@3.0.5

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .
ADD /api/package.json api/
RUN npm pkg set scripts.prepare="echo 'skip prepare'"
RUN npm -w api --include-workspace-root ci --no-audit --no-fund --omit=optional --omit=dev &&\
    clean-modules --yes
# it might not exist, depending on the dependencies versions
RUN mkdir -p /app/api/node_modules

##########################
# copy deps and build and assemble actual dist
FROM node:20.15.1-alpine3.20
LABEL org.opencontainers.image.authors="contact@koumoul.com"

# processing plugins should be able to install native dependencies themselves
RUN apk add --no-cache python3 make g++

ENV NODE_ENV production

WORKDIR /app/

COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/api /app/api
COPY --from=installer /app/node_modules /app/node_modules
COPY --from=installer /app/api/node_modules /app/api/node_modules

ADD contract contract
ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /app/api

EXPOSE 8080

# USER node
# This would be great to use, but not possible as the volumes are mounted as root

CMD ["node", "--max-http-header-size", "64000", "index.js"]
