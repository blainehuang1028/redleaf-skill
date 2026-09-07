# 红笺官网

独立静态网站，无服务端、账号、环境密钥或运行时 API。根目录为 `website/`。代码已准备好上线；本仓库不自动部署官网。

本地查看：

```sh
python3 -m http.server 4388 --directory website
```

浏览器打开 `http://127.0.0.1:4388`。

## 内容

- `index.html`：产品说明、五主题真实 PNG/WebP 样张、npx 安装命令、技能 ZIP、复制与主题切换。
- `guide.html`：安装、配置、运行和使用边界。
- `sources.html`：图片、字体、色彩、代码来源。
- `examples/long-image/`：真实手机网页长截图的连续导出。

## 重建资产

先安装技能依赖、字体与 Chromium，然后在仓库根目录运行：

```sh
node tests/regression.mjs output/release
node scripts/package.mjs
python3 -m pip install -r requirements-dev.txt
python3 scripts/build-website.py --outputs output/release
```

回归输出必须写入新目录；也可改用另一个目录并传给 `--outputs`。网站字体使用本地子集，重新生成后保留随附 OFL 许可证。样张使用经过 `qa.json` 检查的实际输出，主题切换更换真实图片，不用 CSS 给截图改色。

## 上线

将 `website/` 内容或 `dist/redleaf-website.zip` 上传至静态托管服务。无构建步骤。服务器需将 `/` 映射到 `index.html`，保留目录结构。正式域名确定后，可添加绝对 canonical URL、绝对 Open Graph 图片 URL、sitemap 与自定义域名配置。此处不预填未确定域名。

设计延续红笺纸墨系统，疏朗布局、克制交互（variance 5 / motion 2 / density 3）。浅色页面采用暖纸色，深色遵循系统偏好；排版成品保持原始纸色。层级仅使用跳转辅助链接的一个定位层，不使用滚动劫持。
