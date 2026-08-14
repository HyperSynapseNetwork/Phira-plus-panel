# 部署（Deployment）

> Panel 是 Nuxt 3 纯静态 SPA（`ssr:false`）。构建后只托管 `.output/public`，并由反向代理统一处理深路由回退与 noindex 响应头。

## 构建

```bash
pnpm install
pnpm generate   # → .output/public
pnpm test:noindex  # 构建产物 noindex 回归
```

## 静态托管

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

仓库中的 `deploy/nginx.conf` 与 `deploy/Caddyfile` 是权威模板。静态托管没有 Nitro，`routeRules` 不会生成生产响应头；反代必须为正常页、登录页和 fallback 统一添加 `X-Robots-Tag`。

## 安全与合规

- 管理界面应置于内网 / VPN 或做 IP 白名单（配合 TLS 反代）。
- CSP、安全响应头建议在反代层强制；`panel-phira.htadiy.com` 与 `api-phira.htadiy.com` 同注册域跨源 credentialed CORS（cookie host-only 域 `api-phira.htadiy.com`）。

## CI（design §26.4）

[`.github/workflows/build.yml`](../.github/workflows/build.yml)：frozen-lockfile 安装 → ESLint → vue-tsc → Vitest → Nuxt SPA 构建 → **noindex 回归检查**（`pnpm test:noindex`）。永不生成 sitemap。

## 生产注意

- 构建时显式设置 `NUXT_PUBLIC_API_BASE`；自部署不得依赖官方 API 默认值。
- Root 登录 / 首次改密依赖 PPB `/api/v1/admin/auth/root/*`，部署前确认 PPB 已就绪。
