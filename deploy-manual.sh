#!/bin/bash
# Manual deploy to server at 192.168.100.50
# Run this script - it will prompt for password

set -e

SERVER="server@192.168.100.50"
REMOTE_DIR="/home/server/cmmc-tracker"
LOCAL_DIR="/home/kali/.openclaw/workspace/cmmc-tracker"

echo "========================================="
echo "  CMMC Tracker - Deploy to Server"
echo "========================================="
echo ""
echo "Server: $SERVER"
echo "Password: server"
echo ""

# Build locally
echo "→ Building locally..."
cd "$LOCAL_DIR"
npm run build

# Create deployment package
echo "→ Creating deployment package..."
tar czf /tmp/cmmc-deploy.tar.gz \
  src/ prisma/ docker-compose.yml Dockerfile next.config.ts \
  package.json package-lock.json seed-data.sql .env.example \
  public/ tsconfig.json postcss.config.mjs

echo "→ Package size: $(du -h /tmp/cmmc-deploy.tar.gz | cut -f1)"
echo ""

# Copy to server (will prompt for password)
echo "→ Copying to server (enter password: server)..."
scp /tmp/cmmc-deploy.tar.gz "$SERVER:/tmp/"

# Deploy on server
echo "→ Deploying on server (enter password: server)..."
ssh "$SERVER" '
  set -e
  REMOTE_DIR="/home/server/cmmc-tracker"
  
  # Stop existing containers
  echo "→ Stopping existing containers..."
  cd "$REMOTE_DIR" 2>/dev/null && sudo docker compose down 2>/dev/null || true
  
  # Backup old code
  if [ -d "$REMOTE_DIR" ]; then
    echo "→ Backing up old code..."
    mv "$REMOTE_DIR" "${REMOTE_DIR}.bak.$(date +%s)"
  fi
  
  # Extract new code
  echo "→ Extracting new code..."
  mkdir -p "$REMOTE_DIR"
  tar xzf /tmp/cmmc-deploy.tar.gz -C "$REMOTE_DIR"
  rm /tmp/cmmc-deploy.tar.gz
  
  # Start Docker
  echo "→ Starting Docker..."
  sudo service docker start 2>/dev/null || sudo systemctl start docker 2>/dev/null || true
  
  # Build and start
  echo "→ Building and starting containers..."
  cd "$REMOTE_DIR"
  sudo docker compose up --build -d
  
  # Wait for DB
  echo "→ Waiting for database (20s)..."
  sleep 20
  
  # Seed database
  echo "→ Seeding database..."
  sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed-data.sql 2>/dev/null || echo "Database may already be seeded"
  
  # Show status
  echo ""
  echo "========================================="
  echo "  ✅ DEPLOYED!"
  echo "========================================="
  echo ""
  SERVER_IP=$(hostname -I | awk "{print \$1}" || echo "localhost")
  echo "  🌐 URL: http://$SERVER_IP:3000"
  echo "  🔐 Login: admin@local / admin123"
  echo ""
  echo "  Containers:"
  sudo docker ps --format "  {{.Names}}: {{.Status}}"
'

echo ""
echo "✅ Deployment complete!"
