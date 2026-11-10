# Contributing to Loopwise

Thanks for your interest. Bug reports, fixes, features and documentation are all welcome.

## Before you start

- Read [docs/PLAN.md](docs/PLAN.md) (product and phases), [docs/DESIGN.md](docs/DESIGN.md) (data model, access rules,
  Wise) and [docs/NEXT.md](docs/NEXT.md) (what is built and what comes next).
- For anything larger than a small fix, open an issue first so we can agree on the approach.
- Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## Setup

Follow [Local development](README.md#local-development) in the README.

## Rules the code follows

The conventions are written down in [CLAUDE.md](CLAUDE.md) (used by people and AI agents alike). The ones reviewers
check most:

- **Resolvers stay thin; logic lives in services; Prisma only in repositories.**
- **Deny by default.** Patient access goes through a care relationship or a clinic role, and clinical queries run
  inside the row-level security context.
- **Audit everything.** Every view and change writes an `audit_logs` row in the same transaction.
- **AI drafts, a person confirms.** Agent tools only read or render proposal cards; only a confirm action writes.
- **Synthetic data only.** Never commit real patient data in seeds, fixtures, screenshots or issues.

## Checks

Before you open a pull request:

```bash
npm run lint
npm test
npm run format:check
```

For frontend changes, also run `npm run test:e2e -w @loopwise/frontend` with the local stack up. After you change the
GraphQL schema, run `npm run codegen`. Add a Prisma migration with `prisma migrate dev`; never edit an existing one.

## Pull requests

- Keep each pull request to one change, with tests.
- Write the commit message as what the change does ("Refuse to issue when every invoice series is turned off").
- By contributing, you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
