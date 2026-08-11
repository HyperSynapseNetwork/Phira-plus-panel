# Phira+ Panel

Admin/operations UI for Phira+ V3 — a **Nuxt 3 SPA** (`ssr:false`), built on
Vue 3 + TypeScript + Vite + Tailwind CSS + `@heroui/styles` (local Vue
wrappers, no React). Full details in `docs/PHASE_A_PLAN.md`.

## Commands

| command | purpose |
|---|---|
| `pnpm dev` | local dev (SPA) |
| `pnpm build` | Nuxt SPA build |
| `pnpm lint` | ESLint (antfu config) |
| `pnpm vue-tsc` | typecheck (Nuxt prepare + vue-tsc) |
| `pnpm test` | unit/component tests (vitest) |
| `pnpm test:noindex` | noindex regression against the built server |
| `pnpm preview` | serve the build output |

## Environment

Copy `.env.example` → `.env` and set `NUXT_PUBLIC_API_BASE` (defaults to
`https://api-phira.htadiy.com`).

## Noindex

The whole site is `noindex, nofollow, noarchive, nosnippet, noimageindex`:

- HTTP header via Nitro middleware + route rules (every route, incl. fallback/404)
- robots meta in `app.head`
- `public/robots.txt` → `Disallow: /`
- no sitemap generation

Regression-tested in `tests/noindex.spec.ts` (CI runs it after `pnpm build`).
