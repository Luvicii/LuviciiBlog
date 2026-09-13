/**
 * Edge TTS 合成核心（Vercel / Netlify / 本地共用）
 *
 * 浏览器无法直连微软 speech.platform.bing.com（服务端校验 Edge UA 与 muid Cookie，
 * 浏览器 WS 握手无法伪造），需在服务端完成握手。
 *
 * 令牌算法与常量来源: https://github.com/rany2/edge-tts (MIT)
 * 微软可能更新版本要求，若出现 403，请同步 edge-tts 最新 constants.py/drm.py。
 */
const { WebSocket } = require('ws');

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const GEC_VERSION = '1-143.0.3650.75';
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
const muid = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

const escapeXml = s =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function synthesize(text, voice, rate) {
  return new Promise(async (resolve, reject) => {
    const gec = await secMsGec();
    const url =
      'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
      `?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${uuid()}`;
    const ws = new WebSocket(url, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Cookie': `muid=${muid()};`,
        'Origin': EDGE_ORIGIN,
        'Accept-Encoding': 'gzip, deflate, br',
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
    ws.on('error', e => finish(new Error('websocket: ' + e.message)));
    ws.on('close', () => finish(chunks.length ? null : new Error('connection closed without audio')));
  });
}

module.exports = { synthesize, DEFAULT_VOICE, MAX_TEXT_LEN };
