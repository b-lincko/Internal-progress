# Linkco CMMC Tracker v2.1

CMMC Level 2 Compliance Management System with Team Collaboration

## Features

### 🔐 Authentication
- JWT-based auth with secure cookies
- Role-based access: Admin, Manager, Viewer
- Default: admin@local / admin123

### 🛡️ CMMC Controls
- 108 pre-loaded CMMC 2.0 controls across 14 domains
- Status tracking: Not Started, In Progress, Implemented
- Evidence upload and management
- POA&M creation per control

### 📅 Schedules & Deadlines
- Multi-user assignment
- Priority levels: Low, Medium, High, Critical
- Status tracking: Scheduled, In Progress, Completed, Overdue
- Linked to controls

### 📁 Documents
- Folder-based file explorer
- File/Text/Link document types
- ACL: Read/Write/Admin per user
- Audit trail

### 💬 Team Chat
- Global chat room
- Private messaging
- File uploads
- Real-time notifications

### 📊 Projects
- Project tracking with tasks
- Member assignment
- Progress monitoring

### 💻 Asset Inventory
- IT asset tracking
- Types: Server, Workstation, Laptop, Mobile, Network Device, etc.
- Status and criticality tracking

### 🔔 Notifications
- Auto-generated for schedules, documents, projects
- Unread badge in sidebar
- Real-time SSE stream

### 🌓 Dark Theme
- Glass card UI design
- Violet/cyan accent colors
- Professional compliance aesthetic

### 👥 Users (Admin Only)
- Full CRUD: Add, Edit, Delete users
- Role management
- Password reset
- Self password change in profile

### 🔒 Security
- Role-based access control
- Admin panel with stats
- Secure file uploads
- Session management

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- PostgreSQL + Prisma ORM v5
- JWT auth + bcryptjs
- jsPDF for SSP export

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Git

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/b-lincko/Internal-progress/main/one-go-install.sh | bash
```

Or manually:

```bash
git clone https://github.com/b-lincko/Internal-progress.git
cd Internal-progress
sudo docker compose up -d
```

### Default Login
- URL: http://localhost:3000
- Email: admin@local
- Password: admin123

## Role Permissions

| Feature | Admin | Manager | Viewer |
|---------|-------|---------|--------|
| Users CRUD | ✅ | ❌ | ❌ |
| Edit Controls | ✅ | ✅ | ❌ |
| Create Deadlines | ✅ | ✅ | ❌ |
| Upload Documents | ✅ | ✅ | ❌ |
| Create Projects | ✅ | ✅ | ❌ |
| View Controls | ✅ | ✅ | ✅ |
| Chat Access | ✅ | ✅ | ✅ |
| View Assigned Items | ✅ | ✅ | ✅ |

## API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `POST /api/auth/logout` - Logout
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PATCH /api/users` - Update user
- `DELETE /api/users` - Delete user
- `GET /api/controls` - List controls
- `POST /api/controls` - Update control status
- `GET /api/deadlines` - List deadlines
- `POST /api/deadlines` - Create deadline
- `GET /api/documents` - List documents
- `POST /api/documents` - Create document
- `GET /api/chat` - Chat messages
- `POST /api/chat` - Send message
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/assets` - List assets
- `POST /api/assets` - Create asset

## Environment Variables

```env
DATABASE_URL=postgresql://cmmc:changeme-strong-password@db:5432/cmmc2
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
PORT=3000
NODE_ENV=production
```

## Deployment

### Docker Compose
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: cmmc
      POSTGRES_PASSWORD: changeme-strong-password
      POSTGRES_DB: cmmc2
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: cmmc-tracker:v2.1-perfect
    environment:
      DATABASE_URL: postgresql://cmmc:changeme-strong-password@db:5432/cmmc2
      JWT_SECRET: changeme-jwt-secret-key-min-32-chars
    ports:
      - "3000:3000"
    depends_on:
      - db

volumes:
  postgres_data:
```

### Transfer Between Machines
```bash
# Export image
sudo docker save cmmc-tracker:v2.1-perfect | gzip > cmmc-tracker.tar.gz

# Transfer
scp cmmc-tracker.tar.gz user@server:/tmp/

# Import on server
sudo docker load < /tmp/cmmc-tracker.tar.gz
```

## Database Reset

```bash
# Reset all data (CAUTION)
sudo docker compose down
sudo docker volume rm internal-progress_postgres_data
sudo docker compose up -d
```

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL container is healthy
- Check DATABASE_URL environment variable
- Verify network connectivity between containers

### Empty Database
- Run migrations: `npx prisma migrate deploy`
- Seed data: `node prisma/seed.js`
- Check logs: `sudo docker logs cmmc-app`

### Port Already in Use
```bash
sudo fuser -k 3000/tcp
# or
sudo kill $(sudo lsof -t -i:3000)
```

### Clear Browser Cache
- Hard refresh: Ctrl+Shift+R
- Or clear cache in DevTools > Network > Disable cache

## Changelog

### v2.1 (May 2026)
- Added Asset Inventory with full CRUD
- Fixed chat private messaging
- Fixed document folder ACL
- Added notification system with SSE
- Dark theme throughout
- Fixed database seeding in Docker
- Added _DeadlineAssignees table for many-to-many
- Added Asset table migration
- Production-ready Docker image

### v2.0 (April 2026)
- Initial release with controls, deadlines, documents
- Basic chat and projects
- User management

## License

Internal use only - Linkco Systems

## Support

Repository: https://github.com/b-lincko/Internal-progress
