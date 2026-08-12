# 部署（Deployment）

> Panel 是 Nuxt 3 SPA（`ssr:false`），部署即「构建 → 托管 Nitro server 或把 `.output/public` 丢给静态托管」。域名固定 `panel-phira.htadiy.com`（contract §11）。

## 构建

```bash
pnpm install
pnpm build      # → .output/（public HTML 壳 + server/index.mjs）
pnpm test:noindex  # 构建产物 noindex 回归
```

## 方式 A：Nitro Server（推荐）

`pnpm build` 产出的 Nitro server（`.output/server/index.mjs`）渲染 SPA HTML 壳并输出 `X-Robots-Tag`（middleware + route rules 双保险），由 Node 托管：

```bash
node .output/server/index.mjs
```

反代把 `panel-phira.htadiy.com` 转给该端口即可。这样 noindex 头由 Nitro 层保证。

## 方式 B：纯静态托管（+ 反代补 noindex）

把 `.output/public/` 上传到静态托管，所有未知路径回退到 `index.html`（SPA fallback）：

```nginx
server {
    listen 443 ssl http2;
    server_name panel-phira.htadiy.com;
    ssl_certificate     /etc/nginx/tls/panel-phira.htadiy.com.pem;
    ssl_certificate_key /etc/nginx/tls/panel-phira.htadiy.com.key;

    root /srv/panel/dist;   # .output/public
    index index.html;

    # SPA history fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 关键：非 Nitro 托管必须由反代补 noindex 头（design §23.2 #7）
    add_header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet, noimageindex" always;
}
```

> [!IMPORTANT]
> 静态托管没有 Nitro，`routeRules` 与 middleware 都不生效。**反代必须**为 error / fallback / 登录页补 `X-Robots-Tag`，否则 noindex 契约被破坏（`tests/noindex.spec.ts` 只覆盖 Nitro 托管产物）。

## 安全与合规

- 管理界面应置于内网 / VPN 或做 IP 白名单（配合 TLS 反代）。
- CSP、安全响应头建议在反代层强制；`panel-phira.htadiy.com` 与 `api-phira.htadiy.com` 同注册域跨源 credentialed CORS（cookie host-only 域 `api-phira.htadiy.com`）。

## CI（design §26.4）

[`.github/workflows/build.yml`](../.github/workflows/build.yml)：frozen-lockfile 安装 → ESLint → vue-tsc → Vitest → Nuxt SPA 构建 → **noindex 回归检查**（`pnpm test:noindex`）。永不生成 sitemap。

## 生产注意

- `apiBase` 默认 `https://api-phira.htadiy.com`；自部署时用 `NUXT_PUBLIC_API_BASE` 覆盖并重新构建。
- Root 登录 / 首次改密依赖 PPB `/api/v1/admin/auth/root/*`，部署前确认 PPB 已就绪。
