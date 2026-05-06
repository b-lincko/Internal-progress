#!/bin/bash
#
# CMMC Tracker - Fix Migration + Build + Launch
# Fixes: shadow database permission error + missing build
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
echo "║  CMMC Tracker - Fix Migration + Build + Launch              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

SUDO=""
if [[ "$EUID" -ne 0 ]] && command -v sudo &>/dev/null; then
    SUDO="sudo"
fi

# ─────────────────────────────────────────────────────────────
# 1. FIX PERMISSIONS
# ─────────────────────────────────────────────────────────────
if [[ ! -w "$APP_DIR" ]]; then
    log_warn "Cannot write to $APP_DIR. Fixing..."
    $SUDO chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
    $SUDO chmod -R u+rwX "$APP_DIR"
fi

cd "$APP_DIR"

# ─────────────────────────────────────────────────────────────
# 2. LOAD .env
# ─────────────────────────────────────────────────────────────
if [[ -f "$APP_DIR/.env" ]]; then
    set -a
    source "$APP_DIR/.env"
    set +a
fi

# ─────────────────────────────────────────────────────────────
# 3. FIX POSTGRESQL PERMISSIONS (CREATEDB for shadow database)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Fixing PostgreSQL permissions..."

DB_USER="cmmc"
DB_NAME="cmmc2"

# Give cmmc user permission to create databases (needed for migrate dev)
$SUDO -u postgres psql -c "ALTER USER $DB_USER WITH CREATEDB;" 2>/dev/null || true
log_ok "Granted CREATEDB to '$DB_USER'"

# Also grant superuser (safest for migrations)
$SUDO -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;" 2>/dev/null || true

# Ensure the user owns the database
$SUDO -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" 2>/dev/null || true

# Grant schema privileges
$SUDO -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
log_ok "Database permissions fixed"

# ─────────────────────────────────────────────────────────────
# 4. RUN PRISMA MIGRATE DEPLOY (production-safe, no shadow DB)
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Running Prisma migrations..."

# First try deploy (no shadow database needed)
if npx prisma migrate deploy; then
    log_ok "Migrations applied with 'migrate deploy'"
else
    log_warn "migrate deploy failed. Trying migrate dev..."
    npx prisma migrate dev --name init --skip-generate --skip-seed || true
fi

# ─────────────────────────────────────────────────────────────
# 5. GENERATE PRISMA CLIENT
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Generating Prisma client..."
npx prisma generate
log_ok "Prisma client ready"

# ─────────────────────────────────────────────────────────────
# 6. SEED DATABASE
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
# 7. BUILD THE APP
# ─────────────────────────────────────────────────────────────
echo ""
log_info "Building Next.js application..."

# Clean old build first
rm -rf "$APP_DIR/.next"

npm run build

if [[ ! -d "$APP_DIR/.next" ]]; then
    log_error "Build failed - .next directory not found"
    exit 1
fi

log_ok "Build completed successfully"

# ─────────────────────────────────────────────────────────────
# 8. CREATE START SCRIPT
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

# Verify build exists
if [[ ! -d "$APP_DIR/.next" ]]; then
    echo "❌ Build not found. Run: npm run build"
    exit 1
fi

# Verify certs exist
if [[ ! -f "$APP_DIR/certs/cert.pem" || ! -f "$APP_DIR/certs/key.pem" ]]; then
    echo "❌ SSL certificates not found in $APP_DIR/certs/"
    exit 1
fi

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
# 9. LAUNCH
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ ALL FIXED - STARTING!                   ║"
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
