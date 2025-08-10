import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile, indexDocuments, getIndexingStatus } from '@/services/pythonApi';
import { deleteFile } from '@/services/fileService';
import WorkspaceManagement from '@/components/WorkspaceManagement';
import PendingInvitations from '@/components/PendingInvitations';
import {
  FolderPlus,
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash,
  Users,
  X,
  Upload,
  Database
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

interface File {
  id: string;
  filename: string;
  content: string;
  file_type: string;
  created_at: string;
  workspace_id: string;
  updated_at: string;
}

interface FileExplorerProps {
  selectedWorkspace: Workspace | null;
  onWorkspaceSelect: (workspace: Workspace | null) => void;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  selectedWorkspace,
  onWorkspaceSelect,
  onFileSelect,
  selectedFile
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showWorkspaceManagement, setShowWorkspaceManagement] = useState(false);
  const [managementWorkspace, setManagementWorkspace] = useState<Workspace | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      populateExistingWorkspaces();
    }
  }, [user]);

  // Helper function to populate existing workspaces with collaborator entries
  const populateExistingWorkspaces = async () => {
    if (!user) return;

    try {
      // First, get all workspaces owned by the current user
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('owner_id', user.id);

      if (ownedError) {
        console.error('Error fetching owned workspaces:', ownedError);
        fetchWorkspaces(); // Fallback to normal fetch
        return;
      }

      if (ownedWorkspaces && ownedWorkspaces.length > 0) {
        // Check which workspaces don't have collaborator entries for the owner
        const { data: existingCollaborators, error: collabError } = await supabase
          .from('collaborators')
          .select('workspace_id')
          .eq('user_id', user.id)
          .in('workspace_id', ownedWorkspaces.map(w => w.id));

        if (collabError) {
          console.error('Error checking collaborators:', collabError);
          fetchWorkspaces(); // Fallback to normal fetch
          return;
        }

        const existingWorkspaceIds = existingCollaborators?.map(c => c.workspace_id) || [];
        const workspacesToPopulate = ownedWorkspaces.filter(w => !existingWorkspaceIds.includes(w.id));

        // Add collaborator entries for workspaces that don't have them
        if (workspacesToPopulate.length > 0) {
          const collaboratorEntries = workspacesToPopulate.map(workspace => ({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'owner'
          }));

          const { error: insertError } = await supabase
            .from('collaborators')
            .insert(collaboratorEntries);

          if (insertError) {
            console.error('Error populating collaborators:', insertError);
          } else {
            console.log(`Populated ${workspacesToPopulate.length} workspaces with collaborator entries`);
          }
        }
      }

      // Now fetch workspaces normally
      fetchWorkspaces();
    } catch (error) {
      console.error('Error in populateExistingWorkspaces:', error);
      fetchWorkspaces(); // Fallback to normal fetch
    }
  };

  useEffect(() => {
    if (selectedWorkspace) {
      fetchFiles();
    }
  }, [selectedWorkspace]);

  // Set up real-time subscription for files
  useEffect(() => {
    if (!selectedWorkspace) return;

    console.log('Setting up real-time subscription for workspace:', selectedWorkspace.id);

    const subscription = supabase
      .channel(`files-${selectedWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'files',
          filter: `workspace_id=eq.${selectedWorkspace.id}`
        },
        (payload) => {
          console.log('Real-time file change detected:', payload);
          console.log('Event type:', payload.eventType);
          console.log('Old record:', payload.old);
          console.log('New record:', payload.new);

          // Refresh files list when any change occurs
          fetchFiles();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription when workspace changes or component unmounts
    return () => {
      console.log('Cleaning up real-time subscription for workspace:', selectedWorkspace.id);
      subscription.unsubscribe();
    };
  }, [selectedWorkspace]);

  const fetchWorkspaces = async () => {
    if (!user) return;

    try {
      // Fetch workspaces where user is a collaborator or owner
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          collaborators!inner(user_id, role)
        `)
        .eq('collaborators.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Workspace fetch error:', error);

        // Check if it's a table not found error
        if (error.message?.includes('relation "public.workspaces" does not exist')) {
          toast({
            variant: "destructive",
            title: "Database not set up",
            description: "Please run the database migrations in your Supabase Dashboard"
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error fetching workspaces",
            description: error.message
          });
        }

        // Set empty array to prevent infinite retries
        setWorkspaces([]);
      } else {
        setWorkspaces(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching workspaces:', err);
      setWorkspaces([]);
      toast({
        variant: "destructive",
        title: "Unexpected error",
        description: "Failed to fetch workspaces. Please check the console for details."
      });
    }
  };

  const fetchFiles = async () => {
    if (!selectedWorkspace) return;

    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('workspace_id', selectedWorkspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching files",
        description: error.message
      });
    } else {
      setFiles(data || []);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim() || !user) return;

    try {
      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert([{
          name: newWorkspaceName,
          owner_id: user.id
        }])
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      // Add creator as owner collaborator
      const { error: collaboratorError } = await supabase
        .from('collaborators')
        .insert([{
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'owner'
        }]);

      if (collaboratorError) {
        console.error('Error adding collaborator:', collaboratorError);
        // Don't fail the workspace creation if collaborator addition fails
      }

      // Refresh workspaces to show the new one
      await fetchWorkspaces();

      setNewWorkspaceName('');
      setShowNewWorkspace(false);
      toast({
        title: "Workspace created",
        description: `${workspace.name} has been created successfully.`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating workspace",
        description: error.message
      });
    }
  };

  const createFile = async () => {
    if (!newFileName.trim() || !selectedWorkspace || !user) return;

    const { data, error } = await supabase
      .from('files')
      .insert([{
        filename: newFileName,
        workspace_id: selectedWorkspace.id,
        created_by: user.id,
        file_type: 'markdown'
      }])
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error creating file",
        description: error.message
      });
    } else {
      setFiles([data, ...files]);
      setNewFileName('');
      setShowNewFile(false);
      onFileSelect(data);
      toast({
        title: "File created",
        description: `${data.filename} has been created successfully.`
      });
    }
  };

  // Handle file upload to Python backend
  const handleFileUpload = async () => {
    if (!selectedWorkspace) {
      toast({
        variant: "destructive",
        title: "No workspace selected",
        description: "Please select a workspace before uploading files."
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      setIsUploading(true);

      try {
        const uploadPromises = Array.from(files).map(async (file) => {
          try {
            await uploadFile(file, selectedWorkspace.id);
            return { success: true, filename: file.name };
          } catch (error) {
            return { success: false, filename: file.name, error };
          }
        });

        const results = await Promise.all(uploadPromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
          toast({
            title: "Upload completed",
            description: `Successfully uploaded ${successful.length} file(s) to Python backend for workspace "${selectedWorkspace.name}".`
          });

          // Automatically refresh the files list to show any new files
          await fetchFiles();
        }

        if (failed.length > 0) {
          toast({
            variant: "destructive",
            title: "Upload errors",
            description: `Failed to upload ${failed.length} file(s). Check console for details.`
          });
          console.error('Upload failures:', failed);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "An unexpected error occurred during upload."
        });
        console.error('Upload error:', error);
      } finally {
        setIsUploading(false);
      }
    };

    input.click();
  };

  // Handle document indexing
  const handleIndexDocuments = async () => {
    if (!selectedWorkspace) {
      toast({
        variant: "destructive",
        title: "No workspace selected",
        description: "Please select a workspace before indexing documents."
      });
      return;
    }

    setIsIndexing(true);

    try {
      await indexDocuments(selectedWorkspace.id);

      toast({
        title: "Indexing started",
        description: `Document indexing has been initiated for workspace "${selectedWorkspace.name}". Check status for progress.`
      });

      // Optionally check status after a delay
      setTimeout(async () => {
        try {
          const status = await getIndexingStatus();
          toast({
            title: "Indexing status",
            description: `Status: ${JSON.stringify(status)}`
          });
        } catch (error) {
          console.error('Status check error:', error);
        }
      }, 2000);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Indexing failed",
        description: "Failed to start document indexing. Check console for details."
      });
      console.error('Indexing error:', error);
    } finally {
      setIsIndexing(false);
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (file: File, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent file selection when clicking delete

    if (!user || !selectedWorkspace) return;

    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete "${file.filename}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const result = await deleteFile(file.id, selectedWorkspace.id, user.id);

      if (result.success) {
        toast({
          title: "File deleted",
          description: result.message
        });

        // Clear selected file if it was the one being deleted
        if (selectedFile?.id === file.id) {
          onFileSelect(null as any);
        }

        // Manually refresh the files list as a fallback in case real-time doesn't work
        await fetchFiles();
      } else {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: result.message
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "An unexpected error occurred while deleting the file."
      });
      console.error('Delete error:', error);
    }
  };

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full bg-editor-sidebar border-r border-editor-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Explorer</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewWorkspace(true)}
            className="h-8 w-8 p-0 hover:bg-editor-tab"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* New Workspace Input */}
        {showNewWorkspace && (
          <div className="space-y-2 mb-4">
            <Input
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createWorkspace()}
              className="bg-input border-editor-border text-sm"
              autoFocus
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={createWorkspace} className="bg-gradient-primary text-xs">
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewWorkspace(false)} className="text-xs">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-input border-editor-border"
          />
        </div>
      </div>

      {/* Workspaces */}
      <div className="flex-1 overflow-auto">
        {!selectedWorkspace ? (
          <div className="p-4 space-y-2">
            {/* Pending Invitations - Show at the top */}
            <PendingInvitations onInvitationAccepted={fetchWorkspaces} />

            <h3 className="text-sm font-medium text-muted-foreground mb-3">Workspaces</h3>
            {workspaces.map((workspace) => (
              <Card
                key={workspace.id}
                className="p-3 bg-editor-panel border-editor-border cursor-pointer hover:bg-editor-tab transition-colors"
                onClick={() => onWorkspaceSelect(workspace)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FolderPlus className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{workspace.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(workspace.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Opening workspace management for:', workspace.name);
                          setManagementWorkspace(workspace);
                          setShowWorkspaceManagement(true);
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onWorkspaceSelect(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Workspaces
              </Button>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewFile(true)}
                  className="h-8 w-8 p-0 hover:bg-editor-tab"
                  title="Create new file"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="h-8 w-8 p-0 hover:bg-editor-tab"
                  title="Upload files to Python backend"
                >
                  <Upload className={`h-4 w-4 ${isUploading ? 'animate-pulse' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleIndexDocuments}
                  disabled={isIndexing}
                  className="h-8 w-8 p-0 hover:bg-editor-tab"
                  title="Index documents for embedding"
                >
                  <Database className={`h-4 w-4 ${isIndexing ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
            </div>

            <h3 className="text-sm font-medium mb-3">{selectedWorkspace.name}</h3>

            {/* New File Input */}
            {showNewFile && (
              <div className="space-y-2 mb-4">
                <Input
                  placeholder="File name (e.g., document.md)"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createFile()}
                  className="bg-input border-editor-border text-sm"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <Button size="sm" onClick={createFile} className="bg-gradient-accent text-xs">
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewFile(false)} className="text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`group p-3 rounded-lg cursor-pointer transition-colors border ${selectedFile?.id === file.id
                  ? 'bg-editor-tab-active border-primary'
                  : 'bg-editor-panel border-editor-border hover:bg-editor-tab'
                  }`}
                onClick={() => onFileSelect(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteFile(file, e)}
                    className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete file"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Management Modal */}
      {showWorkspaceManagement && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-editor-sidebar border border-editor-border rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  Manage Workspace: {managementWorkspace?.name}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowWorkspaceManagement(false);
                    setManagementWorkspace(null);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <WorkspaceManagement
                workspace={managementWorkspace}
                onWorkspaceUpdate={() => {
                  fetchWorkspaces();
                  setShowWorkspaceManagement(false);
                  setManagementWorkspace(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;