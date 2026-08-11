/**
 * Panel must be excluded from search engines on EVERY route — including the
 * SPA fallback and error responses (design §23.2 #1 and #7).
 *
 * A nitro middleware runs before every handler, so the header lands on:
 *   - all SPA routes (/ , /login, /change-password, …)
 *   - unknown routes (SPA fallback → index.html)
 *   - error responses handled by nitro
 *
 * nuxt.config `routeRules['/**'].headers` is a declarative complement. A
 * reverse proxy must also set X-Robots-Tag to cover non-Nitro deployments.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
})
