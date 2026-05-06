#!/bin/sh
#
# Fix login credentials inside Docker
# Run this on your server if you can't log in
#

echo "Fixing admin login credentials..."

sudo docker exec cmmc-app sh -c "
node -e \"
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
console.log(hash);
\" > /tmp/hash.txt
"

HASH=$(sudo docker exec cmmc-app cat /tmp/hash.txt)

echo "Generated password hash"

sudo docker exec cmmc-app npx prisma db execute --stdin <<EOF
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  gen_random_uuid(),
  'Admin User',
  'admin@local',
  '$HASH',
  'Admin',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = excluded.password_hash,
  name = excluded.name,
  role = excluded.role;
EOF

echo ""
echo "✅ Admin credentials reset:"
echo "   Email: admin@local"
echo "   Password: admin123"
echo ""
