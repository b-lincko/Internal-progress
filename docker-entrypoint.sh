#!/bin/sh
set -e

echo ""
echo "Linkco CMMC Tracker - Starting..."
echo ""

# ─── Wait for database using Node.js (pg module is in the image) ───
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if node -e "
const { Client } = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000});
c.connect().then(() => c.query('SELECT 1')).then(() => { c.end(); process.exit(0); }).catch(() => { c.end(); process.exit(1); });
" 2>/dev/null; then
        echo "[OK] Database ready"
        break
    fi
    echo "[INFO] Retrying in 2s... ($RETRIES left)"
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "[ERROR] Database connection failed"
    exit 1
fi

# ─── Run migrations ────────────────────────────────────────────────
echo "[INFO] Running Prisma migrations..."
npx prisma migrate deploy 2>/dev/null || echo "[WARN] Migrate may have already run"
echo "[OK] Migrations applied"

# ─── Seed data via db seed or seed.ts ────────────────────────────
echo "[INFO] Seeding data..."
npx prisma db seed 2>/dev/null || true

# ─── Ensure upload directories exist ────────────────────────────
mkdir -p public/uploads/chat

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
