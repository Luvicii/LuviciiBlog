/**
 * Edge TTS 合成核心（Vercel / Netlify / 本地共用）
 *
 * 浏览器无法直连微软的语音服务（服务端校验 Origin/UA，浏览器 WS 握手无法伪造），
 * 需在服务端完成握手。
 *
 * 端点变更（2026-10）：旧域名 speech.platform.bing.com 已对所有合成请求返回 403，
 * 微软 Edge 改走 api.msedgeservices.com，并把旧 TrustedClientToken 当作
 * Ocp-Apim-Subscription-Key 传入。令牌算法（Sec-MS-GEC，SHA-256）不变。
 *
 * 令牌算法与常量来源: https://github.com/rany2/edge-tts (MIT)
 * 参考实现: node-edge-tts@1.2.11（同样的新端点 + 旧令牌）
 * 若再次出现 403，先同步 edge-tts 最新 constants.py/drm.py 的版本号与端点。
 */
const { WebSocket } = require('ws');

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const GEC_VERSION = '1-143.0.3650.75';
const WSS_URL = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const EDGE_ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const MAX_TEXT_LEN = 500;
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

async function secMsGec() {
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ticks.toFixed(0) + TOKEN));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const uuid = () => crypto.randomUUID().replace(/-/g, '');

const escapeXml = s =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function synthesizeOnce(text, voice, rate) {
  return new Promise(async (resolve, reject) => {
    const gec = await secMsGec();
    const url =
      WSS_URL +
      `?Ocp-Apim-Subscription-Key=${TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}`;
    const ws = new WebSocket(url, {
      origin: EDGE_ORIGIN,
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': EDGE_UA
      }
    });
    ws.binaryType = 'arraybuffer';
    const chunks = [];
    let done = false;
    const timer = setTimeout(() => finish(new Error('synthesis timeout')), 20000);
    const finish = err => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      err ? reject(err) : resolve(Buffer.concat(chunks));
    };
    ws.on('open', () => {
      const ts = new Date().toString();
      ws.send(
        'X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"' + OUTPUT_FORMAT + '"}}}}'
      );
      const ssml =
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>" +
        `<voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`);
    });
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        if (data.toString().includes('Path:turn.end')) finish(null);
        return;
      }
      const buf = Buffer.from(data);
      const hlen = buf.readUInt16BE(0);
      const header = buf.slice(2, 2 + hlen).toString();
      if (header.includes('Path:audio') && buf.length > 2 + hlen) chunks.push(buf.slice(2 + hlen));
    });
    ws.on('unexpected-response', (req, res) => {
      const retryAfter = Number(res.headers['retry-after']);
      let snippet = '';
      const limit = 240;
      res.on('data', d => { if (snippet.length < limit) snippet += d.toString('utf8', 0, limit); });
      res.on('end', () => finish(Object.assign(new Error('http ' + res.statusCode + (snippet ? ' :: ' + snippet.replace(/\s+/g, ' ').slice(0, 200) : '')), {
        status: res.statusCode,
        body: snippet,
        ...(retryAfter > 0 ? { retryAfter: retryAfter * 1000 } : {})
      })));
      res.on('error', () => finish(Object.assign(new Error('http ' + res.statusCode), { status: res.statusCode })));
      setTimeout(() => finish(Object.assign(new Error('http ' + res.statusCode), { status: res.statusCode })), 3000);
      try { res.resume(); } catch {}
    });
    ws.on('error', e => {
      const m = /Unexpected server response: (\d{3})/.exec(e.message || '');
      const err = new Error('websocket: ' + e.message);
      if (m) err.status = Number(m[1]);
      finish(err);
    });
    ws.on('close', () => finish(chunks.length ? null : new Error('connection closed without audio')));
  });
}

// 微软对同一来源的连发请求会回 429，预取/连播时容易撞上；按 Retry-After 退避重试
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

async function synthesize(text, voice, rate) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await synthesizeOnce(text, voice, rate);
    } catch (e) {
      lastError = e;
      if (!RETRYABLE.has(e.status) || attempt === MAX_ATTEMPTS - 1) break;
      const wait = e.retryAfter || 600 * (attempt + 1);
      await new Promise(r => setTimeout(r, Math.min(wait, 5000)));
    }
  }
  throw lastError;
}

module.exports = { synthesize, DEFAULT_VOICE, MAX_TEXT_LEN };
