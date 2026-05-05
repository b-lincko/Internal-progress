#!/bin/bash
# This script runs ON THE SERVER after code is extracted
# It handles sudo password prompt properly

set -e

echo "========================================="
echo "  CMMC Tracker - Server Deploy"
echo "========================================="
echo ""

REMOTE_DIR="/home/server/cmmc-tracker"
PASS="server"

cd "$REMOTE_DIR"

# Function to run with sudo
sudocmd() {
    echo "$PASS" | sudo -S "$@"
}

# Stop existing
echo "→ Stopping existing containers..."
sudocmd docker compose down 2>/dev/null || true

# Start Docker if needed
if ! sudocmd docker info > /dev/null 2>&1; then
    echo "→ Starting Docker service..."
    sudocmd service docker start 2>/dev/null || sudocmd systemctl start docker 2>/dev/null || true
    sleep 3
fi

# Build and start
echo "→ Building and starting containers..."
sudocmd docker compose up --build -d

# Wait for DB
echo "→ Waiting for database (20s)..."
sleep 20

# Check if database needs seeding
echo "→ Checking database..."
USER_COUNT=$(sudocmd docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")

echo "  Current users: $USER_COUNT"

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
    echo "→ Seeding database..."
    sudocmd docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed-data.sql
    echo "✓ Database seeded"
else
    echo "→ Database already has data, skipping seed"
fi

# Verify
echo ""
echo "→ Verifying..."
CONTROL_COUNT=$(sudocmd docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM controls;" 2>/dev/null | xargs || echo "0")
echo "  Controls: $CONTROL_COUNT"

# Show status
echo ""
echo "========================================="
echo "  ✅ DEPLOYED!"
echo "========================================="
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
echo "  🌐 URL: http://$SERVER_IP:3000"
echo "  🔐 Login: admin@local / admin123"
echo ""
echo "  Containers:"
sudocmd docker ps --format "  {{.Names}}: {{.Status}}"
echo ""
