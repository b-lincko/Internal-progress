#!/bin/bash
#
# CMMC Tracker - Fix Server Issues
# Fixes .env permissions and upload directories
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
CURRENT_USER=$(whoami)

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
echo "║  CMMC Tracker - Server Fix                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Fix .env Permissions ──────────────────────────────
info "Fixing .env file permissions..."

if [[ -f "$APP_DIR/.env" ]]; then
    # Make .env readable by the user running the server
    chmod 644 "$APP_DIR/.env"
    chown "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/.env" 2>/dev/null || sudo chown "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/.env"
    ok ".env permissions fixed (now readable by server user)"
else
    warn ".env file not found!"
fi

# ─── 2. Fix Upload Directories ────────────────────────────
info "Fixing upload directories..."

mkdir -p "$APP_DIR/public/uploads"
mkdir -p "$APP_DIR/public/uploads/chat"
chmod -R 755 "$APP_DIR/public/uploads"
chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/public/uploads" 2>/dev/null || sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR/public/uploads"

ok "Upload directories ready"

# ─── 3. Fix start-https.sh ────────────────────────────────
info "Updating start-https.sh..."

cat > "$APP_DIR/start-https.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Load environment variables
if [[ -f "$APP_DIR/.env" ]]; then
    # Check if we can read .env
    if [[ -r "$APP_DIR/.env" ]]; then
        set -a
        source "$APP_DIR/.env"
        set +a
        echo "✅ Environment loaded from .env"
    else
        echo "⚠️  Warning: Cannot read .env file. Using defaults."
        echo "   Run: chmod 644 $APP_DIR/.env"
    fi
fi

PORT=${PORT:-3000}
HTTP_PORT=${HTTP_PORT:-3001}
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            CMMC Tracker - HTTPS Server                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [[ ! -d "$APP_DIR/.next" ]]; then
    echo "❌ Build not found. Run: npm run build"
    exit 1
fi

if [[ ! -f "$APP_DIR/certs/cert.pem" || ! -f "$APP_DIR/certs/key.pem" ]]; then
    echo "❌ SSL certificates not found in $APP_DIR/certs/"
    exit 1
fi

echo "  🌐 HTTPS:   https://localhost:$PORT"
echo "  🌐 Network: https://$LOCAL_IP:$PORT"
echo "  🔄 HTTP:    http://localhost:$HTTP_PORT → HTTPS"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

node "$APP_DIR/server.js"
EOF

chmod +x "$APP_DIR/start-https.sh"
ok "start-https.sh updated with better .env handling"

# ─── 4. Verify Everything ────────────────────────────────
info "Verifying setup..."

echo ""
echo "File permissions:"
ls -la "$APP_DIR/.env"

echo ""
echo "Upload directories:"
ls -la "$APP_DIR/public/uploads/"

echo ""
echo "Server script:"
ls -la "$APP_DIR/start-https.sh"

# ─── 5. Test ─────────────────────────────────────────────
echo ""
info "Testing upload API..."

# Create test file
echo "test content" > /tmp/test-upload.txt

UPLOAD_RESPONSE=$(curl -sk -X POST \
    -F "file=@/tmp/test-upload.txt" \
    -F "uploaded_by=test-user" \
    "https://localhost:3000/api/upload" 2>/dev/null || echo '{"error": "connection failed"}')

echo "Upload response: $UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
    ok "Upload API is working!"
else
    warn "Upload API may have issues (server might need restart)"
fi

# ─── 6. Done ─────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ Fixes Applied!                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Restart the server now:"
echo "    Ctrl+C (if running)"
echo "    ./start-https.sh"
echo ""
echo "  Test uploads at: https://$LOCAL_IP:3000/documents"
echo "  Test chat at: https://$LOCAL_IP:3000/chat"
echo ""
