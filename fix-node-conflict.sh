#!/bin/bash
#
# CMMC Tracker - Fix Node.js Conflict + Full Install
# Handles the dpkg conflict with old libnode-dev
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
echo "║  CMMC Tracker - Fix Node.js Conflict + Full Install        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

SUDO=""
if [[ "$EUID" -ne 0 ]] && command -v sudo &>/dev/null; then
    SUDO="sudo"
fi

# ─────────────────────────────────────────────────────────────
# 1. FIX DIRECTORY PERMISSIONS
# ─────────────────────────────────────────────────────────────
log_info "Running as: $CURRENT_USER"
log_info "App directory: $APP_DIR"

if [[ ! -w "$APP_DIR" ]]; then
    log_warn "Cannot write to $APP_DIR. Fixing permissions..."
    $SUDO chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
    $SUDO chmod -R u+rwX "$APP_DIR"
    log_ok "Permissions fixed"
fi

# ─────────────────────────────────────────────────────────────
# 2. REMOVE OLD NODE.JS PACKAGES (fixes dpkg conflict)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Removing old Node.js 12 packages..."

# Remove conflicting packages first
$SUDO apt-get remove -y libnode-dev libnode72 2>/dev/null || true
$SUDO apt-get remove -y nodejs-doc 2>/dev/null || true

# Purge old nodejs
$SUDO apt-get purge -y nodejs 2>/dev/null || true
$SUDO apt-get autoremove -y 2>/dev/null || true

# Clean up dpkg state
$SUDO dpkg --configure -a 2>/dev/null || true
$SUDO apt-get install -f -y 2>/dev/null || true

log_ok "Old Node.js packages removed"

# ─────────────────────────────────────────────────────────────
# 3. INSTALL NODE.JS 22
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Installing Node.js 22 LTS..."

# Re-add NodeSource repo
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq curl ca-certificates gnupg

# Remove old nodesource repo if exists
$SUDO rm -f /etc/apt/sources.list.d/nodesource.list*

# Add fresh NodeSource repo
curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -

# Install nodejs (should work now without conflict)
$SUDO apt-get install -y -qq nodejs

# Verify
NODE_VERSION=$(node --version)
log_ok "Node.js installed: $NODE_VERSION"

# Update npm
$SUDO npm install -g npm@latest
log_ok "npm updated: $(npm --version)"

# ─────────────────────────────────────────────────────────────
# 4. CLEAN OLD node_modules
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Cleaning old node_modules..."

cd "$APP_DIR"
rm -rf node_modules package-lock.json .next
log_ok "Cleaned"

# ─────────────────────────────────────────────────────────────
# 5. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────
log_info "Installing npm dependencies..."
npm install
log_ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────
# 6. SSL CERTIFICATES
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Checking SSL certificates..."

CERTS_DIR="$APP_DIR/certs"
mkdir -p "$CERTS_DIR"

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
    log_warn "Generating self-signed SSL certificates..."
    
    if ! command -v openssl &>/dev/null; then
        log_info "Installing OpenSSL..."
        $SUDO apt-get install -y -qq openssl
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
# 7. POSTGRESQL SETUP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up PostgreSQL..."

DB_NAME="cmmc2"
DB_USER="cmmc"
DB_PASS="changeme-strong-password"

if ! command -v psql &>/dev/null; then
    log_warn "PostgreSQL not found. Installing..."
    $SUDO apt-get install -y -qq postgresql postgresql-contrib
fi

if ! pg_isready -q 2>/dev/null; then
    log_warn "Starting PostgreSQL..."
    $SUDO systemctl start postgresql 2>/dev/null || $SUDO service postgresql start 2>/dev/null || true
    sleep 2
fi

if pg_isready -q 2>/dev/null; then
    log_ok "PostgreSQL is running"
else
    log_error "Cannot start PostgreSQL. Start manually: sudo systemctl start postgresql"
    exit 1
fi

USER_EXISTS=$($SUDO -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")
if [[ "$USER_EXISTS" != "1" ]]; then
    $SUDO -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    log_ok "Created DB user '$DB_USER'"
fi

DB_EXISTS=$($SUDO -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [[ "$DB_EXISTS" != "1" ]]; then
    $SUDO -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
    log_ok "Created database '$DB_NAME'"
fi

$SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────
# 8. CREATE .ENV FILE
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
log_ok ".env created"

# ─────────────────────────────────────────────────────────────
# 9. PRISMA SETUP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up Prisma..."

cd "$APP_DIR"
npx prisma generate
log_ok "Prisma client generated"

npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-generate --skip-seed
log_ok "Migrations applied"

# ─────────────────────────────────────────────────────────────
# 10. SEED DATABASE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Seeding database..."

if [[ -f "$APP_DIR/prisma/seed.ts" ]]; then
    npx tsx "$APP_DIR/prisma/seed.ts" 2>/dev/null || log_warn "Seed may have already run"
fi

if [[ -f "$APP_DIR/seed-data.sql" ]]; then
    $SUDO -u postgres psql -d "$DB_NAME" -f "$APP_DIR/seed-data.sql" 2>/dev/null || true
fi

log_ok "Database seeded"

# ─────────────────────────────────────────────────────────────
# 11. BUILD APP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Building Next.js app..."

npm run build

log_ok "Build completed"

# ─────────────────────────────────────────────────────────────
# 12. CREATE START SCRIPT
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
# 13. LAUNCH
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
