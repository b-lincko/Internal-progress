# CMMC Tracker - Deployment Guide

## Option 1: Docker Compose (Recommended) ✅

### Requirements
- Docker + Docker Compose

### Steps

1. **Copy project to server:**
```bash
# On your machine - zip the project
cd /home/kali/.openclaw/workspace/cmmc-tracker
zip -r cmmc-tracker.zip . -x "node_modules/*" ".next/*" "*.log"

# Transfer to server
scp cmmc-tracker.zip user@server:/opt/

# On server
unzip cmmc-tracker.zip -d /opt/cmmc-tracker
cd /opt/cmmc-tracker
```

2. **Create environment file:**
```bash
cat > .env << 'EOF'
DB_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-key-here
EOF
```

3. **Build and run:**
```bash
docker-compose up --build -d
```

4. **Initialize database (first time only):**
```bash
# Wait for DB to be ready (30 seconds)
sleep 30

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed data (creates admin user + 108 controls)
docker-compose exec app npx prisma db seed
```

5. **Access:**
- App: http://server-ip:3000
- Login: `admin@local` / `admin123`

### Useful Commands
```bash
# View logs
docker-compose logs -f app

# Restart
docker-compose restart app

# Stop everything
docker-compose down

# Backup database
docker-compose exec db pg_dump -U cmmc cmmc2 > backup.sql

# Restore database
docker-compose exec -T db psql -U cmmc cmmc2 < backup.sql
```

---

## Option 2: Manual Deployment (Not Recommended)

### Requirements
- Node.js 22+
- PostgreSQL 16+
- Linux server

### Steps

1. **Install PostgreSQL:**
```bash
sudo apt update
sudo apt install postgresql-16
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER cmmc WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE cmmc2 OWNER cmmc;"
```

2. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Deploy app:**
```bash
cd /opt/cmmc-tracker
npm ci
npx prisma generate
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
npm run start
```

---

## Troubleshooting

### Port 3000 already in use
```bash
# Find process
sudo lsof -ti:3000 | xargs sudo kill -9

# Or change port in docker-compose.yml
ports:
  - "8080:3000"
```

### Database connection failed
```bash
# Check DB is running
docker-compose ps db

# Check logs
docker-compose logs db

# Reset DB (WARNING: deletes all data!)
docker-compose down -v
docker-compose up -d
```

### Static files not loading (404)
```bash
# Rebuild with static files
docker-compose exec app sh -c "cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"
docker-compose restart app
```

---

## 🚀 Quick Deploy Script

Save this as `deploy.sh` on your server:

```bash
#!/bin/bash
set -e

APP_DIR="/opt/cmmc-tracker"
ZIP_FILE="$1"

if [ -z "$ZIP_FILE" ]; then
    echo "Usage: ./deploy.sh cmmc-tracker.zip"
    exit 1
fi

# Stop existing
cd $APP_DIR 2>/dev/null && docker-compose down || true

# Extract new code
rm -rf $APP_DIR
unzip -q "$ZIP_FILE" -d $APP_DIR
cd $APP_DIR

# Create env if not exists
[ ! -f .env ] && echo -e "DB_PASSWORD=$(openssl rand -base64 16)\nJWT_SECRET=$(openssl rand -base64 32)" > .env

# Build and start
docker-compose up --build -d

# Wait for DB
sleep 30

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed if first time
if [ "$2" == "--seed" ]; then
    docker-compose exec app npx prisma db seed
fi

echo "✅ Deployed! Access: http://$(hostname -I | awk '{print $1}'):3000"
```

Usage:
```bash
chmod +x deploy.sh
./deploy.sh cmmc-tracker.zip --seed
```
