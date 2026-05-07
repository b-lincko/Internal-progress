-- Fix schedule_deadlines priority column

-- Add priority column (Priority enum already exists)
ALTER TABLE "schedule_deadlines" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'Medium';
