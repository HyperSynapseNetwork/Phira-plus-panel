import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  /**
   * Panel is a pure SPA admin/ops UI (design §3.3 / §26.4).
   * No SSR, no SSG, no sitemap, fully noindex (design §23.2).
   */
  ssr: false,

  compatibilityDate: '2026-08-12',

  devtools: { enabled: false },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/seo',
    '@nuxt/image',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Phira+ Panel',
      meta: [
        // §23.2 #2 — robots meta in the initial HTML shell (survives non-JS crawl).
        { name: 'robots', content: 'noindex,nofollow,noarchive,nosnippet,noimageindex' },
      ],
    },
  },

  site: {
    url: 'https://panel-phira.htadiy.com',
    name: 'Phira+ Panel',
    description: 'Phira+ 管理控制台',
  },

  // §23.2 — Panel MUST NOT generate a sitemap, robots.txt, OG images, or
  // schema.org. Only head-management utilities (useSeoMeta etc.) are wanted
  // from @nuxtjs/seo. robots.txt is served statically from public/.
  sitemap: false,
  robots: false,
  ogImage: false,
  schemaOrg: false,
  linkChecker: false,
  seo: {
    // We only use useHead(); disable the useSeoMeta tree-shake which needs
    // the optional @unhead/bundler peer.
    treeShakeUseSeoMeta: false,
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://api-phira.htadiy.com',
    },
  },

  // §23.2 #1 — belt-and-suspenders: declarative header on every route,
  // reinforced by server/middleware/noindex.ts (covers SPA fallback + errors).
  routeRules: {
    '/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
      },
    },
  },

  typescript: {
    strict: true,
    shim: false,
  },
})
