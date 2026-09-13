/* Netlify Function: GET /api/tts?text=&voice=&rate= → audio/mpeg */
const { synthesize, DEFAULT_VOICE, MAX_TEXT_LEN } = require('../../lib/edge-tts');

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*' },
  body: JSON.stringify(obj)
});

exports.handler = async event => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
      body: ''
    };
  }

  const q = event.queryStringParameters || {};
  const text = (q.text || '').trim();
  const voice = q.voice || DEFAULT_VOICE;
  const rate = q.rate || '+0%';

  if (!text || text.length > MAX_TEXT_LEN) return json(400, { error: `text required, max ${MAX_TEXT_LEN} chars` });
  if (!/^[a-zA-Z-]+Neural$/.test(voice)) return json(400, { error: 'invalid voice' });
  if (!/^[+-]\d{1,3}%$/.test(rate)) return json(400, { error: 'invalid rate' });

  try {
    const mp3 = await synthesize(text, voice, rate);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'public, max-age=86400'
      },
      body: mp3.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return json(502, { error: e.message });
  }
};
