# 文章朗读（Read Aloud）功能设计

日期：2026-09-12（当日修订：发声引擎由浏览器原生语音改为微软 Edge 神经语音）

## 目标

让读者可以在文章页"听"文章：点击按钮后朗读文章标题与正文，
提供播放/暂停、上一段/下一段、语速调节与关闭控制。

## 方案选型（修订）

初版采用浏览器原生 Web Speech API，实测在本机 Linux 上语音为 espeak 机械音，
质量不可接受；且音质取决于访客设备，体验不一致。遂改为 **Edge TTS（微软神经语音）**。

实测结论（2026-09-12）：

- 微软 `speech.platform.bing.com` 的 readaloud 接口校验 Edge UA + muid Cookie，
  浏览器 WebSocket 无法伪造 → **纯浏览器直连不可行**（握手 403）。
- 服务端携带 edge-tts 项目同款请求头可正常合成（Node 实测产出有效 MP3）。
- 因此采用 **Serverless 代理**方案。后续落地时（2026-09-13）发现：

- `*.vercel.app` 域名在国内被 DNS 污染（解析到 Facebook IP），对国内访客不可用；
- 预生成 MP3 + jsDelivr 托管被用户否决（加重文章发布流程，不符合"锦上添花"定位）；
- 百度翻译 gettts 可直连但音质被用户否决；
- **最终采用 Netlify Functions**：实测 `*.netlify.app` 在国内可正常访问，
  已部署至 https://luvicii-tts.netlify.app/api/tts（线上实测 200，约 2s 返回 MP3）。

部署注意：新建 Netlify 站点默认开启 SSO 登录（访客 401），需 API 关闭；
站点 UI 中可能残留错误构建命令，`netlify.toml` 的 `[build]` 可覆盖。

## 架构

```
文章页 tts.js --fetch(段落文本)--> Vercel /api/tts --wss--> speech.platform.bing.com
     <----- audio/mpeg (Blob) ----<audio> 播放<------
```

### 代理函数 `edge-tts-api/netlify/functions/tts.js`（Vercel 版在 api/tts.js，共用 lib/edge-tts.js）

- `GET /api/tts?text=&voice=&rate=` → `audio/mpeg`；text ≤500 字，voice/rate 白名单校验。
- 服务端实现 edge-tts 协议：Sec-MS-GEC 令牌（5 分钟窗口 + WIN_EPOCH + SHA-256）、
  muid Cookie、Edg UA、chrome-extension Origin；wss 分段收取 `Path:audio` 二进制帧拼成 MP3。
- 响应带 24h CDN 缓存头；`ALLOWED_ORIGIN` 环境变量控制 CORS。
- 维护注意：微软更新版本要求时同步 edge-tts 最新 constants.py/drm.py 到文件顶部常量。

### 前端模块 `themes/luvicii/source/js/luvicii/tts.js`

- 分块：标题 + `#article-container` 内 `p,h1-h6,li`（跳过 pre/figure/table/.aplayer 等；
  嵌套取最外层），按句切分 ≤120 字。
- 播放：逐块 fetch 代理接口 → Blob → objectURL → `<audio>` 播放；`ended` 自动播下一块；
  播放当前块时**预取下一块**（cache: idx→Promise<Blob>），调速后清空缓存重合成。
- 控制条 `#read-aloud-bar`：上一段 / 播放暂停 / 下一段 / 语速(0.75–2x) / 关闭；
  合成等待期间播放按钮显示旋转 spinner；失败用 `luvicii.snackbarShow` 提示。
- 高亮：当前块 `.read-aloud-active` 描边 + 平滑滚动居中。
- 生命周期：DOMContentLoaded / pjax:complete 幂等 init；pjax:send / beforeunload 停止并清空缓存。

### 样式 `_layout/tts.styl`

底部居中胶囊控制条（复用 --btn-bg/--btn-color/--btn-hover-color）+ 段落描边高亮 + spinner 动画。

### 模板/配置

- `rightside.pug`：`readAloud` 项（仅文章页且 `read_aloud.enable && read_aloud.api` 时渲染），
  默认加入 show 组，图标 `luvicii-icon-bullhorn`。
- `additional-js.pug`：同条件加载 `/js/luvicii/tts.js`。
- `config.pug`：注入 `GLOBAL_CONFIG.readAloud = {api, voice, play, pause, prev, next, speed, close, error}`。
- 配置（主题与站点 `_config.luvicii.yml`）：
  ```yaml
  read_aloud:
    enable: true
    api: <Vercel 代理地址>
    voice: zh-CN-XiaoxiaoNeural
  ```
  语音默认按页面语言映射（zh-CN→晓晓 / zh-TW→HsiaoChen / 其他→en-US-Jenny）。
- 语言文件（default/zh-CN/zh-TW/en）：`rightside.read_aloud_title` 与 `read_aloud.*`。

## 错误处理

- 未配置 `api`：按钮与脚本均不输出，功能完全关闭。
- 合成失败（网络/微软接口变动）：snackbar 提示"语音合成失败"，停止播放；该块缓存被清除可重试。
- 朗读中 PJAX 翻页：自动停止、清缓存、隐藏控制条。

## 验证

- 代理函数本地实测：`api/tts.js` 经 `server.js` 返回有效 MP3（48kbps/24kHz），
  参数校验（空 text / 非法 rate）返回 400。
- 无头 Chrome E2E（真实鼠标事件）：点击 → spinner → audio 播放（图标转 pause）→
  高亮 H1 → 下一段合成并续播 → 暂停/继续/调速/关闭全部正常，无 JS 异常。
- `npx hexo generate` 构建通过。
