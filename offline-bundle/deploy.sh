#!/bin/bash
# CMMC Tracker - Complete Deploy with Pre-seeded Database
# Run this on the target server (no internet needed)

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
echo -e "${YELLOW}→ Checking Docker...${NC}"
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
echo -e "${YELLOW}→ Loading Docker images...${NC}"
docker load < "$SCRIPT_DIR/postgres-image.tar.gz"
docker load < "$SCRIPT_DIR/cmmc-tracker-image.tar.gz"
echo -e "${GREEN}✓ Images loaded${NC}"
echo ""

# Create .env if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}→ Creating .env file...${NC}"
    cat > "$SCRIPT_DIR/.env" << EOF
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)
EOF
    echo -e "${YELLOW}⚠ Generated random passwords in .env${NC}"
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

# Import pre-seeded database
echo ""
echo -e "${YELLOW}→ Importing pre-configured database...${NC}"
docker exec -i cmmc-db psql -U cmmc -d cmmc2 < "$SCRIPT_DIR/seed-data.sql" 2>/dev/null || true

# Verify import
echo ""
echo -e "${YELLOW}→ Verifying database...${NC}"
USER_COUNT=$(docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
CONTROL_COUNT=$(docker exec cmmc-db psql -U cmmc -d cmmc2 -t -c "SELECT COUNT(*) FROM controls;" 2>/dev/null | xargs || echo "0")

echo "  Users: $USER_COUNT"
echo "  Controls: $CONTROL_COUNT"

if [ "$USER_COUNT" = "0" ] || [ "$CONTROL_COUNT" = "0" ]; then
    echo -e "${RED}⚠ Database import may have failed. Trying again...${NC}"
    sleep 5
    docker exec -i cmmc-db psql -U cmmc -d cmmc2 < "$SCRIPT_DIR/seed-data.sql"
fi

echo ""
echo -e "${GREEN}✓ Database ready${NC}"

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================="
echo -e "${GREEN}  ✅ READY!${NC}"
echo "========================================="
echo ""
echo "  🌐 URL: http://$SERVER_IP:3000"
echo "  🔐 Login: admin@local / admin123"
echo ""
echo "  Commands:"
echo "    Logs:  docker compose logs -f app"
echo "    Stop:  docker compose down"
echo ""
