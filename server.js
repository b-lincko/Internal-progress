const { createServer } = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');
const port = parseInt(process.env.PORT, 10) || 3000;
const hostname = '0.0.0.0';

// Read SSL certificates
let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(path.join(certsDir, 'key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'cert.pem'))
  };
  console.log('✅ SSL certificates loaded');
} catch (err) {
  console.error('❌ SSL certificates not found in', certsDir);
  console.error('Generate them with:');
  console.error('  openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost"');
  process.exit(1);
}

// Load Next.js request handler
const { parse } = require('url');
const next = require('next');

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // HTTPS Server
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Request error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  }).listen(port, hostname, (err) => {
    if (err) {
      console.error('Failed to start HTTPS server:', err);
      process.exit(1);
    }
    console.log(`✅ HTTPS Server running on https://${hostname}:${port}`);
    console.log(`🌐 Local:    https://localhost:${port}`);
    console.log(`🌐 Network:  https://192.168.100.68:${port}`);
  });

  // HTTP Redirect Server (port 3001)
  http.createServer((req, res) => {
    const redirectUrl = `https://${req.headers.host?.split(':')[0] || 'localhost'}:${port}${req.url}`;
    res.writeHead(301, { Location: redirectUrl });
    res.end();
  }).listen(3001, hostname, () => {
    console.log(`🔄 HTTP Redirect: http://${hostname}:3001 → https://${hostname}:${port}`);
  });

}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});
