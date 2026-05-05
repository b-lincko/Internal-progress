#!/bin/bash
# Build Complete Offline Bundle on YOUR machine (needs Docker + sudo)
# Run this on your source machine with internet

set -e

echo "========================================="
echo "  Building CMMC Tracker Offline Bundle"
echo "========================================="
echo ""

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$APP_DIR/offline-bundle"
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="cmmc-tracker-complete-$BUILD_DATE"

# Check Docker
echo "→ Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed"
    exit 1
fi

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⚠ Docker not running. Starting..."
    sudo service docker start || sudo systemctl start docker || {
        echo "❌ Could not start Docker. Run: sudo service docker start"
        exit 1
    }
    sleep 3
fi

echo "✓ Docker ready"
echo ""

# Clean and prepare
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Build app image
echo "→ Building app image..."
docker build -t cmmc-tracker:latest .

# Pull postgres
echo "→ Pulling PostgreSQL..."
docker pull postgres:16-alpine

# Save images
echo "→ Saving images..."
docker save cmmc-tracker:latest | gzip > "$BUNDLE_DIR/cmmc-tracker-image.tar.gz"
docker save postgres:16-alpine | gzip > "$BUNDLE_DIR/postgres-image.tar.gz"

# Copy files
echo "→ Copying deployment files..."
cp "$APP_DIR/docker-compose.yml" "$BUNDLE_DIR/"
cp "$APP_DIR/seed-data.sql" "$BUNDLE_DIR/"
cp "$APP_DIR/.env.example" "$BUNDLE_DIR/"

# Create deploy script
cat > "$BUNDLE_DIR/deploy.sh" << 'SCRIPT'
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  CMMC Tracker - One-Click Deploy"
echo "========================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✓ Docker ready${NC}"
echo ""

# Load images
echo -e "${YELLOW}→ Loading images...${NC}"
docker load < "$SCRIPT_DIR/postgres-image.tar.gz"
docker load < "$SCRIPT_DIR/cmmc-tracker-image.tar.gz"
echo -e "${GREEN}✓ Images loaded${NC}"
echo ""

# Create .env if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}→ Creating .env...${NC}"
    cat > "$SCRIPT_DIR/.env" << EOF
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)
EOF
    echo -e "${YELLOW}⚠ Generated random passwords${NC}"
    echo ""
fi

# Start services
echo -e "${YELLOW}→ Starting services...${NC}"
cd "$SCRIPT_DIR"
$COMPOSE_CMD up -d

# Wait for DB
echo ""
echo -e "${YELLOW}→ Waiting for database (15s)...${NC}"
sleep 15

# Import database
echo ""
echo -e "${YELLOW}→ Importing pre-seeded database...${NC}"
docker exec -i cmmc-db psql -U cmmc -d cmmc2 < "$SCRIPT_DIR/seed-data.sql" 2>/dev/null || true

# Verify
echo ""
echo -e "${YELLOW}→ Verifying...${NC}"
USER_COUNT=$(docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
CONTROL_COUNT=$(docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM controls;" 2>/dev/null | xargs || echo "0")

echo "  Users: $USER_COUNT"
echo "  Controls: $CONTROL_COUNT"

if [ "$USER_COUNT" = "0" ] || [ "$CONTROL_COUNT" = "0" ]; then
    echo -e "${RED}⚠ Retrying import...${NC}"
    sleep 5
    docker exec -i cmmc-db psql -U cmmc -d cmmc2 < "$SCRIPT_DIR/seed-data.sql"
fi

echo ""
echo -e "${GREEN}✓ Done${NC}"

# Get IP
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================="
echo -e "${GREEN}  ✅ READY!${NC}"
echo "========================================="
echo ""
echo "  🌐 URL: http://$SERVER_IP:3000"
echo "  🔐 Login: admin@local / admin123"
echo ""
SCRIPT

chmod +x "$BUNDLE_DIR/deploy.sh"

# Create README
cat > "$BUNDLE_DIR/README.txt" << 'EOF'
CMMC Tracker - Complete Offline Bundle
======================================

This bundle includes:
- Pre-built Docker images
- Pre-seeded database (admin + 108 controls)
- One-click deploy script

DEPLOY INSTRUCTIONS:
1. Copy this folder to your server
2. Run: ./deploy.sh
3. Access: http://server-ip:3000
4. Login: admin@local / admin123

That's it. Everything is pre-configured.
EOF

# Create zip
echo ""
echo "→ Creating zip..."
cd "$APP_DIR"
zip -r "$BUNDLE_NAME.zip" offline-bundle/

# Sizes
TOTAL_SIZE=$(du -h "$BUNDLE_NAME.zip" | cut -f1)

echo ""
echo "========================================="
echo "  ✅ BUNDLE READY!"
echo "========================================="
echo ""
echo "  📦 File: $BUNDLE_NAME.zip"
echo "  📦 Size: $TOTAL_SIZE"
echo ""
echo "  🚀 To deploy:"
echo "     1. scp $BUNDLE_NAME.zip server:/opt/"
echo "     2. ssh server"
echo "     3. unzip $BUNDLE_NAME.zip"
echo "     4. cd offline-bundle && ./deploy.sh"
echo "     5. Open http://server-ip:3000"
echo ""
