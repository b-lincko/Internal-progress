#!/bin/bash
# Deploy CMMC Tracker to server at 192.168.100.50
# Run this from your local machine

set -e

SERVER="server@192.168.100.50"
REMOTE_DIR="/home/server/cmmc-tracker"
LOCAL_DIR="/home/kali/.openclaw/workspace/cmmc-tracker"

echo "========================================="
echo "  CMMC Tracker - Remote Deploy"
echo "========================================="
echo ""

# Build locally first
echo "→ Building locally..."
cd "$LOCAL_DIR"
npm run build 2>/dev/null || {
  echo "⚠ Build needed. Building now..."
  npm run build
}

# Copy files to server
echo "→ Copying to server..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.next' \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

# Deploy on server
echo "→ Deploying on server..."
ssh "$SERVER" "
  cd $REMOTE_DIR
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo '❌ Docker not installed'
    exit 1
  fi
  
  # Start docker if needed
  if ! docker info > /dev/null 2>&1; then
    echo '⚠ Starting Docker...'
    sudo service docker start || sudo systemctl start docker
    sleep 3
  fi
  
  # Build and start
  echo '→ Building containers...'
  sudo docker compose down 2>/dev/null || true
  sudo docker compose up --build -d
  
  # Wait for DB
  echo '→ Waiting for database...'
  sleep 15
  
  # Check if seed needed
  USER_COUNT=\$(sudo docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c \"SELECT COUNT(*) FROM users;\" 2>/dev/null | xargs || echo '0')
  
  if [ \"\$USER_COUNT\" = '0' ] || [ -z \"\$USER_COUNT\" ]; then
    echo '→ Seeding database...'
    sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed-data.sql
  fi
  
  echo ''
  echo '========================================='
  echo '  ✅ DEPLOYED!'
  echo '========================================='
  echo ''
  echo '  🌐 URL: http://\$(hostname -I | awk \"{print \$1}\" || echo localhost):3000'
  echo '  🔐 Login: admin@local / admin123'
  echo ''
"

echo ""
echo "✅ Deployment complete!"
