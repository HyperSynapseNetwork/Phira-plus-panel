# Panel — Phase A Plan (scaffold + foundation)

Status: implemented locally, committed to `main` (not pushed).
Date: 2026-08-12
Repo: `HyperSynapseNetwork/Phira-plus-panel`

## 1. Goal

Nuxt 3 SPA admin/operations UI skeleton for Phira+ V3: typed PPB client,
full-site noindex baseline, root login + first-login password change, dense
ops layout, Panel preferences store skeleton, and a CI pipeline that guards
the noindex contract.

## 2. Stack (exact versions installed — for Main to freeze)

Runtime `dependencies`:

| package | version | note |
|---|---|---|
| `nuxt` | 3.21.11 | Nuxt 3, SPA (`ssr:false`) |
| `vue` | 3.5.41 | |
| `pinia` | 4.0.2 | |
| `@pinia/nuxt` | 1.0.1 | |
| `@nuxtjs/seo` | 5.3.12 | head-management only; sitemap/robots/og-image/schema-org/link-checker disabled |
| `@nuxt/image` | 2.1.0 | |
| `@vueuse/nuxt` | 14.4.0 | |
| `tailwindcss` | 4.3.3 | required by `@heroui/styles` (peer `>=4.0.0`) |
| `@tailwindcss/vite` | 4.3.3 | Tailwind 4 Vite plugin (Nuxt 3.21 bundles Vite 7.3.6) |
| `@heroui/styles` | 3.2.4 | framework-agnostic HeroUI layer; **not** `@heroui/vue` |
| `@tanstack/vue-virtual` | 3.13.35 | reserved for Phase C lists |
| `@formkit/auto-animate` | 0.10.0 | |
| `echarts` | 6.1.0 | charts later (Phase C); pinned now to freeze the stack |
| `vue-echarts` | 8.1.0 | charts later |

Dev `devDependencies`:

| package | version | note |
|---|---|---|
| `typescript` | 5.9.3 | TS 5.x (stable line; not the just-released 7.x) |
| `vue-tsc` | 3.3.9 | |
| `eslint` | 9.39.5 | |
| `@antfu/eslint-config` | 9.3.0 | flat config |
| `vitest` | 4.1.10 | |
| `@vue/test-utils` | 2.4.11 | |
| `happy-dom` | 20.11.2 | |
| `@vitejs/plugin-vue` | 6.0.8 | vitest SFC support (Nuxt bundles its own) |
| `@types/node` | 22.20.1 | |

> If the PPF repo (sibling Agent) resolves different versions for the shared
> stack, report both — Main pins a single baseline.

## 3. Implementation plan (done)

1. **Nuxt 3 SPA scaffold** — `nuxt.config.ts` with `ssr:false`, modules
   (`@pinia/nuxt`, `@nuxtjs/seo`, `@nuxt/image`, `@vueuse/nuxt`), TS strict,
   Tailwind 4 via `@tailwindcss/vite` + global CSS `@import "@heroui/styles"`,
   aliases `~`/`@`.
2. **Noindex baseline** (§23.2):
   - `server/middleware/noindex.ts` sets `X-Robots-Tag` on every response
     (covers SPA fallback + errors).
   - `nuxt.config` `routeRules['/**']` headers (declarative complement).
   - `app.head` robots meta (in the initial HTML shell) + explicit
     `useHead` in `app.vue`, `error.vue` and the `[...slug]` 404 page.
   - `public/robots.txt` → `User-agent: * / Disallow: /`.
   - `sitemap/robots/ogImage/schemaOrg/linkChecker` disabled under
     `@nuxtjs/seo`.
   - `tests/noindex.spec.ts` regression (source + built-output).
3. **Typed API client** — `app/types/api.ts` (error envelope, pagination,
   meta/capabilities), `app/utils/api-error.ts` (`ApiError`,
   `normalizeFetchError`), `app/composables/useApi.ts` (`apiFetch`,
   `useApi()`, `useApiFetch()`) with credentialed CORS to
   `https://api-phira.htadiy.com/api/v1`. `.env.example` provides
   `NUXT_PUBLIC_API_BASE`.
4. **Root login** (§6.8) — `login.vue` (POST `/admin/auth/root/login`),
   `change-password.vue` (first-login flow), `stores/auth.ts` session state.
5. **Layout skeleton** — dense Fluent-ish ops layout: `AppShell` + `AppSidebar`
   (permission-filtered nav) + `AppTopBar` + content area; dashboard
   placeholder (`pages/index.vue`); route meta `permissions: []` stubs
   (no full manifest hardcoded).
6. **Panel preferences store** — `stores/preferences.ts` + `types/preferences.ts`,
   namespace `panel`, JSONB+revision optimistic-concurrency save to
   `/me/preferences/panel`. In-memory only in Phase A (never localStorage-only).
7. **CI** — `.github/workflows/build.yml` (reproducible install, lint,
   vue-tsc, vitest, SPA build, noindex regression).
8. **Local verification** — `pnpm install`, `pnpm lint`, `pnpm vue-tsc`,
   `pnpm test`, `pnpm build`, `pnpm test:noindex` (see §6).

## 4. Contract issues / proposals (for Main to review & freeze)

These touch the frozen PPB REST contract; **none are silently changed** here.

- **P1 — Root session probe endpoint.** Root is a local principal
  (`user_id = NULL`, design §6.8), so `/me/profile` is ambiguous for it.
  Propose `GET /api/v1/admin/auth/root/session` →
  `{ authenticated, principal_type:'root', must_change_password, permissions }`.
  Panel calls it on startup to restore the session. Alternative: define that
  `/me/profile` works for root.
- **P2 — Root login request/response shape.** `POST /api/v1/admin/auth/root/login`
  body is proposed as `{ password }` (Root has no username); response proposed
  `{ principal_type:'root', must_change_password:boolean }` so the Panel can
  route to the first-login change flow.
- **P3 — Root password change endpoint.** Not in the contract namespace.
  Propose `POST /api/v1/admin/auth/root/change-password`
  `{ current_password, new_password }` → `{ ok:true }`.
- **P4 — Error code casing.** Contract §2 lists canonical codes in
  snake_case (`auth`, `permission_denied`, …) but the example envelope uses
  `PHIRA_REAUTH_REQUIRED` (SCREAMING_SNAKE). Please freeze one convention.
  The Panel `ApiError` preserves any server code verbatim, so either works;
  the UI localizes by exact match.
- **P5 — Client-local error codes.** Panel adds `network_error` /
  `unknown_error` / `invalid_response` (not on the server list) for
  transport-level failures where no envelope exists. These are client-side
  categories, not server codes.
- **P6 — Root preferences.** Design §21.1 gives Panel a full preference
  namespace, but Root (`user_id = NULL`) has no obvious `user_id` key.
  Decide: root prefs keyed by principal, or root reuses a shared/global
  namespace. Phase A keeps prefs in-memory and wires the REST path for normal
  admins.
- **P7 — Permission ids used in nav stubs.** `user:view`, `group:view`,
  `room:view`, `server:view`, `config:view`, `plugin:view`, `audit:view`,
  `logs:view`, `pmp:cli`, `notification:send_system`, `dashboard:view` are
  referenced as route-meta stubs. They match the integration-required set in
  the contract, but the authoritative manifest must come from PPB
  (`GET /api/v1/admin/permissions`). Panel renders only what the manifest
  provides; the full set is never hardcoded.

## 5. Out of scope (Phase A)

Tournament/Event/HSNBot, private IM, raw replay download, Web OS, arbitrary
shell, `@heroui/vue`, React runtime, PPB/PMP DB access, sitemap generation,
localStorage-only account prefs.

## 6. Local verification status

- `pnpm install` — OK (lockfile generated).
- `pnpm lint` — OK.
- `pnpm vue-tsc` — OK.
- `pnpm test` — OK (unit/component tests).
- `pnpm build` — OK (Nuxt SPA build, `.output/server/index.mjs` produced).
- `pnpm test:noindex` — OK (built-output regression: header on `/`, `/login`,
  `/change-password`, unknown fallback route; `robots.txt`; no sitemap).

## 7. Reverse-proxy note (deployment)

`X-Robots-Tag` is emitted by the Nitro server (middleware + route rules). For
non-Nitro hosting (e.g. static + nginx), the proxy MUST also add
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` to
error/fallback/login pages (§23.2 #7).
