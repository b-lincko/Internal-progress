#!/bin/bash
#
# CMMC Tracker - Fix Permissions + Complete Installation
# Run this if you got "Permission denied" on the .env file
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_IP=$(hostname -I | awk '{print $1}')
CURRENT_USER=$(whoami)

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
echo "║  CMMC Tracker - Fix Permissions + Full Installation          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. FIX DIRECTORY PERMISSIONS
# ─────────────────────────────────────────────────────────────
log_info "Running as user: $CURRENT_USER"
log_info "App directory: $APP_DIR"

# Check if we own the directory
if [[ ! -w "$APP_DIR" ]]; then
    log_warn "Cannot write to $APP_DIR"
    log_info "Fixing permissions..."
    
    # Try to fix with sudo first
    if command -v sudo &>/dev/null; then
        sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
        sudo chmod -R u+rwX "$APP_DIR"
        log_ok "Permissions fixed with sudo"
    else
        # No sudo, try direct chown (must be root)
        chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
        chmod -R u+rwX "$APP_DIR"
        log_ok "Permissions fixed"
    fi
else
    log_ok "Directory is writable"
fi

# Verify
if [[ ! -w "$APP_DIR" ]]; then
    log_error "Still cannot write to $APP_DIR"
    log_error "Run this script as the directory owner, or as root:"
    log_error "  sudo chown -R \$(whoami) $APP_DIR"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# 2. CHECK / FIX NODE.JS VERSION
# ─────────────────────────────────────────────────────────────
CURRENT_NODE=$(node --version 2>/dev/null || echo "not installed")
log_info "Current Node.js: $CURRENT_NODE"

NODE_MAJOR=$(echo "$CURRENT_NODE" | sed 's/v//g' | cut -d. -f1)

if [[ "$CURRENT_NODE" == "not installed" ]] || [[ "$NODE_MAJOR" -lt 18 ]]; then
    log_warn "Node.js is too old. Installing Node.js 22 LTS..."
    
    if command -v apt-get &>/dev/null; then
        if command -v sudo &>/dev/null; then
            sudo apt-get update -qq
            sudo apt-get install -y -qq curl ca-certificates gnupg
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
            sudo apt-get install -y -qq nodejs
        else
            apt-get update -qq
            apt-get install -y -qq curl ca-certificates gnupg
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y -qq nodejs
        fi
    else
        log_error "Unsupported system. Install Node.js 22 manually."
        exit 1
    fi
    
    log_ok "Node.js updated to $(node --version)"
    
    # Update npm
    if command -v sudo &>/dev/null; then
        sudo npm install -g npm@latest
    else
        npm install -g npm@latest
    fi
    log_ok "npm updated to $(npm --version)"
fi

# ─────────────────────────────────────────────────────────────
# 3. CLEAN OLD node_modules
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Cleaning old node_modules..."

if [[ -d "$APP_DIR/node_modules" ]]; then
    rm -rf "$APP_DIR/node_modules" "$APP_DIR/package-lock.json"
    log_ok "Old node_modules removed"
fi

# ─────────────────────────────────────────────────────────────
# 4. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────
log_info "Installing dependencies..."
cd "$APP_DIR"
npm install
log_ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────
# 5. SSL CERTIFICATES
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Checking SSL certificates..."

CERTS_DIR="$APP_DIR/certs"
mkdir -p "$CERTS_DIR"

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
    log_warn "Generating self-signed SSL certificates..."
    
    if ! command -v openssl &>/dev/null; then
        log_info "Installing OpenSSL..."
        if command -v sudo &>/dev/null; then
            sudo apt-get install -y -qq openssl
        else
            apt-get install -y -qq openssl
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
    log_ok "SSL certificates generated"
else
    log_ok "SSL certificates exist"
fi

# ─────────────────────────────────────────────────────────────
# 6. POSTGRESQL SETUP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up PostgreSQL..."

DB_NAME="cmmc2"
DB_USER="cmmc"
DB_PASS="changeme-strong-password"

# Install PostgreSQL if missing
if ! command -v psql &>/dev/null; then
    log_warn "PostgreSQL not found. Installing..."
    if command -v apt-get &>/dev/null; then
        if command -v sudo &>/dev/null; then
            sudo apt-get install -y -qq postgresql postgresql-contrib
        else
            apt-get install -y -qq postgresql postgresql-contrib
        fi
    fi
fi

# Start PostgreSQL
if ! pg_isready -q 2>/dev/null; then
    log_warn "Starting PostgreSQL..."
    if command -v sudo &>/dev/null; then
        sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
    else
        systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true
    fi
    sleep 2
fi

if pg_isready -q 2>/dev/null; then
    log_ok "PostgreSQL is running"
else
    log_error "Cannot start PostgreSQL. Start it manually:"
    log_error "  sudo systemctl start postgresql"
    exit 1
fi

# Create DB and user (using sudo -u postgres)
SUDO_PREFIX=""
if [[ "$EUID" -ne 0 ]] && command -v sudo &>/dev/null; then
    SUDO_PREFIX="sudo"
fi

USER_EXISTS=$($SUDO_PREFIX -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")
if [[ "$USER_EXISTS" != "1" ]]; then
    $SUDO_PREFIX -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    log_ok "Created DB user '$DB_USER'"
fi

DB_EXISTS=$($SUDO_PREFIX -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [[ "$DB_EXISTS" != "1" ]]; then
    $SUDO_PREFIX -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
    log_ok "Created database '$DB_NAME'"
fi

$SUDO_PREFIX -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────
# 7. CREATE .ENV FILE
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

chmod 600 "$APP_DIR/.env"
log_ok ".env file created"

# ─────────────────────────────────────────────────────────────
# 8. PRISMA SETUP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up Prisma..."

cd "$APP_DIR"
npx prisma generate
log_ok "Prisma client generated"

npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-generate --skip-seed
log_ok "Database migrations applied"

# ─────────────────────────────────────────────────────────────
# 9. SEED DATABASE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Seeding database..."

if [[ -f "$APP_DIR/prisma/seed.ts" ]]; then
    npx tsx "$APP_DIR/prisma/seed.ts" 2>/dev/null || log_warn "Seed may have already run"
fi

if [[ -f "$APP_DIR/seed-data.sql" ]]; then
    $SUDO_PREFIX -u postgres psql -d "$DB_NAME" -f "$APP_DIR/seed-data.sql" 2>/dev/null || true
fi

log_ok "Database seeded"

# ─────────────────────────────────────────────────────────────
# 10. BUILD APP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Building Next.js app..."

npm run build

log_ok "Build completed"

# ─────────────────────────────────────────────────────────────
# 11. CREATE START SCRIPT
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Creating start-https.sh..."

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
echo "  🌐 HTTPS:   https://localhost:$PORT"
echo "  🌐 Network: https://$LOCAL_IP:$PORT"
echo "  🔄 HTTP:    http://localhost:$HTTP_PORT → HTTPS"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

node "$APP_DIR/server.js"
EOF

chmod +x "$APP_DIR/start-https.sh"
log_ok "Quick-start script created"

# ─────────────────────────────────────────────────────────────
# 12. LAUNCH
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ INSTALLATION COMPLETE!                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Access URLs:"
echo "     • https://localhost:3000"
echo "     • https://$LOCAL_IP:3000"
echo "     • http://localhost:3001 (redirects to HTTPS)"
echo ""
echo "  ⚠️  Accept the self-signed cert warning in your browser"
echo ""
echo "  🚀 Starting server now..."
echo ""

exec "$APP_DIR/start-https.sh"
