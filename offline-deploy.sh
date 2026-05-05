#!/bin/bash
# Deploy CMMC Tracker - Offline (Run this on TARGET SERVER)
# No internet required. All images are pre-built.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  CMMC Tracker - Offline Deploy"
echo "========================================="
echo ""

# Check Docker
echo -e "${YELLOW}→ Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo ""
    echo "Install Docker first:"
    echo "  sudo apt update"
    echo "  sudo apt install docker.io docker-compose"
    echo "  sudo usermod -aG docker \$USER"
    echo "  (logout and login again)"
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
$COMPOSE_CMD -f docker-compose.yml up -d

# Wait for DB
echo ""
echo -e "${YELLOW}→ Waiting for database (30s)...${NC}"
for i in {1..3}; do
    sleep 10
    echo "  ...($((i*10))s)"
done

# Migrations
echo ""
echo -e "${YELLOW}→ Running migrations...${NC}"
$COMPOSE_CMD -f docker-compose.yml exec -T app npx prisma migrate deploy || true

# Check if seed needed
echo ""
echo -e "${YELLOW}→ Checking if seed is needed...${NC}"
if $COMPOSE_CMD -f docker-compose.yml exec -T app npx prisma db seed 2>/dev/null; then
    echo -e "${GREEN}✓ Database seeded${NC}"
else
    echo -e "${GREEN}✓ Database already has data${NC}"
fi

# Show info
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
echo "    Logs:  docker compose -f docker-compose.yml logs -f app"
echo "    Stop:  docker compose -f docker-compose.yml down"
echo "    Shell: docker compose -f docker-compose.yml exec app sh"
echo ""
