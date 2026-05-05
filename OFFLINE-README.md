# CMMC Tracker - Offline Deployment

Complete offline bundle for CMMC Level 2 compliance tracking.

## What's New (v2.0)

- **HTTPS Support** - Self-signed certificate support
- **Group Schedule Assignment** - Assign deadlines to multiple users
- **Full Document CRUD** - Text docs, file uploads, links with edit/delete
- **Chat Clearing** - Admin/users can clear chat history
- **Notifications** - Auto-generated for schedules, documents, projects
- **Role Hiding** - Non-admin users can't see other users' roles
- **Schedule Permissions** - View/edit based on assignment
- **Project Tracker** - Full project management with tasks

## Quick Deploy

```bash
# 1. Copy bundle to server
scp cmmc-tracker-complete-*.zip server@192.168.100.50:/home/server/

# 2. On server:
unzip cmmc-tracker-complete-*.zip
cd offline-bundle
./deploy.sh
```

## Manual Deploy (if script fails)

```bash
# Load images
docker load < postgres-image.tar.gz
docker load < cmmc-tracker-image.tar.gz

# Start
docker compose up -d

# Seed database (first time only)
sleep 15
docker exec -i cmmc-db psql -U cmmc -d cmmc2 < seed-data.sql
```

## Access

- URL: http://server-ip:3000
- Login: `admin@local` / `admin123`

## Default Roles

- **Admin** - Full access, user management, admin panel
- **Manager** - Edit controls, create deadlines, upload docs, create projects
- **Viewer** - Read-only + chat + view assigned items

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | JWT login |
| `/api/auth/me` | GET | Current user |
| `/api/controls` | GET/POST | List/create controls |
| `/api/controls/[id]` | GET/PATCH | Get/update control |
| `/api/deadlines` | GET/POST/PATCH/DELETE | Schedule CRUD |
| `/api/documents` | GET/POST/PATCH/DELETE | Document CRUD |
| `/api/projects` | GET/POST | Project list/create |
| `/api/projects/[id]` | GET/PATCH/DELETE | Project detail |
| `/api/projects/[id]/tasks` | GET/POST/PATCH/DELETE | Project tasks |
| `/api/chat` | GET/POST/PATCH/DELETE | Messages |
| `/api/notifications` | GET/PATCH | Notifications |
| `/api/users` | GET/POST/DELETE | User management |
| `/api/ssp` | GET | Export SSP PDF |

## Database

PostgreSQL with pre-seeded:
- 1 admin user (admin@local / admin123)
- 108 CMMC Level 2 controls

## Files

- `cmmc-tracker-image.tar.gz` - App Docker image
- `postgres-image.tar.gz` - PostgreSQL image
- `seed-data.sql` - Database seed (admin + controls)
- `docker-compose.yml` - Service orchestration
- `deploy.sh` - One-click deploy script
