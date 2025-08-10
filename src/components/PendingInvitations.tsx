import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Mail,
    Clock,
    Check,
    X,
    Crown,
    Edit,
    Eye,
    Users
} from 'lucide-react';

interface WorkspaceInvitation {
    id: string;
    workspace_id: string;
    inviter_id: string;
    invitee_email: string;
    role: string;
    status: string;
    expires_at: string;
    workspace: {
        name: string;
    };
    inviter: {
        name: string;
        email: string;
    };
}

interface PendingInvitationsProps {
    onInvitationAccepted?: () => void;
}

const PendingInvitations: React.FC<PendingInvitationsProps> = ({ onInvitationAccepted }) => {
    const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitation[]>([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (user) {
            fetchPendingInvitations();
        }
    }, [user]);

    const fetchPendingInvitations = async () => {
        if (!user || !user.email) return;

        try {
            // Direct query to workspace_invitations table
            const { data: directData, error: directError } = await supabase
                .from('workspace_invitations' as any)
                .select(`
          id,
          workspace_id,
          inviter_id,
          invitee_email,
          role,
          status,
          expires_at,
          workspaces!workspace_invitations_workspace_id_fkey(name),
          users!workspace_invitations_inviter_id_fkey(name, email)
        `)
                .eq('invitee_email', user.email)
                .eq('status', 'pending')
                .gt('expires_at', new Date().toISOString());

            if (directError) {
                console.error('Error fetching pending invitations:', directError);
                return;
            }

            // Transform the data to match our interface
            const transformedData = directData?.map((invitation: any) => ({
                id: invitation.id,
                workspace_id: invitation.workspace_id,
                inviter_id: invitation.inviter_id,
                invitee_email: invitation.invitee_email,
                role: invitation.role,
                status: invitation.status,
                expires_at: invitation.expires_at,
                workspace: {
                    name: invitation.workspaces?.name || 'Unknown Workspace'
                },
                inviter: {
                    name: invitation.users?.name || 'Unknown User',
                    email: invitation.users?.email || 'unknown@email.com'
                }
            })) || [];

            setPendingInvitations(transformedData);
        } catch (err) {
            console.error('Error in fetchPendingInvitations:', err);
        }
    };

    const acceptInvitation = async (invitationId: string) => {
        if (!user) return;

        setLoading(true);
        try {
            // Get invitation details first
            const invitation = pendingInvitations.find(inv => inv.id === invitationId);
            if (!invitation) {
                throw new Error('Invitation not found');
            }

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

            // Add to collaborators
            const { error: collaboratorError } = await supabase
                .from('collaborators')
                .insert([{
                    workspace_id: invitation.workspace_id,
                    user_id: user.id,
                    role: invitation.role
                }]);

            if (collaboratorError) {
                // Check if already a collaborator
                if (collaboratorError.code === '23505') {
                    toast({
                        title: "Already a member",
                        description: "You're already a member of this workspace."
                    });
                } else {
                    throw collaboratorError;
                }
            }

            toast({
                title: "Invitation accepted!",
                description: `You've joined ${invitation.workspace.name} successfully.`
            });

            // Remove from pending invitations
            setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

            // Notify parent component
            if (onInvitationAccepted) {
                onInvitationAccepted();
            }
        } catch (error: any) {
            console.error('Error accepting invitation:', error);
            toast({
                variant: "destructive",
                title: "Error accepting invitation",
                description: error.message || "Failed to accept invitation. Please try again."
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

            const invitation = pendingInvitations.find(inv => inv.id === invitationId);
            toast({
                title: "Invitation declined",
                description: `You've declined the invitation to ${invitation?.workspace.name}.`
            });

            // Remove from pending invitations
            setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        } catch (error: any) {
            console.error('Error declining invitation:', error);
            toast({
                variant: "destructive",
                title: "Error declining invitation",
                description: error.message || "Failed to decline invitation."
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

    if (pendingInvitations.length === 0) {
        return null; // Don't render anything if no pending invitations
    }

    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Pending Invitations</span>
                </CardTitle>
                <CardDescription className="text-xs">
                    {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
                {pendingInvitations.map((invitation) => (
                    <div key={invitation.id} className="p-3 border rounded-lg bg-accent/5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{invitation.workspace.name}</h4>
                                <p className="text-xs text-muted-foreground truncate">
                                    {invitation.inviter.name}
                                </p>
                            </div>
                            <div className="flex space-x-1 ml-2 flex-shrink-0">
                                <button
                                    className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    onClick={() => acceptInvitation(invitation.id)}
                                    disabled={loading}
                                    title="Accept invitation"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    onClick={() => declineInvitation(invitation.id)}
                                    disabled={loading}
                                    title="Decline invitation"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Badge variant={getRoleBadgeVariant(invitation.role) as any} className="text-xs px-1.5 py-0.5">
                                {getRoleIcon(invitation.role)}
                                <span className="ml-1 capitalize">{invitation.role}</span>
                            </Badge>
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {new Date(invitation.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Badge>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default PendingInvitations;