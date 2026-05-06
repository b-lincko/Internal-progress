#!/bin/sh
set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Docker Startup (HTTP Mode)               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── Wait for database ─────────────────────────────────────
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; then
        echo "[OK] Database is ready"
        break
    fi
    echo "[INFO] Retrying... ($RETRIES left)"
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "[ERROR] Database connection failed"
    exit 1
fi

# ─── Run migrations ──────────────────────────────────────────
echo "[INFO] Running database migrations..."
npx prisma migrate deploy
echo "[OK] Migrations applied"

# ─── Seed database if empty ────────────────────────────────
USER_COUNT=$(echo "SELECT COUNT(*) FROM users;" | npx prisma db execute --stdin 2>/dev/null | tr -d ' \n' || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    echo "[INFO] Database is empty. Seeding..."
    if [ -f "./prisma/seed.ts" ]; then
        npx tsx ./prisma/seed.ts || true
    fi
    if [ -f "./seed-data.sql" ]; then
        npx prisma db execute --file ./seed-data.sql || true
    fi
    echo "[OK] Database seeded"
else
    echo "[OK] Database has $USER_COUNT users"
fi

# ─── Create upload directories ─────────────────────────────
mkdir -p public/uploads/chat
echo "[OK] Upload directories ready"

# ─── Start HTTP server ─────────────────────────────────────
echo ""
echo "[OK] Starting CMMC Tracker HTTP Server..."
echo "    http://0.0.0.0:3000"
echo ""

exec node -e "
const http = require('http');
const path = require('path');
const fs = require('fs');
const { parse } = require('url');
const next = require('next');

const port = 3000;
const hostname = '0.0.0.0';

// Ensure upload directories
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const chatUploadsDir = path.join(uploadsDir, 'chat');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(chatUploadsDir)) fs.mkdirSync(chatUploadsDir, { recursive: true });

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http.createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, hostname, () => {
    console.log('Server running on http://' + hostname + ':' + port);
  });
});
"
