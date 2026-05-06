#!/bin/bash
#
# CMMC Tracker - Fix Uploads and Chat Issues
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
CURRENT_USER=$(whoami)
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Colors
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
N='\033[0m'

info()  { echo -e "${B}[INFO]${N}  $1"; }
ok()    { echo -e "${G}[OK]${N}    $1"; }
warn()  { echo -e "${Y}[WARN]${N}  $1"; }
err()   { echo -e "${R}[ERROR]${N} $1"; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Fix Uploads & Chat                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Fix Upload Directories ────────────────────────────
info "Setting up upload directories..."

mkdir -p "$APP_DIR/public/uploads"
mkdir -p "$APP_DIR/public/uploads/chat"
chmod -R 755 "$APP_DIR/public/uploads"
chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/public/uploads" 2>/dev/null || sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/public/uploads"

ok "Upload directories created and permissions set"

# ─── 2. Check API Routes ──────────────────────────────────
info "Checking API routes..."

for route in "src/app/api/upload/route.ts" "src/app/api/chat/route.ts"; do
    if [[ -f "$APP_DIR/$route" ]]; then
        ok "API route exists: $(basename $route)"
    else
        err "Missing API route: $route"
    fi
done

# ─── 3. Fix Server.js for Uploads ─────────────────────────
info "Creating fixed server.js with upload support..."

cat > "$APP_DIR/server.js" <<'EOF'
const { createServer } = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');
const port = parseInt(process.env.PORT, 10) || 3000;
const hostname = '0.0.0.0';

// Ensure upload directories exist
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
      
      // Log API requests for debugging
      if (req.url?.startsWith('/api/')) {
        console.log(`[API] ${req.method} ${req.url}`);
      }
      
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
    const localIP = require('os').networkInterfaces();
    let networkIP = 'unknown';
    Object.values(localIP).forEach((iface) => {
      iface?.forEach((addr) => {
        if (addr.family === 'IPv4' && !addr.internal) {
          networkIP = addr.address;
        }
      });
    });
    console.log(`✅ HTTPS Server running on https://${hostname}:${port}`);
    console.log(`🌐 Local:    https://localhost:${port}`);
    console.log(`🌐 Network:  https://${networkIP}:${port}`);
  });

  // HTTP Redirect Server (port 3001)
  const httpPort = parseInt(process.env.HTTP_PORT, 10) || 3001;
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
EOF

ok "server.js updated with upload directory creation and API logging"

# ─── 4. Test the API Endpoints ────────────────────────────
info "Testing API endpoints..."

# Wait a moment for any existing server to respond
sleep 2

# Test upload endpoint
echo ""
info "Testing /api/upload..."
echo "test file content" > /tmp/test-upload.txt

UPLOAD_RESULT=$(curl -sk -X POST \
    -F "file=@/tmp/test-upload.txt" \
    -F "uploaded_by=test-user-id" \
    "https://localhost:3000/api/upload" 2>/dev/null || echo '{"error": "connection failed"}')

echo "Upload response: $UPLOAD_RESULT"

# Test chat endpoint
info "Testing /api/chat..."
CHAT_RESULT=$(curl -sk -X GET \
    "https://localhost:3000/api/chat?room=global" 2>/dev/null || echo '{"error": "connection failed"}')

echo "Chat response: $CHAT_RESULT"

# ─── 5. Check for Errors in Log ───────────────────────────
info "Checking for any running server processes..."
ps aux | grep -E "(next|node.*server)" | grep -v grep || true

# ─── 6. Instructions ─────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   Fix Applied!                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Changes made:"
echo "    ✅ Created public/uploads and public/uploads/chat"
echo "    ✅ Set correct permissions (755)"
echo "    ✅ Updated server.js with auto-directory creation"
echo "    ✅ Added API request logging"
echo ""
echo "  Next steps:"
echo "    1. Stop the current server (Ctrl+C if running)"
echo "    2. Restart with: ./start-https.sh"
echo "    3. Check server logs for API request details"
echo ""
echo "  Access URLs:"
echo "    🌐 https://localhost:3000"
echo "    🌐 https://$LOCAL_IP:3000"
echo ""
echo "  Note: Browser will warn about self-signed certificate."
echo "        Click 'Advanced' → 'Proceed' to continue."
echo ""

# ─── 7. Offer to Restart ─────────────────────────────────
info "Restart server now? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    warn "Stopping any existing server..."
    pkill -f "node.*server.js" 2>/dev/null || true
    sleep 2
    ok "Starting server..."
    exec "$APP_DIR/start-https.sh"
else
    ok "Run './start-https.sh' when ready"
fi
