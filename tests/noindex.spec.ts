// @vitest-environment node
// Use Node's native (undici) fetch — happy-dom's fetch enforces CORS.
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Panel noindex regression (design §23.2, audit §28.3).
 *
 * Source-level checks always run. The built-output suite boots the Nitro
 * server (`nuxt build` output) and asserts the HTTP header on real routes,
 * the SPA fallback (unknown route) and robots.txt — CI runs it after build.
 */
const ROOT = process.cwd()
const SERVER_ENTRY = resolve(ROOT, '.output/server/index.mjs')
const HAS_BUILD = existsSync(SERVER_ENTRY)

const ROBOTS_META = 'noindex,nofollow,noarchive,nosnippet,noimageindex'
const ROBOTS_HEADER = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('noindex source baseline (§23.2)', () => {
  it('public/robots.txt disallows everything', () => {
    const txt = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8')
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Disallow: /')
  })

  it('nitro middleware sets X-Robots-Tag on every response', () => {
    const src = readFileSync(resolve(ROOT, 'server/middleware/noindex.ts'), 'utf-8')
    expect(src).toContain('X-Robots-Tag')
    expect(src).toContain(ROBOTS_HEADER)
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
  let proc: ChildProcess
  let url: string

  beforeAll(async () => {
    const port = 43000 + Math.floor(Math.random() * 1000)
    proc = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: ROOT,
      env: {
        ...process.env,
        NITRO_PORT: String(port),
        NITRO_HOST: '127.0.0.1',
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    url = `http://127.0.0.1:${port}`
    const deadline = Date.now() + 25_000
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(2000) })
        if (res.status)
          return
      }
      catch {
        // not ready yet
      }
      await delay(250)
    }
    throw new Error('built nitro server did not become ready')
  }, 30_000)

  afterAll(() => {
    proc?.kill()
  })

  async function get(path: string) {
    return fetch(`${url}${path}`)
  }

  function headerValue(res: Response): string {
    return res.headers.get('x-robots-tag') ?? ''
  }

  it('serves X-Robots-Tag + robots meta on /', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    const h = headerValue(res).toLowerCase()
    expect(h).toContain('noindex')
    expect(h).toContain('nofollow')
    expect(h).toContain('noarchive')
    expect(h).toContain('nosnippet')
    expect(h).toContain('noimageindex')
    const html = await res.text()
    expect(html).toContain(ROBOTS_META)
  })

  it('serves X-Robots-Tag on /login', async () => {
    const res = await get('/login')
    expect(headerValue(res).toLowerCase()).toContain('noindex')
  })

  it('serves X-Robots-Tag on /change-password', async () => {
    const res = await get('/change-password')
    expect(headerValue(res).toLowerCase()).toContain('noindex')
  })

  it.each(['/users', '/rooms', '/server', '/logs', '/audit', '/console', '/config', '/plugins', '/groups', '/coupons', '/automation', '/jobs', '/notifications', '/preferences'])(
    'serves X-Robots-Tag on Phase C route %s',
    async (path) => {
      const res = await get(path)
      const h = headerValue(res).toLowerCase()
      expect(h).toContain('noindex')
      expect([200, 404]).toContain(res.status)
    },
  )

  it('serves X-Robots-Tag on a fallback/404 route', async () => {
    const res = await get('/does-not-exist-panel-404')
    expect([200, 404]).toContain(res.status)
    const h = headerValue(res).toLowerCase()
    expect(h).toContain('noindex')
    const html = await res.text()
    expect(html.toLowerCase()).toContain('<!doctype html')
  })

  it('serves robots.txt with Disallow: /', async () => {
    const res = await get('/robots.txt')
    expect(res.status).toBe(200)
    const txt = await res.text()
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Disallow: /')
  })

  it('does not generate a sitemap', async () => {
    const res = await get('/sitemap.xml')
    const body = await res.text()
    // SPA fallback (HTML) is acceptable, but there must be no sitemap XML.
    expect(body).not.toContain('<urlset')
    expect(body).not.toContain('<sitemapindex')
  })
})
