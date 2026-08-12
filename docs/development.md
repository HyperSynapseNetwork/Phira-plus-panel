# 开发指南（Development）

> 面向 Panel 贡献者：目录结构、页面、API 客户端、noindex 契约、测试。跨仓契约见 `contracts/README.md`（尤其 §5 Permission Manifest、§17 Admin REST 子路径）。

## 目录结构

```
panel/
├── nuxt.config.ts               # SPA（ssr:false）、noindex、runtimeConfig.public.apiBase
├── .env.example                 # NUXT_PUBLIC_API_BASE
├── docs/                        # 本文档集
├── app.vue                      # 根布局（useHead noindex 显式守卫）
├── error.vue                    # 错误页（noindex）
├── assets/css/main.css          # @heroui/styles + Panel token
├── layouts/                     # 布局
├── components/
│   ├── layout/                  #   AppShell / AppSidebar / AppTopBar
│   ├── admin/  experimental/  ui/
├── pages/                       # 路由页面
├── stores/
│   ├── auth.ts                  #   Root 会话状态
│   ├── permissions.ts           #   权限（来自 PPB manifest）
│   └── preferences.ts           #   Panel 偏好（namespace panel，JSONB + revision）
├── composables/
│   ├── useApi.ts                #   apiFetch / useApi / useApiFetch（credentialed CORS）
│   └── useAsync.ts
├── types/
│   ├── api.ts                   #   错误信封 / 分页 / meta / capabilities
│   └── preferences.ts
├── utils/
│   ├── api-error.ts             #   ApiError + normalizeFetchError
│   ├── format.ts / log-translator.ts / window-geometry.ts
├── plugins/                     # echarts / session.client
├── api/admin.ts                 #   /api/v1/admin/* 调用封装
├── config/admin-navigation.ts   #   权限驱动的导航声明
├── server/middleware/noindex.ts #   Nitro 中间件（每个响应输出 X-Robots-Tag）
├── public/robots.txt            #   Disallow: /
└── tests/                       #   Vitest + noindex.spec.ts
```

## 页面（`pages/`）

| 路由 | 说明 |
|---|---|
| `/login` `/change-password` | Root 登录 / 首次改密 |
| `/` | 仪表盘（`dashboard:view`） |
| `/users` `/users/[id]` | 用户管理 / 用户详情（multiplayer / sessions / security / audit / actions / ban / kick） |
| `/groups` | 用户组（成员 / 权限分配） |
| `/rooms` `/rooms/[id]` | 房间管理（详情 / actions / batch actions） |
| `/server` | 服务器（stats / runtime / actions / broadcast） |
| `/config` | 配置（descriptors / values / validate / diff / save / snapshots / rollback / ppb / pmp / ppf / public） |
| `/plugins` | 插件（enable / disable / reload / remove / call） |
| `/logs` `/console` | 日志 / 原始控制台（`cli.execute`，全量 Audit） |
| `/audit` | 审计（含 CSV 导出） |
| `/jobs` | 任务 |
| `/notifications` | 通知（send / delivery） |
| `/coupons` | 优惠券（create / revoke） |
| `/automation` | 自动化（runbooks / runs） |
| `/preferences` | 面板偏好 |
| `[...slug]` | SPA fallback（404 + noindex） |

## API 客户端与权限

- `types/api.ts`：冻结错误信封 `{error:{code,message,request_id,details}}`、分页 `{items,total,page,pageNum}`、`meta`/capabilities。
- `utils/api-error.ts`：`ApiError` 保留服务端 `code` 原样；客户端自有 code `network_error` / `unknown_error` / `invalid_response`（非服务端契约）。
- `composables/useApi.ts`：向 `NUXT_PUBLIC_API_BASE` 发起 credentialed CORS 请求。
- **权限导航**：`config/admin-navigation.ts` 每项声明最小权限 id，侧栏按 `hasPermission` 过滤。权威 **Permission Manifest 永远来自 PPB**（`GET /api/v1/admin/permissions/manifest`），前端零硬编码全集。

## noindex 契约（设计 §23.2）

四层防线（见 [configuration.md](./configuration.md)）：

1. `routeRules['/**'].headers` → `X-Robots-Tag`
2. `server/middleware/noindex.ts` → 每个响应的 HTTP 头
3. `app.head` + `app.vue`/`error.vue`/`[...slug]` 的 robots meta
4. `public/robots.txt` → `Disallow: /`

**回归测试**：`tests/noindex.spec.ts` 在 `pnpm build` 后对构建产物断言（`/`、`/login`、`/change-password`、未知 fallback 路由的头 / meta；`robots.txt`；无 sitemap）。

## 测试

```bash
pnpm test          # 全部 Vitest 测试
pnpm test:noindex  # 仅 noindex 回归（需先 pnpm build）
```

当前覆盖：`api-error.spec.ts`、`auth-store.spec.ts`、`permissions-store.spec.ts`、`preferences-store.spec.ts`、`log-translator.spec.ts`、`ui-button.spec.ts`、`window-geometry.spec.ts`、`noindex.spec.ts`。

## 质量门禁

```bash
pnpm lint
pnpm vue-tsc       # Nuxt prepare + vue-tsc --noEmit
pnpm test
pnpm build
pnpm test:noindex
```

> [!NOTE]
> 仓库刻意不用 `app/` 目录，源码在根目录；`nuxt.config` 中**不要**设置 `alias: { '~': '.', '@': '.' }`（相对别名会被 Vite 相对解析破坏）。详见 `docs/history/PHASE_A_PLAN.md` §3a。
