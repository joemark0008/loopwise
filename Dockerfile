# Loopwise: apps/api serving the built frontend. Build: `docker build -t loopwise .`; run with docker-compose.prod.yml.
# apps/api runs from its TypeScript sources through @swc-node/register (as in development), so the image keeps
# the dev dependencies; the frontend is built once, at image build time.
FROM node:22.23.4-bookworm-slim AS base

# fonts: chart PNG downloads (resvg).
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl fonts-liberation fonts-noto-color-emoji \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm install -g npm@11.10.1

ENV HUSKY=0
WORKDIR /app

FROM base AS build

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/frontend/package.json apps/frontend/
COPY apps/shared/package.json apps/shared/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
# `prisma generate` (apps/api postinstall) reads DATABASE_URL from prisma.config.ts but never connects.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci --no-audit --no-fund

COPY . .
RUN npm run build -w @loopwise/frontend

FROM base AS runtime

COPY --from=build /app /app

ENV NODE_ENV=production \
	MODE=prod \
	PORT=5006 \
	LOOPWISE_FRONTEND_DIST=/app/apps/frontend/dist \
	LOOPWISE_CLINICS_DIR=/data/clinics \
	LOOPWISE_STORAGE_LOCAL_PATH=/data/storage

VOLUME /data
EXPOSE 5006

# Applies pending Prisma migrations, then starts the API (which serves the frontend).
CMD ["sh", "-c", "npm run db:deploy -w @loopwise/api && exec npm run start -w @loopwise/api"]
