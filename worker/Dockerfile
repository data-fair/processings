####################################################################
# Stage: build libraries and tools for geographic data manipulations
FROM node:20.15.1-alpine3.20 AS nativedepsbuilder

# build CGAL (not yet present in alpine repos)
RUN apk add --no-cache curl cmake make g++ linux-headers boost-dev gmp gmp-dev mpfr-dev
WORKDIR /tmp/
RUN curl -L https://github.com/CGAL/cgal/releases/download/releases%2FCGAL-4.14.3/CGAL-4.14.3.tar.xz -o cgal.tar.xz
RUN tar -xf cgal.tar.xz
WORKDIR /tmp/CGAL-4.14.3/
RUN cmake -D CMAKE_BUILD_TYPE=Release .
RUN make
RUN make install
RUN test -f /usr/local/lib/libCGAL.so.13

# build tippecanoe from source
WORKDIR /tmp/
RUN apk add git zlib-dev sqlite-dev bash
RUN git clone https://github.com/felt/tippecanoe.git
WORKDIR /tmp/tippecanoe
RUN git checkout 2.57.0
RUN make -j
RUN make install
RUN test -f /usr/local/bin/tippecanoe

############################################################################################################
# Stage: prepare a base image with all native utils pre-installed, used both by builder and definitive image

FROM node:20.15.1-alpine3.20 AS nativedeps

COPY --from=nativedepsbuilder /usr/local/lib/libCGAL.so.13 /usr/local/lib/libCGAL.so.13
COPY --from=nativedepsbuilder /usr/local/bin/tippecanoe /usr/local/bin/tippecanoe
ENV TIPPECANOE_MAX_THREADS 1

RUN apk add --no-cache zip unzip p7zip dumb-init gmp gdal-tools proj
RUN test -f /usr/bin/ogr2ogr
RUN ln -s /usr/lib/libproj.so.25 /usr/lib/libproj.so
RUN test -f /usr/lib/libproj.so

#################################
# install root dev deps and build types
FROM nativedeps AS builder

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .
RUN npm ci --workspaces=false --no-audit --no-fund --omit=optional

ADD shared shared
ADD worker worker
RUN npm run build-types-worker

##########################
# install worker prod deps
FROM nativedeps AS installer

RUN npm i -g clean-modules@3.0.5

WORKDIR /app/

ADD /package.json .
ADD /package-lock.json .
ADD /worker/package.json worker/
RUN npm pkg set scripts.prepare="echo 'skip prepare'"
RUN npm -w worker --include-workspace-root ci --no-audit --no-fund --omit=optional --omit=dev &&\
    clean-modules --yes
# it might not exist, depending on the dependencies versions
RUN mkdir -p /app/worker/node_modules

##############################################
# copy deps and build and assemble actual dist
FROM nativedeps
LABEL org.opencontainers.image.authors="contact@koumoul.com"

ENV NODE_ENV=production
ENV DEBUG=upgrade*

WORKDIR /app/

COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/worker /app/worker
COPY --from=installer /app/node_modules /app/node_modules
COPY --from=installer /app/worker/node_modules /app/worker/node_modules

ADD upgrade upgrade
ADD contract contract
ADD README.md .
ADD package.json .
ADD LICENSE .

WORKDIR /app/worker

# USER node
# This would be great to use, but not possible as the volumes are mounted as root

CMD ["node", "index.js"]
