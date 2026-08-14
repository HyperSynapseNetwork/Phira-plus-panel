// @vitest-environment node
// Use Node's native (undici) fetch — happy-dom's fetch enforces CORS.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Panel noindex regression (design §23.2, audit §28.3).
 *
 * Source checks cover the static HTML controls and the production proxy
 * templates. Built checks inspect the generated static artifact when present.
 */
const ROOT = process.cwd()
const PUBLIC_DIR = resolve(ROOT, '.output/public')
const HAS_BUILD = existsSync(resolve(PUBLIC_DIR, 'index.html'))

const ROBOTS_META = 'noindex,nofollow,noarchive,nosnippet,noimageindex'
const ROBOTS_HEADER = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

describe('noindex source baseline (§23.2)', () => {
  it('public/robots.txt disallows everything', () => {
    const txt = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8')
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Disallow: /')
  })

  it('static proxy templates set X-Robots-Tag and SPA fallback', () => {
    const nginx = readFileSync(resolve(ROOT, 'deploy/nginx.conf'), 'utf-8')
    expect(nginx).toContain('X-Robots-Tag')
    expect(nginx).toContain(ROBOTS_HEADER)
    expect(nginx).toContain('try_files $uri $uri/ /index.html')
    const caddy = readFileSync(resolve(ROOT, 'deploy/Caddyfile'), 'utf-8')
    expect(caddy).toContain('X-Robots-Tag')
    expect(caddy).toContain('try_files {path} {path}/ /index.html')
  })

  it('app head carries the robots meta', () => {
    const nuxtCfg = readFileSync(resolve(ROOT, 'nuxt.config.ts'), 'utf-8')
    expect(nuxtCfg).toContain(`name: 'robots'`)
    expect(nuxtCfg).toContain(ROBOTS_META)
    const appVue = readFileSync(resolve(ROOT, 'app.vue'), 'utf-8')
    expect(appVue).toContain(ROBOTS_META)
  })

  it('no sitemap generation is configured', () => {
    const nuxtCfg = readFileSync(resolve(ROOT, 'nuxt.config.ts'), 'utf-8')
    expect(nuxtCfg).toMatch(/sitemap:\s*false/)
  })
})

describe.skipIf(!HAS_BUILD)('noindex regression — built output', () => {
  it('contains robots meta in the generated shell', () => {
    const html = readFileSync(resolve(PUBLIC_DIR, 'index.html'), 'utf-8')
    expect(html).toContain(ROBOTS_META)
  })

  it('contains the deny-all robots file', () => {
    const txt = readFileSync(resolve(PUBLIC_DIR, 'robots.txt'), 'utf-8')
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Disallow: /')
  })

  it('does not generate a sitemap', () => {
    expect(existsSync(resolve(PUBLIC_DIR, 'sitemap.xml'))).toBe(false)
    expect(existsSync(resolve(PUBLIC_DIR, 'sitemap_index.xml'))).toBe(false)
  })
})
