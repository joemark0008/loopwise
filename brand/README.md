# Loopwise brand

**Mark:** a ring that stops short of closing, and a coral dot that closes it: every screening result reaching care.
**Wordmark:** "Loopwise" in Poppins SemiBold, tracking −2, converted to outlines (no font needed). Poppins is under the SIL Open Font License (`POPPINS-OFL.txt`).

| Colour                         | Hex       |
| ------------------------------ | --------- |
| Care blue (primary)            | `#1F5FAE` |
| Care blue, hover               | `#174A8A` |
| Mid blue (ring in the UI)      | `#3B7BD0` |
| Light blue (dark-mode primary) | `#6FA8F0` |
| Coral (accent, the dot)        | `#E8735A` |
| Ink (sidebar, wordmark)        | `#13233A` |
| Paper (wordmark on dark)       | `#F4F7FB` |

White text on `#1F5FAE` is about 6.3:1. In dark mode the primary is `#6FA8F0` with dark text on it. The UI mark uses the mid blue so it reads on white and on the ink sidebar alike.

See `preview.png` for the logos and icons.

## Logo only (no text)

- `svg/loopwise-mark.svg`: colour
- `svg/loopwise-mark-white.svg`: for dark or blue backgrounds
- `svg/loopwise-mark-greyscale.svg`: one-colour uses
- `png/loopwise-mark-{64,128,256,512,1024}.png`, `png/loopwise-mark-white-512.png`, `png/loopwise-mark-greyscale-512.png`

## Logo with text

- `svg/loopwise-logo-light.svg`, `svg/loopwise-logo-dark.svg` (+ 1200px PNGs)
- `svg/loopwise-wordmark.svg`, `svg/loopwise-wordmark-white.svg`: text only

## App icons

- `svg/loopwise-app-icon.svg`, `svg/loopwise-app-icon-dark.svg` (+ 1024px PNGs)

## Frontend drop-ins (`frontend/`)

- `public/`: `favicon.ico` (16/32/48), `favicon.svg`, `appicon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest`, Teams `color.png` + `outline.png`, empty-state backgrounds `lightLogo.svg`, `darkLogo.svg`, `light-card-logo.svg`, `dark-card-logo.svg`
- `src/components/icons/`: `loopwise-logo.svg`, `loopwise-full-logo.svg` (wordmark in `currentColor`), `loopwise-logo-greyscale.svg`, `loopwise-desktop-logo.png`

The loading animation in `apps/frontend/src/components/icons/loopwise-logo-animated.tsx` draws the same ring and dot.

## Regenerate

`node brand/build.mjs brand` rebuilds everything from `wordmark.json` (the outlined Poppins glyphs), then copy `brand/frontend/` into `apps/frontend/`. It needs `@resvg/resvg-js`, resolved from `apps/api`'s dependencies (`npm install` first). `wordmark.json` was made from `Poppins-SemiBold.ttf` with opentype.js at 100px (x-height 55.4).
