import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Edit, Eye, GitBranch, Save, Clock, Users2, Wifi, WifiOff, History, RotateCcw, User, Download, ChevronDown, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useFileHistory } from '@/hooks/useFileHistory';
import GitStyleDiff from './GitStyleDiff';
import { exportFile } from '@/utils/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface File {
  id: string;
  filename: string;
  content: string;
  file_type: string;
  workspace_id: string;
  updated_at: string;
}

interface MarkdownEditorProps {
  file: File | null;
  onFileUpdate: (file: File) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ file, onFileUpdate }) => {
  const [originalContent, setOriginalContent] = useState('');
  const [lastKnownContent, setLastKnownContent] = useState(''); // Last content user was aware of
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [isOwner, setIsOwner] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [recentChange, setRecentChange] = useState<{
    timestamp: Date;
    isRemote: boolean;
    source?: string; // 'ai', 'user', 'external'
  } | null>(null);
  const [hasExternalChanges, setHasExternalChanges] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Use file history hook
  const {
    versions,
    isLoading: historyLoading,
    selectedVersion,
    setSelectedVersion,
    restoreVersion
  } = useFileHistory({ fileId: file?.id || '' });

  const [content, setContent] = useState(file?.content || '');
  const [isConnected] = useState(false); // Remove CRDT connection status

  const updateContent = (newContent: string) => {
    setContent(newContent);
    // Check if content differs from last known content (for manual edits)
    if (newContent !== lastKnownContent && newContent !== originalContent) {
      setHasExternalChanges(true);
    }
  };

  useEffect(() => {
    if (file) {
      console.log('MarkdownEditor: File loaded', {
        fileId: file.id,
        workspaceId: file.workspace_id,
        filename: file.filename
      });
      setOriginalContent(file.content || '');
      setContent(file.content || '');
      // Initialize lastKnownContent to current content when file loads
      setLastKnownContent(file.content || '');
      setHasExternalChanges(false);

      // Listen for database changes to this file from other users
      const channel = supabase
        .channel(`file-${file.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'files',
            filter: `id=eq.${file.id}`
          },
          (payload) => {
            console.log('MarkdownEditor: Database change detected', payload);
            const updatedFile = payload.new as File;

            // Check if this is an external change (AI, other users, etc.)
            if (updatedFile.content !== content && updatedFile.content !== lastKnownContent) {
              console.log('MarkdownEditor: External change detected - showing in diff');

              // Update the current content to show the new external changes
              setContent(updatedFile.content);
              setOriginalContent(updatedFile.content);

              // Mark as having external changes that need review
              setHasExternalChanges(true);

              // Update the file object
              onFileUpdate(updatedFile);

              // Show notification about external change
              setRecentChange({
                timestamp: new Date(),
                isRemote: true,
                source: 'external'
              });

              setTimeout(() => {
                setRecentChange(null);
              }, 3000);
            }
          }
        )
        .subscribe((status) => {
          console.log('MarkdownEditor: File subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }

    return () => {
      // Cleanup if needed
    };
  }, [file?.id, file?.workspace_id, file?.content]);

  // Check user permissions (owner, editor, viewer)
  useEffect(() => {
    const checkPermissions = async () => {
      if (!file?.workspace_id || !user) return;

      // Check if user is workspace owner
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', file.workspace_id)
        .single();

      const isWorkspaceOwner = workspace?.owner_id === user.id;
      setIsOwner(isWorkspaceOwner);

      // Check user role in collaborators table
      const { data: collaborator } = await supabase
        .from('collaborators')
        .select('role')
        .eq('workspace_id', file.workspace_id)
        .eq('user_id', user.id)
        .single();

      const role = collaborator?.role || (isWorkspaceOwner ? 'owner' : 'viewer');
      setUserRole(role);
      setIsEditor(role === 'editor' || role === 'owner');
    };

    checkPermissions();
  }, [file?.workspace_id, user]);

  // Save to database (used by both manual save and auto-save)
  const saveToDatabase = async (contentToSave?: string, isManualSave = false) => {
    const saveContent = contentToSave || content;
    if (!file || !user || saveContent === originalContent) return;

    const { data, error } = await supabase
      .from('files')
      .update({
        content: saveContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', file.id)
      .select()
      .single();

    if (error) {
      console.error('Error saving file:', error);
    } else {
      setOriginalContent(saveContent);
      setLastSaved(new Date());
      onFileUpdate(data);

      // If this is a manual save (accept changes), update lastKnownContent
      if (isManualSave) {
        setLastKnownContent(saveContent);
        setHasExternalChanges(false);
      }

      // Create version entry silently
      await supabase.from('file_versions').insert([{
        file_id: file.id,
        content: saveContent,
        version_number: Math.floor(Date.now() / 1000),
        created_by: user.id
      }]);
    }
  };

  const saveFile = () => saveToDatabase();

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (content !== originalContent && file) {
      const timer = setTimeout(() => {
        saveFile();
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [content, originalContent, file]);

  const hasUnsavedChanges = content !== originalContent;

  // Debug logging
  console.log('MarkdownEditor Debug:', {
    hasUnsavedChanges,
    hasExternalChanges,
    contentLength: content.length,
    originalContentLength: originalContent.length,
    lastKnownContentLength: lastKnownContent.length,
    contentPreview: content.substring(0, 50),
    originalContentPreview: originalContent.substring(0, 50),
    lastKnownPreview: lastKnownContent.substring(0, 50)
  });

  if (!file) {
    return (
      <div className="h-full bg-editor-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Edit className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No file selected</h3>
            <p className="text-muted-foreground">
              Select a file from the explorer or create a new one to start editing
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-editor-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-editor-border bg-editor-panel">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">{file.filename}</h1>
          {hasUnsavedChanges && (
            <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
          {lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Recent Change Indicator */}
          {recentChange && recentChange.isRemote && (
            <div className="flex items-center space-x-1 text-blue-400 animate-pulse">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Collaborator updated</span>
            </div>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-editor-border hover:bg-editor-panel"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const filename = file.filename.replace(/\.[^/.]+$/, '') || 'document';
                    await exportFile({
                      filename,
                      content,
                      format: 'pdf'
                    });
                    toast({
                      title: "Export successful",
                      description: "PDF file has been downloaded",
                    });
                  } catch (error) {
                    toast({
                      title: "Export failed",
                      description: "Failed to export as PDF",
                      variant: "destructive"
                    });
                  }
                }}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const filename = file.filename.replace(/\.[^/.]+$/, '') || 'document';
                    await exportFile({
                      filename,
                      content,
                      format: 'docx'
                    });
                    toast({
                      title: "Export successful",
                      description: "DOCX file has been downloaded",
                    });
                  } catch (error) {
                    toast({
                      title: "Export failed",
                      description: "Failed to export as DOCX",
                      variant: "destructive"
                    });
                  }
                }}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const filename = file.filename.replace(/\.[^/.]+$/, '') || 'document';
                    await exportFile({
                      filename,
                      content,
                      format: 'txt'
                    });
                    toast({
                      title: "Export successful",
                      description: "TXT file has been downloaded",
                    });
                  } catch (error) {
                    toast({
                      title: "Export failed",
                      description: "Failed to export as TXT",
                      variant: "destructive"
                    });
                  }
                }}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as TXT
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const filename = file.filename.replace(/\.[^/.]+$/, '') || 'document';
                    await exportFile({
                      filename,
                      content,
                      format: 'md'
                    });
                    toast({
                      title: "Export successful",
                      description: "Markdown file has been downloaded",
                    });
                  } catch (error) {
                    toast({
                      title: "Export failed",
                      description: "Failed to export as Markdown",
                      variant: "destructive"
                    });
                  }
                }}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={saveFile}
            disabled={!hasUnsavedChanges}
            size="sm"
            className="bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start bg-editor-sidebar border-b border-editor-border rounded-none h-12">
          <TabsTrigger value="edit" className="data-[state=active]:bg-editor-tab-active">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-editor-tab-active">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>

          <TabsTrigger value="history" className="data-[state=active]:bg-editor-tab-active">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="edit" className="h-full m-0 p-0">
            <Textarea
              value={content}
              onChange={(e) => updateContent(e.target.value)}
              placeholder="Start writing your markdown content..."
              className="h-full w-full resize-none border-0 bg-editor-background rounded-none focus:ring-0 text-sm font-mono leading-relaxed p-6"
              style={{
                minHeight: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
              }}
            />
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0 p-0 relative">
            <div
              className="absolute inset-0 overflow-y-auto bg-editor-background p-6"
              style={{ height: '100%' }}
            >
              <div className="prose prose-invert max-w-none prose-p:leading-7 prose-p:mb-4 prose-headings:mb-4 prose-headings:mt-6 prose-li:my-1 prose-pre:whitespace-pre-wrap prose-pre:break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-4 leading-7">{children}</p>,
                    br: () => <br className="mb-2" />,
                    h1: ({ children }) => <h1 className="mb-4 mt-6">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-4 mt-6">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-4 mt-6">{children}</h3>,
                    h4: ({ children }) => <h4 className="mb-4 mt-6">{children}</h4>,
                    h5: ({ children }) => <h5 className="mb-4 mt-6">{children}</h5>,
                    h6: ({ children }) => <h6 className="mb-4 mt-6">{children}</h6>,
                    ul: ({ children }) => <ul className="mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-4 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="my-1">{children}</li>,
                    blockquote: ({ children }) => <blockquote className="mb-4 pl-4 border-l-4 border-gray-300">{children}</blockquote>,
                    pre: ({ children }) => <pre className="mb-4 p-4 bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap break-words">{children}</pre>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ?
                        <code className="px-1 py-0.5 bg-gray-800 rounded text-sm">{children}</code> :
                        <code className={className}>{children}</code>;
                    }
                  }}
                >
                  {content || '*No content to preview*'}
                </ReactMarkdown>
              </div>
            </div>
          </TabsContent>



          <TabsContent value="history" className="h-full m-0 p-0">
            <div className="h-full bg-editor-background flex flex-col overflow-hidden">
              {/* History Header - Fixed at top */}
              <div className="flex-shrink-0 bg-editor-panel border-b border-editor-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <History className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">File History</h3>
                      <p className="text-xs text-muted-foreground">
                        {versions.length} version{versions.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Clear History Button */}
                    {versions.length > 0 && isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to clear all ${versions.length} version(s) from history? This action cannot be undone.`)) {
                            try {
                              const { error } = await supabase
                                .from('file_versions')
                                .delete()
                                .eq('file_id', file.id);

                              if (error) {
                                toast({
                                  title: "Clear failed",
                                  description: "Failed to clear file history",
                                  variant: "destructive"
                                });
                              } else {
                                toast({
                                  title: "History cleared",
                                  description: "All file versions have been deleted",
                                });
                                // Clear selected version and refresh
                                setSelectedVersion(null);
                                window.location.reload();
                              }
                            } catch (error) {
                              toast({
                                title: "Clear failed",
                                description: "An error occurred while clearing history",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                        className="border-destructive/20 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear History
                      </Button>
                    )}
                    {/* Restore Version Button */}
                    {selectedVersion && isOwner && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const success = await restoreVersion(selectedVersion);
                          if (success) {
                            toast({
                              title: "Version restored",
                              description: `Restored to version from ${new Date(selectedVersion.created_at).toLocaleString()}`,
                              className: "bg-green-600"
                            });
                            // Refresh the file content
                            window.location.reload();
                          } else {
                            toast({
                              title: "Restore failed",
                              description: "Failed to restore the selected version",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore Version
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* History Content - Main scrollable container */}
              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                  </div>
                ) : versions.length > 0 ? (
                  <div className="h-full flex">
                    {/* Left Panel - Version List */}
                    <div className="w-1/3 border-r border-editor-border bg-editor-panel/30">
                      <div className="p-4">
                        <h4 className="font-medium mb-3 text-sm">Version History</h4>
                        <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                          {versions.map((version, index) => (
                            <div
                              key={version.id}
                              className={`border border-editor-border rounded-lg p-3 cursor-pointer transition-all text-sm ${selectedVersion?.id === version.id
                                ? 'bg-primary/10 border-primary/30'
                                : 'hover:bg-editor-panel/50'
                                }`}
                              onClick={() => setSelectedVersion(version)}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-medium truncate">
                                      {version.user_name || 'Unknown'}
                                    </span>
                                  </div>
                                  {index === 0 && (
                                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(version.created_at).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {version.content.length} chars
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Panel - Version Details */}
                    <div className="flex-1 flex flex-col">
                      {selectedVersion ? (
                        <div className="h-full flex flex-col">
                          {/* Version Info Header */}
                          <div className="flex-shrink-0 bg-editor-panel/50 border-b border-editor-border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">Version Details</h4>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(selectedVersion.created_at).toLocaleString()} by {selectedVersion.user_name}
                                </p>
                              </div>
                              {isOwner && (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedVersion(null)}
                                    className="border-muted-foreground/20"
                                  >
                                    Clear
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      const success = await restoreVersion(selectedVersion);
                                      if (success) {
                                        toast({
                                          title: "Version restored",
                                          description: `Restored to version from ${new Date(selectedVersion.created_at).toLocaleString()}`,
                                          className: "bg-green-600"
                                        });
                                        updateContent(selectedVersion.content);
                                        setOriginalContent(selectedVersion.content);
                                        setSelectedVersion(null);
                                      } else {
                                        toast({
                                          title: "Restore failed",
                                          description: "Failed to restore the selected version",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Restore
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Scrollable Content Area */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Version Preview */}
                            <div className="border border-editor-border rounded-lg overflow-hidden">
                              <div className="bg-editor-panel border-b border-editor-border px-4 py-2">
                                <h5 className="font-medium text-sm">Content Preview</h5>
                              </div>
                              <div className="p-4 max-h-64 overflow-y-auto bg-editor-background/50">
                                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                                  {selectedVersion.content || 'Empty file'}
                                </pre>
                              </div>
                            </div>

                            {/* Comparison with Current - Only if different */}
                            {selectedVersion.content !== content && (
                              <div className="border border-editor-border rounded-lg overflow-hidden">
                                <div className="bg-editor-panel border-b border-editor-border px-4 py-2">
                                  <h5 className="font-medium text-sm">Changes from This Version to Current</h5>
                                  <p className="text-xs text-muted-foreground">
                                    Showing differences between selected version and current content
                                  </p>
                                </div>
                                <div className="p-4">
                                  <GitStyleDiff
                                    originalContent={selectedVersion.content || ''}
                                    newContent={content || ''}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Same content message */}
                            {selectedVersion.content === content && (
                              <div className="border border-editor-border rounded-lg p-4 text-center">
                                <div className="text-muted-foreground">
                                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">This version is identical to the current content</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                          <div className="space-y-4">
                            <History className="h-12 w-12 mx-auto opacity-50" />
                            <div>
                              <h4 className="font-medium mb-2">Select a Version</h4>
                              <p className="text-sm">
                                Choose a version from the left panel to view its details and compare with current content
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                    <div className="space-y-4">
                      <History className="h-16 w-16 mx-auto opacity-50" />
                      <div>
                        <h3 className="text-lg font-semibold mb-2">No History Available</h3>
                        <p>
                          No previous versions found for this file.<br />
                          Versions are created automatically when you save changes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default MarkdownEditor;