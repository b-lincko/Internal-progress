-- Add missing priority column to schedule_deadlines
-- This column was added to the Prisma schema but the original migration missed it

-- Ensure Priority enum exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority') THEN
    CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High', 'Critical');
  END IF;
END $$;

-- Add priority column to schedule_deadlines if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_deadlines' AND column_name = 'priority'
  ) THEN
    ALTER TABLE "schedule_deadlines" 
    ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'Medium';
  END IF;
END $$;
