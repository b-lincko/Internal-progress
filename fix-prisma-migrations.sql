-- Recreate _prisma_migrations table and populate with known migrations

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP WITH TIME ZONE,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP WITH TIME ZONE,
    "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Mark all known migrations as successfully applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'init', now(), '20260503124853_init', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000002', 'docs', now(), '20260504073613_add_documents_deadlines', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000003', 'chat', now(), '20260504110214_add_chat_rooms', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000004', 'sub', now(), '20260504133016_add_subcontrols', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000005', 'major', now(), '20260505080000_major_update', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000006', 'folders', now(), '20260507100000_document_folders_acl', '', NULL, now(), 1),
  ('00000000-0000-0000-0000-000000000007', 'priority', now(), '20260507124500_add_priority_to_schedules', '', NULL, now(), 1)
ON CONFLICT ("id") DO NOTHING;
