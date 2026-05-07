#!/bin/sh
set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Starting...                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── Wait for database ─────────────────────────────────────
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; then
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

# ─── Run migrations ──────────────────────────────────────────
echo "[INFO] Running migrations..."
npx prisma migrate deploy
echo "[OK] Migrations applied"

# ─── Ensure admin user exists (CRITICAL - fixes login) ──────
echo "[INFO] Checking admin user..."

# Generate bcrypt hash for admin123
ADMIN_HASH=$(node -e "console.log(require('bcryptjs').hashSync('admin123', 10))")

# Insert admin user via SQL (guaranteed to work)
echo "INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (gen_random_uuid(), 'Admin User', 'admin@local', '$ADMIN_HASH', 'Admin', NOW())
ON CONFLICT (email) DO UPDATE SET
  password_hash = excluded.password_hash,
  name = excluded.name,
  role = excluded.role;" | npx prisma db execute --stdin

echo "[OK] Admin user ready: admin@local / admin123"

# ─── Run full seed if available ────────────────────────────
if [ -f "prisma/seed.ts" ]; then
    echo "[INFO] Running full database seed..."
    npx tsx prisma/seed.ts 2>/dev/null || echo "[WARN] Full seed skipped (may already be seeded)"
fi

# ─── Create upload directories ─────────────────────────────
mkdir -p public/uploads/chat
echo "[OK] Upload directories ready"

# ─── Start the server ──────────────────────────────────────
echo ""
echo "[OK] Starting CMMC Tracker on HTTP"
echo "    http://0.0.0.0:3000"
echo ""

# Use standalone server if available (Docker), otherwise fall back to next start
if [ -f "server.js" ]; then
    exec node server.js
else
    exec npx next start -p 3000 -H 0.0.0.0
fi
