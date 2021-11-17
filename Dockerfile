FROM node:16.13.0-alpine
MAINTAINER "contact@koumoul.com"

# allow for using native modules and unpacking various archive formats
RUN apk add --no-cache --update python3 make g++ unzip p7zip curl git

# Install node-prune to reduce size of node_modules
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin

ENV NODE_ENV production
WORKDIR /webapp

# install gdal mostly for using ogr2ogr
# cf https://github.com/appropriate/docker-postgis/pull/97/commits/9fbb21cf5866be05459a6a7794c329b40bdb1b37
ENV CMAKE_BUILD_TYPE TRUE
RUN apk add --no-cache --virtual .build-deps cmake linux-headers boost-dev gmp gmp-dev mpfr-dev && \
    apk add --no-cache libressl3.1-libcrypto && \
    apk add --no-cache --virtual .gdal-build-deps --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing gdal-dev && \
    apk add --no-cache gdal proj && \
    curl -L https://github.com/CGAL/cgal/releases/download/releases%2FCGAL-4.12/CGAL-4.12.tar.xz -o cgal.tar.xz && \
    tar -xf cgal.tar.xz && \
    rm cgal.tar.xz && \
    cd CGAL-4.12 && \
    cmake . && \
    make && \
    make install && \
    cd .. && \
    rm -rf CGAL-4.12 && \
    apk del .build-deps .gdal-build-deps
RUN test -f /usr/lib/libproj.so.20
RUN ln -s /usr/lib/libproj.so.20 /usr/lib/libproj.so

ADD package.json .
ADD package-lock.json .
RUN npm install --production && node-prune

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

# Processings data is persisted in a volume
VOLUME /webapp/data

# Default port of our webapps
EXPOSE 8080

# Check the HTTP server is started as health indicator
HEALTHCHECK --start-period=4m --interval=10s --timeout=3s CMD curl -f http://localhost:8080/ || exit 1

CMD ["node", "server"]
