-- Function to clean up invitations when user leaves or is removed from workspace
CREATE OR REPLACE FUNCTION public.cleanup_user_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- When a collaborator is removed, clean up any old invitations for that user/workspace combo
  DELETE FROM public.workspace_invitations 
  WHERE workspace_id = OLD.workspace_id 
    AND (invitee_id = OLD.user_id OR invitee_email = (
      SELECT email FROM public.users WHERE id = OLD.user_id
    ));
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to clean up invitations when collaborator is removed
CREATE OR REPLACE TRIGGER on_collaborator_removed_cleanup_invitations
  AFTER DELETE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_invitations();

-- Also update the unique constraint to only apply to pending invitations
-- First drop the existing constraint
ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_invitee_email_key;

-- Add a new partial unique constraint that only applies to pending invitations
CREATE UNIQUE INDEX idx_workspace_invitations_unique_pending 
ON public.workspace_invitations (workspace_id, invitee_email) 
WHERE status = 'pending';

-- Function to automatically clean up expired invitations (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Update expired invitations
  UPDATE public.workspace_invitations 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Optionally delete very old expired invitations (older than 30 days)
  DELETE FROM public.workspace_invitations 
  WHERE status = 'expired' AND updated_at < (now() - interval '30 days');
  
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;