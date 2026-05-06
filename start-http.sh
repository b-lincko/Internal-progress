#!/bin/bash
#
# CMMC Tracker - HTTP Docker Startup
# Use this for LAN deployment — no SSL certificate issues
# Chat, uploads, calls all work out of the box
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - HTTP Mode (No SSL Issues)                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  This runs the app on plain HTTP — no certificate warnings."
echo "  Chat, uploads, calls all work out of the box."
echo ""

# Stop existing containers
echo "[INFO] Stopping existing containers..."
sudo docker compose down 2>/dev/null || true
sudo docker stop cmmc-app cmmc-db 2>/dev/null || true
sudo docker rm cmmc-app cmmc-db 2>/dev/null || true

# Create .env if missing
if [[ ! -f "$APP_DIR/.env" ]]; then
    echo "[INFO] Creating .env file..."
    cat > "$APP_DIR/.env" <<EOF
DB_PASSWORD=changeme-strong-password
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
EOF
    echo "[WARN] .env created with default passwords. Edit it to change them!"
fi

# Start with HTTP compose file
echo ""
echo "[INFO] Starting Docker containers in HTTP mode..."
sudo docker compose -f docker-compose.http.yml up --build -d

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ Server Started!                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 http://$LOCAL_IP:3000"
echo ""
echo "  Features:"
echo "    ✅ Chat (global + private)"
echo "    ✅ File uploads"
echo "    ✅ Voice/video calls"
echo "    ✅ Projects + tasks"
echo "    ✅ Notifications"
echo ""
echo "  No certificate warnings — everything just works."
echo ""
echo "  Logs: sudo docker compose -f docker-compose.http.yml logs -f app"
echo ""
