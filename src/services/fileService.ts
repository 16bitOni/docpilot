import { supabase } from '@/integrations/supabase/client';

// Check if user has permission to delete files in a workspace
export const checkDeletePermission = async (workspaceId: string, userId: string): Promise<boolean> => {
  try {
    console.log('Checking delete permission for:', { workspaceId, userId });
    
    const { data, error } = await supabase
      .from('collaborators')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    console.log('Permission query result:', { data, error });

    if (error) {
      console.error('Error checking permissions:', error);
      return false;
    }

    // Only owners and editors can delete files
    const hasPermission = data?.role === 'owner' || data?.role === 'editor';
    console.log('User role:', data?.role, 'Has permission:', hasPermission);
    
    return hasPermission;
  } catch (error) {
    console.error('Error in checkDeletePermission:', error);
    return false;
  }
};

// Delete a file from the database
export const deleteFile = async (fileId: string, workspaceId: string, userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Delete file called with:', { fileId, workspaceId, userId });
    
    // First check permissions
    const hasPermission = await checkDeletePermission(workspaceId, userId);
    console.log('Permission check result:', hasPermission);
    
    if (!hasPermission) {
      return {
        success: false,
        message: "You don't have permission to delete files in this workspace. Only owners and editors can delete files."
      };
    }

    // Delete file versions first (to avoid foreign key constraint)
    console.log('Deleting file versions first...');
    const { error: versionsError } = await supabase
      .from('file_versions')
      .delete()
      .eq('file_id', fileId);

    if (versionsError) {
      console.error('Error deleting file versions:', versionsError);
      return {
        success: false,
        message: `Failed to delete file versions: ${versionsError.message}`
      };
    }

    // Now delete the file
    console.log('Attempting to delete file from database...');
    const { data, error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('workspace_id', workspaceId) // Extra security check
      .select(); // Add select to see what was deleted

    console.log('Delete result:', { data, error });

    if (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        message: `Failed to delete file: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      console.warn('No file was deleted - file may not exist or permission denied');
      return {
        success: false,
        message: "File not found or you don't have permission to delete it"
      };
    }

    console.log('File deleted successfully:', data);
    return {
      success: true,
      message: "File deleted successfully"
    };
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return {
      success: false,
      message: "An unexpected error occurred while deleting the file"
    };
  }
};