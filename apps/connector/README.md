# Loopwise edge connector

One small process per facility, next to its LIS (DESIGN.md §6.2, §11). It keeps the facility's systems as they are:

- **Results in.** Listens for HL7 v2 over MLLP, stores each message in a local SQLite queue, answers the LIS with a
  commit ACK, and pushes the message to the hub over HTTPS with the facility API key.
- **Orders out** (optional). Polls the hub outbox, hands each order to the LIS over MLLP, and posts the LIS ACK back.

No runtime dependencies: Node 22 runs the TypeScript sources directly, and the queue uses the built-in `node:sqlite`.

## Run it

```bash
HUB_URL=http://localhost:5006 FACILITY_KEY=<facility key> MLLP_PORT=2575 npm start -w @loopwise/connector
```

Send a synthetic ORU^R01 (HbA1c 8.2 %) to it and print the ACK:

```bash
npm run send-mllp -w @loopwise/connector -- --port 2575
```

`--count 5` sends five, `--value 5.1` changes the HbA1c, `--file message.hl7` sends your own (synthetic) message.
Check `http://localhost:8081/health`.

Docker (build from the repository root):

```bash
docker build -f apps/connector/Dockerfile -t loopwise-connector .
FACILITY_KEY=<facility key> docker compose -f apps/connector/docker-compose.example.yml up --build
```

Keep `/data` on a volume: it holds messages the hub has not acknowledged yet.

## Configuration

| Variable                                     | Default               | Meaning                                                                 |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `HUB_URL`                                    | required              | Hub base URL; use `https://` for anything but localhost                 |
| `FACILITY_KEY`                               | required              | Facility API key, sent as `Authorization: Bearer …`                     |
| `MLLP_PORT` / `MLLP_HOST`                    | `2575` / `0.0.0.0`    | MLLP listener for the LIS                                               |
| `QUEUE_PATH`                                 | `./data/connector.db` | SQLite queue file                                                       |
| `LIS_HOST` / `LIS_PORT`                      | unset / `2575`        | Where hub orders go; the outbox poller is off while `LIS_HOST` is unset |
| `OUTBOX_POLL_MS`                             | `5000`                | Outbox poll interval                                                    |
| `RETRY_BASE_MS` / `RETRY_MAX_MS`             | `1000` / `300000`     | Backoff for transient hub failures: doubles from base, capped at max    |
| `HUB_TIMEOUT_MS` / `LIS_TIMEOUT_MS`          | `15000`               | Request timeouts                                                        |
| `HEALTH_PORT`                                | `8081`                | `GET /health` (JSON; 503 when halted); `off` disables it                |
| `STATUS_LOG_MS`                              | `60000`               | Status log line interval (queue depth, last success); `0` disables it   |
| `LOG_LEVEL`                                  | `info`                | `debug`, `info`, `warn`, `error`                                        |
| `CONNECTOR_APPLICATION`/`CONNECTOR_FACILITY` | `LOOPWISE_CONNECTOR`  | MSH-3/MSH-4 on the AR sent back for input that has no MSH to answer     |

## How it behaves

| Event                                         | Connector does                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| LIS sends a message with MSH and MSH-10       | Commits it to the queue, then answers **AA**                                         |
| LIS sends text with no MSH (or no MSH-10)     | Answers **AR**; nothing is queued                                                    |
| The queue write fails (disk full, …)          | Answers **AE**: the LIS keeps the message and resends                                |
| Hub answers 200 with MSA AA                   | Marks it delivered and drops the body                                                |
| Hub answers AE/AR, or a 4xx (not 401/408/429) | Marks it **failed** and keeps it with its body for review; never retried             |
| Hub down, timeout, 408, 429 or 5xx            | Retries with exponential backoff (capped); the hub dedupes by MSH-10                 |
| Hub answers 401/403                           | **Halts** all hub traffic, logs `connector.halted` with `alert: true`, `/health` 503 |

- **Why ACK after local storage, not after the hub.** The connector is where messages wait while the hub is
  unreachable (DESIGN.md §6.3). Waiting for the hub would make the LIS hold, resend or give up during every outage, and
  many LIS time out an ACK within seconds. Once the row is committed (SQLite WAL, `synchronous = FULL`) the connector
  owns the message.
- **Order.** Messages from one sender (MSH-3 + MSH-4) reach the hub in the order they arrived: only the oldest pending
  message of each sender is sent; later ones wait while it is in backoff. A failed message no longer blocks its sender.
- **While halted** the MLLP listener keeps accepting and queueing, so nothing is lost. Fix `FACILITY_KEY` and restart.
- **Orders out.** The LIS ACK is stored before it is posted to the hub; if that post fails, the next poll re-posts it
  without sending the order to the LIS twice. If the LIS is unreachable the poll stops and the order stays on the hub.
- **Logs** are JSON lines with control ids, row ids, message types, counts and statuses: never a message or ACK body.
- **Shutdown** (SIGINT/SIGTERM): stop listening, let the send in progress finish, close the queue. A second signal
  exits at once.
- **Failed messages** stay in `inbound_message` with `status = 'failed'`, `last_error` and the hub ACK. Inspect them
  with `sqlite3 data/connector.db "select id, control_id, last_error from inbound_message where status = 'failed'"`;
  `MessageQueue.requeue(id)` puts one back.

On a seeded development database the hub accepts the synthetic dev key of Bohol Diagnostics,
`lw_dev_bohol_diagnostics_synthetic_key_0001` (dev only, see `.env.example`); org admins issue real keys with
`createFacilityKey`.

## Tests

`npm test -w @loopwise/connector`: framing, ACKs, the queue across a restart, the forwarder against a fake hub (500 then
200, 401, AE), the outbox poller against a fake hub and a fake LIS, and end to end over real TCP and HTTP.

`test/hub.integration.test.ts` runs against a real hub and is skipped unless `HUB_IT_URL` is set (`HUB_IT_KEY`
defaults to the dev key; `HUB_IT_OUTBOX=1` adds the outbox check).
