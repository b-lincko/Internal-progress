-- Docker DB Fix Script
-- Run this inside the db container to fix missing tables/columns

-- ─── 1. Fix AccessLevel enum ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessLevel') THEN
    CREATE TYPE "AccessLevel" AS ENUM ('Read', 'Write', 'Admin');
  END IF;
END $$;

-- ─── 2. Fix Priority enum ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
    CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');
  END IF;
END $$;

-- ─── 3. Create document_folders table ─────────────────────
CREATE TABLE IF NOT EXISTS "document_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_folders_parent_id_fkey') THEN
    ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_folders_created_by_fkey') THEN
    ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 4. Create document_access table ──────────────────────
CREATE TABLE IF NOT EXISTS "document_access" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'Read',
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_access_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_access_document_id_user_id_key" UNIQUE ("document_id", "user_id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_access_document_id_fkey') THEN
    ALTER TABLE "document_access" ADD CONSTRAINT "document_access_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_access_user_id_fkey') THEN
    ALTER TABLE "document_access" ADD CONSTRAINT "document_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_access_granted_by_fkey') THEN
    ALTER TABLE "document_access" ADD CONSTRAINT "document_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 5. Create document_audit_logs table ──────────────────
CREATE TABLE IF NOT EXISTS "document_audit_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_audit_logs_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_audit_logs_document_id_fkey') THEN
    ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'document_audit_logs_user_id_fkey') THEN
    ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 6. Fix documents table ───────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'folder_id') THEN
    ALTER TABLE "documents" ADD COLUMN "folder_id" TEXT;
    ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_name' AND is_nullable = 'NO') THEN
    ALTER TABLE "documents" ALTER COLUMN "file_name" DROP NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_path' AND is_nullable = 'NO') THEN
    ALTER TABLE "documents" ALTER COLUMN "file_path" DROP NOT NULL;
  END IF;
END $$;

-- ─── 7. Fix schedule_deadlines.priority column ────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'priority') THEN
    ALTER TABLE "schedule_deadlines" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'Medium';
  END IF;
END $$;

-- ─── 8. Ensure chat rooms exist ───────────────────────────
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  ('df66283f-921c-44ec-904a-5dd827971399', 'global', 'Global', NOW(), NOW()),
  ('37bfd4ff-b88c-4ac1-bb93-dda73c71bf56', 'private', 'Global', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ─── 9. Mark migration as applied in Prisma migrations table ─
INSERT INTO _prisma_migrations (id, migration_name, checksum, finished_at, migration_state, logs, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  '20260507100000_document_folders_acl',
  '',
  NOW(),
  'MigrationSuccess',
  '',
  NOW(),
  1
)
ON CONFLICT (migration_name) DO NOTHING;

SELECT 'Database fix complete!' AS status;
