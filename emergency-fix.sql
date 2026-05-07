-- EMERGENCY FIX: Fix all schedule_deadlines related issues in one shot
-- This script fixes the broken migration state and ensures all tables are correct

-- ─── 1. Clean up schedule_deadlines table ─────────────────
-- Drop old assigned_to column if it still exists (should have been dropped by migration)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'assigned_to') THEN
    ALTER TABLE "schedule_deadlines" DROP COLUMN "assigned_to";
  END IF;
END $$;

-- Ensure created_by column exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'created_by') THEN
    ALTER TABLE "schedule_deadlines" ADD COLUMN "created_by" TEXT;
  END IF;
END $$;

-- Ensure priority column exists with correct type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
    CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'priority') THEN
    ALTER TABLE "schedule_deadlines" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'Medium';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_deadlines' AND column_name = 'priority' AND data_type = 'text') THEN
    -- If priority is text type (from bad init), fix it
    ALTER TABLE "schedule_deadlines" ALTER COLUMN "priority" TYPE "Priority" USING 'Medium'::"Priority";
  END IF;
END $$;

-- ─── 2. Fix junction table for many-to-many relation ──────
-- Drop old junction table if it has wrong name or structure
DROP TABLE IF EXISTS "_deadlineassignees";
DROP TABLE IF EXISTS "_ScheduleDeadlineAssignees";

-- Create correct junction table (Prisma expects exact name and columns)
CREATE TABLE "_DeadlineAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_DeadlineAssignees_AB_unique" ON "_DeadlineAssignees"("A", "B");
CREATE INDEX "_DeadlineAssignees_B_index" ON "_DeadlineAssignees"("B");

ALTER TABLE "_DeadlineAssignees" ADD CONSTRAINT "_DeadlineAssignees_A_fkey" 
  FOREIGN KEY ("A") REFERENCES "schedule_deadlines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DeadlineAssignees" ADD CONSTRAINT "_DeadlineAssignees_B_fkey" 
  FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 3. Fix Prisma migration tracking ─────────────────────
-- Mark the problematic migration as resolved so Prisma can continue
DELETE FROM _prisma_migrations WHERE migration_name = '20260505080000_major_update';

-- ─── 4. Ensure other tables from major update exist ─────
-- (These might be missing if the migration failed partway)

-- Ensure projects table
CREATE TABLE IF NOT EXISTS "projects" (
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_created_by_fkey') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure project_members table
CREATE TABLE IF NOT EXISTS "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_members_project_id_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_members_user_id_fkey') THEN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure project_tasks table
CREATE TABLE IF NOT EXISTS "project_tasks" (
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'project_tasks_project_id_fkey') THEN
    ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure enums exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectStatus') THEN
    CREATE TYPE "ProjectStatus" AS ENUM ('Planning', 'Active', 'On_Hold', 'Completed', 'Cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('Todo', 'In_Progress', 'Review', 'Done');
  END IF;
END $$;

-- ─── 5. Ensure chat rooms exist ───────────────────────────
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  ('df66283f-921c-44ec-904a-5dd827971399', 'global', 'Global', NOW(), NOW()),
  ('37bfd4ff-b88c-4ac1-bb93-dda73c71bf56', 'private', 'Global', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT 'EMERGENCY FIX COMPLETE' AS status;
