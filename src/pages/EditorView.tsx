import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import FileExplorer from '@/components/FileExplorer';
import MarkdownEditor from '@/components/MarkdownEditor';
import ChatSidebar from '@/components/ChatSidebar';
import { LogOut, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

const EditorView = () => {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();

  const handleFileUpdate = (updatedFile: File) => {
    setSelectedFile(updatedFile);
  };

  return (
    <div className="h-screen bg-editor-background flex flex-col">
      {/* Top Header */}
      <header className="h-12 bg-editor-panel border-b border-editor-border flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          )}
          <h1 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
            ScribeCollab
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.email}
          </span>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatOpen(!chatOpen)}
              className="lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <div className={`${
          isMobile ? (sidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-80' : 'hidden') : 'w-80'
        } ${isMobile ? 'lg:relative lg:block' : ''}`}>
          <FileExplorer
            selectedWorkspace={selectedWorkspace}
            onWorkspaceSelect={setSelectedWorkspace}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
        </div>

        {/* Main Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <MarkdownEditor
            file={selectedFile}
            onFileUpdate={handleFileUpdate}
          />
        </div>

        {/* Right Sidebar - Chat */}
        <div className={`${
          isMobile ? (chatOpen ? 'fixed inset-y-0 right-0 z-50 w-80' : 'hidden') : 'w-80'
        } ${isMobile ? 'lg:relative lg:block' : ''}`}>
          <ChatSidebar workspaceId={selectedWorkspace?.id || null} />
        </div>
      </div>

      {/* Mobile Overlays */}
      {isMobile && (sidebarOpen || chatOpen) && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setChatOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default EditorView;