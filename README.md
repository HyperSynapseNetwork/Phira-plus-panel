<div align="center">

# Phira+ Panel

**Phira+（Phira+ V3）三件套之一** · Nuxt 3 SPA 管理控制台 · 全站 noindex · Root 登录 · 权限驱动的运维 UI

<br/>

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Nuxt](https://img.shields.io/badge/Nuxt-3.21-00DC82.svg?logo=nuxt&logoColor=white)](https://nuxt.com/)
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883.svg?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Build](https://github.com/HyperSynapseNetwork/Phira-plus-panel/actions/workflows/build.yml/badge.svg)](https://github.com/HyperSynapseNetwork/Phira-plus-panel/actions/workflows/build.yml)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.3-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

> [!IMPORTANT]
> **Phira+ 三件套之一**：`ppb`（Phira-plus-Backend，后端）· `ppf`（Phira-plus-frontend，公开伴生站）· `panel`（本仓库，管理控制台）。
> **跨仓冻结契约见 [`contracts/README.md`](../contracts/README.md)（Contract-Freeze v0）** —— 先改契约，再实现；禁止三边猜字段。
> 本仓库采用 **Apache License, Version 2.0**，详见 [LICENSE](LICENSE)。

> [!TIP]
> 第一次来？直接看[快速开始](#快速开始)。

## 简介

**Panel（Phira+ Panel）** 是 Phira+ 的管理 / 运维界面（admin/operations presentation），一个 **Nuxt 3 SPA**（`ssr:false`）。一句话数据所有权：**Panel 只消费 PPB 的 `/api/v1/admin/*` 与 Permission Manifest 渲染管理界面，权限解析永远由服务端（PPB）裁决，前端零硬编码权限全集。**

### 核心特性

- **纯 SPA + 全站 noindex**：`ssr:false`，无 SSR/SSG/sitemap；`X-Robots-Tag: noindex,nofollow,noarchive,nosnippet,noimageindex`（Nitro 中间件 + route rules 双保险）覆盖每个路由含 fallback/404；`public/robots.txt` → `Disallow: /`；回归测试 `tests/noindex.spec.ts`
- **Root 登录**：`/login` POST `/api/v1/admin/auth/root/login`（`{password}` → `{principal_type, must_change_password}`）；首次登录强改密走 `/change-password`；`stores/auth.ts` 管理会话状态
- **权限驱动的导航**：`config/admin-navigation.ts` 声明每项所需最小权限 id，侧栏按 `hasPermission` 过滤；权威 Permission Manifest 始终来自 PPB（`GET /api/v1/admin/permissions/manifest`），前端不硬编码全集
- **管理功能页**：仪表盘 / 用户 / 用户组 / 房间 / 服务器 / 配置 / 插件 / 日志 / 控制台 / 审计 / 任务 / 通知 / 优惠券 / 自动化 / 面板偏好（每页在 PPB 端点未就绪时优雅降级）
- **统一 API 客户端**：`types/api.ts`（错误信封 / 分页 / meta）、`utils/api-error.ts`（`ApiError` + `normalizeFetchError`）、`composables/useApi.ts`（credentialed CORS 到 `NUXT_PUBLIC_API_BASE`）
- **面板偏好**：`stores/preferences.ts` + `types/preferences.ts`，命名空间 `panel`，JSONB + revision 乐观并发保存到 `/me/preferences/panel`（Phase A 内存态，绝不 localStorage-only）

## 文档

| 分类 | 文档 |
|------|------|
| **快速开始** | [docs/getting-started.md](docs/getting-started.md)（dev / build / 登录） |
| **配置** | [docs/configuration.md](docs/configuration.md)（`NUXT_PUBLIC_API_BASE` + noindex 配置） |
| **部署** | [docs/deployment.md](docs/deployment.md)（SPA 构建 → 反代 / 静态托管 + noindex 头） |
| **开发** | [docs/development.md](docs/development.md)（目录结构 / 页面 / API 客户端 / noindex 契约） |
| **历史计划** | [docs/history/PHASE_A_PLAN.md](docs/history/PHASE_A_PLAN.md)（Phase A 实施计划存档） |

## 技术栈

| 技术 | 用途 |
|------|------|
| [Nuxt](https://nuxt.com/) `3.21.11` | 框架（SPA，`ssr:false`） |
| [Vue](https://vuejs.org/) `3.5.41` | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) `5.9` | 类型系统（strict） |
| [Tailwind CSS](https://tailwindcss.com/) `4.3` + `@tailwindcss/vite` | 样式 |
| [@heroui/styles](https://www.heroui.com/) `3.2.4` | HeroUI 框架无关样式层（**非** `@heroui/vue`，无 React runtime） |
| [@nuxtjs/seo](https://nuxtseo.com/) `5.3.12` | 仅 head 管理（sitemap/robots/ogImage/schemaOrg/linkChecker 全部关闭） |
| [@pinia/nuxt](https://pinia.vuejs.org/) `1.0.1` + [pinia](https://pinia.vuejs.org/) `4.0.2` | 状态管理 |
| [@vueuse/nuxt](https://vueuse.org/) `14.4.0` | VueUse 组合函数 |
| [echarts](https://echarts.apache.org/) `6.1` + [vue-echarts](https://github.com/ecomfe/vue-echarts) `8.1` | 图表 |
| [@tanstack/vue-virtual](https://tanstack.com/virtual/) `3.13` | 虚拟列表 |

## 快速开始

> [!NOTE]
> 本地需要 Node ≥ 22 与 pnpm ≥ 11（仓库 `packageManager: pnpm@11.8.0`，pnpm 设置见 `pnpm-workspace.yaml`）。

```bash
pnpm install

# 开发预览（SPA，:3000）
pnpm dev

# 质量门禁
pnpm lint          # ESLint（@antfu/eslint-config）
pnpm vue-tsc       # Nuxt prepare + vue-tsc --noEmit
pnpm test          # Vitest 单元/组件测试
pnpm build         # Nuxt SPA 构建 → .output/server + .output/public
pnpm test:noindex  # 对构建产物的 noindex 回归检查
```

`.env.example` → `.env`，默认连 `https://api-phira.htadiy.com`（PPB）。

## 首次使用（Root 登录）

1. 访问 Panel 域名（如 `panel-phira.htadiy.com`），进入 `/login`。
2. 使用 PPB 首启打印的 Root 一次性口令登录（PPB `ppctl root reset-password` 可重置）。
3. 首次登录强制改密，然后进入仪表盘。

> [!IMPORTANT]
> Panel 是管理界面，**全站 noindex**：任何页面都不应被搜索引擎收录。反代部署时须同样输出 `X-Robots-Tag`（见 [docs/deployment.md](docs/deployment.md)）。

## 许可证

Phira+ Panel 采用 **Apache License, Version 2.0** — 详见 [LICENSE](LICENSE)。

