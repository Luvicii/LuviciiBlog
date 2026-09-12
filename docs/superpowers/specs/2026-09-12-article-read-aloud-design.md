# 文章朗读（Read Aloud）功能设计

日期：2026-09-12

## 目标

让读者可以在文章页"听"文章：点击按钮后，浏览器朗读文章标题与正文，
并提供播放/暂停、上一段/下一段、语速调节与关闭控制。

## 方案选型

采用浏览器原生 **Web Speech API（speechSynthesis）**：

- 无需后端、无需 API Key、零成本；
- 使用系统语音，中文（zh-CN/zh-TW）在主流桌面与移动浏览器均可用；
- 不引入第三方依赖，符合 YAGNI。

备选（未采用）：云端 TTS（Azure/讯飞等）——音质更好但需要密钥、费用与后端代理。

## 架构

### 前端模块 `themes/luvicii/source/js/luvicii/tts.js`

自包含 IIFE，无需修改 main.js：

- `collectChunks()`：从 `#article-container` 提取 `#CrawlerTitle` 标题及
  `p, h1–h6, li` 块级元素文本；跳过 `pre/figure/table/iframe/.aplayer/.tabs/
  .gallery` 等；嵌套块（如 li>p）只取最外层；长段落按句切分为 ≤120 字的小块
  （规避 Chrome 长文本 ~15s 截断 bug，另加 Chrome keep-alive 定时器）。
- `speak(idx)`：带 token 防串话，逐块朗读；`onend` 自动播下一块；
  当前块元素加 `.read-aloud-active` 高亮并 `scrollIntoView` 居中。
- 控制条 `#read-aloud-bar`（创建一次，append 到 body，PJAX 不替换）：
  上一段 / 播放暂停 / 下一段 / 语速循环(0.75–2x) / 关闭。
- 语音选择：优先匹配 `document.documentElement.lang`，其次 zh 语音；
  监听 `voiceschanged`。
- 生命周期：`DOMContentLoaded` 与 `pjax:complete` 时幂等 `init()`
  （仅在文章页绑定 `#read-aloud-btn`，离开文章页关闭控制条）；
  `pjax:send` 与 `beforeunload` 时停止朗读并隐藏控制条。

### 样式 `themes/luvicii/source/css/_layout/tts.styl`

- 底部居中悬浮胶囊控制条，复用 `--btn-bg/--btn-color/--btn-hover-color`；
- `.read-aloud-active`：`var(--luvicii-main)` 描边高亮。
- `_layout/*` 已被 index.styl 自动导入，无需改入口。

### 模板改动

- `layout/includes/rightside.pug`：新增 `readAloud` 项（`is_post() && theme.read_aloud`），
  加入默认 show 数组；按钮 id `#read-aloud-btn`，图标 `luvicii-icon-bullhorn`。
- `layout/includes/additional-js.pug`：`theme.read_aloud` 时加载 `/js/luvicii/tts.js`（async）。
- `layout/includes/head/config.pug`：注入 `GLOBAL_CONFIG.readAloud` 文案。

### 配置与文案

- 主题 `_config.yml` 与站点 `_config.luvicii.yml` 增加 `read_aloud: true`；
  rightside_item_order 注释选项加入 `readAloud`。
- 语言文件（default/zh-CN/zh-TW/en）新增 `rightside.read_aloud_title` 与
  `read_aloud.{play,pause,prev,next,speed,close}`。

## 错误处理

- 浏览器不支持 speechSynthesis：模块直接不启用（按钮点击无控制条）。
- 无语音/语音未加载：回退默认 utterance（浏览器自选语音）。
- 朗读中翻页（PJAX）：自动停止，避免"串页朗读"。

## 验证

- `npx hexo generate` 构建通过；
- 生成的文章页 HTML 中包含 `#read-aloud-btn` 与 tts.js 引用。
