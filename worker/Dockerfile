############################################################
# Stage: install libraries for geographic data manipulations
FROM node:20.11.1-alpine3.19 AS geodeps

RUN apk add --no-cache curl cmake make g++ linux-headers
RUN apk add --no-cache boost-dev gmp gmp-dev mpfr-dev

# build CGAL (not yet present in alpine repos)
WORKDIR /tmp
RUN curl -L https://github.com/CGAL/cgal/releases/download/releases%2FCGAL-4.14.3/CGAL-4.14.3.tar.xz -o cgal.tar.xz
RUN tar -xf cgal.tar.xz
WORKDIR /tmp/CGAL-4.14.3
RUN cmake -D CMAKE_BUILD_TYPE=Release .
RUN make
RUN make install

############################################################################################################
# Stage: prepare a base image with all native utils pre-installed, used both by builder and definitive image

FROM node:20.11.1-alpine3.19 AS nativedeps

COPY --from=geodeps /usr/local/lib/libCGAL.so.13 /usr/local/lib/libCGAL.so.13

# some of these are also geodeps, but we need to install them here as they pull many dependencies
RUN apk add --no-cache unzip p7zip dumb-init gmp gdal-tools proj
RUN test -f /usr/bin/ogr2ogr
RUN ln -s /usr/lib/libproj.so.25 /usr/lib/libproj.so
RUN test -f /usr/lib/libproj.so

# processing plugins should be able to install native dependencies themselves
RUN apk add --no-cache python3 make g++

######################################
# Stage: nodejs dependencies and build
FROM nativedeps AS builder

WORKDIR /worker

ADD package.json .
ADD package-lock.json .
RUN npm ci --workspaces=false --no-audit --no-fund --omit=optional

ADD /worker/ /worker/
ADD /contract/ /contract/

##########################
# install worker prod deps
FROM node:20.11.1-alpine3.19 AS installer

WORKDIR /worker/

ADD package.json .
ADD package-lock.json .
ADD /worker/package.json worker/
RUN npm pkg set scripts.prepare="echo 'skip prepare'"
RUN npm ci -w worker --no-audit --no-fund --omit=optional --omit=dev &&\
    clean-modules --yes

# check that we don't have deps in local node_modules (sign of deps that couldn't be deduped)
RUN test ! -d worker/node_modules

##############################################
# copy deps and build and assemble actual dist
FROM node:20.11.1-alpine3.19
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ENV NODE_ENV production

WORKDIR /worker/

COPY --from=builder /worker/worker /worker/worker
COPY --from=nativedeps /usr/lib/libproj.so /usr/lib/libproj.so
COPY --from=installer /worker/node_modules /worker/node_modules

ADD /contract/ /contract/
ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /worker/worker

USER node

CMD ["node", "worker/index.mjs"]
