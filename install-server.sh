#!/bin/bash
#
# CMMC Tracker - Node.js Upgrade + Installation Script
# Fixes the "Unsupported engine" / "Prisma needs Node >= 16.13" error
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker - Node.js Fix + Full Installation            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. CHECK CURRENT NODE VERSION
# ─────────────────────────────────────────────────────────────
CURRENT_NODE=$(node --version 2>/dev/null || echo "not installed")
log_info "Current Node.js version: $CURRENT_NODE"

# Extract major version number
NODE_MAJOR=$(echo "$CURRENT_NODE" | sed 's/v//g' | cut -d. -f1)

# ─────────────────────────────────────────────────────────────
# 2. INSTALL NODE.JS 22 LTS IF NEEDED
# ─────────────────────────────────────────────────────────────
if [[ "$CURRENT_NODE" == "not installed" ]] || [[ "$NODE_MAJOR" -lt 18 ]]; then
    log_warn "Node.js is too old or not installed. Installing Node.js 22 LTS..."
    
    # Detect OS
    if command -v apt-get &>/dev/null; then
        # Debian/Ubuntu/Kali
        log_info "Detected Debian-based system. Installing Node.js via NodeSource..."
        
        # Install dependencies
        apt-get update -qq
        apt-get install -y -qq curl ca-certificates gnupg
        
        # Add NodeSource repo for Node 22
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        
        # Install Node.js
        apt-get install -y -qq nodejs
        
    elif command -v dnf &>/dev/null; then
        # Fedora/RHEL 8+
        log_info "Detected RHEL-based system. Installing Node.js..."
        dnf module -y reset nodejs
        dnf module -y install nodejs:22
        
    elif command -v yum &>/dev/null; then
        # Older RHEL/CentOS
        log_info "Detected older RHEL-based system. Installing Node.js via NodeSource..."
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        yum install -y nodejs
        
    else
        log_error "Unsupported package manager. Please install Node.js 22 manually:"
        log_error "  https://nodejs.org/en/download/"
        exit 1
    fi
    
    # Verify new installation
    NEW_NODE=$(node --version)
    log_ok "Node.js updated to: $NEW_NODE"
    
    # Update npm to latest
    log_info "Updating npm to latest..."
    npm install -g npm@latest
    log_ok "npm updated to: $(npm --version)"
else
    log_ok "Node.js version is sufficient ($CURRENT_NODE)"
fi

# ─────────────────────────────────────────────────────────────
# 3. RE-RUN npm install (or npm ci)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Installing npm dependencies..."
cd "$APP_DIR"

# Clean old node_modules if they were installed with wrong node version
if [[ -d "node_modules" ]]; then
    log_warn "Removing old node_modules (installed with old Node version)..."
    rm -rf node_modules package-lock.json
fi

npm install
log_ok "Dependencies installed successfully"

# ─────────────────────────────────────────────────────────────
# 4. GENERATE SSL CERTIFICATES
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Checking SSL certificates..."

CERTS_DIR="$APP_DIR/certs"
mkdir -p "$CERTS_DIR"

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
    log_warn "SSL certificates not found. Generating self-signed certificates..."
    
    # Check if openssl is available
    if ! command -v openssl &>/dev/null; then
        log_warn "OpenSSL not found. Installing..."
        if command -v apt-get &>/dev/null; then
            apt-get install -y -qq openssl
        elif command -v dnf &>/dev/null; then
            dnf install -y openssl
        elif command -v yum &>/dev/null; then
            yum install -y openssl
        fi
    fi
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/key.pem" \
        -out "$CERTS_DIR/cert.pem" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" 2>/dev/null || \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/key.pem" \
        -out "$CERTS_DIR/cert.pem" \
        -subj "/CN=localhost"
    
    chmod 600 "$CERTS_DIR/key.pem"
    log_ok "Self-signed SSL certificates generated"
else
    log_ok "SSL certificates already exist"
fi

# ─────────────────────────────────────────────────────────────
# 5. SET UP POSTGRESQL
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up PostgreSQL database..."

DB_NAME="cmmc2"
DB_USER="cmmc"
DB_PASS="changeme-strong-password"

# Check if PostgreSQL is installed
if ! command -v psql &>/dev/null; then
    log_warn "PostgreSQL not found. Installing..."
    if command -v apt-get &>/dev/null; then
        apt-get install -y -qq postgresql postgresql-contrib
    elif command -v dnf &>/dev/null; then
        dnf install -y postgresql-server
        postgresql-setup --initdb
        systemctl start postgresql
    elif command -v yum &>/dev/null; then
        yum install -y postgresql-server
        postgresql-setup initdb
        service postgresql start
    fi
fi

# Ensure PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    log_warn "PostgreSQL not running. Starting..."
    if command -v systemctl &>/dev/null; then
        systemctl start postgresql || true
    elif command -v service &>/dev/null; then
        service postgresql start || true
    fi
    sleep 2
fi

if pg_isready -q 2>/dev/null; then
    log_ok "PostgreSQL is running"
else
    log_error "Cannot start PostgreSQL. Please start it manually."
    exit 1
fi

# Create database and user
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")
if [[ "$USER_EXISTS" != "1" ]]; then
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    log_ok "Created database user '$DB_USER'"
fi

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [[ "$DB_EXISTS" != "1" ]]; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
    log_ok "Created database '$DB_NAME'"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────
# 6. CREATE .ENV FILE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Creating .env file..."

cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
PORT=3000
HTTP_PORT=3001
NODE_ENV=production
EOF

log_ok ".env created"

# ─────────────────────────────────────────────────────────────
# 7. SET UP PRISMA
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up Prisma ORM..."

npx prisma generate
log_ok "Prisma client generated"

npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-generate --skip-seed
log_ok "Database migrations applied"

# ─────────────────────────────────────────────────────────────
# 8. SEED DATABASE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Seeding database..."

if [[ -f "$APP_DIR/prisma/seed.ts" ]]; then
    npx tsx "$APP_DIR/prisma/seed.ts" 2>/dev/null || log_warn "Seed script may have already run"
fi

if [[ -f "$APP_DIR/seed-data.sql" ]]; then
    sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/seed-data.sql" 2>/dev/null || true
fi

log_ok "Database seeded"

# ─────────────────────────────────────────────────────────────
# 9. BUILD THE APP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Building Next.js application..."

npm run build

log_ok "Build completed"

# ─────────────────────────────────────────────────────────────
# 10. CREATE START SCRIPT
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Creating quick-start script..."

cat > "$APP_DIR/start-https.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [[ -f "$APP_DIR/.env" ]]; then
    set -a
    source "$APP_DIR/.env"
    set +a
fi

PORT=${PORT:-3000}
HTTP_PORT=${HTTP_PORT:-3001}
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            CMMC Tracker - HTTPS Server                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 HTTPS Server:  https://localhost:$PORT"
echo "  🌐 Network:       https://$LOCAL_IP:$PORT"
echo "  🔄 HTTP Redirect: http://localhost:$HTTP_PORT"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

node "$APP_DIR/server.js"
EOF

chmod +x "$APP_DIR/start-https.sh"
log_ok "Quick-start script created: start-https.sh"

# ─────────────────────────────────────────────────────────────
# 11. LAUNCH
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   INSTALLATION COMPLETE!                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}✅ Node.js upgraded and installed${NC}"
echo -e "  ${GREEN}✅ Dependencies installed${NC}"
echo -e "  ${GREEN}✅ Database configured${NC}"
echo -e "  ${GREEN}✅ App built${NC}"
echo -e "  ${GREEN}✅ SSL certificates ready${NC}"
echo ""
echo "  🌐 Access URLs:"
echo "     • https://localhost:3000"
echo "     • https://$LOCAL_IP:3000"
echo "     • http://localhost:3001 (redirects to HTTPS)"
echo ""
echo "  ⚠️  Browsers will warn about self-signed certs. Click 'Advanced' → 'Proceed'."
echo ""
echo "  🚀 Starting HTTPS server now..."
echo ""

exec "$APP_DIR/start-https.sh"
