# Security policy

Loopwise handles clinical data, so we take security reports seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/joemark0008/loopwise/security/advisories/new).

Please include what you found, how to reproduce it (with synthetic data only), and the impact you expect. We aim to
acknowledge a report within 5 working days and to agree a disclosure date with you once a fix is ready.

## Scope

In scope: the code in this repository (`apps/api`, `apps/frontend`, `apps/shared`), its Docker image and its default
configuration. Of particular interest:

- bypasses of the access rules (care relationships, clinic roles, break-glass, row-level security);
- ways to read or change another clinic's or patient's records;
- ways to make Wise (the AI assistant) act without a person confirming, or leak data outside the user's scope;
- gaps in the append-only audit trail.

Out of scope: vulnerabilities in a deployment you do not own, social engineering, and denial of service by volume.

## Supported versions

Loopwise is pre-1.0. Only the latest `main` receives security fixes.

## Never use real patient data

Do not test against, or attach, real patient data in a report. Use the synthetic seed (`npm run db:seed -w @loopwise/api`).
