#!/bin/bash
# Build Complete Offline Docker Bundle with Pre-seeded Database
# Run this on source machine (with Docker and internet)

set -e

echo "========================================="
echo "  CMMC Tracker - Complete Offline Build"
echo "========================================="
echo ""

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$APP_DIR/offline-bundle"
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="cmmc-tracker-complete-$BUILD_DATE"

# Clean previous builds
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

echo -e "→ Building app image..."
cd "$APP_DIR"
docker build -t cmmc-tracker:latest .

echo -e "→ Pulling PostgreSQL image..."
docker pull postgres:16-alpine

echo -e "→ Starting temporary database for seeding..."
docker run -d --name cmmc-temp-db \
  -e POSTGRES_USER=cmmc \
  -e POSTGRES_PASSWORD=temp123 \
  -e POSTGRES_DB=cmmc2 \
  postgres:16-alpine

# Wait for DB to be ready
echo -e "→ Waiting for database..."
sleep 15

# Run migrations
echo -e "→ Running migrations..."
docker run --rm --link cmmc-temp-db:db \
  -e DATABASE_URL=postgresql://cmmc:temp123@db:5432/cmmc2 \
  -v "$APP_DIR/prisma:/app/prisma" \
  -v "$APP_DIR/node_modules:/app/node_modules" \
  -w /app \
  cmmc-tracker:latest \
  sh -c "npx prisma migrate deploy"

# Seed database
echo -e "→ Seeding database..."
docker run --rm --link cmmc-temp-db:db \
  -e DATABASE_URL=postgresql://cmmc:temp123@db:5432/cmmc2 \
  -v "$APP_DIR/src/lib/prisma.ts:/app/src/lib/prisma.ts" \
  -v "$APP_DIR/prisma:/app/prisma" \
  -v "$APP_DIR/node_modules:/app/node_modules" \
  -w /app \
  cmmc-tracker:latest \
  sh -c "node -e \"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@local', password_hash: hash, role: 'Admin' }
  });
  console.log('Admin created');

  const domains = [
    {n:'Access Control (AC)',s:'AC'},{n:'Awareness and Training (AT)',s:'AT'},
    {n:'Audit and Accountability (AU)',s:'AU'},{n:'Configuration Management (CM)',s:'CM'},
    {n:'Identification and Authentication (IA)',s:'IA'},{n:'Incident Response (IR)',s:'IR'},
    {n:'Maintenance (MA)',s:'MA'},{n:'Media Protection (MP)',s:'MP'},
    {n:'Personnel Security (PS)',s:'PS'},{n:'Physical Protection (PE)',s:'PE'},
    {n:'Risk Assessment (RA)',s:'RA'},{n:'Security Assessment (CA)',s:'CA'},
    {n:'System and Communications Protection (SC)',s:'SC'},{n:'System and Information Integrity (SI)',s:'SI'}
  ];

  const templates = {
    AC:[{id:'3.1.1',t:'Limit system access to authorized users',d:'Limit information system access to authorized users.'},{id:'3.1.2',t:'Limit system access to types of transactions',d:'Limit information system access to the types of transactions that authorized users are permitted to execute.'},{id:'3.1.3',t:'Control flow of CUI',d:'Control the flow of CUI in accordance with approved authorizations.'},{id:'3.1.4',t:'Separation of duties',d:'Separate the duties of individuals to reduce the risk of malevolent activity without collusion.'},{id:'3.1.5',t:'Least privilege',d:'Employ the principle of least privilege, allowing only authorized accesses necessary to accomplish assigned tasks.'},{id:'3.1.6',t:'Non-privileged access for nonsecurity functions',d:'Use non-privileged accounts when performing nonsecurity functions.'},{id:'3.1.7',t:'Prevent non-privileged users from executing privileged functions',d:'Prevent non-privileged users from executing privileged functions.'},{id:'3.1.8',t:'Limit unsuccessful logon attempts',d:'Limit the number of unsuccessful logon attempts.'},{id:'3.1.9',t:'Privacy and security notices',d:'Provide privacy and security notices consistent with applicable CUI rules.'},{id:'3.1.10',t:'Use session lock',d:'Use session lock with pattern-hiding display to prevent access/viewing.'},{id:'3.1.11',t:'Terminate sessions after inactivity',d:'Terminate sessions after a defined period of inactivity.'},{id:'3.1.12',t:'Monitor and control remote access',d:'Monitor and control remote access sessions.'},{id:'3.1.13',t:'Employ cryptographic mechanisms',d:'Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.'},{id:'3.1.14',t:'Route remote access through managed points',d:'Route remote access via managed access control points.'},{id:'3.1.15',t:'Authorize wireless access',d:'Authorize wireless access prior to allowing such connections.'},{id:'3.1.16',t:'Protect wireless access',d:'Protect wireless access using authentication and encryption.'},{id:'3.1.17',t:'Control mobile device access',d:'Control connection of mobile devices.'},{id:'3.1.18',t:'Encrypt mobile device data',d:'Encrypt CUI on mobile devices.'},{id:'3.1.19',t:'Restrict USB devices',d:'Restrict use of organization-defined portable storage devices.'},{id:'3.1.20',t:'Limit external connections',d:'Limit external system connections.'},{id:'3.1.21',t:'Control public information',d:'Control CUI posted on publicly accessible systems.'},{id:'3.1.22',t:'Control CUI in shared resources',d:'Control CUI in shared system resources.'}],
    AT:[{id:'3.2.1',t:'Security awareness training',d:'Ensure that managers, system administrators, and users of organizational systems are aware of security risks.'},{id:'3.2.2',t:'Insider threat training',d:'Provide insider threat awareness training.'},{id:'3.2.3',t:'Role-based training',d:'Provide role-based security training.'}],
    AU:[{id:'3.3.1',t:'Create and retain audit logs',d:'Create and retain system audit logs.'},{id:'3.3.2',t:'Ensure audit events are reviewed',d:'Ensure that the auditing system is reviewed.'},{id:'3.3.3',t:'Protect audit information',d:'Protect audit information.'},{id:'3.3.4',t:'Audit failure alerts',d:'Alert on audit processing failures.'},{id:'3.3.5',t:'Correlate audit records',d:'Correlate audit record review, analysis, and reporting.'},{id:'3.3.6',t:'Provide audit reduction',d:'Provide audit reduction and report generation.'},{id:'3.3.7',t:'Time stamps',d:'Provide time stamps for audit records.'},{id:'3.3.8',t:'Protection of audit info',d:'Protect audit information and tools.'},{id:'3.3.9',t:'Manage audit storage capacity',d:'Manage audit storage capacity.'}],
    CM:[{id:'3.4.1',t:'Establish baseline configurations',d:'Establish baseline configurations.'},{id:'3.4.2',t:'Enforce security config',d:'Establish and enforce security configuration settings.'},{id:'3.4.3',t:'Track and review changes',d:'Track, review, and approve changes.'},{id:'3.4.4',t:'Security impact analysis',d:'Analyze security impact of changes.'},{id:'3.4.5',t:'Access restrictions for changes',d:'Define, document, and enforce access restrictions.'},{id:'3.4.6',t:'Least functionality',d:'Employ least functionality by configuring systems to provide only essential capabilities.'},{id:'3.4.7',t:'Nonessential functions',d:'Restrict nonessential programs, functions, ports, protocols, and services.'},{id:'3.4.8',t:'Software usage restrictions',d:'Apply software usage restrictions for nonessential software.'},{id:'3.4.9',t:'User-installed software',d:'Control user installation of software.'},{id:'3.4.10',t:'Component inventory',d:'Create and maintain an inventory of system components.'},{id:'3.4.11',t:'Memory protection',d:'Employ mechanisms to protect memory.'}],
    IA:[{id:'3.5.1',t:'Identify system users',d:'Identify system users, processes, and devices.'},{id:'3.5.2',t:'Authenticate identities',d:'Authenticate identities of users, processes, and devices.'},{id:'3.5.3',t:'Multi-factor authentication',d:'Use multi-factor authentication for local and network access.'},{id:'3.5.4',t:'Replay-resistant auth',d:'Employ replay-resistant authentication mechanisms.'},{id:'3.5.5',t:'Prevent identifier reuse',d:'Prevent reuse of identifiers for a defined period.'},{id:'3.5.6',t:'Disable identifiers after inactivity',d:'Disable inactive identifiers after defined period.'},{id:'3.5.7',t:'Password complexity',d:'Enforce minimum password complexity requirements.'},{id:'3.5.8',t:'Password lifetime restrictions',d:'Prohibit password reuse for specified generations.'},{id:'3.5.9',t:'Temporary passwords',d:'Allow temporary passwords with immediate change upon first login.'},{id:'3.5.10',t:'Store passwords with encryption',d:'Store and transmit passwords with encryption.'},{id:'3.5.11',t:'Obscure feedback of authentication',d:'Obscure feedback of authentication information.'}],
    IR:[{id:'3.6.1',t:'Incident response policy',d:'Establish an operational incident-handling capability.'},{id:'3.6.2',t:'Track and document incidents',d:'Track, document, and report incidents.'},{id:'3.6.3',t:'Test incident response',d:'Test the incident response capability.'}],
    MA:[{id:'3.7.1',t:'Perform maintenance',d:'Perform maintenance on organizational systems.'},{id:'3.7.2',t:'Controlled maintenance',d:'Provide controls on the tools used for maintenance.'},{id:'3.7.3',t:'Sanitize equipment',d:'Ensure equipment removed for off-site maintenance is sanitized.'},{id:'3.7.4',t:'Maintenance personnel',d:'Supervise maintenance personnel.'},{id:'3.7.5',t:'Nonlocal maintenance',d:'Restrict nonlocal maintenance sessions.'},{id:'3.7.6',t:'Cryptographic protection for nonlocal maintenance',d:'Protect nonlocal maintenance via cryptographic mechanisms.'}],
    MP:[{id:'3.8.1',t:'Protect system media',d:'Protect system media containing CUI.'},{id:'3.8.2',t:'Limit access to media',d:'Limit access to CUI on media to authorized users.'},{id:'3.8.3',t:'Sanitize media',d:'Sanitize media prior to disposal or release.'},{id:'3.8.4',t:'Mark media',d:'Mark media with necessary CUI markings and distribution limitations.'},{id:'3.8.5',t:'Control media transport',d:'Control media transport in approved areas.'},{id:'3.8.6',t:'Protect backups',d:'Protect system backups containing CUI.'},{id:'3.8.7',t:'Restrict USB device usage',d:'Restrict USB device usage.'},{id:'3.8.8',t:'Prohibit use of portable storage without approval',d:'Prohibit use of portable storage devices without explicit approval.'},{id:'3.8.9',t:'Encrypt backups',d:'Encrypt system backup media containing CUI.'}],
    PS:[{id:'3.9.1',t:'Screen personnel',d:'Screen personnel prior to authorizing access.'},{id:'3.9.2',t:'Ensure CUI protection during personnel actions',d:'Ensure CUI protections during personnel actions.'}],
    PE:[{id:'3.10.1',t:'Limit physical access',d:'Limit physical access to systems.'},{id:'3.10.2',t:'Escort visitors',d:'Escort visitors and monitor visitor activity.'},{id:'3.10.3',t:'Control access to physical devices',d:'Control physical access to devices.'},{id:'3.10.4',t:'Monitor physical access',d:'Monitor physical access to facilities.'},{id:'3.10.5',t:'Protect devices from tampering',d:'Protect devices from physical tampering.'},{id:'3.10.6',t:'Secure work areas',d:'Secure work areas to protect CUI.'}],
    RA:[{id:'3.11.1',t:'Risk assessment policy',d:'Periodically assess the risk to organizational operations.'},{id:'3.11.2',t:'Scan for vulnerabilities',d:'Scan for vulnerabilities in organizational systems and applications.'},{id:'3.11.3',t:'Remediate vulnerabilities',d:'Remediate vulnerabilities in accordance with assessments.'},{id:'3.11.4',t:'Threat intelligence',d:'Identify cyber supply chain risks.'}],
    CA:[{id:'3.12.1',t:'Security assessments',d:'Periodically assess the security controls.'},{id:'3.12.2',t:'Develop plans',d:'Develop and implement plans for assessment.'},{id:'3.12.3',t:'Monitor security controls',d:'Monitor security controls on an ongoing basis.'},{id:'3.12.4',t:'Review and update plans',d:'Review and update assessment plans.'}],
    SC:[{id:'3.13.1',t:'Boundary protection',d:'Monitor and control communications at external boundaries.'},{id:'3.13.2',t:'Deny network traffic by default',d:'Deny network traffic by default and allow by exception.'},{id:'3.13.3',t:'Separate CUI from other data',d:'Separate CUI from other information.'},{id:'3.13.4',t:'Prevent CUI from unauthorized release',d:'Prevent CUI from unauthorized release.'},{id:'3.13.5',t:'Implement subnetworks',d:'Implement subnetworks for publicly accessible components.'},{id:'3.13.6',t:'Deny direct public access',d:'Deny direct public access between internal and external networks.'},{id:'3.13.7',t:'Prevent split tunneling',d:'Prevent split tunneling for remote devices.'},{id:'3.13.8',t:'Encrypt CUI on public networks',d:'Encrypt CUI on public networks.'},{id:'3.13.9',t:'Encrypt CUI at rest',d:'Encrypt CUI at rest on mobile devices and media.'},{id:'3.13.10',t:'Encrypt remote access',d:'Encrypt remote access sessions.'},{id:'3.13.11',t:'FIPS-validated cryptography',d:'Use FIPS-validated cryptography for CUI protection.'}],
    SI:[{id:'3.14.1',t:'Flaw remediation',d:'Identify, report, and correct system flaws.'},{id:'3.14.2',t:'Malicious code protection',d:'Provide protection from malicious code.'},{id:'3.14.3',t:'Monitor system alerts',d:'Monitor system alerts and advisories.'},{id:'3.14.4',t:'Update malicious code protection',d:'Update malicious code protection mechanisms.'},{id:'3.14.5',t:'System integrity verification',d:'Perform periodic scans of organizational systems.'},{id:'3.14.6',t:'Monitor communications',d:'Monitor communications for unauthorized exfiltration.'},{id:'3.14.7',t:'Identify unauthorized use',d:'Identify unauthorized use of systems.'}]
  };

  let count = 0;
  for (const d of domains) {
    const list = templates[d.s] || [];
    for (const x of list) {
      await prisma.control.create({
        data: { control_id: x.id, domain: d.n, title: x.t, description: x.d, status: 'Not_Started' }
      });
      count++;
    }
  }
  console.log('Seeded ' + count + ' controls');
  await prisma.\$disconnect();
}
seed().catch(e => { console.error(e); process.exit(1); });
\""

# Export database
echo -e "→ Exporting database..."
docker exec cmmc-temp-db pg_dump -U cmmc cmmc2 > "$BUNDLE_DIR/database.sql"

# Stop and remove temp container
docker stop cmmc-temp-db && docker rm cmmc-temp-db

# Save images
echo -e "→ Saving Docker images..."
docker save cmmc-tracker:latest | gzip > "$BUNDLE_DIR/cmmc-tracker-image.tar.gz"
docker save postgres:16-alpine | gzip > "$BUNDLE_DIR/postgres-image.tar.gz"

# Copy deployment files
cp "$APP_DIR/docker-compose.yml" "$BUNDLE_DIR/"
cp "$APP_DIR/.env.example" "$BUNDLE_DIR/"

# Create deploy script
cat > "$BUNDLE_DIR/deploy.sh" << 'SCRIPT'
#!/bin/bash
set -e

echo "========================================="
echo "  CMMC Tracker - One-Click Deploy"
echo "========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed"
    exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo "✓ Docker found"
echo ""

# Load images
echo "→ Loading Docker images..."
docker load < "$SCRIPT_DIR/postgres-image.tar.gz"
docker load < "$SCRIPT_DIR/cmmc-tracker-image.tar.gz"
echo "✓ Images loaded"
echo ""

# Create .env if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "→ Creating .env file..."
    cat > "$SCRIPT_DIR/.env" << EOF
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)
EOF
    echo "⚠ Generated random passwords in .env"
    echo ""
fi

# Start services
echo "→ Starting services..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD up -d

echo ""
echo "→ Waiting for database..."
sleep 15

# Import pre-seeded database
echo "→ Importing pre-configured database..."
docker exec -i cmmc-db psql -U cmmc -d cmmc2 < "$SCRIPT_DIR/database.sql" || true

echo ""
echo "→ Running migrations (if needed)..."
$COMPOSE_CMD exec -T app npx prisma migrate deploy || true

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================="
echo "  ✅ READY!"
echo "========================================="
echo ""
echo "  🌐 URL: http://$SERVER_IP:3000"
echo "  🔐 Login: admin@local / admin123"
echo ""
echo "  Commands:"
echo "    Logs:  docker compose logs -f app"
echo "    Stop:  docker compose down"
echo ""
SCRIPT

chmod +x "$BUNDLE_DIR/deploy.sh"

# Create README
cat > "$BUNDLE_DIR/README.txt" << 'EOF'
CMMC Tracker - Complete Offline Bundle
======================================

INCLUDES:
- Pre-built Docker images
- Pre-seeded PostgreSQL database (admin user + 108 controls)
- One-click deploy script

REQUIREMENTS:
- Docker + Docker Compose
- Port 3000 available
- Port 5432 available

DEPLOY:
1. Copy this folder to server
2. Run: ./deploy.sh
3. Access: http://server-ip:3000
4. Login: admin@local / admin123

That's it. Everything is pre-configured.
EOF

# Create zip
echo -e "→ Creating zip bundle..."
cd "$APP_DIR"
zip -r "$BUNDLE_NAME.zip" offline-bundle/

# Calculate sizes
TOTAL_SIZE=$(du -h "$BUNDLE_NAME.zip" | cut -f1)

echo ""
echo "========================================="
echo "  ✅ COMPLETE BUNDLE CREATED!"
echo "========================================="
echo ""
echo "  📦 Bundle: $BUNDLE_NAME.zip"
echo "  📦 Size: $TOTAL_SIZE"
echo ""
echo "  🚀 To deploy:"
echo "     1. Copy $BUNDLE_NAME.zip to server"
echo "     2. Unzip: unzip $BUNDLE_NAME.zip"
echo "     3. Run: cd offline-bundle && ./deploy.sh"
echo "     4. Access: http://server-ip:3000"
echo ""

# Cleanup
rm -rf "$BUNDLE_DIR"

echo "Done!"
