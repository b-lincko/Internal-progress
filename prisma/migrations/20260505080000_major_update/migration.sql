-- Major Update Migration
-- 1. Documents: add content, doc_type, updated_at
-- 2. ScheduleDeadlines: convert assigned_to to many-to-many
-- 3. Notifications: extend enum values
-- 4. Projects, ProjectMembers, ProjectTasks: new tables

-- ============================================================
-- 1. DOCUMENTS: Add new columns
-- ============================================================

-- Add DocumentType enum
CREATE TYPE "DocumentType" AS ENUM ('File', 'Text', 'Link');

-- Add columns to documents
ALTER TABLE "documents" 
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "doc_type" "DocumentType" NOT NULL DEFAULT 'File',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make file_name/file_path nullable for text documents
ALTER TABLE "documents" 
  ALTER COLUMN "file_name" DROP NOT NULL,
  ALTER COLUMN "file_path" DROP NOT NULL;

-- ============================================================
-- 2. SCHEDULE_DEADLINES: Convert assigned_to to many-to-many
-- ============================================================

-- Create junction table
CREATE TABLE IF NOT EXISTS "_ScheduleDeadlineAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Migrate existing single assignees into junction table
INSERT INTO "_ScheduleDeadlineAssignees" ("A", "B")
SELECT "id", "assigned_to"
FROM "schedule_deadlines"
WHERE "assigned_to" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old assigned_to column
ALTER TABLE "schedule_deadlines" DROP COLUMN IF EXISTS "assigned_to";

-- Add unique constraint to junction table
CREATE UNIQUE INDEX IF NOT EXISTS "_ScheduleDeadlineAssignees_AB_unique" 
ON "_ScheduleDeadlineAssignees"("A", "B");

CREATE INDEX IF NOT EXISTS "_ScheduleDeadlineAssignees_B_index" 
ON "_ScheduleDeadlineAssignees"("B");

-- Add foreign keys to junction table
ALTER TABLE "_ScheduleDeadlineAssignees" 
  ADD CONSTRAINT "_ScheduleDeadlineAssignees_A_fkey" 
  FOREIGN KEY ("A") REFERENCES "schedule_deadlines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_ScheduleDeadlineAssignees" 
  ADD CONSTRAINT "_ScheduleDeadlineAssignees_B_fkey" 
  FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. NOTIFICATIONS: Extend enum
-- ============================================================

-- PostgreSQL doesn't allow adding enum values directly in a safe way within transactions
-- We'll recreate the enum. First check if values already exist.

-- Add deadline_id to notifications
ALTER TABLE "notifications" 
  ADD COLUMN IF NOT EXISTS "deadline_id" TEXT;

ALTER TABLE "notifications" 
  ADD CONSTRAINT "notifications_deadline_id_fkey" 
  FOREIGN KEY ("deadline_id") REFERENCES "schedule_deadlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 4. PROJECTS: New tables
-- ============================================================

-- Create ProjectStatus enum
CREATE TYPE "ProjectStatus" AS ENUM ('Planning', 'Active', 'On_Hold', 'Completed', 'Cancelled');

-- Create TaskStatus enum
CREATE TYPE "TaskStatus" AS ENUM ('Todo', 'In_Progress', 'Review', 'Done');

-- Create projects table
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'Planning',
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Create project_members table
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- Create project_tasks table
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'Todo',
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for projects
ALTER TABLE "projects" 
  ADD CONSTRAINT "projects_created_by_fkey" 
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign keys for project_members
ALTER TABLE "project_members" 
  ADD CONSTRAINT "project_members_project_id_fkey" 
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members" 
  ADD CONSTRAINT "project_members_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint for project_members
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- Add foreign keys for project_tasks
ALTER TABLE "project_tasks" 
  ADD CONSTRAINT "project_tasks_project_id_fkey" 
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
