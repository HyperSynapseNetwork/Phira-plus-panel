# 快速开始（Getting Started）

> Panel = Phira+ 管理 / 运维界面：Nuxt 3 **SPA**（`ssr:false`）。本页覆盖本地开发、质量门禁、构建与首次登录。

## 前置条件

- Node ≥ 22
- pnpm ≥ 11（仓库 `packageManager: pnpm@11.8.0`；pnpm 设置见 `pnpm-workspace.yaml`）
- 可用的 PPB 实例，并在 `.env` 中显式设置其 URL

## 安装与开发

```bash
pnpm install

# 开发预览（Nuxt SPA dev server，:3000）
pnpm dev
```

> [!NOTE]
> `pnpm install` 的 `postinstall` 会执行 `nuxt prepare` 生成 `.nuxt/`。仓库源码在根目录（`pages/`、`components/` 等），刻意不用 `app/` 目录（避免 `~/` 别名在运行时解析到项目根的问题，见 `docs/history/PHASE_A_PLAN.md` §3a）。

## 质量门禁

```bash
pnpm lint          # ESLint（@antfu/eslint-config）
pnpm vue-tsc       # Nuxt prepare + vue-tsc --noEmit
pnpm test          # Vitest 单元/组件测试
pnpm generate      # Nuxt SPA 静态构建（.output/public）
pnpm test:noindex  # 对构建产物做 noindex 回归检查
```

CI（[build.yml](../.github/workflows/build.yml)）按 `lint → vue-tsc → test → build → test:noindex` 顺序执行。

## 构建产物

- `pnpm generate` 产出 `.output/public` 静态 SPA；生产 noindex HTTP header 由反代模板添加。
- **不生成 sitemap / robots.txt / OG 图**（`@nuxtjs/seo` 相关能力全部关闭）。
- `public/robots.txt` 静态提供 `User-agent: * / Disallow: /`。

## 首次使用（Root 登录）

1. 访问 `http://localhost:3000`（本地）或 Panel 域名（生产）。
2. `/login`：输入 PPB Root 口令。Root 是本地 principal（`user_id = NULL`，独立于 `users` 表），body `{password}` → `{principal_type:'root', must_change_password}`。
3. 若 `must_change_password=true`，跳 `/change-password` 完成首次改密（`POST /api/v1/admin/auth/root/change-password`）。
4. 会话恢复探针：`GET /api/v1/admin/auth/root/session`（Panel 启动时调用）。

## 本地配置

复制 `.env.example` → `.env`，显式设置 `NUXT_PUBLIC_API_BASE`；本地联调可使用 `http://localhost:8000`（PPB 需在 `[cors] dev_origins` 中放行 `http://localhost:3000`）。缺失或 URL 非法时开发服务器与构建均直接失败。完整变量表见 [configuration.md](./configuration.md)。
