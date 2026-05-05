#!/bin/bash
# Run this script ON THE SERVER (192.168.100.50)
# Copy to server and run: ./finish-deploy.sh

set -e

DIR="/home/server/cmmc-tracker"
PASS="server"

echo "========================================="
echo "  CMMC Tracker - Finish Deployment"
echo "========================================="
echo ""

cd "$DIR"

# Seed the database
echo "→ Seeding database..."
{
  echo "$PASS"
  cat seed-data.sql
} | sudo -S docker exec -i cmmc-db psql -U cmmc -d cmmc2

echo ""
echo "→ Verifying..."
USER_COUNT=$(echo "$PASS" | sudo -S docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM users;" | xargs)
CONTROL_COUNT=$(echo "$PASS" | sudo -S docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM controls;" | xargs)

echo "  Users: $USER_COUNT"
echo "  Controls: $CONTROL_COUNT"

# Restart app to pick up new code
echo ""
echo "→ Restarting app..."
echo "$PASS" | sudo -S docker compose restart app

echo ""
echo "========================================="
echo "  ✅ READY!"
echo "========================================="
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "  🌐 URL: http://$SERVER_IP:3000"
echo "  🔐 Login: admin@local / admin123"
echo ""
