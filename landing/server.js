const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const PROJECT_ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath;

  if (urlPath.startsWith('/app')) {
    const appPath = urlPath === '/app' || urlPath === '/app/' ? '/app/index.html' : urlPath;
    filePath = path.join(PROJECT_ROOT, appPath);
  } else if (urlPath === '/' || urlPath === '/index.html') {
    filePath = path.join(PROJECT_ROOT, 'landing', 'index.html');
  } else {
    filePath = path.join(PROJECT_ROOT, 'landing', urlPath);
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Finance Mind running at http://localhost:${PORT}`);
});
