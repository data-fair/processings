############################################################
# Stage: install libraries for geographic data manipulations
FROM node:16.13.2-alpine3.14 AS geodeps

# build CGAL (not yet present in alpine repos)
WORKDIR /tmp
RUN apk add --no-cache --virtual .curl curl && \
    curl -L https://github.com/CGAL/cgal/releases/download/releases%2FCGAL-4.14/CGAL-4.14.tar.xz -o cgal.tar.xz && \
    apk del .curl && \
    tar -xf cgal.tar.xz && \
    rm cgal.tar.xz
WORKDIR /tmp/CGAL-4.14
RUN apk add --no-cache cmake make g++ gmp gmp-dev mpfr-dev boost-dev && \
    cmake -D CMAKE_BUILD_TYPE=Release . && \
    make && \
    make install

############################################################################################################
# Stage: prepare a base image with all native utils pre-installed, used both by builder and definitive image

FROM node:16.13.2-alpine3.14 AS nativedeps

COPY --from=geodeps /usr/local/lib/libCGAL.so.13 /usr/local/lib/libCGAL.so.13

# some of these are also geodeps, but we need to install them here as they pull many dependencies
RUN apk add --no-cache unzip p7zip dumb-init gmp gdal-tools proj && \
    test -f /usr/bin/ogr2ogr && \
    ln -s /usr/lib/libproj.so.21.1.2 /usr/lib/libproj.so && \
    test -f /usr/lib/libproj.so

# processing plugins should be able to install native dependencies themselves
RUN apk add --no-cache python3 make g++ && \
    ln -s /usr/bin/python3 /usr/bin/python

######################################
# Stage: nodejs dependencies and build
FROM nativedeps AS builder

WORKDIR /webapp
ADD package.json .
ADD package-lock.json .
# use clean-modules on the same line as npm ci to be lighter in the cache
RUN npm ci && \
    ./node_modules/.bin/clean-modules --yes --exclude exceljs/lib/doc/ --exclude mocha/lib/test.js --exclude "**/*.mustache"

# Adding UI files
ADD public public
ADD nuxt.config.js .
ADD config config
ADD contract contract

# Build UI
ENV NODE_ENV production
RUN npm run build && \
    rm -rf dist

# Adding server files
ADD server server
ADD upgrade upgrade
ADD scripts scripts

# Check quality
ADD .gitignore .gitignore
ADD test test
RUN npm run lint
RUN npm run test

# Cleanup /webapp/node_modules so it can be copied by next stage
RUN npm prune --production && \
    rm -rf node_modules/.cache

##################################
# Stage: main nodejs service stage
FROM nativedeps
MAINTAINER "contact@koumoul.com"

WORKDIR /webapp

# We could copy /webapp whole, but this is better for layering / efficient cache use
COPY --from=builder /webapp/node_modules /webapp/node_modules
COPY --from=builder /webapp/nuxt-dist /webapp/nuxt-dist
ADD nuxt.config.js nuxt.config.js
ADD server server
ADD upgrade upgrade
ADD scripts scripts
ADD config config
ADD contract contract

# Adding licence, manifests, etc.
ADD package.json .
ADD README.md BUILD.json* ./
ADD LICENSE .
ADD nodemon.json .

# configure node webapp environment
ENV NODE_ENV production
ENV DEBUG db,upgrade*
# the following line would be a good practice
# unfortunately it is a problem to activate now that the service was already deployed
# with volumes belonging to root
#USER node
VOLUME /webapp/data
EXPOSE 8080

CMD ["dumb-init", "node", "--max-http-header-size", "64000", "server"]
