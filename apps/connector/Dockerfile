# Loopwise edge connector: one per facility, next to its LIS. Build from the repository root:
#   docker build -f apps/connector/Dockerfile -t loopwise-connector .
# No dependencies at runtime: Node runs the TypeScript sources directly (type stripping) and the queue is the built-in
# node:sqlite, so the image holds only Node and apps/connector/src.
FROM node:22.23.4-bookworm-slim

ENV NODE_ENV=production \
	MLLP_PORT=2575 \
	HEALTH_PORT=8081 \
	QUEUE_PATH=/data/connector.db

WORKDIR /app
COPY apps/connector/package.json ./
COPY apps/connector/src ./src
COPY apps/connector/scripts ./scripts

RUN mkdir -p /data && chown node:node /data
USER node

# The queue holds messages the hub has not acknowledged yet: keep it on a volume.
VOLUME /data
EXPOSE 2575 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||8081)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# exec form: node gets SIGTERM directly and drains before exiting.
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
