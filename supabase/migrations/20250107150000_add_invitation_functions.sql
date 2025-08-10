-- Function to get pending invitations for a user
CREATE OR REPLACE FUNCTION public.get_pending_invitations(user_email text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  inviter_id uuid,
  invitee_email text,
  role text,
  status text,
  expires_at timestamp with time zone,
  workspace_name text,
  inviter_name text,
  inviter_email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wi.id,
    wi.workspace_id,
    wi.inviter_id,
    wi.invitee_email,
    wi.role,
    wi.status,
    wi.expires_at,
    w.name as workspace_name,
    u.name as inviter_name,
    u.email as inviter_email
  FROM workspace_invitations wi
  JOIN workspaces w ON wi.workspace_id = w.id
  JOIN users u ON wi.inviter_id = u.id
  WHERE wi.invitee_email = user_email
    AND wi.status = 'pending'
    AND wi.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pending_invitations(text) TO authenticated;