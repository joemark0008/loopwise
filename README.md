<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/loopwise-logo-dark.svg">
    <img src="brand/svg/loopwise-logo-light.svg" alt="Loopwise" width="360">
  </picture>
</p>

<p align="center">
  <b>Run the whole clinic, with an assistant that drafts and a clinician who decides.</b><br>
  An open-source clinic management system powered by AI, for Philippine outpatient clinics.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-1F5FAE" alt="License: Apache-2.0"></a>
  <img src="https://img.shields.io/badge/status-pre--1.0-E8735A" alt="Status: pre-1.0">
</p>

**Loopwise is an open-source clinic management system powered by AI**, built for outpatient clinics in the
Philippines. It runs the whole patient visit in one place: booking and check-in, triage, the doctor's consult, lab
results, pharmacy and the bill. Its rules and paperwork follow local practice: BIR invoices, senior citizen and PWD
discounts, PRC and S2 licenses, PhilHealth and the Data Privacy Act.

At every desk, **Wise**, the built-in AI assistant, takes on the paperwork. It drafts the consult note from the
conversation, prepares prescriptions, orders, certificates and charges, summarises results and answers questions
about the clinic. Nothing is saved until a person reviews and confirms it: the AI drafts, the clinician decides.

Loopwise is free to use, modify and self-host under the Apache-2.0 license.

Each install is **self-hosted by one business** and serves any number of its **clinic locations**. Patients and
catalogs are shared across locations; visits, invoices, stock and document numbering stay with each clinic.

- [Features](#features)
- [Stack](#stack)
- [Development setup](#development-setup)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Features

### Front desk

- Patient registration with duplicate checks, data-privacy consent (RA 10173), IDs (OSCA, PWD, PhilHealth), contacts
  and allergies; one medical record number across all clinic locations
- Appointments by day or week per doctor, built from each doctor's schedule and leaves: book, reschedule, cancel,
  confirm, no-show
- Check-in for bookings and walk-ins, with a queue number and a priority lane (senior citizen, PWD, pregnant, with
  infant, emergency)
- The queue from triage to the doctor to the cashier, plus a full-screen waiting-room board that shows no names

### Nurse and doctor

- Triage and vitals; the doctor's own queue
- The patient chart and the visit page: SOAP note, vitals, ICD-10 diagnoses, lab results, billing and referrals
- Prescriptions (RA 6675 generic names, RA 9165 S2 for dangerous drugs) and medical certificates, with print views
- Referrals, internal or external, with an inbox, letters and responses
- A follow-up list showing visits that are overdue, due or coming soon, with one-click booking
- **AI scribe:** with the patient's recorded consent, dictate or type the consult. Wise drafts the SOAP note, vitals,
  diagnoses, prescription (checked against allergies), tests, certificate, follow-up and a patient summary, as separate
  cards the doctor confirms one by one. The audio is never kept.

### Lab

- In-house test catalog and orders
- A lab worklist: collect, enter results, release
- A results inbox for the doctor, with abnormal and critical values first

### Pharmacy and inventory

- Item master with lots and expiry dates, suppliers, receiving stock, a stock ledger and supplies used
- A dispense queue from issued prescriptions; dispensed medicines flow to the bill
- Alerts for low, expiring and expired stock

### Cashier

- Invoices loaded from the visit: consult fee, tests and dispensed medicines
- The BIR tax breakdown (VAT only for a VAT-registered business), senior citizen and PWD discounts, other discounts with
  an approver, and creditable withholding
- BIR invoice series (ATP or CAS, ranges, validity) and the printed sales invoice
- Split-tender payments on cashier shifts, with X and Z readings and cash counts
- Professional fees with expanded withholding tax, and a PF report

### Wise, the AI assistant

- **Drafts, never acts:** registrations, notes, orders, prescriptions, certificates, charges, appointments and
  referrals appear as proposal cards. Only a person's confirmation saves them.
- Answers questions about the clinic in chat, with read-only access limited to what the user may see: patients,
  queue, appointments, stock, billing, follow-ups
- Charts, summary reports and safe analytics queries (one read-only SQL statement, row-level security applied,
  audited)
- Reads attached files, including scanned PDFs (OCR, English and Filipino)
- Works with Anthropic, OpenAI, Google Gemini and Vertex AI, Mistral, OpenRouter, Amazon Bedrock, Azure OpenAI, a local
  Ollama model or any OpenAI-compatible endpoint, set per clinic

### Clinic setup and administration

- A first-run setup wizard, then any number of clinic locations
- Clinic profile: business TIN and VAT status, BIR branch code, DOH license, PhilHealth accreditation, PSGC address
- Practitioners: PRC, PTR, S2, PhilHealth PAN, e-signature, weekly hours, leaves and consult fees
- Services and prices per clinic, staff and desk roles, document numbering, and alerts for licenses about to expire
- Usage and cost tracking for the AI

### Security and privacy

- **Deny by default:** a user reaches a patient only through a care relationship or a desk role at the clinic of the
  visit, enforced by PostgreSQL row-level security
- **Audit everything:** every view and change is logged to an append-only audit trail, with the request id
- Synthetic demo data only; no real patient data in the repository

### Not built yet

Patient portal and SMS reminders (the reminder job exists, but nothing is sent yet), PhilHealth eClaims and
Konsulta, HMO letters of authorization and consolidated billing, refunds, and the break-glass emergency-access API. See
[docs/PLAN.md](docs/PLAN.md) and [docs/NEXT.md](docs/NEXT.md).

## Stack

| Layer           | Technology                                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| Runtime         | Node.js 22, npm 11 workspaces, TypeScript                                              |
| API             | NestJS 11 on Express; GraphQL code-first (`@nestjs/graphql`, Apollo Server 5)          |
| Database        | PostgreSQL 16 with Prisma 7; row-level security, triggers and an append-only audit     |
| Auth            | better-auth (email and password, sessions; optional Google sign-in)                    |
| Background jobs | pg-boss (reminders and timers, stored in Postgres)                                     |
| AI              | Vercel AI SDK 6 with provider packages; Tesseract.js for OCR                           |
| Frontend        | React 19, Vite 7, TanStack Router, shadcn/ui on Radix, Tailwind CSS v4, CSS Modules    |
| Data fetching   | Apollo Client 4 with GraphQL Code Generator                                            |
| Testing         | Vitest (unit and API end-to-end against Postgres), Playwright (browser, with axe a11y) |
| Deployment      | Docker: one image in which the API also serves the built frontend, plus Postgres       |

### Repository layout

| Path                             | Contents                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------- |
| [`apps/api`](apps/api)           | NestJS API: GraphQL at `/graphql`, REST for auth, AI streaming and file uploads |
| [`apps/frontend`](apps/frontend) | React app                                                                       |
| [`apps/shared`](apps/shared)     | Types and rules shared by both apps                                             |
| [`docs`](docs)                   | Product plan, technical design, handoff notes and design system                 |

## Development setup

### Requirements

- **Node.js 22.23.4** and **npm 11.10.1** (`nvm use` reads `.nvmrc`; npm is pinned by `packageManager`)
- **Docker** with Docker Compose for the database, or your own **PostgreSQL 16**
- An API key for at least one LLM provider (Anthropic, OpenAI, Gemini, Mistral, OpenRouter) or a local Ollama, for Wise

### 1. Install

```bash
git clone https://github.com/joemark0008/loopwise.git
cd loopwise
nvm use
npm install
cp .env.example .env
```

Then edit `.env`:

- `BETTER_AUTH_SECRET`: paste the output of `openssl rand -base64 32`. Without it, a new secret is made on every
  restart, which signs everyone out and changes the setup token.
- An LLM key such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. You can instead add one per clinic later, in Settings →
  AI and models.

The other values work as they are.

### 2. Start the database

```bash
npm run db:up                        # Postgres 16 in Docker, on localhost:5435, database `loopwise`
npm run db:deploy -w @loopwise/api   # create the tables (applies every migration)
```

**Using your own Postgres instead of Docker:** skip `db:up`, create an empty database, and point `DATABASE_URL` at it.
The user in `DATABASE_URL` needs permission to create roles (a superuser such as `postgres` is simplest), because the
migrations create the row-level security and read-only analytics roles. Run `db:deploy` as above.

### 3. Choose how to start

- **Demo data:** run `npm run db:seed -w @loopwise/api`. It loads a synthetic organization, clinics, staff and
  patients. Log in as `test@test.test` / `test1234` (admin and doctor).
- **A clean install:** skip the seed. On an empty database the app opens `/setup`. Enter the setup token printed by the
  API at startup and create the first admin account. Then open **Settings** and click **New clinic** in the sidebar to
  create your first clinic location (you become its admin); add more locations the same way.

### 4. Run

In two terminals:

```bash
npm run dev:api        # API on http://localhost:5006 (restarts on change)
npm run dev:frontend   # app on http://localhost:3000 (sends API calls to :5006)
```

Open http://localhost:3000.

### Everyday commands

| Command                                | What it does                                                          |
| -------------------------------------- | --------------------------------------------------------------------- |
| `npm run db:deploy -w @loopwise/api`   | Apply new migrations (after a pull, or against a new database)        |
| `npm run db:migrate -w @loopwise/api`  | Create a migration after you change `apps/api/prisma/schema/*.prisma` |
| `npm run db:seed -w @loopwise/api`     | Load the synthetic demo data                                          |
| `npm run dev:studio`                   | Prisma Studio, to browse the database                                 |
| `npm run codegen`                      | Regenerate the frontend's GraphQL types after a schema change         |
| `npm run db:down` / `npm run db:reset` | Stop Postgres / stop it and delete its data                           |

### Troubleshooting

- **`The table public.… does not exist`** when the API starts: the database has no tables yet. Run
  `npm run db:deploy -w @loopwise/api`, then restart `dev:api`.
- **Changed `POSTGRES_USER` or `POSTGRES_PASSWORD` and can't connect:** the Docker volume keeps the first credentials.
  Run `npm run db:reset`, then `db:up`, `db:deploy` and (optionally) `db:seed`.
- **Port 5435 is taken:** change `POSTGRES_PORT` and the port in `DATABASE_URL` to the same free port.
- **Lost the setup token:** it is printed again each time `dev:api` starts while no admin exists. It comes from
  `BETTER_AUTH_SECRET`, so keep that value stable.

**Demo data is synthetic only.** Never load real patient data into a development or demo database.

### Checks

```bash
npm run lint
npm test               # the API tests need the database running; they use their own `<database>_test` copy
npm run format:check
```

Browser tests: `npm run test:e2e -w @loopwise/frontend` with the dev stack running.

## Deployment

Loopwise runs as two containers: the app (API and frontend in one image) and PostgreSQL 16. Both are defined in
[`docker-compose.prod.yml`](docker-compose.prod.yml).

### Requirements

- A Linux server with Docker and Docker Compose. 2 vCPU and 4 GB RAM is enough for a small clinic; the AI runs at the
  provider, unless you use a local model.
- A domain name and a reverse proxy for HTTPS (Caddy, nginx or Traefik)
- An API key for an LLM provider, or a reachable Ollama server

### 1. Configure

```bash
git clone https://github.com/joemark0008/loopwise.git
cd loopwise
cp .env.example .env
```

Edit `.env`:

| Setting                                | Value                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`   | Database credentials. Use a strong password; set it before the first start |
| `BETTER_AUTH_SECRET`                   | **Required.** `openssl rand -base64 32`. Keep it stable and secret         |
| `BETTER_AUTH_URL`                      | The public URL, e.g. `https://clinic.example.com`                          |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`… | Optional; keys can also be added per clinic in the app                     |
| `LOOPWISE_PORT`                        | Optional host port of the app (default `8080`)                             |

`DATABASE_URL` and `PORT` in `.env` are ignored here: the compose file sets them for the containers.

### 2. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app applies any pending database migrations each time it starts, then listens on port `8080`. Clinic files and
uploads live in the `loopwise_data` volume, and the database in `loopwise_postgres_data`.

### 3. Put HTTPS in front

Point your reverse proxy at `http://localhost:8080`. With Caddy, this whole `Caddyfile` is enough:

```text
clinic.example.com {
    reverse_proxy localhost:8080
}
```

### 4. First run

Get the setup token from the logs:

```bash
docker compose -f docker-compose.prod.yml logs loopwise | grep "setup token"
```

Open your URL, enter the token, and create the first admin. Then, in **Settings**:

1. **New clinic** (under the logo): create each clinic location
2. **Clinic profile**: business and clinic registrations
3. **AI and models**: choose an LLM provider and add its key
4. **Practitioners**, **Services and prices**, **Staff and roles**, and **Numbering**

### Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on start. Back up first.

### Backups

```bash
# Back up the database
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U loopwise -Fc loopwise > loopwise-$(date +%F).dump

# Restore: stop the app, replace the database contents, start the app again
docker compose -f docker-compose.prod.yml stop loopwise
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U loopwise -d loopwise --clean --if-exists < loopwise-2026-11-10.dump
docker compose -f docker-compose.prod.yml start loopwise
```

Replace `loopwise` after `-U` if you changed `POSTGRES_USER`. Also back up the `loopwise_data` volume (uploaded files
and clinic context). Keep backups encrypted and off the server.

### Production checklist

- [ ] Strong `POSTGRES_PASSWORD` and a stable, secret `BETTER_AUTH_SECRET`
- [ ] HTTPS only, and the database port not exposed to the internet
- [ ] Change the analytics role's development password, then point the app at it:
      `ALTER ROLE loopwise_analyst PASSWORD '…';` in `psql`, and
      `ANALYTICS_DATABASE_URL=postgresql://loopwise_analyst:…@postgres:5432/loopwise` in `.env`
- [ ] Automated, tested backups
- [ ] An LLM provider under a data processing agreement, or a local model, for patient data
- [ ] Your Data Privacy Act duties: a DPO, a privacy impact assessment and NPC registration where required
      ([docs/NEXT.md](docs/NEXT.md), "Before real patients")

## Documentation

| Document                                       | What it covers                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| [docs/PLAN.md](docs/PLAN.md)                   | Product, desks, phases and open questions                           |
| [docs/DESIGN.md](docs/DESIGN.md)               | Architecture, data model, the follow-up flow, Wise and access rules |
| [docs/NEXT.md](docs/NEXT.md)                   | What is built and what comes next                                   |
| [docs/design-system.md](docs/design-system.md) | The UI look, tokens and components                                  |
| [CLAUDE.md](CLAUDE.md)                         | Code conventions (for people and AI coding agents)                  |

## Status and disclaimer

Loopwise is pre-1.0 and under active development. It is **not a certified medical device** and is provided "as is",
without warranty (see [LICENSE](LICENSE)). AI output is a draft for a qualified person to check, never a clinical
decision. If you deploy it with real patients, you are responsible for clinical safety, for compliance with the Data
Privacy Act of 2012 (RA 10173) and other regulations, and for securing your installation.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and
[SECURITY.md](SECURITY.md) for reporting vulnerabilities privately.

## Acknowledgements

Loopwise includes code from other Apache-2.0 projects, among them [nao](https://github.com/getnao/nao) by nao Labs.
They are credited in [NOTICE](NOTICE).

Third-party dependencies keep their own licenses. Most are MIT, Apache-2.0, BSD or ISC; note that the map components
use `react-leaflet`, licensed under the [Hippocratic License 2.1](https://firstdonoharm.dev/), which adds ethical-use
conditions.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
