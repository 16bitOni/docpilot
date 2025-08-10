import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FileVersion {
  id: string;
  file_id: string;
  content: string;
  version_number: number;
  created_at: string;
  created_by: string;
  user_name?: string;
  user_email?: string;
}

interface UseFileHistoryProps {
  fileId: string;
}

export const useFileHistory = ({ fileId }: UseFileHistoryProps) => {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<FileVersion | null>(null);

  // Fetch file versions
  const fetchVersions = async () => {
    if (!fileId) return;

    setIsLoading(true);
    try {
      // Fetch versions with user information
      const { data: versionsData, error: versionsError } = await supabase
        .from('file_versions')
        .select(`
          id,
          file_id,
          content,
          version_number,
          created_at,
          created_by
        `)
        .eq('file_id', fileId)
        .order('created_at', { ascending: false });

      if (versionsError) {
        console.error('Error fetching versions:', versionsError);
        return;
      }

      if (!versionsData || versionsData.length === 0) {
        setVersions([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(versionsData.map(v => v.created_by))];

      // Fetch user information
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        // Still show versions without user info
        setVersions(versionsData);
        return;
      }

      // Create user map for quick lookup
      const usersMap = new Map(
        (usersData || []).map(user => [
          user.id,
          {
            name: user.name || user.email?.split('@')[0] || 'Unknown',
            email: user.email
          }
        ])
      );

      // Combine versions with user data
      const versionsWithUsers = versionsData.map(version => ({
        ...version,
        user_name: usersMap.get(version.created_by)?.name || 'Unknown',
        user_email: usersMap.get(version.created_by)?.email || null
      }));

      setVersions(versionsWithUsers);
    } catch (error) {
      console.error('Error in fetchVersions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new version
  const createVersion = async (content: string, userId: string) => {
    if (!fileId || !userId) return;

    try {
      const versionNumber = Math.floor(Date.now() / 1000);

      const { error } = await supabase
        .from('file_versions')
        .insert([{
          file_id: fileId,
          content,
          version_number: versionNumber,
          created_by: userId
        }]);

      if (error) {
        console.error('Error creating version:', error);
        return;
      }

      // Refresh versions list
      await fetchVersions();
    } catch (error) {
      console.error('Error in createVersion:', error);
    }
  };

  // Restore a version
  const restoreVersion = async (version: FileVersion) => {
    if (!fileId) return;

    try {
      // Update the main file content
      const { error } = await supabase
        .from('files')
        .update({
          content: version.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (error) {
        console.error('Error restoring version:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in restoreVersion:', error);
      return false;
    }
  };

  // Load versions when fileId changes
  useEffect(() => {
    if (fileId) {
      fetchVersions();
    }
  }, [fileId]);

  return {
    versions,
    isLoading,
    selectedVersion,
    setSelectedVersion,
    fetchVersions,
    createVersion,
    restoreVersion
  };
};