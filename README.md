# Linkco CMMC Tracker

A full-stack CMMC Level 2 Compliance Tracking System built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, PostgreSQL, and Prisma ORM.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql)

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Stats cards with deadlines, documents, users, and controls |
| **Controls** | 108 CMMC Level 2 controls with search, filter by status/domain |
| **Control Detail** | Update status, notes, owner, upload evidence, create/view POA&Ms |
| **POA&M Tracker** | Plan of Action & Milestones with severity filtering and overdue highlighting |
| **Documents (File Explorer)** | Folders with breadcrumb navigation, file/text/link docs, ACL (Read/Write/Admin), audit trail |
| **Team Chat** | WhatsApp-style global + private messaging, file uploads, voice messages, voice/video calls |
| **Notifications** | Real-time SSE notifications with unread badge |
| **Schedules** | Multi-user assignment, priority levels, status tracking |
| **Projects** | Project tracker with tasks, members, progress, priorities |
| **Users** | Full CRUD: add, edit (name/email/role), password reset, delete |
| **Admin Panel** | Stats, role management, access control reference |
| **SSP Export** | PDF export of System Security Plan |

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js API Routes (App Router)
- **Database:** PostgreSQL + Prisma ORM v5
- **Auth:** JWT with `jose` (Edge Runtime compatible), bcrypt password hashing
- **Real-time:** Server-Sent Events (SSE) for notifications
- **PDF:** jsPDF for SSP export
- **Deployment:** Docker + docker-compose ready

---

## Prerequisites

- Node.js v22+
- PostgreSQL 15+ (or use Docker)
- npm or yarn

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/b-lincko/Internal-progress.git
cd Internal-progress
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://cmmc:changeme-strong-password@localhost:5432/cmmc2
JWT_SECRET=changeme-jwt-secret-key-min-32-chars
```

> **Security:** Change `changeme-jwt-secret-key-min-32-chars` to a strong random secret in production.

### 4. Set up PostgreSQL database

#### Option A: Local PostgreSQL

```bash
# Create database and user
sudo -u postgres psql -c "CREATE USER cmmc WITH PASSWORD 'changeme-strong-password';"
sudo -u postgres psql -c "CREATE DATABASE cmmc2 OWNER cmmc;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cmmc2 TO cmmc;"
```

#### Option B: Docker (recommended)

```bash
docker run -d \
  --name cmmc-postgres \
  -e POSTGRES_USER=cmmc \
  -e POSTGRES_PASSWORD=changeme-strong-password \
  -e POSTGRES_DB=cmmc2 \
  -p 5432:5432 \
  postgres:15
```

### 5. Run database migrations

```bash
npx prisma migrate deploy
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Seed initial data (optional)

```bash
psql $DATABASE_URL -f seed-data.sql
```

This seeds:
- Admin user: `admin@local` / `admin123`
- 108 CMMC Level 2 controls
- Sample chat rooms

### 8. Build the project

```bash
npm run build
```

### 9. Start the production server

```bash
npm run start
```

The app will be available at:
- **Local:** http://localhost:3000
- **LAN:** http://YOUR_IP:3000 (binds to 0.0.0.0)

### 10. Default login

- **Email:** `admin@local`
- **Password:** `admin123`

---

## Development

### Run development server (with hot reload)

```bash
npm run dev
```

> Dev server runs on port **3002** by default. Edit `package.json` if needed.

### Database commands

```bash
# Open Prisma Studio (visual DB management)
npx prisma studio

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (dangerous!)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```

### Lint

```bash
npm run lint
```

---

## Docker Deployment

### Build and run with Docker Compose

```bash
docker-compose up --build
```

Or for production:

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

### Manual Docker build

```bash
# Build image
docker build -t cmmc-tracker .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://cmmc:changeme-strong-password@host.docker.internal:5432/cmmc2 \
  -e JWT_SECRET=your-secret-key \
  cmmc-tracker
```

---

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed-data.sql          # Initial seed data
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Login/logout/me
│   │   │   ├── chat/          # Chat messages + rooms
│   │   │   ├── controls/      # CMMC controls CRUD
│   │   │   ├── documents/     # Documents + folders + ACL + audit
│   │   │   ├── projects/      # Projects + tasks
│   │   │   ├── users/         # User CRUD + password
│   │   │   └── ...
│   │   ├── chat/              # Chat page (WhatsApp-style)
│   │   ├── controls/          # Controls list
│   │   ├── documents/         # File explorer
│   │   ├── dashboard/         # Dashboard
│   │   ├── projects/          # Project tracker
│   │   ├── users/             # User management
│   │   └── login/             # Login page
│   ├── components/
│   │   ├── AppLayout.tsx      # Main layout with sidebar
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── NotificationBell.tsx # Real-time notifications
│   │   └── ...
│   ├── hooks/
│   │   └── useNotifications.ts # SSE notification hook
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── auth.ts            # JWT auth helpers
│   └── middleware.ts          # Route protection
├── public/
│   └── uploads/               # File uploads directory
├── docker-compose.yml         # Docker Compose config
├── Dockerfile                 # Docker image
├── next.config.ts             # Next.js config
├── package.json
└── README.md
```

---

## Role-Based Access

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: user CRUD, admin panel, view all roles, manage ACL |
| **Manager** | Edit controls, create deadlines, upload docs, create projects, manage documents |
| **Viewer** | Read-only access + chat + view assigned items. Cannot see other users' roles. |

---

## API Endpoints

### Auth
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user

### Chat
- `GET /api/chat?room=global` — List messages
- `POST /api/chat` — Send message (multipart for files)
- `DELETE /api/chat?room=global` — Clear chat
- `GET /api/chat/rooms` — List rooms

### Documents (File Explorer)
- `GET /api/documents?folderId=` — List documents in folder
- `POST /api/documents` — Create document
- `GET /api/documents/folders` — List folders
- `POST /api/documents/folders` — Create folder
- `GET /api/documents/acl?docId=` — Get ACL
- `POST /api/documents/acl` — Grant access
- `GET /api/documents/audit?docId=` — Get audit log

### Users
- `GET /api/users` — List users (admin sees roles)
- `POST /api/users` — Create user (admin only)
- `PATCH /api/users` — Edit user (admin only)
- `DELETE /api/users?id=` — Delete user (admin only)
- `PATCH /api/users/password` — Reset password

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | Yes |

---

## Troubleshooting

### Port already in use

```bash
# Kill existing Next.js server
pkill -f "next-server"
```

### Database connection refused

Ensure PostgreSQL is running:
```bash
sudo systemctl start postgresql
# or
docker start cmmc-postgres
```

### Build fails with "standalone/server.js not found"

The `start` script now uses `next start` directly. If you see this error, the `next.config.ts` has been updated — rebuild with `npm run build`.

### Prisma migration errors

If migrations fail due to existing tables:
```bash
npx prisma migrate resolve --applied MIGRATION_NAME
npx prisma migrate deploy
```

---

## License

Internal use only. Built for Linkco CMMC compliance tracking.

---

## Support

For issues or questions, contact the development team or open an issue on GitHub.
