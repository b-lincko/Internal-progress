#!/bin/sh
#
# Reset admin password inside Docker container
# Run this if login credentials don't work
#

echo "Resetting admin user..."

npx prisma db execute --stdin <<SQL
-- Check if admin user exists
SELECT id, email, role FROM users WHERE email = 'admin@local';
SQL

echo ""
echo "If no admin user exists, we'll create one:"
echo ""

node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
console.log('Password hash:', hash);
"

echo ""
echo "To fix login, run this SQL inside the container:"
echo ""
echo "  npx prisma db execute --stdin <<EOF"
echo "  INSERT INTO users (id, name, email, password_hash, role, created_at)"
echo "  VALUES (gen_random_uuid(), 'Admin User', 'admin@local', '\$(node -e \"console.log(require(\"bcryptjs\").hashSync(\"admin123\", 10))\"), 'Admin', NOW())"
echo "  ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash;"
echo "  EOF"
echo ""
