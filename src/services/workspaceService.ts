import { supabase } from '@/integrations/supabase/client';

// Delete a workspace and all its related data
export const deleteWorkspace = async (workspaceId: string, userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Delete workspace called with:', { workspaceId, userId });
    
    // First check if user is the owner of the workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      return {
        success: false,
        message: `Failed to fetch workspace: ${workspaceError.message}`
      };
    }

    if (!workspace || workspace.owner_id !== userId) {
      return {
        success: false,
        message: "You don't have permission to delete this workspace. Only the owner can delete a workspace."
      };
    }

    // Delete related data in the correct order to avoid foreign key constraints
    
    // 1. Delete file versions first
    console.log('Deleting file versions...');
    
    // First get all file IDs for this workspace
    const { data: workspaceFiles, error: filesQueryError } = await supabase
      .from('files')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (filesQueryError) {
      console.error('Error fetching workspace files:', filesQueryError);
      return {
        success: false,
        message: `Failed to fetch workspace files: ${filesQueryError.message}`
      };
    }

    // Delete file versions if there are files
    if (workspaceFiles && workspaceFiles.length > 0) {
      const fileIds = workspaceFiles.map(file => file.id);
      const { error: fileVersionsError } = await supabase
        .from('file_versions')
        .delete()
        .in('file_id', fileIds);

      if (fileVersionsError) {
        console.error('Error deleting file versions:', fileVersionsError);
        return {
          success: false,
          message: `Failed to delete file versions: ${fileVersionsError.message}`
        };
      }
    }

    // 2. Delete files
    console.log('Deleting files...');
    const { error: filesError } = await supabase
      .from('files')
      .delete()
      .eq('workspace_id', workspaceId);

    if (filesError) {
      console.error('Error deleting files:', filesError);
      return {
        success: false,
        message: `Failed to delete files: ${filesError.message}`
      };
    }

    // 3. Delete chat messages
    console.log('Deleting chat messages...');
    const { error: chatError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('workspace_id', workspaceId);

    if (chatError) {
      console.error('Error deleting chat messages:', chatError);
      return {
        success: false,
        message: `Failed to delete chat messages: ${chatError.message}`
      };
    }

    // 4. Delete workspace activity
    console.log('Deleting workspace activity...');
    const { error: activityError } = await supabase
      .from('workspace_activity')
      .delete()
      .eq('workspace_id', workspaceId);

    if (activityError) {
      console.error('Error deleting workspace activity:', activityError);
      return {
        success: false,
        message: `Failed to delete workspace activity: ${activityError.message}`
      };
    }

    // 5. Delete workspace invitations
    console.log('Deleting workspace invitations...');
    const { error: invitationsError } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('workspace_id', workspaceId);

    if (invitationsError) {
      console.error('Error deleting workspace invitations:', invitationsError);
      return {
        success: false,
        message: `Failed to delete workspace invitations: ${invitationsError.message}`
      };
    }

    // 6. Delete workspace requests
    console.log('Deleting workspace requests...');
    const { error: requestsError } = await supabase
      .from('workspace_requests')
      .delete()
      .eq('workspace_id', workspaceId);

    if (requestsError) {
      console.error('Error deleting workspace requests:', requestsError);
      return {
        success: false,
        message: `Failed to delete workspace requests: ${requestsError.message}`
      };
    }

    // 7. Delete collaborators
    console.log('Deleting collaborators...');
    const { error: collaboratorsError } = await supabase
      .from('collaborators')
      .delete()
      .eq('workspace_id', workspaceId);

    if (collaboratorsError) {
      console.error('Error deleting collaborators:', collaboratorsError);
      return {
        success: false,
        message: `Failed to delete collaborators: ${collaboratorsError.message}`
      };
    }

    // 8. Finally, delete the workspace itself
    console.log('Deleting workspace...');
    const { data, error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .eq('owner_id', userId) // Extra security check
      .select();

    if (error) {
      console.error('Error deleting workspace:', error);
      return {
        success: false,
        message: `Failed to delete workspace: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      console.warn('No workspace was deleted - workspace may not exist or permission denied');
      return {
        success: false,
        message: "Workspace not found or you don't have permission to delete it"
      };
    }

    console.log('Workspace deleted successfully:', data);
    return {
      success: true,
      message: "Workspace deleted successfully"
    };
  } catch (error) {
    console.error('Error in deleteWorkspace:', error);
    return {
      success: false,
      message: "An unexpected error occurred while deleting the workspace"
    };
  }
};