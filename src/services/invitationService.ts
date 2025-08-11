// Simple invitation service - no email sending, just in-app notifications
import { supabase } from '@/integrations/supabase/client'

export interface CreateInvitationParams {
  workspaceId: string
  inviteeEmail: string
  role: 'owner' | 'editor' | 'viewer'
  inviterId: string
}

export async function createInvitation(params: CreateInvitationParams) {
  try {
    // Create the invitation
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: params.workspaceId,
        inviter_id: params.inviterId,
        invitee_email: params.inviteeEmail,
        role: params.role
      })
      .select(`
        *,
        workspaces(name),
        users!workspace_invitations_inviter_id_fkey(name, email)
      `)
      .single()

    if (error || !invitation) {
      console.error('Error creating invitation:', error)
      return { success: false, error: error?.message || 'Failed to create invitation' }
    }

    // Generate shareable invitation link
    const invitationLink = `${window.location.origin}/accept-invitation?token=${invitation.invitation_token}`

    return { 
      success: true, 
      invitation,
      invitationLink
    }

  } catch (error) {
    console.error('Error in createInvitation:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function getInvitationByToken(token: string) {
  try {
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .select(`
        *,
        workspaces(name, description),
        users!workspace_invitations_inviter_id_fkey(name, email)
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single()

    if (error || !invitation) {
      return { success: false, error: 'Invitation not found or expired' }
    }

    // Check if invitation hasn't expired
    if (new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: 'Invitation has expired' }
    }

    return { success: true, invitation }

  } catch (error) {
    console.error('Error getting invitation:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function acceptInvitation(token: string, userId: string) {
  try {
    // Get the invitation
    const invitationResult = await getInvitationByToken(token)
    if (!invitationResult.success) {
      return invitationResult
    }

    const invitation = invitationResult.invitation

    // Check if user is already a collaborator
    const { data: existingCollaborator } = await supabase
      .from('collaborators')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', userId)
      .single()

    if (existingCollaborator) {
      return { success: false, error: 'You are already a member of this workspace' }
    }

    // Add user as collaborator
    const { error: collaboratorError } = await supabase
      .from('collaborators')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: invitation.role
      })

    if (collaboratorError) {
      console.error('Error adding collaborator:', collaboratorError)
      return { success: false, error: 'Failed to join workspace' }
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ 
        status: 'accepted',
        invitee_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      // Don't fail here since the user was already added as collaborator
    }

    return { success: true, workspace: invitation.workspaces }

  } catch (error) {
    console.error('Error accepting invitation:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function getPendingInvitations(userEmail: string) {
  try {
    const { data: invitations, error } = await supabase
      .from('workspace_invitations')
      .select(`
        *,
        workspaces(name, description),
        users!workspace_invitations_inviter_id_fkey(name, email)
      `)
      .eq('invitee_email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return { success: false, error: error.message }
    }

    return { success: true, invitations: invitations || [] }

  } catch (error) {
    console.error('Error getting pending invitations:', error)
    return { success: false, error: (error as Error).message }
  }
}