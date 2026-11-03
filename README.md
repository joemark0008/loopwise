# Loopwise

> **Every result, followed through.**

Loopwise makes sure every ordered test and every actionable screening result becomes timely care, with a clear owner at
each step, safe AI help for doctors, and documented closure across providers. It is an entry to the Future Health
Digital Innovation Challenge (Population Health: _Closing the Screening-to-Care Loop_).

The design, scope and plan are in [docs/DESIGN.md](docs/DESIGN.md).

## What it does

- **Cases**: every order and actionable result is a case with a state machine, one accountable owner per step, SLAs and
  a full timeline, from the order to documented closure.
- **Wise**: the doctor's assistant. It finds patients, summarises results and drafts orders, referrals and messages as
  proposal cards. The doctor confirms every clinical action; the AI never acts on its own.
- **Cross-provider**: facilities (clinics, labs, imaging, hospitals, pharmacies) are tenants of one hub. Referrals are
  accepted or rejected, and the case follows the patient.
- **Patients**: calm, tiered messages in their language. The patient never learns bad news from a machine.
- **Governance**: deny-by-default access through care relationships, Postgres row-level security, and an append-only
  audit trail.

## Stack

| Layer          | Technology                                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| Runtime        | Node.js 22 (see `.nvmrc`), npm 11 workspaces, TypeScript                          |
| API            | NestJS 11 on Express, GraphQL code-first with `@nestjs/graphql` + Apollo Server 5 |
| Database       | PostgreSQL 16 with Prisma 7                                                       |
| Auth           | better-auth (email and password, sessions)                                        |
| Background job | pg-boss (SLA timers, escalations, reminders)                                      |
| AI             | Vercel AI SDK 6 (`ai`, `@ai-sdk/*` providers)                                     |
| Frontend       | React 19, Vite 7, TanStack Router, Mantine 9, CSS Modules                         |
| Data fetching  | Apollo Client 4 + GraphQL Code Generator                                          |
| Testing        | Vitest (unit and e2e), Playwright (browser)                                       |
| Deployment     | Docker (a single image: the API also serves the built frontend)                   |

Loopwise is built on [quarry](https://github.com/joemark0008/quarry): its agent, chat UI, auth, organizations and jobs.
The workspace packages keep quarry's `@quarry/*` names for now.

## Repository layout

| Path                               | Contents                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- |
| [`apps/api`](apps/api)             | NestJS API: GraphQL at `/graphql`, REST for auth, agent streaming and files |
| [`apps/frontend`](apps/frontend)   | React app                                                                   |
| [`apps/shared`](apps/shared)       | Types and helpers used by both apps                                         |
| [`apps/connector`](apps/connector) | Edge connector: HL7 v2 over MLLP in, HTTPS to the hub, local retry queue    |
| [`docs`](docs)                     | Design and frontend guidelines                                              |

## Local development

Requirements: Node.js **22.23.4** (`nvm use`), npm **11.10.1**, Docker with Docker Compose, and an API key for at least
one LLM provider.

```bash
nvm use
npm install
cp .env.example .env            # set BETTER_AUTH_SECRET (openssl rand -base64 32) and an LLM key
npm run db:up                   # Postgres 16 on localhost:5435, database `loopwise`
npm run db:deploy -w @quarry/api
npm run db:seed -w @quarry/api  # synthetic demo data; user test@test.test / test1234
```

Then, in two terminals:

```bash
npm run dev:api        # API on http://localhost:5006
npm run dev:frontend   # app on http://localhost:3000 (sends API calls to :5006)
```

Open http://localhost:3000 and log in. On an empty database (no seed) the app opens `/setup` instead: enter the setup
token printed by `dev:api` and create the first admin.

Other commands: `npm run dev:studio` (Prisma Studio), `npm run db:down` (stop Postgres), `npm run db:reset` (stop
Postgres and delete its data).

**Demo data is synthetic only.** Never load real patient data into a development or demo database.

## Production with Docker

```bash
cp .env.example .env   # BETTER_AUTH_SECRET (stable), BETTER_AUTH_URL (public URL), an LLM key
docker compose -f docker-compose.prod.yml up -d --build
```

The container applies pending migrations at start. Put a TLS reverse proxy in front of it, and create the first admin at
`/setup` with the token from `docker compose -f docker-compose.prod.yml logs quarry | grep "setup token"`.

## Edge connector

Each facility runs a small connector next to its LIS ([`apps/connector`](apps/connector/README.md)): it takes HL7 v2
over MLLP, queues each message in a local SQLite file, ACKs the LIS, and pushes the message to the hub with the
facility API key, retrying while the hub is unreachable. It can also deliver hub orders to the LIS.

```bash
HUB_URL=http://localhost:5006 FACILITY_KEY=<facility key> npm start -w @quarry/connector
npm run send-mllp -w @quarry/connector -- --port 2575   # a synthetic ORU^R01
```

## Development checks

```bash
npm run lint
npm test
npm run format:check
```

After you change the GraphQL schema, run `npm run codegen` to regenerate the frontend's typed operations.

## Acknowledgements

Loopwise builds on quarry, which builds on [nao](https://github.com/getnao/nao) by nao Labs, released under the Apache
License 2.0.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
