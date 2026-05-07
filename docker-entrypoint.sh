#!/bin/sh
set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Linkco CMMC Tracker - Starting...                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─── Wait for database ─────────────────────────────────────
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if PGPASSWORD=changeme-strong-password psql -h db -U cmmc -d cmmc2 -c "SELECT 1;" > /dev/null 2>&1; then
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
echo "[INFO] Running Prisma migrations..."
npx prisma migrate deploy
echo "[OK] Migrations applied"

# ─── Seed chat rooms (required for chat to work) ───────────
echo "[INFO] Ensuring chat rooms exist..."
PGPASSWORD=changeme-strong-password psql -h db -U cmmc -d cmmc2 -c "
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  ('df66283f-921c-44ec-904a-5dd827971399', 'global', 'Global', NOW(), NOW()),
  ('37bfd4ff-b88c-4ac1-bb93-dda73c71bf56', 'private', 'Global', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
"
echo "[OK] Chat rooms ready"

# ─── Ensure admin user exists ────────────────────────────
echo "[INFO] Ensuring admin user exists..."

# Generate bcrypt hash for admin123
ADMIN_HASH=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('admin123', 10))")

PGPASSWORD=changeme-strong-password psql -h db -U cmmc -d cmmc2 -c "
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@local',
  '$ADMIN_HASH',
  'Admin',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = excluded.password_hash,
  name = excluded.name,
  role = excluded.role;
"
echo "[OK] Admin user ready: admin@local / admin123"

# ─── Create upload directories ─────────────────────────────
mkdir -p public/uploads/chat
echo "[OK] Upload directories ready"

# ─── Generate Prisma client (in case schema changed) ───────
npx prisma generate 2>/dev/null || true

echo ""
echo "[OK] Starting Linkco CMMC Tracker on HTTP"
echo "    http://0.0.0.0:3000"
echo ""

# ─── Start server ──────────────────────────────────────────
# Use standalone server if available
if [ -f "server.js" ]; then
    exec node server.js
else
    exec npx next start -p 3000 -H 0.0.0.0
fi
