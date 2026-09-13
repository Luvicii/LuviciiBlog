# edge-tts-api —— 文章朗读语音代理

为博客"朗读文章"功能提供微软 Edge 神经语音（晓晓/云希等）合成的 Serverless 代理。

**线上地址（已部署）：https://luvicii-tts.netlify.app/api/tts**

## 为什么需要它

浏览器无法直连微软 `speech.platform.bing.com`：服务端会校验 Edge 浏览器的 User-Agent
和 muid Cookie，而浏览器的 WebSocket 握手不允许伪造这些头（实测纯浏览器握手返回 403）。
因此由 Serverless 函数在服务端完成握手与合成，把 MP3 返回给前端播放器。

令牌算法与常量来自开源项目 [edge-tts](https://github.com/rany2/edge-tts)（MIT）。
**若某天接口返回 403/502，多半是微软更新了版本号或算法，同步该仓库最新的
`constants.py` / `drm.py` 改动到 `lib/edge-tts.js` 顶部的常量即可。**

## 架构

- `lib/edge-tts.js` —— 合成核心（Sec-MS-GEC 令牌、wss 握手、MP3 组装），各平台共用
- `netlify/functions/tts.js` —— Netlify Function（**当前线上使用**）
- `api/tts.js` —— Vercel Function（备用，注意 `*.vercel.app` 域名在国内被 DNS 污染，需自定义域名才可用）
- `netlify.toml` —— 构建配置与 `/api/tts` 路由重写
- `server.js` + `demo.html` —— 本地调试服务器与语音试听页

## 重新部署（Netlify）

```bash
cd edge-tts-api
netlify deploy --build --prod        # 目录已 link，直接部署
```

注意事项：
- 站点设置里若被填了 UI 构建命令（如 jekyll），`netlify.toml` 的 `[build] command` 会覆盖它。
- 新建站点如果访客被 401 拦截，是站点开了 SSO 登录，关闭：
  `netlify api updateSite --data '{"site_id": "<id>", "body": {"sso_login": false}}'`

## 博客侧配置

`_config.luvicii.yml`：

```yaml
read_aloud:
  enable: true
  api: https://luvicii-tts.netlify.app/api/tts
  voice: zh-CN-XiaoxiaoNeural
```

改完 `hexo g -d` 重新部署博客生效。

## 本地调试

```bash
npm install
node server.js 8787
# 试听页: http://localhost:8787/  （线上也有: https://luvicii-tts.netlify.app/demo.html）
# 接口测试:
curl -o test.mp3 -G 'http://localhost:8787/api/tts' --data-urlencode 'text=你好'
```

## 接口

`GET /api/tts?text=<文本>&voice=<语音>&rate=<语速>`

| 参数 | 说明 | 默认 |
|---|---|---|
| `text` | 要合成的文本，最长 500 字 | 必填 |
| `voice` | 语音名，如 `zh-CN-XiaoxiaoNeural`（女）/ `zh-CN-YunxiNeural`（男）/ `zh-TW-HsiaoChenNeural` | `zh-CN-XiaoxiaoNeural` |
| `rate` | 语速，如 `-25%` `+0%` `+100%` | `+0%` |

返回 `audio/mpeg`，带 CDN 缓存头（24h），相同文本不重复消耗额度。

## 环境变量

- `ALLOWED_ORIGIN`：允许跨域调用的来源，默认 `*`。如需收紧：
  `netlify env:set ALLOWED_ORIGIN https://luvicii.github.io`（注意：设置后本地 hexo 预览会跨域失败）。
