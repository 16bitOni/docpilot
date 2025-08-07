import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  FolderPlus,
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash,
  Users
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
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchFiles();
    }
  }, [selectedWorkspace]);

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching workspaces",
        description: error.message
      });
    } else {
      setWorkspaces(data || []);
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

    const { data, error } = await supabase
      .from('workspaces')
      .insert([{
        name: newWorkspaceName,
        owner_id: user.id
      }])
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error creating workspace",
        description: error.message
      });
    } else {
      setWorkspaces([data, ...workspaces]);
      setNewWorkspaceName('');
      setShowNewWorkspace(false);
      toast({
        title: "Workspace created",
        description: `${data.name} has been created successfully.`
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
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewFile(true)}
                className="h-8 w-8 p-0 hover:bg-editor-tab"
              >
                <Plus className="h-4 w-4" />
              </Button>
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
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedFile?.id === file.id
                    ? 'bg-editor-tab-active border-primary'
                    : 'bg-editor-panel border-editor-border hover:bg-editor-tab'
                }`}
                onClick={() => onFileSelect(file)}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-4 w-4 text-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;