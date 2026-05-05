const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting migration...');
  
  // Create new tables manually since Prisma Migrate doesn't work in container
  try {
    // Create Upload table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "uploads" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "file_name" TEXT NOT NULL,
        "file_path" TEXT NOT NULL,
        "file_type" TEXT,
        "file_size" INTEGER,
        "uploaded_by" TEXT NOT NULL,
        "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "related_to" TEXT,
        "related_id" TEXT,
        CONSTRAINT "uploads_user_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;
    console.log('✓ Uploads table created');

    // Create Project table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Planning',
        "priority" TEXT NOT NULL DEFAULT 'Medium',
        "start_date" TIMESTAMP(3),
        "end_date" TIMESTAMP(3),
        "progress" INTEGER NOT NULL DEFAULT 0,
        "created_by" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "projects_user_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;
    console.log('✓ Projects table created');

    // Create ProjectMember table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "project_members" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "project_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'Member',
        "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_members_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "project_members_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE("project_id", "user_id")
      )
    `;
    console.log('✓ Project members table created');

    // Create ProjectTask table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "project_tasks" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "project_id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Todo',
        "priority" TEXT NOT NULL DEFAULT 'Medium',
        "assigned_to" TEXT,
        "due_date" TIMESTAMP(3),
        "completed_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_tasks_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;
    console.log('✓ Project tasks table created');

    // Add columns to documents
    try {
      await prisma.$executeRaw`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content" TEXT`;
      await prisma.$executeRaw`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "doc_type" TEXT NOT NULL DEFAULT 'File'`;
      await prisma.$executeRaw`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`;
      console.log('✓ Document columns added');
    } catch (e) {
      console.log('Document columns may already exist');
    }

    // Add columns to notifications
    try {
      await prisma.$executeRaw`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deadline_id" TEXT`;
      await prisma.$executeRaw`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check"`;
      console.log('✓ Notification columns added');
    } catch (e) {
      console.log('Notification columns may already exist');
    }

    // Add columns to schedule_deadlines
    try {
      await prisma.$executeRaw`ALTER TABLE "schedule_deadlines" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'Medium'`;
      await prisma.$executeRaw`ALTER TABLE "schedule_deadlines" ADD COLUMN IF NOT EXISTS "created_by" TEXT`;
      console.log('✓ Deadline columns added');
    } catch (e) {
      console.log('Deadline columns may already exist');
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
