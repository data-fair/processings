##########################
# install root dev deps and build
FROM node:20.15.1-alpine3.20 AS builder

WORKDIR /app/
ADD /package.json .
ADD /package-lock.json .
ADD /ui/package.json ui/

RUN npm pkg set scripts.prepare="echo 'skip prepare'"
RUN npm -w ui --include-workspace-root ci --no-audit --no-fund
ADD /ui/ ui/
ADD /contract contract
ADD /shared shared
RUN npm run build-types-ui
RUN npm -w ui run build

##########################
# copy built app and assemble actual dist
FROM node:20.15.1-alpine3.20

LABEL org.opencontainers.image.authors="contact@koumoul.com"

ENV NODE_ENV production
ENV PORT 8080

WORKDIR /app/

COPY --from=builder /app/ui/.output /app/ui/.output

ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /app/ui

EXPOSE 8080

USER node

CMD ["node", "--max-http-header-size", "64000", ".output/server/index.mjs"]

