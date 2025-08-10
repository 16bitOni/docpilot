import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Users,
    Crown,
    Edit,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';

interface InvitationData {
    id: string;
    workspace_id: string;
    inviter_id: string;
    invitee_email: string;
    role: string;
    status: string;
    expires_at: string;
    workspace: {
        name: string;
        description?: string;
    };
    inviter: {
        name: string;
        email: string;
    };
}

const InvitePage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [invitation, setInvitation] = useState<InvitationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchInvitation();
        }
    }, [token]);

    const fetchInvitation = async () => {
        if (!token) return;

        try {
            // First get the invitation
            const { data: invitationData, error: invitationError } = await supabase
                .from('workspace_invitations' as any)
                .select('*')
                .eq('invitation_token', token)
                .eq('status', 'pending')
                .single();

            if (invitationError) {
                if (invitationError.code === 'PGRST116') {
                    setError('Invitation not found or has already been used.');
                } else {
                    setError('Error loading invitation.');
                }
                console.error('Error fetching invitation:', invitationError);
                return;
            }

            // Check if invitation data exists and has required properties
            if (!invitationData || typeof invitationData !== 'object' || !('expires_at' in invitationData)) {
                setError('Invalid invitation data.');
                return;
            }

            // Type assertion to ensure TypeScript knows this is valid data
            const validInvitationData = invitationData as any;

            // Check if invitation is expired
            if (new Date(validInvitationData.expires_at) < new Date()) {
                setError('This invitation has expired.');
                return;
            }

            // Fetch workspace details
            const { data: workspaceData, error: workspaceError } = await supabase
                .from('workspaces')
                .select('name, description')
                .eq('id', validInvitationData.workspace_id)
                .single();

            if (workspaceError) {
                console.error('Error fetching workspace:', workspaceError);
                setError('Error loading workspace details.');
                return;
            }

            // Fetch inviter details
            const { data: inviterData, error: inviterError } = await supabase
                .from('users')
                .select('name, email')
                .eq('id', validInvitationData.inviter_id)
                .single();

            if (inviterError) {
                console.error('Error fetching inviter:', inviterError);
                setError('Error loading inviter details.');
                return;
            }

            // Combine the data
            const combinedInvitation = {
                ...validInvitationData,
                workspace: {
                    name: workspaceData.name,
                    description: workspaceData.description
                },
                inviter: {
                    name: inviterData.name || 'Unknown User',
                    email: inviterData.email || 'unknown@email.com'
                }
            };

            setInvitation(combinedInvitation);
        } catch (err) {
            console.error('Unexpected error:', err);
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const acceptInvitation = async () => {
        if (!invitation || !user) return;

        setAccepting(true);
        try {
            // Check if user email matches invitation email
            if (user.email !== invitation.invitee_email) {
                toast({
                    variant: "destructive",
                    title: "Email mismatch",
                    description: `This invitation was sent to ${invitation.invitee_email}, but you're signed in as ${user.email}.`
                });
                setAccepting(false);
                return;
            }

            // Update invitation status
            const { error: updateError } = await supabase
                .from('workspace_invitations' as any)
                .update({
                    status: 'accepted',
                    invitee_id: user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', invitation.id);

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

            // Redirect to the main app
            navigate('/');
        } catch (error: any) {
            console.error('Error accepting invitation:', error);
            toast({
                variant: "destructive",
                title: "Error accepting invitation",
                description: error.message || "Failed to accept invitation. Please try again."
            });
        } finally {
            setAccepting(false);
        }
    };

    const declineInvitation = async () => {
        if (!invitation) return;

        try {
            const { error } = await supabase
                .from('workspace_invitations' as any)
                .update({
                    status: 'declined',
                    updated_at: new Date().toISOString()
                })
                .eq('id', invitation.id);

            if (error) throw error;

            toast({
                title: "Invitation declined",
                description: "You've declined the workspace invitation."
            });

            navigate('/');
        } catch (error: any) {
            console.error('Error declining invitation:', error);
            toast({
                variant: "destructive",
                title: "Error declining invitation",
                description: error.message || "Failed to decline invitation."
            });
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

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-editor flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-muted-foreground">Loading invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-editor flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <CardTitle>Invitation Error</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Button onClick={() => navigate('/')} variant="outline">
                            Go to App
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-editor flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                        <CardTitle>Sign In Required</CardTitle>
                        <CardDescription>
                            You need to sign in to accept this workspace invitation.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Button onClick={() => navigate('/auth')} className="w-full">
                            Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!invitation) {
        return (
            <div className="min-h-screen bg-gradient-editor flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-editor flex items-center justify-center p-3 sm:p-4">
            <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-card/95 backdrop-blur">
                <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-semibold">Workspace Invitation</CardTitle>
                    <CardDescription className="text-sm">
                        You've been invited to collaborate
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-4 sm:px-6">
                    {/* Workspace Info */}
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold text-foreground truncate">
                            {invitation.workspace.name}
                        </h3>
                        {invitation.workspace.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {invitation.workspace.description}
                            </p>
                        )}
                    </div>

                    {/* Invitation Details */}
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span className="truncate">By {invitation.inviter.name}</span>
                            </div>
                            <Badge variant={getRoleBadgeVariant(invitation.role)} className="text-xs px-2 py-0.5">
                                {getRoleIcon(invitation.role)}
                                <span className="ml-1 capitalize">{invitation.role}</span>
                            </Badge>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Email Mismatch Warning */}
                    {user.email !== invitation.invitee_email && (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                <strong>Note:</strong> This invitation was sent to{' '}
                                <strong className="break-all">{invitation.invitee_email}</strong>, but you're signed in as{' '}
                                <strong className="break-all">{user.email}</strong>.
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <Button
                            onClick={acceptInvitation}
                            disabled={accepting || user.email !== invitation.invitee_email}
                            className="w-full h-9 text-sm font-medium"
                            size="sm"
                        >
                            {accepting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    Accepting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                    Accept Invitation
                                </>
                            )}
                        </Button>

                        <div className="flex space-x-2">
                            <Button
                                onClick={declineInvitation}
                                variant="outline"
                                className="flex-1 h-8 text-xs"
                                size="sm"
                            >
                                <XCircle className="h-3 w-3 mr-1.5" />
                                Decline
                            </Button>
                            <Button
                                onClick={() => navigate('/')}
                                variant="ghost"
                                className="flex-1 h-8 text-xs"
                                size="sm"
                            >
                                Go to App
                            </Button>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="text-center pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                            Powered by <span className="font-medium text-primary">DocPilot</span>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default InvitePage;