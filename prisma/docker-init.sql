-- Complete Database Initialization for Docker
-- Safety-net: creates tables if migrations somehow failed, then seeds required data

-- ─── Ensure DocumentType enum ───────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('File', 'Text', 'Link');
  END IF;
END $$;

-- ─── Ensure AccessLevel enum ───────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessLevel') THEN
    CREATE TYPE "AccessLevel" AS ENUM ('Read', 'Write', 'Admin');
  END IF;
END $$;

-- ─── Ensure Priority enum (used by schedules + projects) ─
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
    CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');
  END IF;
END $$;

-- ─── Ensure NotificationType has all values ────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('Chat','System','Mention','Alert','Schedule','Document','Upload','Project','Call');
  END IF;
END $$;

-- ─── Ensure DocumentFolder table ───────────────────────────
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

-- ─── Ensure DocumentAccess table ───────────────────────────
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

-- ─── Ensure DocumentAuditLog table ────────────────────────
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

-- ─── Fix documents table columns ──────────────────────────
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('File', 'Text', 'Link');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'doc_type') THEN
    ALTER TABLE "documents" ALTER COLUMN "doc_type" TYPE "DocumentType" USING 'File'::"DocumentType";
    ALTER TABLE "documents" ALTER COLUMN "doc_type" SET DEFAULT 'File';
    ALTER TABLE "documents" ALTER COLUMN "doc_type" SET NOT NULL;
  END IF;
END $$;

-- ─── Fix schedule_deadlines priority column ────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'priority') THEN
    ALTER TABLE "schedule_deadlines" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'Medium';
  END IF;
END $$;

-- ─── Ensure chat rooms exist (REQUIRED for chat to work) ──
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  ('df66283f-921c-44ec-904a-5dd827971399', 'global', 'Global', NOW(), NOW()),
  ('37bfd4ff-b88c-4ac1-bb93-dda73c71bf56', 'private', 'Global', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
