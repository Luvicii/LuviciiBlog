# Luvicii 主题

本站（<https://luvicii.github.io/>）使用的 Hexo 主题，代码位于 `themes/luvicii/`。

> 版本 `2.0.1`（见 `package.json`），构建时会打印。主题资源全部本地自托管，不引用任何第三方主题包或上游 CDN。

## 目录结构

| 路径 | 内容 |
|---|---|
| `layout/` | Pug 模板（`post.pug` / `page.pug` / `includes/`） |
| `source/css/` | Stylus 样式，入口 `index.styl`（自动 import 各子目录） |
| `source/js/` | 主题脚本：`main.js`、`utils.js`、`luvicii/` 下的独立模块 |
| `source/img/`、`source/css/plugins/` | 本地图标字体与插件资源 |
| `scripts/` | Hexo 扩展：配置合并、资源路径生成、页面评论开关、相册封面补全等 |
| `languages/` | 多语言文案（zh-CN / zh-TW / en / default） |
| `_config.yml` | 主题默认配置（站点用 `_config.luvicii.yml` 覆盖） |

## 配置方式

站点根目录的 `_config.luvicii.yml` 是主题配置覆盖层——Hexo 会自动把 `_config.<主题名>.yml` 合并进主题配置并优先于主题自带的 `_config.yml`。**改配置请改站点那份**，主题内的那份只作为默认值。

## 构建

```bash
npx hexo clean && npx hexo generate   # 本地预览：npx hexo server
```

推送到 `main` 后由 GitHub Actions 自动构建并发布。

## 许可

GPL-3.0
