# CMMC Tracker v2.1 - Deployment Guide

## Quick Deploy (Docker)

### 1. Download the Docker Image
```bash
wget http://192.168.100.68:8080/cmmc-tracker-v2.1.tar.gz
```

### 2. Load the Image
```bash
docker load < cmmc-tracker-v2.1.tar.gz
```

### 3. Create docker-compose.yml
```bash
cat > docker-compose.yml << 'EOF'
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
    image: cmmc-tracker:v2.1
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
```

### 4. Start the Application
```bash
docker compose up -d
```

### 5. Access the App
- Open: `http://your-server-ip:3000`
- Login: `admin@local` / `admin123`

---

## Manual Deploy (Git Clone)

### 1. Clone from GitHub
```bash
git clone https://github.com/b-lincko/Internal-progress.git
cd Internal-progress
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
```bash
# Edit .env with your DB credentials
npx prisma migrate deploy
npx prisma db seed
```

### 4. Build & Start
```bash
npm run build
npm start
```

---

## Post-Deploy: Seed Database (if empty)

If the app starts but login fails (no users):
```bash
# Run inside the app container
docker exec -it cmmc-app sh

# Or seed via SQL
docker exec -i cmmc-db psql -U cmmc -d cmmc2 << 'SQL'
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@local',
  '$2b$10$EF2DJNSnZvgHGCb78pDtG.Cg/5rW3nGp9Wd9dStyVCXMKPrwwGD1u',
  'Admin',
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;
SQL
```

---

## Troubleshooting

### Port 3000 in use?
```bash
sudo lsof -i :3000
sudo kill <PID>
```

### Database connection failed?
```bash
# Check DB container
docker logs cmmc-db

# Check network
docker network inspect server_cmmc-network
```

### Migrations failing?
```bash
# Reset and re-apply
npx prisma migrate reset --force
npx prisma migrate deploy
```

---

## What's New in v2.1

- **Chat Privacy Fixed** - Private messages no longer show in Global chat
- **Database Consistency** - Added missing migration for `created_by` column
- **No Default Creds** - Login page no longer shows default credentials
- **Docker Entrypoint** - Uses Node.js instead of `psql` for DB health checks

---

## Features
- 108 CMMC Level 2 Controls
- Dark Theme
- Team Chat (Global + Private)
- POA&M Tracker
- Asset Inventory
- Document Management
- Project Tracking
- Notifications
- Admin Panel

## Default Admin
- Email: `admin@local`
- Password: `admin123`
- **Change this immediately after first login!**
