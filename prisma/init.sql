-- CMMC Tracker Database Initialization
-- Run this after all migrations are applied to seed essential data

-- Insert default chat rooms
INSERT INTO chat_rooms (id, name, type, created_at, updated_at)
VALUES
  ('df66283f-921c-44ec-904a-5dd827971399', 'global', 'Global', NOW(), NOW()),
  ('37bfd4ff-b88c-4ac1-bb93-dda73c71bf56', 'private', 'Global', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
