# 配置参考（Configuration）

> Panel 是纯前端 SPA，**没有运行时密钥**。可配置项只有构建期环境变量（`NUXT_PUBLIC_*`）与 `nuxt.config.ts` 内的构建期设置。

## 环境变量（`.env` → `NUXT_PUBLIC_*`）

参考 [`.env.example`](../.env.example)：

| 变量 | 默认 | 说明 |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | **必填** | PPB REST API 基础 URL。Panel 请求走 credentialed CORS（`credentials:'include'`），PPB 必须精确放行 `http://localhost:3000`（dev）/ `https://panel-phira.htadiy.com`（prod） |

本地联调示例：

```bash
NUXT_PUBLIC_API_BASE=http://localhost:8000
```

## `runtimeConfig.public`（`nuxt.config.ts`）

| 键 | 默认 | 说明 |
|---|---|---|
| `apiBase` | 无默认值 | 同 `NUXT_PUBLIC_API_BASE`；缺失或不是绝对 HTTP(S) URL 时 fail-fast |

## noindex 配置（设计 §23.2）

Panel **必须**对搜索引擎隐藏，配置共四层：

| 层 | 位置 | 内容 |
|---|---|---|
| 1. HTTP 头（声明式） | `nuxt.config.ts` `routeRules['/**'].headers` | `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` |
| 2. HTTP 头（强制） | `server/middleware/noindex.ts`（Nitro middleware） | 每个响应（含 SPA fallback + 错误）都输出同一头 |
| 3. HTML 壳 | `nuxt.config.ts` `app.head` + `app.vue`/`error.vue`/`[...slug]` 内 `useHead` | `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">` |
| 4. robots.txt | `public/robots.txt` | `User-agent: *` / `Disallow: /` |

`@nuxtjs/seo` 的 `sitemap/robots/ogImage/schemaOrg/linkChecker` 全部关闭，**任何情况下不生成 sitemap**。

## 反代注意

对非 Nitro 部署（如静态 + nginx），反代必须自行输出 `X-Robots-Tag` 到错误 / fallback / 登录页（见 [deployment.md](./deployment.md)）。

## 其它构建期设置

- `typescript.strict = true`（`shim:false`）。
- `devtools` 关闭。
- `site.url` / `site.name` / `site.description` 仅供 head 元信息使用（不产出 sitemap）。
