# Loopwise design system

The Loopwise values for the pattern in [frontend-design.md](frontend-design.md): tokens, clinical status, components,
table density and the information architecture. Written for the UX redesign of 3 Nov 2026 (branch `ux-redesign`),
from the ui-ux-pro-max rules (priority order: accessibility → touch → performance → style → layout → type and colour →
animation → forms → navigation → charts) plus our own judgement for a clinical product.

**Product and style.** Clinical SaaS used on clinic desktops and tablets, often by a doctor between patients:
data-dense, trust-first, calm. Flat surfaces, one accent (care blue), semantic status colour that never stands alone,
coral reserved for the assistant.

## 1. Tokens (`apps/frontend/src/theme/tokens.css`)

Components read `--app-*` tokens, never hex (`scripts/check-styles.mjs` fails on hex and px in CSS Modules).
`src/theme/contrast.test.ts` checks every text pair below in light and dark.

### Colour

| Token                                              | Light                             | Dark                              | Use                                      |
| -------------------------------------------------- | --------------------------------- | --------------------------------- | ---------------------------------------- |
| `--app-bg`                                         | `#f4f7fb`                         | `#0b1424`                         | Page background (brand paper)            |
| `--app-surface`                                    | `#ffffff`                         | `#111c2e`                         | Cards, panels, the banner                |
| `--app-fill`                                       | `#ebf0f6`                         | `#1a2740`                         | Subtle fills, hover                      |
| `--app-line` / `--app-line-strong`                 | `#dde3eb` / `#c3ccd8`             | `#25324a` / `#34445f`             | Dividers, card borders                   |
| `--app-control-line`                               | `#7d8a9f`                         | `#6b7c97`                         | Input and control borders (3:1)          |
| `--app-text` / `--app-body`                        | `#0f1b2d` / `#1f2b3d`             | `#f4f7fb` / `#dce3ec`             | Headings / body text                     |
| `--app-muted`                                      | `#526075`                         | `#a3b0c2`                         | Labels, meta (≥4.5:1 on surface and bg)  |
| `--app-primary-bg` / `--app-accent`                | `#1f5fae`                         | `#6fa8f0`                         | Primary button, focus, active nav        |
| `--app-primary-fg`                                 | `#ffffff`                         | `#0b1424`                         | Text on primary (dark text in dark mode) |
| `--app-nav-bg`                                     | `#13233a`                         | `#13233a`                         | Sidebar (ink, both themes)               |
| `--app-wise` / `--app-wise-bg` / `--app-wise-line` | `#b5452a` / `#fdf1ec` / `#f0997b` | `#f2937d` / `#3a1a10` / `#993c1d` | Wise only                                |

**Coral means Wise.** The Ask Wise bar, the Wise dock and (phase 3) draft cards. Never errors, never a user's
primary action. `--app-coral` is the brand dot (`#e8735a`) for illustration only: it fails 4.5:1 as text.

### Clinical status

Always **icon + word + colour** (`components/clinical/clinical-flag.tsx`), so meaning never rests on colour alone and
survives greyscale printing and colour blindness.

| Tone       | Use                                                                    | Light fg / bg       | Dark fg / bg        | Icon                          | Words                       |
| ---------- | ---------------------------------------------------------------------- | ------------------- | ------------------- | ----------------------------- | --------------------------- |
| `critical` | Critical values, an allergy, escalated                                 | `#b42318 / #fef3f2` | `#fda29b / #3a1512` | octagon-alert                 | Critical high, Penicillin   |
| `abnormal` | High/low results, out-of-range vitals, overdue, allergies not recorded | `#8a4b00 / #fff4db` | `#fec84b / #33240a` | arrow-up/down, triangle-alert | High, Low, Not recorded     |
| `normal`   | In range                                                               | muted, outlined     | muted, outlined     | check                         | Normal (neutral, not green) |
| `info`     | Sent, accepted, finalized, open                                        | `#1f5fae / #eaf2fc` | `#9cc3f5 / #14243d` | clock                         | the state in words          |
| `done`     | Issued, paid, reviewed, closed with evidence                           | `#1e7a46 / #eaf7ef` | `#7bd3a0 / #10291c` | circle-check                  | Issued, Paid, Closed        |
| `void`     | Voided, cancelled                                                      | muted on fill       | muted on fill       | ban                           | Voided (+ reason)           |
| `draft`    | Unissued drafts                                                        | body, dashed border | body, dashed border | —                             | Draft                       |

Green only means a loop closed. A normal result is not "good news", it is neutral. **Allergies:** a recorded allergy
is critical; no allergy rows is **"Not recorded"** (abnormal), never a reassuring "none" (the schema has no "no known
allergies" assertion yet).

### Typography

- Headings: **Poppins** 600 (matches the wordmark). Body: **Inter** (variable), 400 body, 500 labels, 600 emphasis.
  Both self-hosted through `@fontsource` (`main.tsx`); no font CDN, so sovereign deployments make no third-party call.
- Scale (`--app-text-*`): 12 · 14 · 16 · 18 · 20 · 24 · 30. **12px is the floor** and only for metadata and chips;
  dense tables and labels are 14; body is 16 with line-height 1.5, headings 1.25.
- Tables and `.app-numeric` use tabular figures.
- Dates read one way everywhere (`feature/encounters/encounter-format.ts`): `22 Oct 2026`, `22 Oct 2026, 09:29`.
  Ages: `45 F`, and `7 mo F` / `12 d M` under two years (`ageLabel`).

### Spacing, radius, elevation, motion

- 4pt grid: 4 · 8 · 12 · 16 · 24 · 32 · 48 (rem). Sections step 16 / 24 / 32.
- Radius: 6 chips · 8 controls · 12 cards and the banner · 16 dialogs and sheets.
- Elevation (`--app-shadow-1..3`, tinted ink): 1 cards and banner · 2 popovers · 3 dialogs, sheets, the Wise overlay.
- Z-index: `--app-z-sticky` 20 (banner) · `--app-z-dock` 40 · `--app-z-overlay` 100 (Wise over the page).
- Motion: 120ms feedback, 200ms enter, 140ms exit, ease-out; transform and opacity only. The global
  `prefers-reduced-motion` reset stays.

## 2. Components

### Sizes and targets

- Controls are **40px** on a mouse and **44px on touch** (`--app-control-height`, raised under `pointer: coarse`).
  `size='sm'` is 36px (44 on touch). Icon buttons grow to 44px on touch. On a mouse every target is at least 24px
  (WCAG 2.2 target size).
- One primary action per view. Forms end with an `ActionBar`: secondary and destructive actions at the start, the
  primary last on the right. Destructive actions are confirmed (`VoidDialog`).

### Clinical components (`apps/frontend/src/components/clinical/`)

| Component                    | What                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `ClinicalFlag`               | A status chip: tone, icon, word. `ResultFlagChip` maps a lab `ResultFlag`.             |
| `StatusBadge`                | One map of record statuses (draft, issued, finalized, paid, voided, sent, reviewed…).  |
| `AllergyChips`               | Allergies with severity and reaction in text, or "Not recorded"; optional Add allergy. |
| `PatientBanner`              | Name, age/sex, born, MRN, PhilHealth, language, consent, allergies. Sticky.            |
| `PageHeader` / `PageSection` | A screen's h1 and actions; a titled card (`page.module.css`).                          |
| `EmptyState`                 | What goes here and the next step (`role=status`).                                      |
| `ActionBar`                  | A form's actions.                                                                      |

Use stock `components/ui` for the rest (Button, Input, Select, Dialog, TabBar). Write new clinical screens from these;
don't restyle per screen.

### Flags in dense tables

`FlaggedValue` marks an out-of-range measurement in a table cell: bold, the tone's colour, an arrow (↑ high, ↓ low)
or the critical sign, and the word for screen readers. Lab results use the result's flag; vitals use
`vitalFlag` (`apps/shared/src/vitals.ts`, adult reference ranges in `VITAL_REFERENCE`, separate from the input limits
in `VITAL_RANGES`, to be confirmed by a clinician). BP takes the worse of systolic and diastolic. The Flag column also
shows a `ResultFlagChip` with the word.

### Forms

Visible labels (never placeholder-only), a required marker, errors under the field and linked with
`aria-describedby`, validation on blur, an error summary that takes focus on a failed submit, `role=status` for
"Saved". Group fields with headings. (Phase 2 brings the registration and encounter forms up to this.)

### Tables (`page.module.css` `.table`)

- **Density:** 40px rows on a mouse, 48px on touch (`--app-row-height`), 14px text, hairline rows, no zebra.
- Sticky header in 12px semibold muted; numbers right-aligned (`data-numeric`), units in the header.
- The flag column comes before status.
- **Phone (≤40rem):** `data-reflow` turns rows into stacked cards, each cell labelled from `data-label`. Wide tables
  never scroll sideways on a phone.

## 3. Information architecture

### Shell (`layout/`)

- **Sidebar** (ink): the role's links from `lib/navigation.ts` (`roleNavLinks`), active row marked with
  `aria-current` and a blue rule. Settings at the bottom through the user menu. The chat history and the clinic
  switcher left the sidebar: chats live on **Wise chats** (`/chats`); the clinic switcher is admin-only in Settings.
- **Phone (<768px):** a bottom bar with the role's first five links, each with icon and label.
- **Top bar:** breadcrumbs as a list with links (`Patients › Maria Santos › Encounter 22 Oct 2026`, names read from
  the pages' cached queries, never fetched again: the reads are audited), ⌘K "Find a patient or chat", account menu.
- Skip link to `#main`; focus moves to the new page's h1 on every route change.
- The clinic, agent, skills, usage and storage settings are admin-only.

### Roles and homes

`useStaffRole()` returns `doctor` for everyone until the API exposes a role; each later feature fills its own.

| Role       | Home                 | Sidebar                                                     |
| ---------- | -------------------- | ----------------------------------------------------------- |
| Doctor     | **Today** `/`        | Today · Patients · Results · Cases · Wise chats             |
| Nurse      | Worklist `/worklist` | Worklist · Patients · Cases                                 |
| Lab        | Orders `/orders`     | Orders                                                      |
| Specialist | Today, Referrals     | Today · Referrals · Patients · Results · Cases · Wise chats |
| Program    | Dashboard            | Dashboard · Wise chats                                      |

**Today** has the Ask Wise bar (a new chat), results to review (critical first), the patients in your care and the
overdue loops. Results, Cases, Worklist, Referrals, Orders and Dashboard exist now as **planned pages**
(`feature/planned/`): their header, table columns and an empty state naming what fills them, so each feature slots
into its layout. All are in the Wise page registry (`apps/shared/src/app-pages.ts`).

### Patient context (`feature/patients/patient-layout.tsx`)

Every `/patients/:id/*` page sits in one layout:

- The **patient banner**, sticky: who this is, and allergies always in view. On a phone it keeps the name, age/sex and
  allergies.
- **Patient pages** as links: Chart (encounters, details) · Results · Cases · Messages (planned).
- The **encounter record** nests under the same banner, with its own tabs.
- **Wise docked** on the right (≥80rem). Below that, the banner's Ask Wise opens it over the page from the right; on a
  phone as a bottom sheet. Escape closes it; focus moves into it.

### Wise everywhere

- **Patient pages:** the patient's own chart chat, docked (above).
- **Other list pages** (Patients, Results, Cases, Wise chats, the planned pages): the top bar's coral **Ask Wise**
  opens a general chat over the page from the right (a sheet on a phone), mounted on first open and kept while you move
  between pages (`feature/wise/wise-dock.tsx`, `hasWiseDock` in `lib/navigation.ts`). Like every embedded chat it
  never navigates by itself; its cards link.
- **Today and chats:** Wise is the page itself.
- **Wise cards** (`tool-calls/proposal-card/`): a coral rule and a dashed "Draft · needs your confirmation" badge mark
  what Wise wrote; warnings use the clinical tones; a failed tool call says "Failed" with its sign. The model picker
  in the chat input is for the instance admin only.

### Flow

Today → a result (critical first) → the patient (banner, Results) → review → case or referral → encounter record →
prescription, certificate, bill → print. Each step stays in one patient context, with the patient's Wise beside it.

## 4. Verification

- `npm run lint` (tsc, ESLint, `check-styles.mjs`), `npm test` (includes `theme/contrast.test.ts`),
  `npm run format:check`.
- `e2e/ux-screens.spec.ts` records the clinical screens at 390, 820 and 1440px, light and dark (`E2E_UX_DIR`).
- The pre-delivery checklist: contrast in both themes, 44px touch targets, no emoji icons, one icon set (lucide),
  focus visible and not hidden by the sticky banner, reduced motion, 375px width without horizontal scroll.
