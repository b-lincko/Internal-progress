#!/bin/bash
# Test the Docker image locally BEFORE sending to server

cd /home/kali/.openclaw/workspace/cmmc-tracker

echo "=== Testing Docker Image Locally ==="
echo ""

# 1. Create test compose
cat > test-local.yml << 'EOF'
services:
  test-db:
    image: postgres:16-alpine
    container_name: cmmc-test-db
    environment:
      POSTGRES_USER: cmmc
      POSTGRES_PASSWORD: changeme-strong-password
      POSTGRES_DB: cmmc2
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cmmc -d cmmc2"]
      interval: 2s
      timeout: 2s
      retries: 10

  test-app:
    image: cmmc-tracker:v2.1-perfect
    container_name: cmmc-test-app
    environment:
      DATABASE_URL: postgresql://cmmc:changeme-strong-password@test-db:5432/cmmc2
      JWT_SECRET: changeme-jwt-secret-key-min-32-chars
      PORT: 3000
      NODE_ENV: production
    ports:
      - "3001:3000"
    depends_on:
      test-db:
        condition: service_healthy
EOF

# 2. Stop any old test containers
sudo docker rm -f cmmc-test-app cmmc-test-db 2>/dev/null || true

# 3. Start test environment
echo "[1/5] Starting test database and app..."
sudo docker compose -f test-local.yml up -d

# 4. Wait for startup
echo "[2/5] Waiting for app to start..."
sleep 20

# 5. Check logs
echo "[3/5] Checking app logs..."
sudo docker logs cmmc-test-app --tail 30

# 6. Test login
echo ""
echo "[4/5] Testing login..."
curl -s http://localhost:3001/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"admin123"}' | python3 -m json.tool 2>/dev/null || echo "Login test failed"

# 7. Test controls
echo ""
echo "[5/5] Testing controls..."
curl -s http://localhost:3001/api/controls 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Controls loaded: {len(d[\"controls\"])}')" 2>/dev/null || echo "Controls test failed"

echo ""
echo "=== Test URL: http://localhost:3001 ==="
echo "If tests pass, image is ready for server deployment!"
