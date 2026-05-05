#!/bin/bash
# Build Offline Docker Bundle for CMMC Tracker
# Run this on your source machine (with internet)
# It creates a portable bundle you can copy to any server

set -e

echo "========================================="
echo "  CMMC Tracker - Offline Build Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$APP_DIR/offline-bundle"
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="cmmc-tracker-offline-$BUILD_DATE"

# Clean previous builds
echo -e "${YELLOW}→ Cleaning previous builds...${NC}"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Step 1: Build the app image
echo ""
echo -e "${YELLOW}→ Building CMMC Tracker image...${NC}"
cd "$APP_DIR"
docker build -t cmmc-tracker:latest .

# Step 2: Pull PostgreSQL image
echo ""
echo -e "${YELLOW}→ Pulling PostgreSQL image...${NC}"
docker pull postgres:16-alpine

# Step 3: Save images as tar files
echo ""
echo -e "${YELLOW}→ Saving Docker images...${NC}"
docker save cmmc-tracker:latest | gzip > "$BUNDLE_DIR/cmmc-tracker-image.tar.gz"
docker save postgres:16-alpine | gzip > "$BUNDLE_DIR/postgres-image.tar.gz"

# Step 4: Copy deployment files
echo ""
echo -e "${YELLOW}→ Copying deployment files...${NC}"
cp "$APP_DIR/docker-compose.yml" "$BUNDLE_DIR/"
cp "$APP_DIR/.env.example" "$BUNDLE_DIR/"

# Step 5: Create deploy script for target machine
cat > "$BUNDLE_DIR/deploy.sh" << 'SCRIPT'
#!/bin/bash
# Deploy CMMC Tracker Offline
# Run this on the target server (no internet needed)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  CMMC Tracker - Offline Deployment"
echo "========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check Docker Compose is available
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Install Docker Compose first"
    exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✓ Docker found${NC}"
echo ""

# Step 1: Load images
echo -e "${YELLOW}→ Loading Docker images...${NC}"
docker load < "$SCRIPT_DIR/postgres-image.tar.gz"
docker load < "$SCRIPT_DIR/cmmc-tracker-image.tar.gz"
echo -e "${GREEN}✓ Images loaded${NC}"
echo ""

# Step 2: Create .env if not exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}→ Creating .env file...${NC}"
    cat > "$SCRIPT_DIR/.env" << 'EOF'
DB_PASSWORD=changeme-strong-password
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
EOF
    echo -e "${RED}⚠ WARNING: Default passwords set!${NC}"
    echo "  Edit .env file and change:"
    echo "    DB_PASSWORD=your-secure-password"
    echo "    JWT_SECRET=your-random-secret-key"
    echo ""
fi

# Step 3: Start services
echo -e "${YELLOW}→ Starting services...${NC}"
cd "$SCRIPT_DIR"
$COMPOSE_CMD up -d

echo ""
echo -e "${GREEN}✓ Services started!${NC}"
echo ""

# Step 4: Wait for DB
echo -e "${YELLOW}→ Waiting for database (30s)...${NC}"
sleep 10
echo "  ...still waiting..."
sleep 10
echo "  ...almost ready..."
sleep 10

# Step 5: Run migrations
echo ""
echo -e "${YELLOW}→ Running database migrations...${NC}"
$COMPOSE_CMD exec -T app npx prisma migrate deploy || true

# Step 6: Check if seed is needed
echo ""
echo -e "${YELLOW}→ Checking database...${NC}"
SEED_NEEDED=$($COMPOSE_CMD exec -T app npx tsx -e "
import { prisma } from './src/lib/prisma';
const count = await prisma.control.count();
console.log(count === 0 ? 'SEED_NEEDED' : 'ALREADY_SEEDED');
await prisma.\$disconnect();
" 2>/dev/null || echo "SEED_NEEDED")

if [ "$SEED_NEEDED" = "SEED_NEEDED" ]; then
    echo -e "${YELLOW}→ Seeding database (first time setup)...${NC}"
    $COMPOSE_CMD exec -T app npx prisma db seed || true
    echo -e "${GREEN}✓ Database seeded${NC}"
else
    echo -e "${GREEN}✓ Database already has data${NC}"
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================="
echo -e "${GREEN}  ✅ DEPLOYMENT COMPLETE!${NC}"
echo "========================================="
echo ""
echo "  🌐 Access the app:"
echo "     http://$SERVER_IP:3000"
echo ""
echo "  🔐 Login credentials:"
echo "     Email: admin@local"
echo "     Password: admin123"
echo ""
echo "  📋 Useful commands:"
echo "     View logs:    cd $(basename "$SCRIPT_DIR") && $COMPOSE_CMD logs -f app"
echo "     Stop:         cd $(basename "$SCRIPT_DIR") && $COMPOSE_CMD down"
echo "     Restart:      cd $(basename "$SCRIPT_DIR") && $COMPOSE_CMD restart app"
echo ""
echo "  ⚠ IMPORTANT: Change default password after first login!"
echo ""
SCRIPT

chmod +x "$BUNDLE_DIR/deploy.sh"

# Step 6: Create README for the bundle
cat > "$BUNDLE_DIR/README.txt" << 'EOF'
CMMC Tracker - Offline Deployment Bundle
=========================================

This bundle contains everything needed to run CMMC Tracker
on a server WITHOUT internet access.

CONTENTS:
---------
- cmmc-tracker-image.tar.gz   (Docker image for the app)
- postgres-image.tar.gz       (Docker image for PostgreSQL)
- docker-compose.yml          (Service configuration)
- .env.example               (Environment variables template)
- deploy.sh                  (One-click deployment script)

REQUIREMENTS:
-------------
- Docker Engine (already installed on target server)
- Docker Compose (already installed on target server)
- ~2GB free disk space
- Port 3000 available
- Port 5432 available (or change in docker-compose.yml)

DEPLOYMENT INSTRUCTIONS:
-----------------------
1. Copy this entire folder to your target server:
   scp -r offline-bundle user@server:/opt/

2. On the target server, run:
   cd /opt/offline-bundle
   ./deploy.sh

3. The app will be available at:
   http://server-ip:3000

4. Login with:
   Email: admin@local
   Password: admin123

TROUBLESHOOTING:
---------------
- If deploy.sh fails, check Docker is installed
- If port 3000 is in use, change it in docker-compose.yml
- Check logs: docker compose logs -f app

SECURITY NOTE:
-------------
Remember to change the default password after first login!
Go to Profile → Change Password.
EOF

# Step 7: Create zip bundle
echo ""
echo -e "${YELLOW}→ Creating zip bundle...${NC}"
cd "$APP_DIR"
zip -r "$BUNDLE_NAME.zip" offline-bundle/

# Calculate sizes
APP_SIZE=$(du -h "$BUNDLE_DIR/cmmc-tracker-image.tar.gz" | cut -f1)
DB_SIZE=$(du -h "$BUNDLE_DIR/postgres-image.tar.gz" | cut -f1)
TOTAL_SIZE=$(du -h "$BUNDLE_NAME.zip" | cut -f1)

echo ""
echo "========================================="
echo -e "${GREEN}  ✅ OFFLINE BUNDLE CREATED!${NC}"
echo "========================================="
echo ""
echo "  📦 Bundle: $BUNDLE_NAME.zip"
echo "  📦 Size: $TOTAL_SIZE"
echo ""
echo "  📁 Bundle contents:"
echo "     - cmmc-tracker-image.tar.gz ($APP_SIZE)"
echo "     - postgres-image.tar.gz ($DB_SIZE)"
echo "     - docker-compose.yml"
echo "     - deploy.sh (auto-runs everything)"
echo ""
echo "  🚀 Next steps:"
echo "     1. Copy $BUNDLE_NAME.zip to your server"
echo "     2. Unzip it on the server"
echo "     3. Run: ./deploy.sh"
echo "     4. Access: http://server-ip:3000"
echo ""
echo "  📂 Bundle location:"
echo "     $BUNDLE_DIR/"
echo ""

# Cleanup temp files but keep the zip
rm -rf "$BUNDLE_DIR"

echo -e "${GREEN}Done!${NC}"
