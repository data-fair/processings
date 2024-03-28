############################################################
# Stage: install libraries for geographic data manipulations
FROM node:20.11.1-alpine3.19 AS geodeps

RUN apk add --no-cache curl cmake make g++ linux-headers
RUN apk add --no-cache boost-dev gmp gmp-dev mpfr-dev

# build CGAL (not yet present in alpine repos)
WORKDIR /tmp/

RUN curl -L https://github.com/CGAL/cgal/releases/download/releases%2FCGAL-4.14.3/CGAL-4.14.3.tar.xz -o cgal.tar.xz
RUN tar -xf cgal.tar.xz

WORKDIR /tmp/CGAL-4.14.3/

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
# Stage: install root dev deps and build types
FROM nativedeps AS builder

RUN npm i -g clean-modules@3.0.4

WORKDIR /app/
ADD /package.json .
ADD /package-lock.json .
ADD /worker/package.json worker/

RUN npm -w worker --include-workspace-root ci --no-audit --no-fund

ADD /contract contract
ADD /shared shared
ADD /worker worker
RUN npm run build-types-worker

##############################################
# copy deps and build and assemble actual dist
FROM node:20.11.1-alpine3.19
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app/

COPY --from=nativedeps /usr/lib/libproj.so /usr/lib/libproj.so
COPY --from=builder /app/contract /app/contract
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/worker /app/worker
COPY --from=builder /app/node_modules /app/node_modules

ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /app/worker

# USER node
# This would be great to use, but not possible as the volumes are mounted as root

CMD ["node", "index.js"]
