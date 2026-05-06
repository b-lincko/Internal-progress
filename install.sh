#!/bin/bash
#
# CMMC Tracker - One Script to Install, Fix, and Launch Everything
# Checks what exists, skips what's good, fixes what's broken.
#

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_IP=$(hostname -I | awk '{print $1}')
CURRENT_USER=$(whoami)

# Colors
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
N='\033[0m'

info()  { echo -e "${B}[INFO]${N}  $1"; }
ok()    { echo -e "${G}[OK]${N}    $1"; }
warn()  { echo -e "${Y}[WARN]${N}  $1"; }
err()   { echo -e "${R}[ERROR]${N} $1"; }

SUDO=""
[[ "$EUID" -ne 0 ]] && command -v sudo &>/dev/null && SUDO="sudo"

# ─── Helpers ─────────────────────────────────────────────────
has_cmd() { command -v "$1" &>/dev/null; }
node_major() { node --version 2>/dev/null | sed 's/v//;s/\..*//' || echo 0; }

# ─── 1. Fix Permissions ──────────────────────────────────────
info "Checking directory permissions..."
if [[ ! -w "$APP_DIR" ]]; then
    warn "Directory not writable. Fixing..."
    $SUDO chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
    chmod -R u+rwX "$APP_DIR"
    ok "Permissions fixed"
else
    ok "Directory is writable"
fi

cd "$APP_DIR"

# ─── 2. Node.js Check & Fix ────────────────────────────────
info "Checking Node.js..."
NODE_V=$(node_major)

if [[ "$NODE_V" -ge 18 ]]; then
    ok "Node.js $(node --version) is good"
else
    warn "Node.js is old or missing (v$NODE_V). Installing Node 22..."

    # Remove conflicting old packages first
    $SUDO apt-get remove -y libnode-dev libnode72 nodejs-doc 2>/dev/null || true
    $SUDO apt-get purge -y nodejs 2>/dev/null || true
    $SUDO apt-get autoremove -y 2>/dev/null || true
    $SUDO dpkg --configure -a 2>/dev/null || true
    $SUDO apt-get install -f -y 2>/dev/null || true

    # Install Node 22
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq curl ca-certificates gnupg
    $SUDO rm -f /etc/apt/sources.list.d/nodesource.list*
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -
    $SUDO apt-get install -y -qq nodejs

    ok "Node.js $(node --version) installed"
fi

# Ensure npm is current
NPM_V=$(npm --version 2>/dev/null | cut -d. -f1)
if [[ "$NPM_V" -lt 9 ]]; then
    warn "npm is old. Updating..."
    $SUDO npm install -g npm@latest
fi
ok "npm $(npm --version) is good"

# ─── 3. OpenSSL Check ────────────────────────────────────────
info "Checking OpenSSL..."
if has_cmd openssl; then
    ok "OpenSSL found"
else
    warn "Installing OpenSSL..."
    $SUDO apt-get install -y -qq openssl
fi

# ─── 4. SSL Certificates ─────────────────────────────────────
info "Checking SSL certificates..."
mkdir -p "$APP_DIR/certs"
if [[ -f "$APP_DIR/certs/cert.pem" && -f "$APP_DIR/certs/key.pem" ]]; then
    ok "SSL certificates exist"
else
    warn "Generating self-signed SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$APP_DIR/certs/key.pem" \
        -out "$APP_DIR/certs/cert.pem" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" 2>/dev/null || \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$APP_DIR/certs/key.pem" \
        -out "$APP_DIR/certs/cert.pem" \
        -subj "/CN=localhost"
    chmod 600 "$APP_DIR/certs/key.pem"
    ok "Certificates generated"
fi

# ─── 5. PostgreSQL Check & Fix ─────────────────────────────
info "Checking PostgreSQL..."

if ! has_cmd psql; then
    warn "PostgreSQL not found. Installing..."
    $SUDO apt-get install -y -qq postgresql postgresql-contrib
fi

if ! pg_isready -q 2>/dev/null; then
    warn "PostgreSQL not running. Starting..."
    $SUDO systemctl start postgresql 2>/dev/null || $SUDO service postgresql start 2>/dev/null || true
    sleep 2
fi

pg_isready -q || { err "Cannot start PostgreSQL"; exit 1; }
ok "PostgreSQL is running"

DB_NAME="cmmc2"
DB_USER="cmmc"
DB_PASS="changeme-strong-password"

# Ensure DB user exists
USER_EXISTS=$($SUDO -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")
if [[ "$USER_EXISTS" != "1" ]]; then
    $SUDO -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;" 2>/dev/null || true
    ok "Created DB user '$DB_USER'"
else
    # Ensure permissions
    $SUDO -u postgres psql -c "ALTER USER $DB_USER WITH CREATEDB SUPERUSER;" 2>/dev/null || true
    ok "DB user '$DB_USER' permissions updated"
fi

# Ensure database exists
DB_EXISTS=$($SUDO -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [[ "$DB_EXISTS" != "1" ]]; then
    $SUDO -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
    ok "Created database '$DB_NAME'"
else
    ok "Database '$DB_NAME' exists"
fi

$SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
$SUDO -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

# ─── 6. .env File ────────────────────────────────────────────
info "Checking .env file..."
if [[ -f "$APP_DIR/.env" ]]; then
    ok ".env exists"
else
    warn "Creating .env..."
    cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
PORT=3000
HTTP_PORT=3001
NODE_ENV=production
EOF
    chmod 600 "$APP_DIR/.env"
    ok ".env created"
fi

# Load .env for Prisma
set -a
source "$APP_DIR/.env"
set +a

# ─── 7. npm Dependencies ─────────────────────────────────────
info "Checking npm dependencies..."
if [[ -d "$APP_DIR/node_modules" && -f "$APP_DIR/package-lock.json" ]]; then
    ok "node_modules exists"
else
    warn "Installing dependencies..."
    rm -rf node_modules package-lock.json
    npm install
    ok "Dependencies installed"
fi

# ─── 8. Prisma ───────────────────────────────────────────────
info "Checking Prisma..."

# Fix any permission issues in node_modules/.prisma
rm -rf "$APP_DIR/node_modules/.prisma" 2>/dev/null || true

npx prisma generate
ok "Prisma client generated"

# ─── 9. Migrations ───────────────────────────────────────────
info "Checking migrations..."

# Check if _prisma_migrations table exists (indicates DB was migrated before)
MIG_TABLE_EXISTS=$($SUDO -u postgres psql -d "$DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations';" 2>/dev/null || echo "0")

if [[ "$MIG_TABLE_EXISTS" == "1" ]]; then
    # Check for failed migrations
    MIG_FAILED=$($SUDO -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL;" 2>/dev/null || echo "0")
    
    if [[ "$MIG_FAILED" -gt 0 ]]; then
        warn "Found $MIG_FAILED failed migration(s)."
        FAILED_NAME=$($SUDO -u postgres psql -d "$DB_NAME" -tAc "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL LIMIT 1;" 2>/dev/null || echo "")
        
        if [[ -n "$FAILED_NAME" ]]; then
            warn "Failed migration: $FAILED_NAME"
            warn "Marking as rolled back..."
            npx prisma migrate resolve --rolled-back "$FAILED_NAME" 2>/dev/null || {
                warn "Auto-resolve failed. Cleaning migration table..."
                $SUDO -u postgres psql -d "$DB_NAME" -c "DELETE FROM _prisma_migrations WHERE finished_at IS NULL;" 2>/dev/null || true
            }
        fi
    fi
    
    # Try deploy first (no shadow DB needed)
    if npx prisma migrate deploy; then
        ok "Migrations applied (deploy)"
    else
        warn "Migrate deploy failed after resolving. Full reset needed..."
        $SUDO -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
        $SUDO -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
        $SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
        $SUDO -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
        npx prisma migrate deploy
        ok "Database reset and migrations applied"
    fi
else
    # Fresh database, just deploy
    npx prisma migrate deploy
    ok "Migrations applied (fresh DB)"
fi

# ─── 10. Seed ────────────────────────────────────────────────
info "Checking seed data..."
SEED_COUNT=$($SUDO -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
if [[ "$SEED_COUNT" -gt 0 ]]; then
    ok "Database already has data ($SEED_COUNT users)"
else
    warn "Seeding database..."
    [[ -f "$APP_DIR/prisma/seed.ts" ]] && npx tsx "$APP_DIR/prisma/seed.ts" 2>/dev/null || true
    [[ -f "$APP_DIR/seed-data.sql" ]] && $SUDO -u postgres psql -d "$DB_NAME" -f "$APP_DIR/seed-data.sql" 2>/dev/null || true
    ok "Database seeded"
fi

# ─── 11. Build ───────────────────────────────────────────────
info "Checking Next.js build..."
if [[ -d "$APP_DIR/.next" && -f "$APP_DIR/.next/standalone/server.js" ]]; then
    ok "Build exists"
else
    warn "Building application..."
    rm -rf "$APP_DIR/.next"
    npm run build
    ok "Build completed"
fi

# ─── 12. Start Script ────────────────────────────────────────
info "Checking start-https.sh..."
if [[ -f "$APP_DIR/start-https.sh" ]]; then
    ok "start-https.sh exists"
else
    warn "Creating start-https.sh..."
    cat > "$APP_DIR/start-https.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
[[ -f "$APP_DIR/.env" ]] && { set -a; source "$APP_DIR/.env"; set +a; }
PORT=${PORT:-3000}
HTTP_PORT=${HTTP_PORT:-3001}
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            CMMC Tracker - HTTPS Server                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
[[ ! -d "$APP_DIR/.next" ]] && { echo "❌ Build not found. Run: npm run build"; exit 1; }
[[ ! -f "$APP_DIR/certs/cert.pem" ]] && { echo "❌ SSL certs not found"; exit 1; }
echo "  🌐 HTTPS:   https://localhost:$PORT"
echo "  🌐 Network: https://$LOCAL_IP:$PORT"
echo "  🔄 HTTP:    http://localhost:$HTTP_PORT → HTTPS"
echo ""
echo "  Press Ctrl+C to stop"
echo ""
node "$APP_DIR/server.js"
EOF
    chmod +x "$APP_DIR/start-https.sh"
    ok "start-https.sh created"
fi

# ─── 13. Launch ──────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ READY TO LAUNCH!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 https://localhost:3000"
echo "  🌐 https://$LOCAL_IP:3000"
echo "  🔄 http://localhost:3001 → HTTPS"
echo ""
echo "  ⚠️  Accept the self-signed cert warning in your browser"
echo ""
echo "  🚀 Starting server now..."
echo ""

exec "$APP_DIR/start-https.sh"
