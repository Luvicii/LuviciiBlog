/* 本地调试服务器 + 语音试听页：node server.js [port]
 * 试听页: http://localhost:8787/        接口: /api/tts?text=你好
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/tts');

const port = Number(process.argv[2]) || 8787;

http
  .createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/?')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return fs.createReadStream(path.join(__dirname, 'demo.html')).pipe(res);
    }
    handler(req, res);
  })
  .listen(port, () => {
    console.log(`试听页: http://localhost:${port}/`);
  });
