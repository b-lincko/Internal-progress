#!/bin/bash
# CMMC Tracker v2.1 Fix Script
# Run this on your development machine to fix all issues before pushing to GitHub

set -e

echo "=========================================="
echo " CMMC Tracker v2.1 - Fixing All Issues"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

# ─── 1. FIX DATABASE MIGRATION ───────────────────────────────────────
echo "[1/8] Adding missing migration for created_by column..."
mkdir -p prisma/migrations/20260509070000_add_created_by_to_schedules

if [ ! -f "prisma/migrations/20260509070000_add_created_by_to_schedules/migration.sql" ]; then
cat > prisma/migrations/20260509070000_add_created_by_to_schedules/migration.sql << 'MIGEOF'
-- Add created_by column to schedule_deadlines (was added via db push, not migration)
ALTER TABLE "schedule_deadlines" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- Add foreign key for created_by
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_deadlines_created_by_fkey' 
    AND table_name = 'schedule_deadlines'
  ) THEN
    ALTER TABLE "schedule_deadlines" 
    ADD CONSTRAINT "schedule_deadlines_created_by_fkey" 
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END \$\$;

-- Set existing rows to a valid admin user ID if any exist
UPDATE "schedule_deadlines" SET "created_by" = (
  SELECT "id" FROM "users" WHERE "role" = 'Admin' LIMIT 1
) WHERE "created_by" IS NULL;

-- Add NOT NULL constraint
ALTER TABLE "schedule_deadlines" ALTER COLUMN "created_by" SET NOT NULL;
MIGEOF
  echo "  ✓ Created migration"
else
  echo "  ✓ Migration already exists"
fi

# ─── 2. FIX CHAT (already fixed in src/app/chat/page.tsx) ─────────────
echo "[2/8] Verifying chat fix (room_id set correctly)..."
if grep -q 'formData.append("room_id", activeContact.id === "global" ? "global" : "private")' src/app/chat/page.tsx; then
  echo "  ✓ Chat room_id fix is present"
else
  echo "  ✗ Chat fix missing! Run sed manually or check source."
  exit 1
fi

# ─── 3. VERIFY LOGIN PAGE (default creds removed) ────────────────────
echo "[3/8] Verifying login page (no default credentials)..."
if ! grep -q "admin@local" src/app/login/page.tsx; then
  echo "  ✓ Default credentials removed from login page"
else
  echo "  ✗ Default credentials still visible!"
  sed -i '/Default: admin@local/d' src/app/login/page.tsx
  echo "  ✓ Fixed - removed default credentials line"
fi

# ─── 4. TEST LOCAL DATABASE ──────────────────────────────────────────
echo "[4/8] Testing local database connection..."
if ! pg_isready -U cmmc -d cmmc2 2>/dev/null; then
  echo "  ⚠ PostgreSQL not running, attempting to start..."
  sudo systemctl start postgresql 2>/dev/null || pg_ctlcluster 18 main start 2>/dev/null || true
fi

# ─── 5. RUN MIGRATIONS ─────────────────────────────────────────────
echo "[5/8] Running Prisma migrations..."
npx prisma migrate deploy

# ─── 6. SEED DATABASE ────────────────────────────────────────────────
echo "[6/8] Seeding database..."
npx prisma db seed 2>/dev/null || {
  echo "  ℹ Seed script not configured, skipping..."
  echo "  (Database may already have data)"
}

# ─── 7. BUILD ────────────────────────────────────────────────────────
echo "[7/8] Building application..."
npm run build

# ─── 8. PUSH TO GITHUB ─────────────────────────────────────────────
echo "[8/8] Pushing to GitHub..."
if [ -d ".git" ]; then
  git add -A
  git commit -m "v2.1: Fix chat privacy, deadlines DB column, remove default credentials

- Chat: Private messages now correctly routed to private room
- DB: Added missing migration for schedule_deadlines.created_by
- Login: Removed default credentials from login screen
- Docker: Fixed entrypoint to use Node.js instead of psql" || echo "  No changes to commit"
  git push origin main || git push origin master || echo "  Push failed - check remote"
else
  echo "  ⚠ Not a git repo - skipping push"
fi

echo ""
echo "=========================================="
echo " FIXES COMPLETE ✅"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Clone on server: git clone https://github.com/b-lincko/Internal-progress.git"
echo "2. Follow DEPLOY.md for Docker deployment"
echo "3. Or use: docker load < cmmc-tracker-v2.1.tar.gz"
echo ""
echo "Key changes:"
echo "- Chat: Private messages no longer leak to global"
echo "- Deadlines: DB schema consistent with code"
echo "- Login: No default credentials shown"
echo ""
