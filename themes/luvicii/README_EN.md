# Luvicii Theme

The Hexo theme used by <https://luvicii.github.io/>, located in `themes/luvicii/`.

> Version `2.0.1` (see `package.json`). All theme assets are self-hosted; no third-party theme package or upstream CDN is referenced.

## Layout

| Path | Contents |
|---|---|
| `layout/` | Pug templates (`post.pug`, `page.pug`, `includes/`) |
| `source/css/` | Stylus styles; entry point `index.styl` (imports each subdirectory) |
| `source/js/` | Theme scripts: `main.js`, `utils.js`, standalone modules under `luvicii/` |
| `scripts/` | Hexo extensions: config merge, asset path generation, per-page comment switch, album cover lookup |
| `languages/` | i18n strings (zh-CN / zh-TW / en / default) |
| `_config.yml` | Theme defaults (overridden by the site-level `_config.luvicii.yml`) |

## Configuration

The site-level `_config.luvicii.yml` is the theme config overlay: Hexo merges `_config.<theme>.yml` into the theme config, taking precedence over the theme's own `_config.yml`. **Edit the site-level file**; the in-theme one only holds defaults.

## Build

```bash
npx hexo clean && npx hexo generate   # local preview: npx hexo server
```

Pushing to `main` triggers the GitHub Actions build and deploy.

## License

GPL-3.0
