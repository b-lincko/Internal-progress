#!/bin/bash
# Linkco CMMC Tracker v2.1 - One-Click Installer
# Run on target server with: curl -fsSL ... | bash

set -e

APP_NAME="cmmc-tracker"
IMAGE_TAG="v2.1-perfect"
PORT="3000"
DB_PASS="changeme-strong-password"
JWT_SECRET="changeme-jwt-secret-key-min-32-chars"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Linkco CMMC Tracker v2.1 - One-Click Installer          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  This script requires sudo privileges"
  echo "Please run: sudo bash one-go-install.sh"
  exit 1
fi

# Check Docker
echo "[1/8] Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker first:"
  echo "   curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  echo "❌ Docker Compose not found. Please install it."
  exit 1
fi

echo "   ✅ Docker found"

# Free port 3000
echo ""
echo "[2/8] Freeing port ${PORT}..."
fuser -k ${PORT}/tcp 2>/dev/null || true
kill $(lsof -t -i:${PORT}) 2>/dev/null || true
sleep 2
echo "   ✅ Port ${PORT} freed"

# Create working directory
echo ""
echo "[3/8] Creating working directory..."
mkdir -p /opt/cmmc-tracker
cd /opt/cmmc-tracker
echo "   ✅ Working directory ready"

# Create entrypoint script
echo ""
echo "[4/8] Creating entrypoint script..."
cat > entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo ""
echo "Linkco CMMC Tracker v2.1 - Starting..."
echo ""

# Wait for database
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if node -e "
const { Client } = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000});
c.connect().then(() => c.query('SELECT 1')).then(() => { c.end(); process.exit(0); }).catch(() => { c.end(); process.exit(1); });
" 2>/dev/null; then
        echo "  ✓ Database ready"
        break
    fi
    sleep 2
    RETRIES=$((RETRIES - 1))
done

# Run migrations
echo "[INFO] Running migrations..."
npx prisma migrate deploy
echo "  ✓ Migrations applied"

# Seed data
echo "[INFO] Seeding database..."
if [ -f prisma/seed.js ]; then
    node prisma/seed.js 2>/dev/null || echo "  ⚠ Seed may have already run"
else
    echo "  ⚠ No seed script found"
fi

mkdir -p public/uploads/chat
echo "  ✓ Ready"

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
EOF
chmod +x entrypoint.sh
echo "   ✅ Entrypoint created"

# Create docker-compose.yml
echo ""
echo "[5/8] Creating docker-compose.yml..."
cat > docker-compose.yml << EOF
services:
  db:
    image: postgres:16-alpine
    container_name: cmmc-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: cmmc
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: cmmc2
    volumes:
      - cmmc_postgres_data:/var/lib/postgresql/data
    expose:
      - "5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cmmc -d cmmc2"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - cmmc-network

  app:
    image: cmmc-tracker:${IMAGE_TAG}
    container_name: cmmc-app
    restart: unless-stopped
    entrypoint: ["/app/entrypoint.sh"]
    environment:
      DATABASE_URL: postgresql://cmmc:${DB_PASS}@db:5432/cmmc2
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
      NODE_ENV: production
    ports:
      - "${PORT}:3000"
    volumes:
      - cmmc_uploads:/app/public/uploads
      - ./entrypoint.sh:/app/entrypoint.sh:ro
    depends_on:
      db:
        condition: service_healthy
    networks:
      - cmmc-network

volumes:
  cmmc_postgres_data:
  cmmc_uploads:

networks:
  cmmc-network:
    driver: bridge
EOF
echo "   ✅ docker-compose.yml created"

# Check if image exists locally
echo ""
echo "[6/8] Checking Docker image..."
if docker images | grep -q "cmmc-tracker.*${IMAGE_TAG}"; then
  echo "   ✅ Image found locally"
else
  echo "   ⚠️  Image not found locally"
  echo ""
  echo "   Option A: Build from source (requires source code)"
  echo "   Option B: Load from tar.gz file"
  echo "   Option C: Download from another machine"
  echo ""
  echo "   For Option B, place the tar.gz file here and run:"
  echo "   docker load < cmmc-tracker-${IMAGE_TAG}.tar.gz"
  echo ""
  echo "   Then re-run this script."
  exit 1
fi

# Start containers
echo ""
echo "[7/8] Starting containers..."
docker compose down 2>/dev/null || true
sleep 2
docker compose up -d
sleep 15
echo "   ✅ Containers started"

# Copy seed.js if it exists
if [ -f prisma/seed.js ]; then
  echo "   📦 Copying seed script..."
  docker cp prisma/seed.js cmmc-app:/app/prisma/seed.js 2>/dev/null || true
  docker exec cmmc-app node prisma/seed.js 2>/dev/null || true
fi

# Verify
echo ""
echo "[8/8] Verifying deployment..."
sleep 5

echo ""
echo "=== DATABASE STATUS ==="
docker exec cmmc-db psql -U cmmc -d cmmc2 -c "
SELECT 'Users:', COUNT(*) FROM users 
UNION ALL 
SELECT 'Controls:', COUNT(*) FROM controls 
UNION ALL 
SELECT 'Chat Rooms:', COUNT(*) FROM chat_rooms
UNION ALL
SELECT 'Assets:', COUNT(*) FROM assets;" 2>/dev/null || echo "   ⚠️  Database still initializing..."

echo ""
echo "=== APP LOGS (last 10 lines) ==="
docker logs cmmc-app --tail 10

echo ""
echo "=== TEST LOGIN ==="
if curl -s http://localhost:${PORT}/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"admin123"}' 2>/dev/null | grep -q "Admin User"; then
  echo "   ✅ Login working"
else
  echo "   ⚠️  Login test failed (may need more time to start)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  INSTALLATION COMPLETE!                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 URL: http://localhost:${PORT}"
echo "   (or http://YOUR_SERVER_IP:${PORT})"
echo ""
echo "🔑 Default Login:"
echo "   Email: admin@local"
echo "   Password: admin123"
echo ""
echo "📁 Working Directory: /opt/cmmc-tracker"
echo ""
echo "🛠️  Useful Commands:"
echo "   cd /opt/cmmc-tracker"
echo "   docker compose logs -f        # View logs"
echo "   docker compose restart        # Restart app"
echo "   docker compose stop           # Stop app"
echo "   docker compose up -d          # Start app"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Change default password immediately"
echo "   - Update JWT_SECRET in docker-compose.yml"
echo "   - Update DB password for production"
echo ""
echo "📖 Full documentation: https://github.com/b-lincko/Internal-progress"
echo ""
