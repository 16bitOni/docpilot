import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmailService } from '@/services/emailService';
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  Check,
  X,
  Crown,
  Edit,
  Eye,
  Trash2,
  LogOut
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_id?: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  workspace: {
    name: string;
  };
  inviter: {
    name: string;
    email: string;
  };
}

interface Collaborator {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  invited_at: string;
  user: {
    name: string;
    email: string;
  };
}

interface WorkspaceManagementProps {
  workspace: Workspace | null;
  onWorkspaceUpdate?: () => void;
}

const WorkspaceManagement: React.FC<WorkspaceManagementProps> = ({
  workspace,
  onWorkspaceUpdate
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (workspace) {
      fetchCollaborators();
      fetchInvitations();
    }
    fetchPendingInvitations();
  }, [workspace, user]);

  const fetchCollaborators = async () => {
    if (!workspace) return;

    try {
      // First get collaborators
      const { data: collaboratorsData, error: collaboratorsError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('workspace_id', workspace.id);

      if (collaboratorsError) {
        console.error('Error fetching collaborators:', collaboratorsError);
        return;
      }

      if (!collaboratorsData || collaboratorsData.length === 0) {
        setCollaborators([]);
        return;
      }

      // Get user IDs
      const userIds = collaboratorsData.map(c => c.user_id);

      // Fetch user details separately
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
      }

      // Combine the data
      const combinedData = collaboratorsData.map(collaborator => {
        const user = usersData?.find(u => u.id === collaborator.user_id);
        return {
          ...collaborator,
          user: {
            name: user?.name || 'Unknown User',
            email: user?.email || 'unknown@email.com'
          }
        };
      });

      setCollaborators(combinedData);
    } catch (error) {
      console.error('Error in fetchCollaborators:', error);
    }
  };

  const fetchInvitations = async () => {
    if (!workspace) return;

    try {
      // First get invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('workspace_invitations' as any)
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('status', 'pending');

      if (invitationsError) {
        console.error('Error fetching invitations:', invitationsError);
        return;
      }

      if (!invitationsData || invitationsData.length === 0) {
        setInvitations([]);
        return;
      }

      // Get inviter IDs
      const inviterIds = invitationsData.map((inv: any) => inv.inviter_id);

      // Fetch inviter details separately
      const { data: invitersData, error: invitersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', inviterIds);

      if (invitersError) {
        console.error('Error fetching inviters:', invitersError);
        return;
      }

      // Combine the data
      const combinedData = invitationsData.map((invitation: any) => {
        const inviter = invitersData?.find(u => u.id === invitation.inviter_id);
        return {
          ...invitation,
          inviter: {
            name: inviter?.name || 'Unknown User',
            email: inviter?.email || 'unknown@email.com'
          }
        };
      });

      setInvitations(combinedData);
    } catch (error) {
      console.error('Error in fetchInvitations:', error);
    }
  };

  const fetchPendingInvitations = async () => {
    if (!user || !user.email) return;

    try {
      // First get pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('workspace_invitations' as any)
        .select('*')
        .eq('invitee_email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (invitationsError) {
        console.error('Error fetching pending invitations:', invitationsError);
        return;
      }

      if (!invitationsData || invitationsData.length === 0) {
        setPendingInvitations([]);
        return;
      }

      // Get workspace IDs and inviter IDs
      const workspaceIds = invitationsData.map((inv: any) => inv.workspace_id);
      const inviterIds = invitationsData.map((inv: any) => inv.inviter_id);

      // Fetch workspace details
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds);

      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        return;
      }

      // Fetch inviter details
      const { data: invitersData, error: invitersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', inviterIds);

      if (invitersError) {
        console.error('Error fetching inviters:', invitersError);
        return;
      }

      // Combine the data
      const combinedData = invitationsData.map((invitation: any) => {
        const workspace = workspacesData?.find(w => w.id === invitation.workspace_id);
        const inviter = invitersData?.find(u => u.id === invitation.inviter_id);
        return {
          ...invitation,
          workspace: {
            name: workspace?.name || 'Unknown Workspace'
          },
          inviter: {
            name: inviter?.name || 'Unknown User',
            email: inviter?.email || 'unknown@email.com'
          }
        };
      });

      setPendingInvitations(combinedData);
    } catch (error) {
      console.error('Error in fetchPendingInvitations:', error);
    }
  };

  const sendInvitation = async () => {
    if (!workspace || !user || !inviteEmail.trim()) return;

    setLoading(true);
    try {
      const email = inviteEmail.toLowerCase();

      // First, check if user is already a collaborator
      const { data: existingCollaborator } = await supabase
        .from('collaborators')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('user_id', (await supabase.from('users').select('id').eq('email', email).single()).data?.id)
        .single();

      if (existingCollaborator) {
        toast({
          variant: "destructive",
          title: "User already in workspace",
          description: "This user is already a member of this workspace."
        });
        return;
      }

      // Check for existing invitations
      const { data: existingInvitation, error: invitationCheckError } = await supabase
        .from('workspace_invitations' as any)
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('invitee_email', email)
        .single();

      // If there's an error other than "not found", handle it
      if (invitationCheckError && invitationCheckError.code !== 'PGRST116') {
        console.error('Error checking existing invitation:', invitationCheckError);
        toast({
          variant: "destructive",
          title: "Error checking invitation",
          description: "There was an error checking for existing invitations. Please try again."
        });
        return;
      }

      // If invitation exists (no error or data found)
      if (existingInvitation && !invitationCheckError) {
        // Type assertion since we know this is valid data (not an error)
        const invitation = existingInvitation as any;

        if (invitation.status === 'pending' && new Date(invitation.expires_at) > new Date()) {
          // Active pending invitation exists
          toast({
            variant: "destructive",
            title: "Invitation already sent",
            description: "This user has already been invited to this workspace and the invitation is still active."
          });
          return;
        } else {
          // Old invitation exists (expired, declined, or accepted) - delete it
          await supabase
            .from('workspace_invitations' as any)
            .delete()
            .eq('id', invitation.id);
        }
      }

      // Create new invitation
      const { data: invitation, error } = await supabase
        .from('workspace_invitations' as any)
        .insert([{
          workspace_id: workspace.id,
          inviter_id: user.id,
          invitee_email: email,
          role: inviteRole
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Error creating invitation:', error);
        toast({
          variant: "destructive",
          title: "Failed to send invitation",
          description: "There was an error creating the invitation. Please try again."
        });
        return;
      }

      // Check if invitation data exists and has the required properties
      if (!invitation || !(invitation as any).invitation_token) {
        throw new Error('Failed to create invitation - missing token');
      }

      // Send email notification
      const emailSent = await EmailService.sendInvitationEmail({
        inviteeEmail: inviteEmail.toLowerCase(),
        inviterName: user.user_metadata?.name || user.email?.split('@')[0] || 'Someone',
        workspaceName: workspace.name,
        invitationToken: (invitation as any).invitation_token,
        role: inviteRole
      });

      const invitationLink = `${window.location.origin}/invite/${(invitation as any).invitation_token}`;

      if (emailSent) {
        // Email sent successfully
        toast({
          title: "Invitation sent! ✉️",
          description: `Invitation email sent to ${inviteEmail}. They will receive a link to join the workspace.`,
          duration: 6000,
        });
      } else {
        // Email failed, but still copy link to clipboard as fallback
        toast({
          variant: "destructive",
          title: "Email failed, but invitation created",
          description: `We couldn't send the email, but the invitation link has been copied to your clipboard.`,
          duration: 8000,
        });
        
        // Copy link to clipboard as fallback
        try {
          await navigator.clipboard.writeText(invitationLink);
        } catch (clipboardError) {
          // Show the link in a prompt if clipboard fails too
          setTimeout(() => {
            prompt('Copy this invitation link and send it manually:', invitationLink);
          }, 500);
        }
      }

      setInviteEmail('');
      setInviteRole('editor');
      setDialogOpen(false);
      fetchInvitations();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        variant: "destructive",
        title: "Error sending invitation",
        description: "Failed to send invitation. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Update invitation status
      const { error: updateError } = await supabase
        .from('workspace_invitations' as any)
        .update({
          status: 'accepted',
          invitee_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // Get invitation details
      const { data: invitation, error: fetchError } = await supabase
        .from('workspace_invitations' as any)
        .select('workspace_id, role')
        .eq('id', invitationId)
        .single();

      if (fetchError || !invitation) throw fetchError || new Error('Invitation not found');

      // Add to collaborators
      const { error: collaboratorError } = await supabase
        .from('collaborators')
        .insert([{
          workspace_id: (invitation as any).workspace_id,
          user_id: user.id,
          role: (invitation as any).role
        }]);

      if (collaboratorError) throw collaboratorError;

      toast({
        title: "Invitation accepted!",
        description: "You've joined the workspace successfully."
      });

      fetchPendingInvitations();
      if (onWorkspaceUpdate) onWorkspaceUpdate();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        variant: "destructive",
        title: "Error accepting invitation",
        description: "Failed to accept invitation. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const declineInvitation = async (invitationId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('workspace_invitations' as any)
        .update({
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation declined",
        description: "You've declined the workspace invitation."
      });

      fetchPendingInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast({
        variant: "destructive",
        title: "Error declining invitation",
        description: "Failed to decline invitation. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!workspace || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      toast({
        title: "Collaborator removed",
        description: "The collaborator has been removed from the workspace."
      });

      fetchCollaborators();
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({
        variant: "destructive",
        title: "Error removing collaborator",
        description: "Failed to remove collaborator. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const leaveWorkspace = async () => {
    if (!workspace || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left workspace",
        description: "You've left the workspace successfully."
      });

      if (onWorkspaceUpdate) onWorkspaceUpdate();
    } catch (error) {
      console.error('Error leaving workspace:', error);
      toast({
        variant: "destructive",
        title: "Error leaving workspace",
        description: "Failed to leave workspace. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4" />;
      case 'editor': return <Edit className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'editor': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  };

  const isOwner = workspace && user && workspace.owner_id === user.id;

  return (
    <div className="space-y-6">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Pending Invitations</span>
            </CardTitle>
            <CardDescription>
              You have {pendingInvitations.length} pending workspace invitation(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-semibold">{invitation.workspace.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invitation.inviter.name} ({invitation.inviter.email})
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant={getRoleBadgeVariant(invitation.role)}>
                      {getRoleIcon(invitation.role)}
                      <span className="ml-1">{invitation.role}</span>
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => acceptInvitation(invitation.id)}
                    disabled={loading}
                    title="Accept invitation"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => declineInvitation(invitation.id)}
                    disabled={loading}
                    title="Decline invitation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Workspace Management */}
      {workspace && (
        <Tabs defaultValue="members" className="w-full">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Workspace Members</CardTitle>
                  <CardDescription>
                    Manage who has access to this workspace
                  </CardDescription>
                </div>
                {isOwner && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite New Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join this workspace
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Email Address</label>
                          <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Role</label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={sendInvitation}
                          disabled={loading || !inviteEmail.trim()}
                          className="w-full"
                        >
                          {loading ? 'Sending...' : 'Send Invitation'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {collaborators.map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{collaborator.user.name}</h4>
                        <p className="text-sm text-muted-foreground">{collaborator.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getRoleBadgeVariant(collaborator.role)}>
                        {getRoleIcon(collaborator.role)}
                        <span className="ml-1">{collaborator.role}</span>
                      </Badge>
                      {isOwner && collaborator.user_id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeCollaborator(collaborator.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {!isOwner && collaborator.user_id === user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={leaveWorkspace}
                          disabled={loading}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          Leave
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Invitations that haven't been accepted yet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {invitations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No pending invitations
                  </p>
                ) : (
                  invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-semibold">{invitation.invitee_email}</h4>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invitation.inviter.name}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant={getRoleBadgeVariant(invitation.role)}>
                            {getRoleIcon(invitation.role)}
                            <span className="ml-1">{invitation.role}</span>
                          </Badge>
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default WorkspaceManagement;