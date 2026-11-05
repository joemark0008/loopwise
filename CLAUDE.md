# Loopwise

Closing the screening-to-care loop: every ordered test and actionable result becomes timely care, with an owner at each
step. Built on NestJS 11 + GraphQL code-first + Prisma/PostgreSQL + React. Read [docs/DESIGN.md](docs/DESIGN.md)
first: it holds the problem, the data model (§7), the case state machine (§8), the Wise assistant (§9), the access rules
(§10) and the plan (§15).

## Stack rules

- NestJS 11 on Express, GraphQL code-first (`@nestjs/graphql` + Apollo), one server, no federation. REST only for auth,
  agent streaming, file uploads and the HL7/edge-connector ingest.
- Prisma on PostgreSQL only. The schema is split by domain into `apps/api/prisma/schema/*.prisma` (generator and
  datasource in `main.prisma`, clinical models in `clinical-*.prisma`); migrations stay in `apps/api/prisma/migrations/`.
- Frontend: React (TanStack Router, Mantine, CSS Modules) following [docs/frontend-design.md](docs/frontend-design.md),
  with Apollo Client + GraphQL Code Generator. Calls go through the `lib/*-api.ts` modules (`lib/apollo-procedures.ts`),
  typed by `lib/api-types.ts`; types of `apps/api` are imported with `import type` from `@loopwise/api/*`.
- Node from `.nvmrc` (`nvm use`), npm pinned by `packageManager` (`engine-strict`).

## Module conventions

- **kebab-case file names**: `care-case.service.ts`, `patient-access.guard.ts`.
- Clinical features live under `apps/api/src/clinical/<feature>/` (`patients`, `encounters`, `orders`, `results`,
  `pathways`, `cases`, `referrals`, `tasks`, `messaging`, `audit`): `<feature>.module.ts`, `.resolver.ts`, `.service.ts`,
  `.repository.ts`, `.loader.ts`, `dto/`, `models/`.
- **Resolvers (and REST controllers) stay thin**: parse args, check access via decorators, call a service, return. No
  business logic, no Prisma.
- **Business logic lives in services.**
- **Prisma is only used in repositories.** Services call repositories, never `PrismaService` directly. Raw SQL goes to
  Prisma TypedSQL (`prisma/sql/*.sql`) or `$queryRaw` inside a repository.
- Access control through decorators on a global `AuthGuard`: `@Public()`, `@CurrentUser()`, `@ClinicAccess()`,
  `@OrgMember()`, `@OrgAdmin()`, `@ClinicAdmin()`.
- N+1: request-scoped DataLoaders, one `<feature>.loader.ts` per module.
- Background work (SLA timers, escalations, reminders): pg-boss jobs registered with `@Job(name)`.

## Clinical rules

- **Deny by default.** A user reaches a patient only through a `CareRelationship` (or a time-limited, logged
  break-glass). Clinical repositories run their queries inside the row-level security context (see
  `apps/api/src/clinical/rls/`), never on the bare `PrismaService`.
- **Every clinical change is an event.** Case transitions write a `CaseEvent`; views and actions write an `AuditLog`
  row. Both tables are append-only (a trigger rejects UPDATE and DELETE).
- **AI drafts, the clinician confirms.** Agent tools only read (scoped to the user) or render proposal cards. Only the
  confirm button calls the mutation that orders, refers, messages or closes. Critical values never get an automated
  patient message.
- **Closing a case** needs `Evidence` or a named clinician's sign-off with a reason.
- **Synthetic data only.** Seeds, fixtures and demos never contain real patient data.

## Style

- Prettier (tabs, width 4, single quotes, print width 120) and ESLint with `simple-import-sort`.
- Husky pre-commit runs lint-staged (ESLint + Prettier on staged files).

## Verify

Before calling any change done, run and pass:

```bash
npm run lint
npm test
```

Plus `npm run format:check`. For frontend changes also run `npm run test:e2e -w @loopwise/frontend` with the local stack
up (the chat flow makes one real LLM call). `test/usage.e2e-spec.ts` › "rejects a range above the chart bucket limit"
is a known failure; leave it unless you are fixing it.

## Local setup

```bash
nvm use
npm install
cp .env.example .env            # fill in BETTER_AUTH_SECRET and an LLM key
docker compose up -d --wait     # Postgres on localhost:5435, database `loopwise`
npm run db:deploy -w @loopwise/api   # apply Prisma migrations
npm run db:seed -w @loopwise/api     # synthetic demo data; test@test.test / test1234
npm run dev:api                    # apps/api on :5006
npm run dev:frontend               # frontend on :3000, proxies the API to :5006
```
