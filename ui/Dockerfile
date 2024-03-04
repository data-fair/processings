#################################
# install root dev deps and build
FROM node:20.11.1-alpine3.19 AS builder

WORKDIR /webapp/

ADD /package.json .
ADD /package-lock.json .
ADD /ui/package.json ui/

RUN npm i -g clean-modules@3.0.4
RUN npm -w ui --include-workspace-root ci --no-audit --no-fund && \
    clean-modules --yes

ADD /ui/ ui/
ADD /contract/ contract/

ENV NODE_ENV production

RUN npm -w ui run build

############################################
# copy built webapp and assemble actual dist
FROM node:20.11.1-alpine3.19
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ENV NODE_ENV production
ENV PORT 3039

WORKDIR /webapp/

COPY --from=builder /webapp/ui/node_modules ui/node_modules/
COPY --from=builder /webapp/ui/.output ui/.output/
COPY --from=builder /webapp/ui/nuxt-dist ui/nuxt-dist/

ADD /ui/nuxt.config.js ui/
ADD /contract/ contract/
ADD /README.md .
ADD /package.json .
ADD /LICENSE .

WORKDIR /webapp/ui

EXPOSE 3039

USER node

CMD ["node", "--max-http-header-size", "64000", "PORT=3039 node /webapp/ui/.output/server/index.mjs"]
