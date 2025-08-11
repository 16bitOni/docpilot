-- Drop all existing tables to start fresh with backup schema
-- This will remove all data and problematic triggers/functions

-- Drop tables in correct order to handle foreign key constraints
DROP TABLE IF EXISTS public.workspace_activity CASCADE;
DROP TABLE IF EXISTS public.workspace_requests CASCADE;
DROP TABLE IF EXISTS public.workspace_invitations CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.file_versions CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.collaborators CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop any remaining functions that might exist
DROP FUNCTION IF EXISTS public.auto_accept_invitations() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_invitations() CASCADE;
DROP FUNCTION IF EXISTS public.get_pending_invitations(text) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_user_invitations() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop any remaining triggers (this will cascade from table drops but just to be sure)
-- No need to specify individual triggers since tables are dropped

-- Clean up any remaining sequences that might be left over
DROP SEQUENCE IF EXISTS public.users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.workspaces_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.collaborators_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.files_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.file_versions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.chat_messages_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.workspace_invitations_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.workspace_requests_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.workspace_activity_id_seq CASCADE;

-- Success message
DO $
BEGIN
    RAISE NOTICE 'All tables and related objects have been dropped successfully. Ready for fresh schema.';
END $;