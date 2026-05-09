#!/bin/bash
# ============================================================
# CMMC Tracker v2.1 - COMPLETE SERVER DEPLOYMENT
# Run this on the DEV MACHINE (192.168.100.68) first,
# then transfer files to the SERVER
# ============================================================

set -e

echo "=========================================="
echo " CMMC Tracker v2.1 - Complete Deploy"
echo "=========================================="
echo ""

# Check if we're on the dev machine
if [ "$(hostname -I | awk '{print $1}')" != "192.168.100.68" ]; then
    echo "WARNING: Run this on the dev machine (192.168.100.68)"
    echo "Your IP: $(hostname -I | awk '{print $1}')"
fi

# ─── STEP 1: Build Docker image ─────────────────────────────
echo "[1/5] Building Docker image..."
cd /home/kali/.openclaw/workspace/cmmc-tracker

# Ensure the entrypoint doesn't use psql
cat > docker-entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo ""
echo "Linkco CMMC Tracker - Starting..."
echo ""

echo "[INFO] Running migrations..."
npx prisma migrate deploy 2>/dev/null || {
  echo "[WARN] First migrate attempt failed, retrying..."
  sleep 3
  npx prisma migrate deploy
}
echo "[OK] Migrations applied"

echo "[INFO] Seeding data..."
npx prisma db seed 2>/dev/null || true

mkdir -p public/uploads/chat
echo "[OK] Upload directories ready"

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
EOF
chmod +x docker-entrypoint.sh

# Build
sudo docker build -t cmmc-tracker:v2.1-final .

# Save image
echo "[2/5] Saving image..."
sudo docker save cmmc-tracker:v2.1-final | gzip > cmmc-tracker-v2.1-final.tar.gz

# ─── STEP 2: Create deployment package ────────────────────────
echo "[3/5] Creating deployment package..."
mkdir -p deploy-package
cp cmmc-tracker-v2.1-final.tar.gz deploy-package/

# Create docker-compose.yml
cat > deploy-package/docker-compose.yml << 'EOF'
services:
  db:
    image: postgres:16-alpine
    container_name: cmmc-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: cmmc
      POSTGRES_PASSWORD: changeme-strong-password
      POSTGRES_DB: cmmc2
    volumes:
      - postgres_data:/var/lib/postgresql/data
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
    image: cmmc-tracker:v2.1-final
    container_name: cmmc-app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://cmmc:changeme-strong-password@db:5432/cmmc2
      JWT_SECRET: changeme-jwt-secret-key-min-32-chars
      PORT: 3000
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/public/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - cmmc-network

volumes:
  postgres_data:
  uploads:

networks:
  cmmc-network:
    driver: bridge
EOF

# Create seed SQL
cat > deploy-package/seed.sql << 'EOF'
-- Admin user (password: admin123)
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@local',
  '$2b$10$LpBZIr9ccznxlVT1fpRYT.MKGOzPUPzo3T2wat070u0xtFFX2vjou',
  'Admin',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Chat rooms
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'global', 'Global', NOW(), NOW()),
  (gen_random_uuid(), 'private', 'Private', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Sample controls (20 for quick setup)
INSERT INTO controls (id, control_id, domain, title, description, status, updated_at) VALUES
(gen_random_uuid(), '3.1.1', 'Access Control (AC)', 'Limit system access', 'Limit system access to authorized users.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.2', 'Access Control (AC)', 'Limit system access to transactions', 'Limit system access to types of transactions.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.3', 'Access Control (AC)', 'Control flow of CUI', 'Control the flow of CUI.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.4', 'Access Control (AC)', 'Separation of duties', 'Separate duties.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.1.5', 'Access Control (AC)', 'Least privilege', 'Employ least privilege.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.2.1', 'Awareness & Training (AT)', 'Security awareness training', 'Ensure managers and users are aware.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.2.2', 'Awareness & Training (AT)', 'Insider threat training', 'Provide insider threat awareness.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.3.1', 'Audit & Accountability (AU)', 'Create audit logs', 'Create and retain system audit logs.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.3.2', 'Audit & Accountability (AU)', 'Review audit events', 'Ensure auditing system is reviewed.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.4.1', 'Configuration Management (CM)', 'Establish baseline configurations', 'Establish baseline configurations.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.4.2', 'Configuration Management (CM)', 'Enforce security config', 'Establish and enforce security settings.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.5.1', 'Identification & Authentication (IA)', 'Identify system users', 'Identify system users.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.5.2', 'Identification & Authentication (IA)', 'Authenticate identities', 'Authenticate identities.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.6.1', 'Incident Response (IR)', 'Incident response policy', 'Establish incident-handling capability.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.6.2', 'Incident Response (IR)', 'Track and document incidents', 'Track, document, and report incidents.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.7.1', 'Maintenance (MA)', 'Perform maintenance', 'Perform maintenance.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.8.1', 'Media Protection (MP)', 'Protect system media', 'Protect system media containing CUI.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.9.1', 'Personnel Security (PS)', 'Screen personnel', 'Screen personnel prior to authorizing access.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.10.1', 'Physical Protection (PE)', 'Limit physical access', 'Limit physical access to systems.', 'Not_Started', NOW()),
(gen_random_uuid(), '3.11.1', 'Risk Assessment (RA)', 'Risk assessment policy', 'Periodically assess the risk.', 'Not_Started', NOW());
EOF

# Create deploy script
cat > deploy-package/deploy.sh << 'EOF'
#!/bin/bash
# Run this on the SERVER
set -e

echo "=========================================="
echo " CMMC Tracker Server Deployment"
echo "=========================================="
echo ""

# Stop old containers
echo "[1/4] Stopping old containers..."
sudo docker compose down 2>/dev/null || true
sudo docker rm -f cmmc-app cmmc-db 2>/dev/null || true

# Load new image
echo "[2/4] Loading Docker image..."
sudo docker load < cmmc-tracker-v2.1-final.tar.gz

# Start services
echo "[3/4] Starting services..."
sudo docker compose up -d

# Wait for DB
echo "[4/4] Waiting for database..."
sleep 5
until sudo docker exec cmmc-db pg_isready -U cmmc -d cmmc2 >/dev/null 2>&1; do
    echo "  ...waiting"
    sleep 2
done

# Seed data
echo "Seeding database..."
sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed.sql

# Restart app to pick up seeded data
sudo docker restart cmmc-app

echo ""
echo "=========================================="
echo " ✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "URL:      http://$(hostname -I | awk '{print $1}'):3000"
echo "Login:    admin@local / admin123"
echo ""
echo "IMPORTANT:"
echo "  - Hard-refresh browser (Ctrl+Shift+R)"
echo "  - If data disappears, run: sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed.sql"
echo "  - NEVER run 'docker compose down' - it deletes data!"
echo "  - Use 'docker compose restart' instead"
echo ""
EOF
chmod +x deploy-package/deploy.sh

echo "[4/5] Packaging..."
tar czf cmmc-deploy-package.tar.gz -C deploy-package .

echo "[5/5] Starting HTTP server for transfer..."
echo ""
echo "=========================================="
echo " DEPLOY PACKAGE READY"
echo "=========================================="
echo ""
echo "Files created:"
echo "  - cmmc-tracker-v2.1-final.tar.gz (Docker image)"
echo "  - cmmc-deploy-package.tar.gz (Complete deploy package)"
echo ""
echo "On the SERVER, run:"
echo "  cd ~"
echo "  wget http://192.168.100.68:8080/cmmc-deploy-package.tar.gz"
echo "  tar xzf cmmc-deploy-package.tar.gz"
echo "  bash deploy.sh"
echo ""

# Start HTTP server
python3 -m http.server 8080 &
echo "HTTP server running on http://192.168.100.68:8080"
