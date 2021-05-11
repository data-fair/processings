FROM koumoul/webapp-base:1.12.2
MAINTAINER "contact@koumoul.com"

# allow for using native modules and unpacking various archive formats
RUN apk add --no-cache --update python make g++ unzip p7zip

ENV NODE_ENV production
WORKDIR /webapp

# install gdal mostly for using ogr2ogr
# cf https://github.com/appropriate/docker-postgis/pull/97/commits/9fbb21cf5866be05459a6a7794c329b40bdb1b37
RUN apk add --no-cache --virtual .build-deps cmake linux-headers boost-dev gmp gmp-dev mpfr-dev && \
    apk add --no-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/main libressl3.0-libcrypto && \
    apk add --no-cache --virtual .gdal-build-deps --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing gdal-dev && \
    apk add --no-cache --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing gdal proj && \
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
RUN test -f /usr/lib/libproj.so.15
RUN ln -s /usr/lib/libproj.so.15 /usr/lib/libproj.so

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

VOLUME /webapp/data
EXPOSE 8080

CMD ["node", "server"]
