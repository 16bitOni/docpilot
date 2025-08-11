-- Clean up all email-related triggers and functions - simplified version

-- Drop specific triggers we know about
DROP TRIGGER IF EXISTS send_invitation_email_trigger ON public.workspace_invitations;
DROP TRIGGER IF EXISTS on_invitation_created ON public.workspace_invitations;
DROP TRIGGER IF EXISTS invitation_email_trigger ON public.workspace_invitations;

-- Drop specific functions we know about
DROP FUNCTION IF EXISTS public.send_invitation_email_webhook();
DROP FUNCTION IF EXISTS public.trigger_invitation_email(uuid);
DROP FUNCTION IF EXISTS public.get_invitation_details(uuid);
DROP FUNCTION IF EXISTS public.handle_invitation_email();
DROP FUNCTION IF EXISTS public.send_email_notification();
DROP FUNCTION IF EXISTS public.notify_invitation_created();
DROP FUNCTION IF EXISTS public.process_invitation_email();

-- Simple test to make sure workspace_invitations table works
DO $
DECLARE
    test_id uuid;
BEGIN
    -- Try a test insert and immediately delete it
    INSERT INTO public.workspace_invitations (workspace_id, inviter_id, invitee_email, role)
    VALUES (
        gen_random_uuid(), 
        gen_random_uuid(), 
        'test@example.com', 
        'editor'
    ) RETURNING id INTO test_id;
    
    DELETE FROM public.workspace_invitations WHERE id = test_id;
    
    RAISE NOTICE 'Workspace invitations table is working correctly';
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'Issue with workspace_invitations table: %', SQLERRM;
        -- Clean up any test records
        DELETE FROM public.workspace_invitations WHERE invitee_email = 'test@example.com';
END $;