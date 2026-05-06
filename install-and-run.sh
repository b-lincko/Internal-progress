#!/bin/bash
#
# CMMC Tracker - Complete Installation & HTTPS Launch Script
# Installs dependencies, sets up PostgreSQL, builds the app, and launches HTTPS
#

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_NAME="cmmc2"
DB_USER="cmmc"
DB_PASS="changeme-strong-password"
JWT_SECRET="changeme-jwt-secret-key-min-32-chars"
HTTPS_PORT=3000
HTTP_PORT=3001
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_command() {
    if ! command -v "$1" &>/dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
    log_ok "$1 found: $(command -v "$1")"
}

# ─────────────────────────────────────────────────────────────
# 1. CHECK PREREQUISITES
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       CMMC Tracker - Installation & HTTPS Launcher         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

log_info "Checking prerequisites..."
check_command node
check_command npm
check_command psql
check_command openssl

NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# ─────────────────────────────────────────────────────────────
# 2. GENERATE SSL CERTIFICATES (if missing)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Checking SSL certificates..."

CERTS_DIR="$APP_DIR/certs"
mkdir -p "$CERTS_DIR"

if [[ ! -f "$CERTS_DIR/cert.pem" || ! -f "$CERTS_DIR/key.pem" ]]; then
    log_warn "SSL certificates not found. Generating self-signed certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/key.pem" \
        -out "$CERTS_DIR/cert.pem" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP"
    chmod 600 "$CERTS_DIR/key.pem"
    log_ok "Self-signed SSL certificates generated in $CERTS_DIR"
    log_warn "Browsers will show a security warning. This is normal for self-signed certs."
else
    log_ok "SSL certificates already exist"
fi

# ─────────────────────────────────────────────────────────────
# 3. SET UP POSTGRESQL DATABASE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up PostgreSQL database..."

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    log_warn "PostgreSQL does not appear to be running. Attempting to start..."
    if command -v systemctl &>/dev/null; then
        sudo systemctl start postgresql || true
    elif command -v service &>/dev/null; then
        sudo service postgresql start || true
    fi
    sleep 2
fi

# Check again
if pg_isready -q 2>/dev/null; then
    log_ok "PostgreSQL is running"
else
    log_error "PostgreSQL is not running. Please start it manually:"
    log_error "  sudo systemctl start postgresql   (systemd)"
    log_error "  sudo service postgresql start     (init)"
    exit 1
fi

# Create database and user
log_info "Creating database '$DB_NAME' and user '$DB_USER'..."

# Check if user exists
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")
if [[ "$USER_EXISTS" != "1" ]]; then
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    log_ok "Created database user '$DB_USER'"
else
    log_info "Database user '$DB_USER' already exists"
fi

# Check if database exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [[ "$DB_EXISTS" != "1" ]]; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
    log_ok "Created database '$DB_NAME'"
else
    log_info "Database '$DB_NAME' already exists"
fi

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ─────────────────────────────────────────────────────────────
# 4. CREATE .ENV FILE
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Creating .env file..."

cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=$HTTPS_PORT
HTTP_PORT=$HTTP_PORT
NODE_ENV=production
EOF

log_ok ".env file created"

# ─────────────────────────────────────────────────────────────
# 5. INSTALL NPM DEPENDENCIES
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Installing npm dependencies..."
cd "$APP_DIR"

if [[ -d "node_modules" ]]; then
    log_info "node_modules already exists. Running npm ci for clean install..."
    npm ci
else
    npm install
fi

log_ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────
# 6. SET UP PRISMA
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Setting up Prisma ORM..."

npx prisma generate
log_ok "Prisma client generated"

npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-generate --skip-seed
log_ok "Database migrations applied"

# ─────────────────────────────────────────────────────────────
# 7. SEED DATABASE (optional)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Seeding database with initial data..."

if [[ -f "$APP_DIR/prisma/seed.ts" ]]; then
    npx tsx "$APP_DIR/prisma/seed.ts" 2>/dev/null || log_warn "Seed script failed or not needed"
else
    log_info "No seed script found, skipping"
fi

# Also check for SQL seed
if [[ -f "$APP_DIR/seed-data.sql" ]]; then
    log_info "Found seed-data.sql, applying..."
    sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/seed-data.sql" 2>/dev/null || log_warn "SQL seed may have already been applied"
fi

log_ok "Database seeded"

# ─────────────────────────────────────────────────────────────
# 8. BUILD NEXT.JS APP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Building Next.js application..."

npm run build

log_ok "Build completed successfully"

# ─────────────────────────────────────────────────────────────
# 9. CREATE START SCRIPT
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Creating production start script..."

cat > "$APP_DIR/start-https.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Load environment
if [[ -f "$APP_DIR/.env" ]]; then
    export $(grep -v '^#' "$APP_DIR/.env" | xargs)
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

# Use the standalone server if available, otherwise fallback to custom server.js
if [[ -f "$APP_DIR/.next/standalone/server.js" ]]; then
    node "$APP_DIR/.next/standalone/server.js"
else
    node "$APP_DIR/server.js"
fi
EOF

chmod +x "$APP_DIR/start-https.sh"
log_ok "Start script created: start-https.sh"

# ─────────────────────────────────────────────────────────────
# 10. LAUNCH HTTPS SERVER
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   INSTALLATION COMPLETE!                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}✅ All dependencies installed${NC}"
echo -e "  ${GREEN}✅ Database configured${NC}"
echo -e "  ${GREEN}✅ App built successfully${NC}"
echo -e "  ${GREEN}✅ SSL certificates ready${NC}"
echo ""
echo "  📁 Application directory: $APP_DIR"
echo "  🗄️  Database:              $DB_NAME"
echo "  👤 DB User:               $DB_USER"
echo ""
echo "  🌐 Access URLs:"
echo "     • https://localhost:$HTTPS_PORT"
echo "     • https://$LOCAL_IP:$HTTPS_PORT"
echo "     • http://localhost:$HTTP_PORT (redirects to HTTPS)"
echo ""
echo "  ⚠️  Note: Browsers will warn about self-signed certificates."
echo "     Click 'Advanced' → 'Proceed' (or similar) to continue."
echo ""
echo "  🚀 Starting HTTPS server now..."
echo ""

# Start the server
exec "$APP_DIR/start-https.sh"
