FROM koumoul/webapp-base:1.10.2
MAINTAINER "contact@koumoul.com"

RUN apk add --no-cache --update python make g++ unzip

ARG VERSION
ENV VERSION=$VERSION
ENV DEBUG nuxt-build-cache
ENV NODE_ENV production
WORKDIR /webapp
ADD package.json .
ADD package-lock.json .
RUN npm install --production

ADD config config
ADD sources sources

# Adding UI
ADD nuxt.config.js .
ADD nodemon.json .
ADD public public
ADD contract contract
RUN npm run build

# Adding server files
ADD server server
ADD upgrade upgrade

ADD README.md .

VOLUME /webapp/data
EXPOSE 8080

CMD ["node", "server"]
