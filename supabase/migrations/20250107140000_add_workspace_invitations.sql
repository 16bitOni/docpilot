-- WORKSPACE INVITATIONS TABLE
CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_id uuid REFERENCES public.users(id) ON DELETE CASCADE, -- null if user doesn't exist yet
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invitation_token uuid DEFAULT gen_random_uuid(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (workspace_id, invitee_email) -- prevent duplicate invitations
);

-- WORKSPACE MEMBERSHIP REQUESTS TABLE (for users requesting to join)
CREATE TABLE public.workspace_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (workspace_id, requester_id) -- prevent duplicate requests
);

-- WORKSPACE ACTIVITY LOG TABLE (optional - for tracking changes)
CREATE TABLE public.workspace_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'invited', 'joined', 'left', 'removed', 'role_changed'
  target_user_id uuid REFERENCES public.users(id), -- for actions involving other users
  details jsonb, -- additional details about the action
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX idx_workspace_invitations_invitee_email ON public.workspace_invitations(invitee_email);
CREATE INDEX idx_workspace_invitations_workspace_id ON public.workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_status ON public.workspace_invitations(status);
CREATE INDEX idx_workspace_requests_workspace_id ON public.workspace_requests(workspace_id);
CREATE INDEX idx_workspace_requests_requester_id ON public.workspace_requests(requester_id);
CREATE INDEX idx_workspace_activity_workspace_id ON public.workspace_activity(workspace_id);

-- Function to automatically accept invitation when user signs up
CREATE OR REPLACE FUNCTION public.auto_accept_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Update pending invitations for this email to include user_id
  UPDATE public.workspace_invitations 
  SET invitee_id = NEW.id, updated_at = now()
  WHERE invitee_email = NEW.email AND invitee_id IS NULL AND status = 'pending';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-accept invitations when user signs up
CREATE OR REPLACE TRIGGER on_user_created_accept_invitations
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_accept_invitations();

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE public.workspace_invitations 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;