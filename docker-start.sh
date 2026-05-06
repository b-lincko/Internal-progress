#!/bin/bash
#
# CMMC Tracker - Docker Setup Script
# Generates SSL certs before Docker starts, then launches compose
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Docker Setup                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Stop existing containers ────────────────────────────
echo "[INFO] Stopping existing containers..."
sudo docker compose down 2>/dev/null || true
sudo docker stop cmmc-db cmmc-app 2>/dev/null || true
sudo docker rm cmmc-db cmmc-app 2>/dev/null || true

# ─── 2. Generate SSL Certificates ───────────────────────────
echo "[INFO] Generating SSL certificates..."

mkdir -p "$APP_DIR/certs"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$APP_DIR/certs/key.pem" \
    -out "$APP_DIR/certs/cert.pem" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP"

chmod 600 "$APP_DIR/certs/key.pem"
chmod 644 "$APP_DIR/certs/cert.pem"

echo "[OK] Certificates generated for: localhost, 127.0.0.1, $LOCAL_IP"

# ─── 3. Create .env if missing ────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
    echo "[INFO] Creating .env file..."
    cat > "$APP_DIR/.env" <<EOF
DB_PASSWORD=changeme-strong-password
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
EOF
    echo "[OK] .env created. Edit it to change passwords!"
fi

# ─── 4. Build and Start ──────────────────────────────────
echo ""
echo "[INFO] Building and starting Docker containers..."
echo ""

sudo docker compose up --build -d

echo ""
echo "[OK] Containers started!"
echo ""
echo "  App:     https://$LOCAL_IP:3000"
echo "  Redirect: http://$LOCAL_IP:3001"
echo ""
echo "  View logs: sudo docker compose logs -f app"
echo ""
