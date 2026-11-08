# @loopwise/frontend

The Loopwise web app: React 19, Vite, TanStack Router (file-based routes in `src/routes`), shadcn/ui (Radix + Tailwind v4) with CSS Modules,
and Apollo Client with GraphQL Code Generator. Design rules: [docs/frontend-design.md](../../docs/frontend-design.md)
and [docs/design-system.md](../../docs/design-system.md).

## Commands

Run from the repo root (see the root [README](../../README.md) for setup):

```bash
npm run dev:frontend                          # http://localhost:3000, proxies the API to :5006
npm run codegen                               # regenerate typed GraphQL operations after a schema change
npm run lint -w @loopwise/frontend            # codegen, tsc, eslint, scripts/check-styles.mjs
npm test -w @loopwise/frontend                # Vitest
npm run test:e2e -w @loopwise/frontend        # Playwright, with the local stack up
npm run build -w @loopwise/frontend
```

`scripts/check-styles.mjs` fails on stray px and hex values and on CSS Module classes that don't exist; use the tokens
in `src/theme/tokens.css`.

## Layout

- `src/routes/`: pages (`_protected/` needs a session).
- `src/feature/<feature>/`: feature screens and components (patients, encounters, orders, results, chat, …).
- `src/components/`: shared UI (`ui/`) and clinical components (`clinical/`).
- `src/lib/*-api.ts`: API calls through `lib/apollo-procedures.ts`, typed by `lib/api-types.ts`.
- `src/graphql/`: operations; `generated/` is written by codegen.
- `e2e/`: Playwright specs.
