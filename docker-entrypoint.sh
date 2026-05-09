#!/bin/sh
set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Linkco CMMC Tracker v2.1 - Starting...                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── Install pg if missing (fallback) ──────────────────────────────
if ! node -e "require('pg')" 2>/dev/null; then
    echo "[INFO] Installing pg module..."
    npm install pg --no-save 2>/dev/null || true
fi

# ─── Wait for database ────────────────────────────────────────────
echo "[INFO] Waiting for database..."
RETRIES=60
while [ $RETRIES -gt 0 ]; do
    if node -e "
const { Client } = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000});
c.connect().then(() => c.query('SELECT 1')).then(() => { c.end(); process.exit(0); }).catch(() => { c.end(); process.exit(1); });
" 2>/dev/null; then
        echo "  ✓ Database ready"
        break
    fi
    echo "  ...waiting ($RETRIES retries left)"
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "[ERROR] Database connection failed"
    exit 1
fi

# ─── Run migrations ────────────────────────────────────────────────
echo "[INFO] Running Prisma migrations..."
if npx prisma migrate deploy 2>/dev/null; then
    echo "  ✓ Migrations applied"
else
    echo "  ⚠ Migrations may have already run"
fi

# ─── Seed data ─────────────────────────────────────────────────────
echo "[INFO] Seeding database..."
if npx prisma db seed 2>/dev/null; then
    echo "  ✓ Database seeded"
else
    echo "  ⚠ Seed may have already run or failed (non-critical)"
fi

# ─── Ensure upload directories ────────────────────────────────────
mkdir -p public/uploads/chat
echo "  ✓ Upload directories ready"

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
