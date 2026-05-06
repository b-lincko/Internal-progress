#!/bin/bash
#
# CMMC Tracker - HTTPS Production Server Launcher
# Run this after installation to start the app on HTTPS
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Load environment
if [[ -f "$APP_DIR/.env" ]]; then
    set -a
    source "$APP_DIR/.env"
    set +a
fi

PORT=${PORT:-3000}
HTTP_PORT=${HTTP_PORT:-3001}
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            CMMC Tracker - HTTPS Server                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verify certificates exist
if [[ ! -f "$APP_DIR/certs/cert.pem" || ! -f "$APP_DIR/certs/key.pem" ]]; then
    echo "❌ SSL certificates not found in $APP_DIR/certs/"
    echo "   Run ./install-and-run.sh first to generate them."
    exit 1
fi

# Verify build exists
if [[ ! -d "$APP_DIR/.next" ]]; then
    echo "❌ Build not found. Run ./install-and-run.sh first."
    exit 1
fi

echo "  🌐 HTTPS Server:  https://localhost:$PORT"
echo "  🌐 Network:       https://$LOCAL_IP:$PORT"
echo "  🔄 HTTP Redirect: http://localhost:$HTTP_PORT"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Launch the custom HTTPS server
node "$APP_DIR/server.js"
