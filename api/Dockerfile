#################################
# install root dev deps and build
FROM node:20.11.1-alpine3.19 AS builder

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .

RUN npm ci --workspaces=false --no-audit --no-fund --omit=optional

ADD /scripts/ scripts/
ADD /upgrade/ upgrade/
ADD /api/ api/

##########################
# install api prod deps
FROM node:20.11.1-alpine3.19 AS installer

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .
ADD /api/package.json api/
ADD /api/nodemon.json api/

RUN npm pkg set scripts.prepare="echo 'skip prepare'"
RUN npm i -g clean-modules@3.0.4
RUN npm ci -w api --no-audit --no-fund --omit=optional --omit=dev &&\
    clean-modules --yes

##########################
# copy deps and build and assemble actual dist
FROM node:20.11.1-alpine3.19
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ENV NODE_ENV production

WORKDIR /app/

COPY --from=builder /app/scripts/ scripts/
COPY --from=builder /app/api api/
COPY --from=builder /app/upgrade upgrade/
COPY --from=installer /app/node_modules node_modules/

ADD /api/ api/
ADD /dev/ dev/
ADD /contract/ contract/
ADD /scripts/ scripts/
ADD /README.md .
ADD /package.json .
ADD /LICENSE .

WORKDIR /app/api

EXPOSE 8080 8081 8082 8088

USER node

CMD ["node", "--max-http-header-size", "64000", "index.js"]

