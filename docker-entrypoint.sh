#!/bin/sh
set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Starting...                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Wait for database
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if echo "SELECT 1;" | npx prisma db execute --stdin >/dev/null 2>&1; then
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

# Run migrations
echo "[INFO] Running migrations..."
npx prisma migrate deploy
echo "[OK] Migrations applied"

# Seed if empty
echo "[INFO] Checking seed data..."
if [ -f "prisma/seed.ts" ]; then
    npx tsx prisma/seed.ts 2>/dev/null || true
fi
if [ -f "seed-data.sql" ]; then
    npx prisma db execute --file seed-data.sql 2>/dev/null || true
fi

# Create upload dirs
mkdir -p public/uploads/chat

echo ""
echo "[OK] Starting CMMC Tracker on HTTP"
echo "    http://0.0.0.0:3000"
echo ""

exec npx next start -p 3000 -H 0.0.0.0
