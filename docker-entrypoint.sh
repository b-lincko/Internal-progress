#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║            CMMC Tracker - Docker Startup                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Generate SSL certificates if they don't exist
if [ ! -f "./certs/cert.pem" ] || [ ! -f "./certs/key.pem" ]; then
    echo "[INFO] Generating self-signed SSL certificates..."
    mkdir -p ./certs
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ./certs/key.pem \
        -out ./certs/cert.pem \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    echo "[OK] Certificates generated"
fi

# Wait for database to be ready
echo "[INFO] Waiting for database..."
until npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; do
    echo "[INFO] Database not ready yet, retrying in 2s..."
    sleep 2
done
echo "[OK] Database is ready"

# Run migrations
echo "[INFO] Running database migrations..."
npx prisma migrate deploy
echo "[OK] Migrations applied"

# Seed database if empty
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \n' || echo "0")
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
    echo "[OK] Database already has $USER_COUNT users"
fi

# Start the HTTPS server
echo ""
echo "[OK] Starting CMMC Tracker HTTPS Server..."
echo ""

exec node server.js
