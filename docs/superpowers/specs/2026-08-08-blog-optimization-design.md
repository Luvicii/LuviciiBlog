# Blog Optimization Design — SEO, Search/Comments, Build/Deploy

Date: 2026-08-08
Project: LuviciiBlog (Hexo 7.3.0 + luvicii theme, deployed via GitHub Actions to Luvicii.github.io)

## Context

Audit findings driving this design:

- `_config.yml:16` has `url: http://example.com` (unset), empty `description`/`keywords`/`subtitle`/`timezone`.
- No sitemap, RSS feed, or `robots.txt`.
- `_config.luvicii.yml` has placeholder `site_verification` values (`xxx`) that inject bogus meta tags; nav link typo `https://Luvicc.github.io`; social GitHub link points to `https://github.com`.
- All search systems disabled, yet the 404 page suggests on-site search.
- Comments set to `Twikoo/Waline` with no `envId`/`serverURL`; `newest_comments` card enabled; `friends_vue` enabled with empty `apiurl`.
- Two conflicting deploy paths: `hexo deploy` (hexo-deployer-git) and the GitHub Actions workflow; workflow hand-rolls `git init` + force-push with a PAT.
- `gulp` is a dependency with no `gulpfile.js`; `hexo-theme-landscape` and `_config.landscape.yml` unused; `source_dataalbum.yml` at repo root is an empty stray file (real data already at `source/_data/album.yml`).

Decisions confirmed with user:

- Production URL: `https://luvicii.github.io` (no custom domain).
- No comment backend deployed yet — prepare config, don't wire credentials.
- Scope: all three areas below, implemented in one pass.

## Area 1 — SEO essentials

- `_config.yml`:
  - `url: https://luvicii.github.io`
  - `timezone: Asia/Shanghai`
  - Fill `subtitle`, `description`, `keywords` (Chinese, matching blog identity).
- Install `hexo-generator-sitemap` and `hexo-generator-feed`; add config blocks:
  - `sitemap: path: sitemap.xml`, `baidusitemap: path: baidusitemap.xml`
  - `feed: enable: true`, `type: atom`, `path: atom.xml`, `limit: 20`
- Add `source/robots.txt` allowing all crawlers and referencing `https://luvicii.github.io/sitemap.xml`.
- `_config.luvicii.yml`:
  - Empty the `site_verification` list (remove `xxx` placeholders).
  - Fix nav link `https://Luvicc.github.io` → `https://luvicii.github.io`.
  - Fix social GitHub link → `https://github.com/Luvicii`.
- Explicitly out of scope: permalink restructuring (hexo-abbrlink) — would break existing URLs.

## Area 2 — Search & comments

- Install `hexo-generator-search`; add config: `search: path: search.xml, field: post, content: true`.
- `_config.luvicii.yml`: `local_search.enable: true` (keep `preload: true`).
- Comments: keep `comments.use: Twikoo/Waline` unchanged, but until a backend exists:
  - `newest_comments.enable: false`
  - `comments.count: false`
  - Add a comment at `twikoo.envId` / `waline.serverURL` noting exactly what to paste when deployed.
- `friends_vue.enable: false` until a circle-of-friends API URL is available (leave `apiurl` empty with a note).

## Area 3 — Build & deploy cleanup

- `_config.yml`: remove the `deploy:` block.
- Uninstall `hexo-deployer-git`, `hexo-theme-landscape`; delete `_config.landscape.yml` and `source_dataalbum.yml`.
- `.github/workflows/autodeploy.yml`:
  - Add npm cache to `setup-node`.
  - Install with `npm ci` only (drop global hexo-cli; use `npx hexo`).
  - Replace hand-rolled git push step with `peaceiris/actions-gh-pages@v4` using `personal_token: ${{ secrets.PAT }}`, `external_repository: Luvicii/Luvicii.github.io`, `publish_branch: main`, `publish_dir: ./public`.
  - Run the gulp minify step after `hexo generate`.
- Add minimal `gulpfile.js` minifying `public/`: HTML (gulp-htmlmin), CSS (gulp-clean-css), JS (gulp-terser); default task `gulp min` reading from `public/` and writing back in place. No image compression (images live on the jsDelivr 图床, not in the repo).
- `package.json`: add `"min": "gulp min"` script and post-build wiring so CI runs `hexo generate && gulp min`.

## Error handling / risks

- If `npm ci` fails after dependency changes, regenerate `package-lock.json` and re-run before touching configs further.
- Theme config keys are validated by grepping the theme source (`themes/luvicii/`) for each key before relying on it.
- CI changes are verified by YAML lint (actionlint if available, else `python -c "import yaml..."`) — no push is performed; the user deploys on their next push to `main`.

## Verification

1. `npm ci` succeeds.
2. `hexo clean && npx hexo generate` succeeds.
3. `gulp min` runs and reduces `public/` size.
4. Grep checks on `public/`:
   - `sitemap.xml`, `atom.xml`, `search.xml`, `robots.txt` exist.
   - Canonical/OG URLs contain `luvicii.github.io`, not `example.com`.
   - No `xxx` verification meta tags.
   - No `Luvicc` typo.
5. Brief `hexo server` smoke test of `/`, a post page, `/search` presence in nav, and 404 page.
