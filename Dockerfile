# =============================
# Base Node image
# =============================
FROM node:22.14.0-alpine AS base

WORKDIR /app
ENV NODE_ENV=production

# =============================
# Package preparation (stripping version for caching)
# =============================
FROM base AS package-strip

RUN apk add --no-cache jq moreutils
ADD package.json package-lock.json ./
# remove version from manifest for better caching when building a release
RUN jq '.version="build"' package.json | sponge package.json
RUN jq '.version="build"' package-lock.json | sponge package-lock.json

# =============================
# Full dependencies installation (for types and building)
# =============================
FROM base AS installer

RUN apk add --no-cache python3 make g++ git jq moreutils
RUN npm i -g clean-modules@3.0.4
COPY --from=package-strip /app/package.json package.json
COPY --from=package-strip /app/package-lock.json package-lock.json
COPY ui/package.json ui/package.json
COPY api/package.json api/package.json
COPY worker/package.json worker/package.json
# full deps install used for types and ui building
# also used to fill the npm cache for faster install api and worker deps
RUN npm ci --omit=dev --omit=optional --omit=peer --no-audit --no-fund

# =============================
# Build Types for API and Worker
# =============================
FROM installer AS types

COPY api/types api/types
COPY api/doc api/doc
COPY api/config api/config
COPY worker/config worker/config
RUN npm run build-types

# =============================
# Build UI with Vite
# =============================
FROM installer AS ui

RUN npm i --no-save @rollup/rollup-linux-x64-musl
COPY --from=types /app/api/config api/config
COPY --from=types /app/api/types api/types
ADD /api/src/config.ts api/src/config.ts
ADD /ui ui
RUN npm -w ui run build

# =============================
# Install production dependencies for Worker
# =============================
FROM installer AS worker-installer

RUN npm ci -w worker --prefer-offline --omit=dev --omit=optional --omit=peer --no-audit --no-fund && \
    npx clean-modules --yes
RUN mkdir -p /app/worker/node_modules
RUN mkdir -p /app/shared/node_modules

# install tippecanoe for some processings
WORKDIR /tmp/
RUN apk add --no-cache curl cmake make g++
RUN apk add git zlib-dev sqlite-dev bash
RUN git clone https://github.com/mapbox/tippecanoe.git
WORKDIR /tmp/tippecanoe
RUN git checkout 1.36.0
RUN make -j
RUN make install
RUN test -f /usr/local/bin/tippecanoe

# =============================
# Final Worker Image
# =============================
FROM base AS worker

COPY --from=worker-installer /app/node_modules node_modules
COPY worker worker
COPY shared shared
COPY upgrade upgrade
COPY --from=types /app/worker/config worker/config
COPY --from=types /app/api/types api/types
COPY --from=worker-installer /app/worker/node_modules worker/node_modules
COPY --from=worker-installer /app/shared/node_modules shared/node_modules
COPY package.json README.md LICENSE BUILD.json* ./

# install gdal for ogr2ogr
RUN apk add --no-cache gmp gdal-tools
RUN test -f /usr/bin/ogr2ogr
RUN ln -s /usr/lib/libproj.so.25 /usr/lib/libproj.so
RUN test -f /usr/lib/libproj.so
# add tippecanoe
COPY --from=worker-installer /usr/local/bin/tippecanoe /usr/local/bin/tippecanoe

EXPOSE 9090
# USER node # This would be great to use, but not possible as the volumes are mounted as root
WORKDIR /app/worker
CMD ["node", "--experimental-strip-types", "index.ts"]

# =============================
# Install production dependencies for API
# =============================
FROM installer AS api-installer

# remove other workspaces and reinstall, otherwise we can get rig have some peer dependencies from other workspaces
RUN npm ci -w api --prefer-offline --omit=dev --omit=optional --omit=peer --no-audit --no-fund && \
    npx clean-modules --yes
RUN mkdir -p /app/api/node_modules
RUN mkdir -p /app/shared/node_modules

# =============================
# Final API Image
# =============================
FROM base AS main

COPY --from=api-installer /app/node_modules node_modules
COPY api api
COPY shared shared
COPY --from=types /app/api/types api/types
COPY --from=types /app/api/doc api/doc
COPY --from=types /app/api/config api/config
COPY --from=api-installer /app/api/node_modules api/node_modules
COPY --from=api-installer /app/shared/node_modules shared/node_modules
COPY --from=ui /app/ui/dist ui/dist
COPY package.json README.md LICENSE BUILD.json* ./
# artificially create a dependency to "worker" target for better caching in github ci
COPY --from=worker /app/package.json package.json
EXPOSE 8080
EXPOSE 9090
# USER node # This would be great to use, but not possible as the volumes are mounted as root
WORKDIR /app/api
CMD ["node", "--max-http-header-size", "65536", "--experimental-strip-types", "index.ts"]
