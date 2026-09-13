/**
 * Edge TTS 代理 —— Vercel Serverless Function
 *
 * GET /api/tts?text=<文本>&voice=<语音名>&rate=<如 +25%>
 * 返回: audio/mpeg
 *
 * 合成核心在 ../lib/edge-tts.js（与 Netlify Function、本地调试共用）。
 */
const { synthesize, DEFAULT_VOICE, MAX_TEXT_LEN } = require('../lib/edge-tts');

module.exports = async (req, res) => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const text = (url.searchParams.get('text') || '').trim();
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;
  const rate = url.searchParams.get('rate') || '+0%';

  if (!text || text.length > MAX_TEXT_LEN) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: `text required, max ${MAX_TEXT_LEN} chars` }));
  }
  if (!/^[a-zA-Z-]+Neural$/.test(voice)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'invalid voice' }));
  }
  if (!/^[+-]\d{1,3}%$/.test(rate)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'invalid rate' }));
  }

  try {
    const mp3 = await synthesize(text, voice, rate);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.end(mp3);
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message }));
  }
};
