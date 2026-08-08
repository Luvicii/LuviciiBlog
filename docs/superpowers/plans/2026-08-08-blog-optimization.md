# Blog Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix SEO fundamentals (site URL, sitemap, RSS, robots.txt), make local search work, safely stage comment config, and consolidate deployment onto a hardened GitHub Actions pipeline with asset minification.

**Architecture:** Pure configuration + build-pipeline changes on a Hexo 7.3.0 site with the luvicii theme (anzhiyu fork). New generator plugins (`hexo-generator-sitemap`, `hexo-generator-feed`, `hexo-generator-search`) emit `sitemap.xml`, `atom.xml`, `search.xml` at build time; a minimal `gulpfile.js` minifies `public/` in CI before `peaceiris/actions-gh-pages` publishes to `Luvicii/Luvicii.github.io`.

**Tech Stack:** Hexo 7, Node 20, gulp 5 + gulp-htmlmin/gulp-clean-css/gulp-terser, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-08-blog-optimization-design.md`

**Conventions:** This is a config project — there is no test suite. Each task's "test" is a build (`npx hexo generate`) plus grep/file-existence checks with exact expected output. Commit after every task. Never push; CI deploys on the user's next push.

---

### Task 1: Update npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove conflicting/unused packages**

```bash
npm uninstall hexo-deployer-git hexo-theme-landscape
```

- [ ] **Step 2: Install generator plugins and gulp minifiers**

```bash
npm install hexo-generator-sitemap hexo-generator-feed hexo-generator-search
npm install gulp-htmlmin gulp-clean-css gulp-terser
```

- [ ] **Step 3: Remove the obsolete deploy script from package.json**

In `package.json`, delete this line from `"scripts"`:

```json
    "deploy": "hexo deploy",
```

(The `deploy:` block in `_config.yml` is removed in Task 2; CI is now the only deploy path.)

- [ ] **Step 4: Verify install**

Run: `npm ls hexo-generator-sitemap hexo-generator-feed hexo-generator-search gulp-htmlmin gulp-clean-css gulp-terser`
Expected: all six listed with versions, no `UNMET DEPENDENCY` errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: swap deployer/landscape for sitemap, feed, search generators and gulp minifiers"
```

---

### Task 2: Site config — URL, SEO fields, generator config, robots.txt

**Files:**
- Modify: `_config.yml`
- Create: `source/robots.txt`

- [ ] **Step 1: Fix the Site block in `_config.yml` (lines 6-12)**

Replace:

```yaml
title: Luvicii
subtitle: ''
description: ''
keywords:
author: Luvicii
language: zh-CN
timezone: ''
```

with:

```yaml
title: Luvicii
subtitle: '生活明朗，万物可爱'
description: 'Luvicii 的个人博客，分享数码科技、大学生活、跑步与生活日常。'
keywords: 'Luvicii,个人博客,数码科技,生活日常,跑步'
author: Luvicii
language: zh-CN
timezone: 'Asia/Shanghai'
```

- [ ] **Step 2: Fix the URL in `_config.yml` (line 16)**

Replace `url: http://example.com` with:

```yaml
url: https://luvicii.github.io
```

- [ ] **Step 3: Remove the Deployment block from `_config.yml` (lines 101-107)**

Delete:

```yaml
# Deployment
## Docs: https://hexo.io/docs/one-command-deployment
deploy:
  type: git
  repo: https://Luvicii@github.com/Luvicii/Luvicii.github.io.git
  branch: main
  message: "Site updated: {{ now('MM-DD HH:mm:ss') }}"
```

- [ ] **Step 4: Append generator config to the end of `_config.yml`**

```yaml
# Sitemap (hexo-generator-sitemap)
sitemap:
  path: sitemap.xml
baidusitemap:
  path: baidusitemap.xml

# RSS (hexo-generator-feed)
feed:
  enable: true
  type: atom
  path: atom.xml
  limit: 20
  hub:
  content: true
  content_limit: 140
  content_limit_delim: ' '
  order_by: -date

# Local search index (hexo-generator-search)
search:
  path: search.xml
  field: post
  content: true
```

- [ ] **Step 5: Create `source/robots.txt`**

```
User-agent: *
Allow: /
Disallow: /json/

Sitemap: https://luvicii.github.io/sitemap.xml
Sitemap: https://luvicii.github.io/baidusitemap.xml
```

(`/json/` holds Hexo-generated data JSON not meant for indexing; everything else is allowed.)

- [ ] **Step 6: Build and verify generated files**

Run:

```bash
npx hexo clean && npx hexo generate
ls -la public/sitemap.xml public/baidusitemap.xml public/atom.xml public/search.xml public/robots.txt
```

Expected: build exits 0; all five files exist.

- [ ] **Step 7: Verify no example.com remains in output**

Run: `grep -rl "example.com" public/ | head -5`
Expected: no output (no files contain `example.com`).

- [ ] **Step 8: Commit**

```bash
git add _config.yml source/robots.txt
git commit -m "feat(seo): set site url/timezone/description, add sitemap, RSS and search index, robots.txt"
```

---

### Task 3: Theme config — verification placeholders, links, search, comments staging

**Files:**
- Modify: `_config.luvicii.yml`

- [ ] **Step 1: Fix nav link typo (line 32)**

Replace `link: https://Luvicc.github.io` with:

```yaml
          link: https://luvicii.github.io
```

- [ ] **Step 2: Fix social GitHub link (line 69)**

Replace `   Github: https://github.com || luvicii-icon-github` with:

```yaml
   Github: https://github.com/Luvicii || luvicii-icon-github
```

- [ ] **Step 3: Enable local search (lines 111-114)**

Replace:

```yaml
local_search:
  enable: false
  preload: true
  CDN:
```

with:

```yaml
local_search:
  enable: true
  preload: true
  CDN:
```

- [ ] **Step 4: Disable comment count until a backend exists (lines 314-323)**

Replace `  count: true # Display comment count in post's top_img` with:

```yaml
  count: false # Display comment count in post's top_img (disabled until Twikoo/Waline backend is deployed)
```

- [ ] **Step 5: Annotate comment backend placeholders (lines 352, 363)**

Replace `  serverURL: # Waline server address url` with:

```yaml
  serverURL: # Waline server address url — paste https://your-waline.vercel.app here once deployed, then set comments.count back to true
```

Replace the twikoo block:

```yaml
twikoo:
  envId:
  region:
```

with:

```yaml
twikoo:
  envId: # paste your Twikoo envId (Tencent CloudBase env id or Vercel URL) here once deployed, then set comments.count back to true
  region:
```

- [ ] **Step 6: Disable newest-comments card (line 866)**

In the `newest_comments:` block, replace `  enable: true` with:

```yaml
  enable: false # requires a working comment backend (Twikoo envId / Waline serverURL)
```

Note: `enable: true` also appears elsewhere in the file — edit only the occurrence inside `newest_comments:` (the block starting at line 865).

- [ ] **Step 7: Disable friends circle until API exists (lines 1084-1087)**

Replace:

```yaml
friends_vue:
  enable: true
  vue_js: /js/plugins/friends.js
  apiurl: # 朋友圈后端地址
```

with:

```yaml
friends_vue:
  enable: false # enable once apiurl below is set
  vue_js: /js/plugins/friends.js
  apiurl: # 朋友圈后端地址 — paste hexo-circle-of-friends API URL here, then set enable back to true
```

- [ ] **Step 8: Remove placeholder site verifications (lines 601-607)**

Replace:

```yaml
site_verification:
  - name: google-site-verification
    content: xxx
  - name: baidu-site-verification
    content: code-xxx
  - name: msvalidate.01
    content: xxx
```

with:

```yaml
site_verification: [] # add entries here after verifying with Google/Baidu/Bing webmaster tools
```

- [ ] **Step 9: Build and verify**

Run:

```bash
npx hexo clean && npx hexo generate
grep -c "google-site-verification" public/index.html; grep -rl "Luvicc" public/ | head -5; grep -c "search.xml\|local-search" public/index.html
```

Expected: `0` verification tags; no files containing `Luvicc`; the last grep returns a count > 0 (local search assets linked).

- [ ] **Step 10: Commit**

```bash
git add _config.luvicii.yml
git commit -m "feat(theme): enable local search, stage comment config, remove placeholder verification tags, fix links"
```

---

### Task 4: Asset minification with gulp

**Files:**
- Create: `gulpfile.js`
- Modify: `package.json`

- [ ] **Step 1: Create `gulpfile.js`**

```js
const { src, dest, parallel } = require('gulp');
const htmlmin = require('gulp-htmlmin');
const cleanCSS = require('gulp-clean-css');
const terser = require('gulp-terser');

const pub = 'public';

function minifyHtml() {
  return src(`${pub}/**/*.html`)
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
      minifyJS: false,
      minifyCSS: false
    }))
    .pipe(dest(pub));
}

function minifyCss() {
  return src(`${pub}/**/*.css`)
    .pipe(cleanCSS())
    .pipe(dest(pub));
}

function minifyJs() {
  return src(`${pub}/**/*.js`)
    .pipe(terser())
    .pipe(dest(pub));
}

exports.min = parallel(minifyHtml, minifyCss, minifyJs);
```

(Inline JS/CSS minification stays off — some theme inline snippets are not valid standalone JS and terser would choke on them; standalone `.js`/`.css` files still get minified.)

- [ ] **Step 2: Add scripts to `package.json`**

In `"scripts"`, replace `"build": "hexo generate",` with:

```json
    "build": "hexo generate && gulp min",
    "min": "gulp min",
```

- [ ] **Step 3: Verify minification works and shrinks output**

Run:

```bash
npx hexo clean && npx hexo generate && du -sh public/ && npx gulp min && du -sh public/
```

Expected: `gulp min` exits 0; second `du` shows a smaller size than the first.

- [ ] **Step 4: Commit**

```bash
git add gulpfile.js package.json
git commit -m "build: add gulp minification for HTML/CSS/JS in public/"
```

---

### Task 5: Harden the GitHub Actions deploy workflow

**Files:**
- Modify: `.github/workflows/autodeploy.yml`

- [ ] **Step 1: Replace the entire workflow file with**

```yaml
name: Auto Deploy to Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate and minify site
        run: |
          npx hexo clean
          npx hexo generate
          npx gulp min
          [ -f public/index.html ] || exit 1

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          personal_token: ${{ secrets.PAT }}
          external_repository: Luvicii/Luvicii.github.io
          publish_branch: main
          publish_dir: ./public
          commit_message: "Deploy: ${{ github.sha }}"
```

Keeps the existing `PAT` secret and target repo, but drops the global hexo-cli install, hand-rolled `git init`, and full-history force-push in favor of an atomic publish.

- [ ] **Step 2: Validate the YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/autodeploy.yml'))"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/autodeploy.yml
git commit -m "ci: cache npm, use npx hexo, minify assets, deploy via peaceiris/actions-gh-pages"
```

---

### Task 6: Remove stray files and run full verification

**Files:**
- Delete: `_config.landscape.yml`
- Delete: `source_dataalbum.yml`

(`source_dataalbum.yml` is an empty 1-line stray; real album data already lives at `source/_data/album.yml`. The landscape theme config is unused since `theme: luvicii`.)

- [ ] **Step 1: Delete stray files**

```bash
git rm _config.landscape.yml source_dataalbum.yml
```

- [ ] **Step 2: Fresh-install build**

Run:

```bash
rm -rf node_modules && npm ci && npx hexo clean && npx hexo generate && npx gulp min
```

Expected: all steps exit 0.

- [ ] **Step 3: Verify generated SEO assets**

Run: `ls -la public/sitemap.xml public/baidusitemap.xml public/atom.xml public/search.xml public/robots.txt`
Expected: all five files exist.

- [ ] **Step 4: Verify URL and placeholder cleanup**

Run:

```bash
grep -c "luvicii.github.io" public/index.html
grep -rl "example.com\|Luvicc\|google-site-verification" public/ | head -5
```

Expected: first grep > 0; second grep prints nothing.

- [ ] **Step 5: Smoke-test with local server**

Run:

```bash
npx hexo server &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/sitemap.xml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/atom.xml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/search.xml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/robots.txt
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/404.html
curl -s http://localhost:4000/ | grep -o 'rel="canonical" href="[^"]*"'
kill %1
```

Expected: all status codes `200`; canonical href is `https://luvicii.github.io/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove unused landscape config and stray album data file"
```

---

## Self-Review Notes

- Spec coverage: Area 1 → Tasks 1-3; Area 2 → Tasks 1, 3; Area 3 → Tasks 1, 4, 5, 6. All spec items mapped, including permalink restructuring being explicitly out of scope.
- No placeholders: every edit shows exact before/after content; every check has an exact command and expected output.
- Consistency: plugin names in Task 1 match config keys in Task 2 (`sitemap`, `feed`, `search`); gulp task name `min` is the same in `gulpfile.js`, `package.json`, and the workflow.
