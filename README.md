# Loopwise

> **Run the whole clinic, with an assistant that drafts and a clinician who decides.**

Loopwise is an AI-powered clinic system for Philippine outpatient clinics: front desk, nurse, doctor, lab, pharmacy,
cashier and the patient, with **Wise** (the AI assistant) drafting the work at every desk and a person confirming it.

The product and plan are in [docs/PLAN.md](docs/PLAN.md), the technical design in [docs/DESIGN.md](docs/DESIGN.md),
and the current state in [docs/NEXT.md](docs/NEXT.md).

## What it does

- **Patients and visits**: registration with duplicate checks and consent, the patient chart, SOAP notes, vitals,
  ICD-10 diagnoses, allergies, prescriptions, medical certificates, referrals and invoices (SC/PWD discounts, BIR
  invoice series, payments), with print views. The data model follows a Philippine clinic reference schema
  ([docs/schema-reference/](docs/schema-reference/clinic-prisma-schema/)).
- **Wise**: drafts registrations, notes, orders, prescriptions, certificates, charges and reviews as proposal cards;
  summarises results, charts trends, answers analytics questions and writes reports. A person confirms every change; the
  AI never acts on its own.
- **In-house lab and results**: a test catalog, orders, a lab worklist where results are entered and released, and a
  results inbox for the doctor (abnormal and critical flags first).
- **Coming next**: appointments and queue, an AI scribe, pharmacy and inventory, follow-up reminders, and a patient
  portal with reminders ([docs/PLAN.md](docs/PLAN.md) §6).
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
| Frontend       | React 19, Vite 7, TanStack Router, shadcn/ui (Radix, Tailwind v4), CSS Modules    |
| Data fetching  | Apollo Client 4 + GraphQL Code Generator                                          |
| Testing        | Vitest (unit and e2e), Playwright (browser)                                       |
| Deployment     | Docker (a single image: the API also serves the built frontend)                   |

## Repository layout

| Path                             | Contents                                                                    |
| -------------------------------- | --------------------------------------------------------------------------- |
| [`apps/api`](apps/api)           | NestJS API: GraphQL at `/graphql`, REST for auth, agent streaming and files |
| [`apps/frontend`](apps/frontend) | React app                                                                   |
| [`apps/shared`](apps/shared)     | Types and helpers used by both apps                                         |
| [`docs`](docs)                   | Plan, design, handoff and frontend guidelines                               |

## Local development

Requirements: Node.js **22.23.4** (`nvm use`), npm **11.10.1**, Docker with Docker Compose, and an API key for at least
one LLM provider.

```bash
nvm use
npm install
cp .env.example .env            # set BETTER_AUTH_SECRET (openssl rand -base64 32) and an LLM key
npm run db:up                   # Postgres 16 on localhost:5435, database `loopwise`
npm run db:deploy -w @loopwise/api
npm run db:seed -w @loopwise/api  # synthetic demo data; user test@test.test / test1234
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
`/setup` with the token from `docker compose -f docker-compose.prod.yml logs loopwise | grep "setup token"`.

## Development checks

```bash
npm run lint
npm test
npm run format:check
```

After you change the GraphQL schema, run `npm run codegen` to regenerate the frontend's typed operations.

## Acknowledgements

Loopwise includes code from other Apache-2.0 projects, among them [nao](https://github.com/getnao/nao) by nao Labs.
They are credited in [NOTICE](NOTICE).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
