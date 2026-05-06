const { createServer } = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certsDir = path.join(__dirname, 'certs');
const port = parseInt(process.env.PORT, 10) || 3000;
const httpPort = parseInt(process.env.HTTP_PORT, 10) || 3001;
const hostname = '0.0.0.0';

// ─── Ensure upload directories exist ──────────────────────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const chatUploadsDir = path.join(uploadsDir, 'chat');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
}
if (!fs.existsSync(chatUploadsDir)) {
    fs.mkdirSync(chatUploadsDir, { recursive: true });
    console.log('✅ Created chat uploads directory');
}

// ─── SSL Certificates ─────────────────────────────────────
let httpsOptions;

function ensureCerts() {
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
        console.log('[INFO] Created certs directory:', certsDir);
    }

    const keyPath = path.join(certsDir, 'key.pem');
    const certPath = path.join(certsDir, 'cert.pem');

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log('[INFO] SSL certificates not found. Generating...');
        try {
            execSync(
                `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
                `-keyout "${keyPath}" -out "${certPath}" ` +
                `-subj "/CN=localhost" ` +
                `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
                { stdio: 'pipe' }
            );
            console.log('✅ SSL certificates generated');
        } catch (err) {
            console.error('❌ Failed to generate certificates:', err.message);
            process.exit(1);
        }
    }

    return {
        key: fs.readFileSync(path.join(certsDir, 'key.pem')),
        cert: fs.readFileSync(path.join(certsDir, 'cert.pem'))
    };
}

httpsOptions = ensureCerts();
console.log('✅ SSL certificates loaded');

// ─── Next.js Setup ──────────────────────────────────────────
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
    console.log(`🌐 Network:  https://<YOUR-IP>:${port}`);
  });

  // HTTP Redirect Server
  http.createServer((req, res) => {
    const redirectUrl = `https://${req.headers.host?.split(':')[0] || 'localhost'}:${port}${req.url}`;
    res.writeHead(301, { Location: redirectUrl });
    res.end();
  }).listen(httpPort, hostname, () => {
    console.log(`🔄 HTTP Redirect: http://${hostname}:${httpPort} → https://${hostname}:${port}`);
  });

}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});
