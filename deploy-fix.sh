#!/bin/bash
# CMMC Tracker Deployment Fix Script
# Run this on the target server after loading the Docker image

set -e

echo "=========================================="
echo " CMMC Tracker Deployment Fix Script"
echo "=========================================="
echo ""

# ─── Step 1: Create working entrypoint ─────────────────────────────
cat > entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo ""
echo "Linkco CMMC Tracker - Starting..."
echo ""

# Use prisma migrate deploy as DB health check (prisma is in the image)
RETRIES=30
echo "[INFO] Waiting for database..."
while [ $RETRIES -gt 0 ]; do
    if npx prisma migrate deploy 2>/dev/null; then
        echo "[OK] Database connected & migrations applied"
        break
    fi
    echo "[INFO] DB not ready... retrying ($RETRIES left)"
    sleep 2
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo "[ERROR] Database connection failed"
    exit 1
fi

# Seed data (idempotent - uses upsert)
npx prisma db seed 2>/dev/null || true

# Ensure upload directories exist
mkdir -p public/uploads/chat

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
EOF
chmod +x entrypoint.sh

# ─── Step 2: Create fixed docker-compose.yml ──────────────────────
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
    image: cmmc-tracker:v2.0
    container_name: cmmc-app
    restart: unless-stopped
    entrypoint: ["/app/entrypoint.sh"]
    environment:
      DATABASE_URL: postgresql://cmmc:changeme-strong-password@db:5432/cmmc2
      JWT_SECRET: changeme-jwt-secret-key-min-32-chars
      PORT: 3000
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/public/uploads
      - ./entrypoint.sh:/app/entrypoint.sh:ro
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

# ─── Step 3: Stop any existing containers ─────────────────────────
echo "[1/5] Stopping existing containers..."
sudo docker compose down 2>/dev/null || true
sudo docker rm -f cmmc-app cmmc-db 2>/dev/null || true

# ─── Step 4: Start services ────────────────────────────────────────
echo "[2/5] Starting services..."
sudo docker compose up -d

# ─── Step 5: Wait for DB to be ready ──────────────────────────────
echo "[3/5] Waiting for database to be healthy..."
sleep 5
until sudo docker exec cmmc-db pg_isready -U cmmc -d cmmc2 >/dev/null 2>&1; do
    echo "  ...waiting for DB"
    sleep 2
done

# ─── Step 6: Seed the database ────────────────────────────────────
echo "[4/5] Seeding database..."

ADMIN_HASH='$2b$10$EF2DJNSnZvgHGCb78pDtG.Cg/5rW3nGp9Wd9dStyVCXMKPrwwGD1u'

sudo docker exec -i cmmc-db psql -U cmmc -d cmmc2 << SEEDSQL
-- Admin user
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (gen_random_uuid(), 'Admin User', 'admin@local', '$ADMIN_HASH', 'Admin', NOW())
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
SEEDSQL

# ─── Step 7: Seed controls via the app container ────────────────────
echo "[5/5] Seeding CMMC controls..."
sudo docker exec cmmc-app sh -c "
node -e '
const { PrismaClient } = require(\"@prisma/client\");
const prisma = new PrismaClient();
const controls = [
  {id:'3.1.1',domain:'Access Control (AC)',title:'Limit system access to authorized users',desc:'Limit information system access to authorized users.'},
  {id:'3.1.2',domain:'Access Control (AC)',title:'Limit system access to types of transactions',desc:'Limit information system access to the types of transactions that authorized users are permitted to execute.'},
  {id:'3.1.3',domain:'Access Control (AC)',title:'Control flow of CUI',desc:'Control the flow of CUI in accordance with approved authorizations.'},
  {id:'3.1.4',domain:'Access Control (AC)',title:'Separation of duties',desc:'Separate the duties of individuals to reduce the risk of malevolent activity without collusion.'},
  {id:'3.1.5',domain:'Access Control (AC)',title:'Least privilege',desc:'Employ the principle of least privilege, allowing only authorized accesses necessary to accomplish assigned tasks.'},
  {id:'3.1.6',domain:'Access Control (AC)',title:'Non-privileged access for nonsecurity functions',desc:'Use non-privileged accounts when performing nonsecurity functions.'},
  {id:'3.1.7',domain:'Access Control (AC)',title:'Prevent non-privileged users from executing privileged functions',desc:'Prevent non-privileged users from executing privileged functions.'},
  {id:'3.1.8',domain:'Access Control (AC)',title:'Limit unsuccessful logon attempts',desc:'Limit the number of unsuccessful logon attempts.'},
  {id:'3.1.9',domain:'Access Control (AC)',title:'Privacy and security notices',desc:'Provide privacy and security notices consistent with applicable CUI rules.'},
  {id:'3.1.10',domain:'Access Control (AC)',title:'Use session lock',desc:'Use session lock with pattern-hiding display to prevent access/viewing.'},
  {id:'3.1.11',domain:'Access Control (AC)',title:'Terminate sessions after inactivity',desc:'Terminate sessions after a defined period of inactivity.'},
  {id:'3.1.12',domain:'Access Control (AC)',title:'Monitor and control remote access',desc:'Monitor and control remote access sessions.'},
  {id:'3.1.13',domain:'Access Control (AC)',title:'Employ cryptographic mechanisms',desc:'Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.'},
  {id:'3.1.14',domain:'Access Control (AC)',title:'Route remote access through managed points',desc:'Route remote access via managed access control points.'},
  {id:'3.1.15',domain:'Access Control (AC)',title:'Authorize wireless access',desc:'Authorize wireless access prior to allowing such connections.'},
  {id:'3.1.16',domain:'Access Control (AC)',title:'Protect wireless access',desc:'Protect wireless access using authentication and encryption.'},
  {id:'3.1.17',domain:'Access Control (AC)',title:'Control mobile device access',desc:'Control connection of mobile devices.'},
  {id:'3.1.18',domain:'Access Control (AC)',title:'Encrypt mobile device data',desc:'Encrypt CUI on mobile devices.'},
  {id:'3.1.19',domain:'Access Control (AC)',title:'Restrict USB devices',desc:'Restrict use of organization-defined portable storage devices.'},
  {id:'3.1.20',domain:'Access Control (AC)',title:'Limit external connections',desc:'Limit external system connections.'},
  {id:'3.1.21',domain:'Access Control (AC)',title:'Control public information',desc:'Control CUI posted on publicly accessible systems.'},
  {id:'3.1.22',domain:'Access Control (AC)',title:'Control CUI in shared resources',desc:'Control CUI in shared system resources.'},
  {id:'3.2.1',domain:'Awareness & Training (AT)',title:'Security awareness training',desc:'Ensure that managers, system administrators, and users are aware of security risks.'},
  {id:'3.2.2',domain:'Awareness & Training (AT)',title:'Insider threat training',desc:'Provide insider threat awareness training.'},
  {id:'3.2.3',domain:'Awareness & Training (AT)',title:'Role-based training',desc:'Provide role-based security training.'},
  {id:'3.3.1',domain:'Audit & Accountability (AU)',title:'Create and retain audit logs',desc:'Create and retain system audit logs.'},
  {id:'3.3.2',domain:'Audit & Accountability (AU)',title:'Ensure audit events are reviewed',desc:'Ensure that the auditing system is reviewed.'},
  {id:'3.3.3',domain:'Audit & Accountability (AU)',title:'Protect audit information',desc:'Protect audit information.'},
  {id:'3.3.4',domain:'Audit & Accountability (AU)',title:'Audit failure alerts',desc:'Alert on audit processing failures.'},
  {id:'3.3.5',domain:'Audit & Accountability (AU)',title:'Correlate audit records',desc:'Correlate audit record review, analysis, and reporting.'},
  {id:'3.3.6',domain:'Audit & Accountability (AU)',title:'Provide audit reduction',desc:'Provide audit reduction and report generation.'},
  {id:'3.3.7',domain:'Audit & Accountability (AU)',title:'Time stamps',desc:'Provide time stamps for audit records.'},
  {id:'3.3.8',domain:'Audit & Accountability (AU)',title:'Protection of audit info',desc:'Protect audit information and tools.'},
  {id:'3.3.9',domain:'Audit & Accountability (AU)',title:'Manage audit storage capacity',desc:'Manage audit storage capacity.'},
  {id:'3.4.1',domain:'Configuration Management (CM)',title:'Establish baseline configurations',desc:'Establish baseline configurations.'},
  {id:'3.4.2',domain:'Configuration Management (CM)',title:'Enforce security config',desc:'Establish and enforce security configuration settings.'},
  {id:'3.4.3',domain:'Configuration Management (CM)',title:'Track and review changes',desc:'Track, review, and approve changes.'},
  {id:'3.4.4',domain:'Configuration Management (CM)',title:'Security impact analysis',desc:'Analyze security impact of changes.'},
  {id:'3.4.5',domain:'Configuration Management (CM)',title:'Access restrictions for changes',desc:'Define, document, and enforce access restrictions.'},
  {id:'3.4.6',domain:'Configuration Management (CM)',title:'Least functionality',desc:'Employ least functionality by configuring systems to provide only essential capabilities.'},
  {id:'3.4.7',domain:'Configuration Management (CM)',title:'Nonessential functions',desc:'Restrict nonessential programs, functions, ports, protocols, and services.'},
  {id:'3.4.8',domain:'Configuration Management (CM)',title:'Software usage restrictions',desc:'Apply software usage restrictions for nonessential software.'},
  {id:'3.4.9',domain:'Configuration Management (CM)',title:'User-installed software',desc:'Control user installation of software.'},
  {id:'3.4.10',domain:'Configuration Management (CM)',title:'Component inventory',desc:'Create and maintain an inventory of system components.'},
  {id:'3.4.11',domain:'Configuration Management (CM)',title:'Memory protection',desc:'Employ mechanisms to protect memory.'},
  {id:'3.5.1',domain:'Identification & Authentication (IA)',title:'Identify system users',desc:'Identify system users, processes, and devices.'},
  {id:'3.5.2',domain:'Identification & Authentication (IA)',title:'Authenticate identities',desc:'Authenticate identities of users, processes, and devices.'},
  {id:'3.5.3',domain:'Identification & Authentication (IA)',title:'Multi-factor authentication',desc:'Use multi-factor authentication for local and network access.'},
  {id:'3.5.4',domain:'Identification & Authentication (IA)',title:'Replay-resistant auth',desc:'Employ replay-resistant authentication mechanisms.'},
  {id:'3.5.5',domain:'Identification & Authentication (IA)',title:'Prevent identifier reuse',desc:'Prevent reuse of identifiers for a defined period.'},
  {id:'3.5.6',domain:'Identification & Authentication (IA)',title:'Disable identifiers after inactivity',desc:'Disable inactive identifiers after defined period.'},
  {id:'3.5.7',domain:'Identification & Authentication (IA)',title:'Password complexity',desc:'Enforce minimum password complexity requirements.'},
  {id:'3.5.8',domain:'Identification & Authentication (IA)',title:'Password lifetime restrictions',desc:'Prohibit password reuse for specified generations.'},
  {id:'3.5.9',domain:'Identification & Authentication (IA)',title:'Temporary passwords',desc:'Allow temporary passwords with immediate change upon first login.'},
  {id:'3.5.10',domain:'Identification & Authentication (IA)',title:'Store passwords with encryption',desc:'Store and transmit passwords with encryption.'},
  {id:'3.5.11',domain:'Identification & Authentication (IA)',title:'Obscure feedback of authentication',desc:'Obscure feedback of authentication information.'},
  {id:'3.6.1',domain:'Incident Response (IR)',title:'Incident response policy',desc:'Establish an operational incident-handling capability.'},
  {id:'3.6.2',domain:'Incident Response (IR)',title:'Track and document incidents',desc:'Track, document, and report incidents.'},
  {id:'3.6.3',domain:'Incident Response (IR)',title:'Test incident response',desc:'Test the incident response capability.'},
  {id:'3.7.1',domain:'Maintenance (MA)',title:'Perform maintenance',desc:'Perform maintenance on organizational systems.'},
  {id:'3.7.2',domain:'Maintenance (MA)',title:'Controlled maintenance',desc:'Provide controls on the tools used for maintenance.'},
  {id:'3.7.3',domain:'Maintenance (MA)',title:'Sanitize equipment',desc:'Ensure equipment removed for off-site maintenance is sanitized.'},
  {id:'3.7.4',domain:'Maintenance (MA)',title:'Maintenance personnel',desc:'Supervise maintenance personnel.'},
  {id:'3.7.5',domain:'Maintenance (MA)',title:'Nonlocal maintenance',desc:'Restrict nonlocal maintenance sessions.'},
  {id:'3.7.6',domain:'Maintenance (MA)',title:'Cryptographic protection for nonlocal maintenance',desc:'Protect nonlocal maintenance via cryptographic mechanisms.'},
  {id:'3.8.1',domain:'Media Protection (MP)',title:'Protect system media',desc:'Protect system media containing CUI.'},
  {id:'3.8.2',domain:'Media Protection (MP)',title:'Limit access to media',desc:'Limit access to CUI on media to authorized users.'},
  {id:'3.8.3',domain:'Media Protection (MP)',title:'Sanitize media',desc:'Sanitize media prior to disposal or release.'},
  {id:'3.8.4',domain:'Media Protection (MP)',title:'Mark media',desc:'Mark media with necessary CUI markings and distribution limitations.'},
  {id:'3.8.5',domain:'Media Protection (MP)',title:'Control media transport',desc:'Control media transport in approved areas.'},
  {id:'3.8.6',domain:'Media Protection (MP)',title:'Protect backups',desc:'Protect system backups containing CUI.'},
  {id:'3.8.7',domain:'Media Protection (MP)',title:'Restrict USB device usage',desc:'Restrict USB device usage.'},
  {id:'3.8.8',domain:'Media Protection (MP)',title:'Prohibit use of portable storage without approval',desc:'Prohibit use of portable storage devices without explicit approval.'},
  {id:'3.8.9',domain:'Media Protection (MP)',title:'Encrypt backups',desc:'Encrypt system backup media containing CUI.'},
  {id:'3.9.1',domain:'Personnel Security (PS)',title:'Screen personnel',desc:'Screen personnel prior to authorizing access.'},
  {id:'3.9.2',domain:'Personnel Security (PS)',title:'Ensure CUI protection during personnel actions',desc:'Ensure CUI protections during personnel actions.'},
  {id:'3.10.1',domain:'Physical Protection (PE)',title:'Limit physical access',desc:'Limit physical access to systems.'},
  {id:'3.10.2',domain:'Physical Protection (PE)',title:'Escort visitors',desc:'Escort visitors and monitor visitor activity.'},
  {id:'3.10.3',domain:'Physical Protection (PE)',title:'Control access to physical devices',desc:'Control physical access to devices.'},
  {id:'3.10.4',domain:'Physical Protection (PE)',title:'Monitor physical access',desc:'Monitor physical access to facilities.'},
  {id:'3.10.5',domain:'Physical Protection (PE)',title:'Protect devices from tampering',desc:'Protect devices from physical tampering.'},
  {id:'3.10.6',domain:'Physical Protection (PE)',title:'Secure work areas',desc:'Secure work areas to protect CUI.'},
  {id:'3.11.1',domain:'Risk Assessment (RA)',title:'Risk assessment policy',desc:'Periodically assess the risk to organizational operations.'},
  {id:'3.11.2',domain:'Risk Assessment (RA)',title:'Scan for vulnerabilities',desc:'Scan for vulnerabilities in organizational systems and applications.'},
  {id:'3.11.3',domain:'Risk Assessment (RA)',title:'Remediate vulnerabilities',desc:'Remediate vulnerabilities in accordance with assessments.'},
  {id:'3.11.4',domain:'Risk Assessment (RA)',title:'Threat intelligence',desc:'Identify cyber supply chain risks.'},
  {id:'3.12.1',domain:'Security Assessment (CA)',title:'Security assessments',desc:'Periodically assess the security controls.'},
  {id:'3.12.2',domain:'Security Assessment (CA)',title:'Develop plans',desc:'Develop and implement plans for assessment.'},
  {id:'3.12.3',domain:'Security Assessment (CA)',title:'Monitor security controls',desc:'Monitor security controls on an ongoing basis.'},
  {id:'3.12.4',domain:'Security Assessment (CA)',title:'Review and update plans',desc:'Review and update assessment plans.'},
  {id:'3.13.1',domain:'System & Communications Protection (SC)',title:'Boundary protection',desc:'Monitor and control communications at external boundaries.'},
  {id:'3.13.2',domain:'System & Communications Protection (SC)',title:'Deny network traffic by default',desc:'Deny network traffic by default and allow by exception.'},
  {id:'3.13.3',domain:'System & Communications Protection (SC)',title:'Separate CUI from other data',desc:'Separate CUI from other information.'},
  {id:'3.13.4',domain:'System & Communications Protection (SC)',title:'Prevent CUI from unauthorized release',desc:'Prevent CUI from unauthorized release.'},
  {id:'3.13.5',domain:'System & Communications Protection (SC)',title:'Implement subnetworks',desc:'Implement subnetworks for publicly accessible components.'},
  {id:'3.13.6',domain:'System & Communications Protection (SC)',title:'Deny direct public access',desc:'Deny direct public access between internal and external networks.'},
  {id:'3.13.7',domain:'System & Communications Protection (SC)',title:'Prevent split tunneling',desc:'Prevent split tunneling for remote devices.'},
  {id:'3.13.8',domain:'System & Communications Protection (SC)',title:'Encrypt CUI on public networks',desc:'Encrypt CUI on public networks.'},
  {id:'3.13.9',domain:'System & Communications Protection (SC)',title:'Encrypt CUI at rest',desc:'Encrypt CUI at rest on mobile devices and media.'},
  {id:'3.13.10',domain:'System & Communications Protection (SC)',title:'Encrypt remote access',desc:'Encrypt remote access sessions.'},
  {id:'3.13.11',domain:'System & Communications Protection (SC)',title:'FIPS-validated cryptography',desc:'Use FIPS-validated cryptography for CUI protection.'},
  {id:'3.14.1',domain:'System & Information Integrity (SI)',title:'Flaw remediation',desc:'Identify, report, and correct system flaws.'},
  {id:'3.14.2',domain:'System & Information Integrity (SI)',title:'Malicious code protection',desc:'Provide protection from malicious code.'},
  {id:'3.14.3',domain:'System & Information Integrity (SI)',title:'Monitor system alerts',desc:'Monitor system alerts and advisories.'},
  {id:'3.14.4',domain:'System & Information Integrity (SI)',title:'Update malicious code protection',desc:'Update malicious code protection mechanisms.'},
  {id:'3.14.5',domain:'System & Information Integrity (SI)',title:'System integrity verification',desc:'Perform periodic scans of organizational systems.'},
  {id:'3.14.6',domain:'System & Information Integrity (SI)',title:'Monitor communications',desc:'Monitor communications for unauthorized exfiltration.'},
  {id:'3.14.7',domain:'System & Information Integrity (SI)',title:'Identify unauthorized use',desc:'Identify unauthorized use of systems.'}
];
async function seed() {
  let count = 0;
  for (const c of controls) {
    try {
      await prisma.control.upsert({
        where: { control_id: c.id },
        update: {},
        create: { control_id: c.id, domain: c.domain, title: c.title, description: c.desc, status: 'Not_Started' }
      });
      count++;
    } catch(e) {}
  }
  console.log('Seeded ' + count + ' controls');
}
seed().then(()=>process.exit(0)).catch(()=>process.exit(1));
'" 2>/dev/null || echo "Control seeding skipped (may already exist)"

# ─── Done ──────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "App URL:     http://$(hostname -I | awk '{print $1}'):3000"
echo "Admin login: admin@local / admin123"
echo ""
echo "Container status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "To view logs: sudo docker logs cmmc-app --tail 20"
echo ""
