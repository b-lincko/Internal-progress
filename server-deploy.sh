#!/bin/bash
# Server Deployment Script for CMMC Tracker v2.1
# Run this on the SERVER (192.168.100.50)

set -e

cd ~

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  CMMC Tracker v2.1 - Server Deployment                    ║"
echo "╚════════════════════════════════════════════════════════════╝"

# 1. Kill anything on port 3000
echo ""
echo "[1/6] Freeing port 3000..."
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo kill $(sudo lsof -t -i:3000) 2>/dev/null || true
sleep 2

# 2. Create working entrypoint
echo ""
echo "[2/6] Creating entrypoint..."
cat > entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo ""
echo "Linkco CMMC Tracker v2.1 - Starting..."
echo ""

# Wait for database
echo "[INFO] Waiting for database..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if node -e "
const { Client } = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000});
c.connect().then(() => c.query('SELECT 1')).then(() => { c.end(); process.exit(0); }).catch(() => { c.end(); process.exit(1); });
" 2>/dev/null; then
        echo "  ✓ Database ready"
        break
    fi
    sleep 2
    RETRIES=$((RETRIES - 1))
done

# Run migrations
echo "[INFO] Running migrations..."
npx prisma migrate deploy
echo "  ✓ Migrations applied"

# Seed with JavaScript (no tsx needed)
echo "[INFO] Seeding database..."
if [ -f prisma/seed.js ]; then
    node prisma/seed.js || echo "  ⚠ Seed may have already run"
else
    echo "  ⚠ No seed.js found, skipping"
fi

mkdir -p public/uploads/chat
echo "  ✓ Ready"

echo ""
echo "[OK] Starting on http://0.0.0.0:3000"
echo ""

exec node server.js
EOF
chmod +x entrypoint.sh

# 3. Create docker-compose
echo ""
echo "[3/6] Creating docker-compose.yml..."
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
      - cmmc_postgres_data:/var/lib/postgresql/data
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
    image: cmmc-tracker:v2.1-final
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
      - cmmc_uploads:/app/public/uploads
      - ./entrypoint.sh:/app/entrypoint.sh:ro
    depends_on:
      db:
        condition: service_healthy
    networks:
      - cmmc-network

volumes:
  cmmc_postgres_data:
  cmmc_uploads:

networks:
  cmmc-network:
    driver: bridge
EOF

# 4. Create seed.js for the container
echo ""
echo "[4/6] Creating seed.js..."
cat > seed.js << 'SEEDJS'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting...');

  // Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@local',
      password_hash: hashedPassword,
      role: 'Admin',
    }
  });
  console.log('[SEED] Admin user ready');

  // Chat Rooms
  await prisma.chatRoom.findFirst({ where: { name: 'global' } })
    .then(exists => {
      if (!exists) return prisma.chatRoom.create({ data: { name: 'global', type: 'Global' } });
    });
  await prisma.chatRoom.findFirst({ where: { name: 'private' } })
    .then(exists => {
      if (!exists) return prisma.chatRoom.create({ data: { name: 'private', type: 'Private' } });
    });
  console.log('[SEED] Chat rooms ready');

  // Controls
  const controlsData = [
    { control_id: '3.1.1', domain: 'Access Control (AC)', title: 'Limit system access', description: 'Limit system access to authorized users.' },
    { control_id: '3.1.2', domain: 'Access Control (AC)', title: 'Limit system access to transactions', description: 'Limit system access to types of transactions.' },
    { control_id: '3.1.3', domain: 'Access Control (AC)', title: 'Control flow of CUI', description: 'Control the flow of CUI.' },
    { control_id: '3.1.4', domain: 'Access Control (AC)', title: 'Separation of duties', description: 'Separate duties.' },
    { control_id: '3.1.5', domain: 'Access Control (AC)', title: 'Least privilege', description: 'Employ least privilege.' },
    { control_id: '3.1.6', domain: 'Access Control (AC)', title: 'Non-privileged access', description: 'Prevent non-privileged users from executing privileged functions.' },
    { control_id: '3.1.7', domain: 'Access Control (AC)', title: 'Prevent CUI access', description: 'Prevent unauthorized disclosure of CUI.' },
    { control_id: '3.1.8', domain: 'Access Control (AC)', title: 'Limit unsuccessful logon', description: 'Limit unsuccessful logon attempts.' },
    { control_id: '3.1.9', domain: 'Access Control (AC)', title: 'Privacy & security notices', description: 'Display privacy and security notices.' },
    { control_id: '3.1.10', domain: 'Access Control (AC)', title: 'Session lock', description: 'Use session lock with pattern-hiding display.' },
    { control_id: '3.1.11', domain: 'Access Control (AC)', title: 'Session termination', description: 'Terminate sessions after inactivity.' },
    { control_id: '3.1.12', domain: 'Access Control (AC)', title: 'Allow CUI access', description: 'Allow access to CUI by authorized users.' },
    { control_id: '3.1.13', domain: 'Access Control (AC)', title: 'Supervision of remote access', description: 'Supervise and control remote access.' },
    { control_id: '3.1.14', domain: 'Access Control (AC)', title: 'Remote access encryption', description: 'Protect remote access with encryption.' },
    { control_id: '3.1.15', domain: 'Access Control (AC)', title: 'Remote access authorization', description: 'Authorize remote access.' },
    { control_id: '3.1.16', domain: 'Access Control (AC)', title: 'Wireless access authorization', description: 'Authorize wireless access.' },
    { control_id: '3.1.17', domain: 'Access Control (AC)', title: 'Wireless access protection', description: 'Protect wireless access.' },
    { control_id: '3.1.18', domain: 'Access Control (AC)', title: 'Mobile device access', description: 'Control connection of mobile devices.' },
    { control_id: '3.1.19', domain: 'Access Control (AC)', title: 'Encrypt CUI on mobile', description: 'Encrypt CUI on mobile devices.' },
    { control_id: '3.1.20', domain: 'Access Control (AC)', title: 'Portable storage verify', description: 'Verify portable storage devices.' },
    { control_id: '3.1.21', domain: 'Access Control (AC)', title: 'Portable storage limit', description: 'Limit use of portable storage devices.' },
    { control_id: '3.1.22', domain: 'Access Control (AC)', title: 'CUI posted to public', description: 'Prohibit CUI posting to public websites.' },
    { control_id: '3.2.1', domain: 'Awareness & Training (AT)', title: 'Security awareness training', description: 'Ensure managers and users are aware.' },
    { control_id: '3.2.2', domain: 'Awareness & Training (AT)', title: 'Insider threat training', description: 'Provide insider threat awareness.' },
    { control_id: '3.2.3', domain: 'Awareness & Training (AT)', title: 'Role-based training', description: 'Provide role-based security training.' },
    { control_id: '3.3.1', domain: 'Audit & Accountability (AU)', title: 'Create audit logs', description: 'Create and retain system audit logs.' },
    { control_id: '3.3.2', domain: 'Audit & Accountability (AU)', title: 'Review audit events', description: 'Ensure auditing system is reviewed.' },
    { control_id: '3.3.3', domain: 'Audit & Accountability (AU)', title: 'Audit record content', description: 'Ensure audit records contain required info.' },
    { control_id: '3.3.4', domain: 'Audit & Accountability (AU)', title: 'Audit storage capacity', description: 'Alert when audit storage capacity is low.' },
    { control_id: '3.3.5', domain: 'Audit & Accountability (AU)', title: 'Audit processing failure', description: 'React to audit processing failures.' },
    { control_id: '3.3.6', domain: 'Audit & Accountability (AU)', title: 'Audit review', description: 'Review and analyze audit records.' },
    { control_id: '3.3.7', domain: 'Audit & Accountability (AU)', title: 'Audit reduction', description: 'Reduce and report audit records.' },
    { control_id: '3.3.8', domain: 'Audit & Accountability (AU)', title: 'Time stamps', description: 'Generate time stamps for audit records.' },
    { control_id: '3.3.9', domain: 'Audit & Accountability (AU)', title: 'Protection of audit info', description: 'Protect audit information.' },
    { control_id: '3.4.1', domain: 'Configuration Management (CM)', title: 'Establish baseline configurations', description: 'Establish baseline configurations.' },
    { control_id: '3.4.2', domain: 'Configuration Management (CM)', title: 'Enforce security config', description: 'Establish and enforce security settings.' },
    { control_id: '3.4.3', domain: 'Configuration Management (CM)', title: 'Track changes', description: 'Track, review, and approve changes.' },
    { control_id: '3.4.4', domain: 'Configuration Management (CM)', title: 'Least functionality', description: 'Employ least functionality.' },
    { control_id: '3.4.5', domain: 'Configuration Management (CM)', title: 'Unauthorized software', description: 'Prohibit unauthorized software.' },
    { control_id: '3.4.6', domain: 'Configuration Management (CM)', title: 'User-installed software', description: 'Limit user installation of software.' },
    { control_id: '3.4.7', domain: 'Configuration Management (CM)', title: 'Nonessential ports', description: 'Restrict nonessential ports and protocols.' },
    { control_id: '3.4.8', domain: 'Configuration Management (CM)', title: 'Unauthorized commands', description: 'Prohibit unauthorized commands.' },
    { control_id: '3.4.9', domain: 'Configuration Management (CM)', title: 'Voice over IP', description: 'Authorize and monitor VoIP.' },
    { control_id: '3.5.1', domain: 'Identification & Authentication (IA)', title: 'Identify system users', description: 'Identify system users.' },
    { control_id: '3.5.2', domain: 'Identification & Authentication (IA)', title: 'Authenticate identities', description: 'Authenticate identities.' },
    { control_id: '3.5.3', domain: 'Identification & Authentication (IA)', title: 'Multifactor authentication', description: 'Use multifactor authentication.' },
    { control_id: '3.5.4', domain: 'Identification & Authentication (IA)', title: 'Replay-resistant auth', description: 'Use replay-resistant authentication.' },
    { control_id: '3.5.5', domain: 'Identification & Authentication (IA)', title: 'Password complexity', description: 'Enforce password complexity.' },
    { control_id: '3.5.6', domain: 'Identification & Authentication (IA)', title: 'Password protection', description: 'Protect passwords.' },
    { control_id: '3.5.7', domain: 'Identification & Authentication (IA)', title: 'Password restrictions', description: 'Enforce password restrictions.' },
    { control_id: '3.5.8', domain: 'Identification & Authentication (IA)', title: 'Password lifetime', description: 'Prohibit password reuse.' },
    { control_id: '3.5.9', domain: 'Identification & Authentication (IA)', title: 'Password temporary', description: 'Allow temporary passwords.' },
    { control_id: '3.5.10', domain: 'Identification & Authentication (IA)', title: 'Store passwords', description: 'Store and transmit passwords securely.' },
    { control_id: '3.5.11', domain: 'Identification & Authentication (IA)', title: 'Public key infrastructure', description: 'Use PKI-based authentication.' },
    { control_id: '3.6.1', domain: 'Incident Response (IR)', title: 'Incident response policy', description: 'Establish incident-handling capability.' },
    { control_id: '3.6.2', domain: 'Incident Response (IR)', title: 'Track and document incidents', description: 'Track, document, and report incidents.' },
    { control_id: '3.6.3', domain: 'Incident Response (IR)', title: 'Incident response testing', description: 'Test incident response capability.' },
    { control_id: '3.7.1', domain: 'Maintenance (MA)', title: 'Perform maintenance', description: 'Perform maintenance.' },
    { control_id: '3.7.2', domain: 'Maintenance (MA)', title: 'Maintenance tools', description: 'Control maintenance tools.' },
    { control_id: '3.7.3', domain: 'Maintenance (MA)', title: 'Nonlocal maintenance', description: 'Authorize nonlocal maintenance.' },
    { control_id: '3.7.4', domain: 'Maintenance (MA)', title: 'Maintenance personnel', description: 'Supervise maintenance personnel.' },
    { control_id: '3.8.1', domain: 'Media Protection (MP)', title: 'Protect system media', description: 'Protect system media containing CUI.' },
    { control_id: '3.8.2', domain: 'Media Protection (MP)', title: 'Media access', description: 'Limit media access to authorized users.' },
    { control_id: '3.8.3', domain: 'Media Protection (MP)', title: 'Media marking', description: 'Mark media with CUI indicators.' },
    { control_id: '3.8.4', domain: 'Media Protection (MP)', title: 'Media storage', description: 'Protect media in storage.' },
    { control_id: '3.8.5', domain: 'Media Protection (MP)', title: 'Media transport', description: 'Protect media during transport.' },
    { control_id: '3.8.6', domain: 'Media Protection (MP)', title: 'Media sanitization', description: 'Sanitize media before disposal.' },
    { control_id: '3.8.7', domain: 'Media Protection (MP)', title: 'Media reuse', description: 'Restrict media reuse.' },
    { control_id: '3.8.8', domain: 'Media Protection (MP)', title: 'Media accountability', description: 'Maintain accountability for media.' },
    { control_id: '3.9.1', domain: 'Personnel Security (PS)', title: 'Screen personnel', description: 'Screen personnel prior to authorizing access.' },
    { control_id: '3.9.2', domain: 'Personnel Security (PS)', title: 'Personnel termination', description: 'Terminate system access upon termination.' },
    { control_id: '3.9.3', domain: 'Personnel Security (PS)', title: 'Personnel transfer', description: 'Review and update access upon transfer.' },
    { control_id: '3.10.1', domain: 'Physical Protection (PE)', title: 'Limit physical access', description: 'Limit physical access to systems.' },
    { control_id: '3.10.2', domain: 'Physical Protection (PE)', title: 'Physical access control', description: 'Control physical access devices.' },
    { control_id: '3.10.3', domain: 'Physical Protection (PE)', title: 'Escort visitors', description: 'Escort visitors and monitor activity.' },
    { control_id: '3.10.4', domain: 'Physical Protection (PE)', title: 'Physical access logs', description: 'Maintain physical access logs.' },
    { control_id: '3.10.5', domain: 'Physical Protection (PE)', title: 'Manage physical access', description: 'Manage physical access devices.' },
    { control_id: '3.10.6', domain: 'Physical Protection (PE)', title: 'Alternate work sites', description: 'Protect alternate work sites.' },
    { control_id: '3.10.7', domain: 'Physical Protection (PE)', title: 'Physical entry', description: 'Control physical entry points.' },
    { control_id: '3.11.1', domain: 'Risk Assessment (RA)', title: 'Risk assessment policy', description: 'Periodically assess the risk.' },
    { control_id: '3.11.2', domain: 'Risk Assessment (RA)', title: 'Vulnerability scanning', description: 'Scan for vulnerabilities.' },
    { control_id: '3.11.3', domain: 'Risk Assessment (RA)', title: 'Risk mitigation', description: 'Remediate vulnerabilities.' },
    { control_id: '3.12.1', domain: 'Security Assessment (CA)', title: 'Security assessments', description: 'Periodically assess security controls.' },
    { control_id: '3.12.2', domain: 'Security Assessment (CA)', title: 'System interconnections', description: 'Develop interconnection agreements.' },
    { control_id: '3.12.3', domain: 'Security Assessment (CA)', title: 'Monitor security', description: 'Monitor security controls.' },
    { control_id: '3.13.1', domain: 'System & Communications (SC)', title: 'Boundary protection', description: 'Monitor and control communications.' },
    { control_id: '3.13.2', domain: 'System & Communications (SC)', title: 'Deny by default', description: 'Use deny by default.' },
    { control_id: '3.13.3', domain: 'System & Communications (SC)', title: 'Separation of CUI', description: 'Separate CUI from non-CUI.' },
    { control_id: '3.13.4', domain: 'System & Communications (SC)', title: 'Transmission confidentiality', description: 'Protect transmission confidentiality.' },
    { control_id: '3.13.5', domain: 'System & Communications (SC)', title: 'Transmission integrity', description: 'Protect transmission integrity.' },
    { control_id: '3.13.6', domain: 'System & Communications (SC)', title: 'Session authenticity', description: 'Validate session authenticity.' },
    { control_id: '3.13.7', domain: 'System & Communications (SC)', title: 'Cryptographic mechanisms', description: 'Use cryptographic mechanisms.' },
    { control_id: '3.13.8', domain: 'System & Communications (SC)', title: 'Collaborative computing', description: 'Control collaborative computing.' },
    { control_id: '3.13.9', domain: 'System & Communications (SC)', title: 'VoIP security', description: 'Protect VoIP communications.' },
    { control_id: '3.13.10', domain: 'System & Communications (SC)', title: 'Mobile code', description: 'Control mobile code.' },
    { control_id: '3.13.11', domain: 'System & Communications (SC)', title: 'User-installed software', description: 'Control user-installed software.' },
    { control_id: '3.13.12', domain: 'System & Communications (SC)', title: 'Information handling', description: 'Handle information securely.' },
    { control_id: '3.13.13', domain: 'System & Communications (SC)', title: 'Remote computing', description: 'Protect remote computing sessions.' },
    { control_id: '3.13.14', domain: 'System & Communications (SC)', title: 'Wireless access', description: 'Protect wireless access.' },
    { control_id: '3.13.15', domain: 'System & Communications (SC)', title: 'Wireless client auth', description: 'Authenticate wireless clients.' },
    { control_id: '3.13.16', domain: 'System & Communications (SC)', title: 'Wireless encryption', description: 'Encrypt wireless communications.' },
    { control_id: '3.14.1', domain: 'System & Information Integrity (SI)', title: 'Flaw remediation', description: 'Identify and remediate flaws.' },
    { control_id: '3.14.2', domain: 'System & Information Integrity (SI)', title: 'Malicious code', description: 'Protect against malicious code.' },
    { control_id: '3.14.3', domain: 'System & Information Integrity (SI)', title: 'Security alerts', description: 'Monitor security alerts.' },
    { control_id: '3.14.4', domain: 'System & Information Integrity (SI)', title: 'Spam protection', description: 'Protect against spam.' },
    { control_id: '3.14.5', domain: 'System & Information Integrity (SI)', title: 'System monitoring', description: 'Monitor system performance.' },
    { control_id: '3.14.6', domain: 'System & Information Integrity (SI)', title: 'Least privilege', description: 'Employ least functionality.' },
    { control_id: '3.14.7', domain: 'System & Information Integrity (SI)', title: 'Software integrity', description: 'Verify software integrity.' }
  ];

  for (const c of controlsData) {
    await prisma.control.upsert({
      where: { control_id: c.control_id },
      update: {},
      create: {
        control_id: c.control_id,
        domain: c.domain,
        title: c.title,
        description: c.description,
        status: 'Not_Started',
      }
    });
  }
  console.log(`[SEED] ${controlsData.length} controls ready`);

  console.log('[SEED] Complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
SEEDJS

# 5. Copy seed.js into container's prisma directory
echo ""
echo "[5/6] Starting containers..."
sudo docker compose down 2>/dev/null || true
sleep 2

# We need to copy seed.js into the container after it starts
sudo docker compose up -d db
sleep 10

# Copy seed.js to container
sudo docker cp seed.js cmmc-app:/app/prisma/seed.js 2>/dev/null || echo "  ⚠ Will copy after app starts"

# Start app
sudo docker compose up -d app
sleep 15

# Copy seed.js if not done
sudo docker cp seed.js cmmc-app:/app/prisma/seed.js 2>/dev/null || true

# Run seed manually if needed
sudo docker exec cmmc-app node prisma/seed.js 2>/dev/null || echo "  ⚠ Seed may have already run"

# 6. Verify
echo ""
echo "[6/6] Verifying..."
sleep 5
echo ""
echo "=== DATABASE STATUS ==="
sudo docker exec cmmc-db psql -U cmmc -d cmmc2 -c "SELECT 'Users:', COUNT(*) FROM users UNION ALL SELECT 'Controls:', COUNT(*) FROM controls UNION ALL SELECT 'Chat Rooms:', COUNT(*) FROM chat_rooms;"

echo ""
echo "=== APP STATUS ==="
sudo docker logs cmmc-app --tail 20

echo ""
echo "=== TEST LOGIN ==="
curl -s http://localhost:3000/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"admin123"}' | python3 -m json.tool 2>/dev/null || echo "Login test failed"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  DEPLOYMENT COMPLETE                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "URL: http://192.168.100.50:3000"
echo "Login: admin@local / admin123"
echo ""
echo "To restart: sudo docker compose restart"
echo "To stop:   sudo docker compose stop"
echo "Logs:      sudo docker logs cmmc-app --tail 50"
