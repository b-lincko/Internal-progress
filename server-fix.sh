#!/bin/bash
# Complete server fix script for CMMC Tracker
# Run this ON THE SERVER to fix everything

set -e

echo "=========================================="
echo " CMMC Tracker - Complete Server Fix"
echo "=========================================="
echo ""

# ─── STEP 1: Check if DB container is running ──────────────────────────
echo "[1/6] Checking database container..."
if ! sudo docker ps | grep -q cmmc-db; then
    echo "  ✗ Database container not running!"
    echo "  Starting containers..."
    cd ~ && sudo docker compose up -d
    sleep 5
fi
echo "  ✓ Database container OK"

# ─── STEP 2: Wait for DB to be ready ────────────────────────────────
echo "[2/6] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if sudo docker exec cmmc-db pg_isready -U cmmc -d cmmc2 >/dev/null 2>&1; then
        echo "  ✓ Database ready"
        break
    fi
    sleep 1
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "  ✗ Database not responding"
    exit 1
fi

# ─── STEP 3: Run migrations ────────────────────────────────────────
echo "[3/6] Running migrations..."
sudo docker exec cmmc-app npx prisma migrate deploy 2>/dev/null || {
    echo "  ⚠ Migrate failed, may already be applied"
}

# ─── STEP 4: Seed the database ─────────────────────────────────────
echo "[4/6] Seeding database..."

ADMIN_HASH='$2b$10$EF2DJNSnZvgHGCb78pDtG.Cg/5rW3nGp9Wd9dStyVCXMKPrwwGD1u'

sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 << SEEDSQL
-- Admin user
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
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Chat rooms
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'global', 'Global', NOW(), NOW()),
  (gen_random_uuid(), 'private', 'Private', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Seed 20 controls (enough for testing)
INSERT INTO controls (id, control_id, domain, title, description, status, updated_at) VALUES
(gen_random_uuid(), '3.1.1', 'Access Control (AC)', 'Limit system access', 'Limit system access to authorized users.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.2', 'Access Control (AC)', 'Limit system access to transactions', 'Limit system access to types of transactions.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.3', 'Access Control (AC)', 'Control flow of CUI', 'Control the flow of CUI.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.4', 'Access Control (AC)', 'Separation of duties', 'Separate the duties of individuals.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.5', 'Access Control (AC)', 'Least privilege', 'Employ the principle of least privilege.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.2.1', 'Awareness & Training (AT)', 'Security awareness training', 'Ensure managers and users are aware of security risks.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.2.2', 'Awareness & Training (AT)', 'Insider threat training', 'Provide insider threat awareness training.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.3.1', 'Audit & Accountability (AU)', 'Create audit logs', 'Create and retain system audit logs.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.3.2', 'Audit & Accountability (AU)', 'Review audit events', 'Ensure that the auditing system is reviewed.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.4.1', 'Configuration Management (CM)', 'Establish baseline configurations', 'Establish baseline configurations.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.4.2', 'Configuration Management (CM)', 'Enforce security config', 'Establish and enforce security configuration settings.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.5.1', 'Identification & Authentication (IA)', 'Identify system users', 'Identify system users, processes, and devices.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.5.2', 'Identification & Authentication (IA)', 'Authenticate identities', 'Authenticate identities of users.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.6.1', 'Incident Response (IR)', 'Incident response policy', 'Establish an operational incident-handling capability.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.6.2', 'Incident Response (IR)', 'Track and document incidents', 'Track, document, and report incidents.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.7.1', 'Maintenance (MA)', 'Perform maintenance', 'Perform maintenance on organizational systems.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.8.1', 'Media Protection (MP)', 'Protect system media', 'Protect system media containing CUI.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.9.1', 'Personnel Security (PS)', 'Screen personnel', 'Screen personnel prior to authorizing access.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.10.1', 'Physical Protection (PE)', 'Limit physical access', 'Limit physical access to systems.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.11.1', 'Risk Assessment (RA)', 'Risk assessment policy', 'Periodically assess the risk.', 'Not_Started', NOW());
SEEDSQL

# ─── STEP 5: Verify seeding worked ─────────────────────────────────
echo "[5/6] Verifying database..."
echo "  Users: $(sudo docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM users;" | xargs)"
echo "  Controls: $(sudo docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM controls;" | xargs)"
echo "  Chat Rooms: $(sudo docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM chat_rooms;" | xargs)"

# ─── STEP 6: Restart app to pick up changes ───────────────────────
echo "[6/6] Restarting app..."
sudo docker restart cmmc-app
sleep 3

echo ""
echo "=========================================="
echo " FIX COMPLETE ✅"
echo "=========================================="
echo ""
echo "Database seeded with:"
echo "  - 1 Admin user (admin@local / admin123)"
echo "  - 20 CMMC controls"
echo "  - 2 Chat rooms (global, private)"
echo ""
echo "Next steps:"
echo "1. Login at http://192.168.100.50:3000"
echo "2. Check Users page - 'Add User' button should appear"
echo "3. Check Controls page - controls should be listed"
echo "4. Check Chat - Global/Private tabs should work"
echo ""
echo "If buttons still don't show, hard-refresh (Ctrl+Shift+R)"
echo ""
