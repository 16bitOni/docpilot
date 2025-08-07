import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Edit, Eye, GitBranch, Save, Clock, Users2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('edit');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setOriginalContent(file.content || '');
    }
  }, [file]);

  const saveFile = async () => {
    if (!file || !user || content === originalContent) return;

    setIsSaving(true);
    
    const { data, error } = await supabase
      .from('files')
      .update({ 
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', file.id)
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error saving file",
        description: error.message
      });
    } else {
      setOriginalContent(content);
      setLastSaved(new Date());
      onFileUpdate(data);
      
      // Create version entry
      await supabase.from('file_versions').insert([{
        file_id: file.id,
        content,
        version_number: Math.floor(Date.now() / 1000), // Simple versioning
        created_by: user.id
      }]);

      toast({
        title: "File saved",
        description: "Your changes have been saved successfully."
      });
    }
    
    setIsSaving(false);
  };

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
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Users2 className="h-4 w-4 mr-2" />
            Collaborators
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <GitBranch className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            onClick={saveFile}
            disabled={isSaving || !hasUnsavedChanges}
            size="sm"
            className="bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
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
          <TabsTrigger value="diff" className="data-[state=active]:bg-editor-tab-active">
            <GitBranch className="h-4 w-4 mr-2" />
            Diff
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="edit" className="h-full m-0 p-0">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your markdown content..."
              className="h-full w-full resize-none border-0 bg-editor-background rounded-none focus:ring-0 text-sm font-mono leading-relaxed p-6"
              style={{
                minHeight: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
              }}
            />
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0 p-0">
            <Card className="h-full bg-editor-background border-0 rounded-none">
              <div className="h-full overflow-auto p-6">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{content || '*No content to preview*'}</ReactMarkdown>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="diff" className="h-full m-0 p-0">
            <Card className="h-full bg-editor-background border-0 rounded-none">
              <div className="h-full overflow-auto p-6">
                <div className="text-center text-muted-foreground space-y-4 mt-20">
                  <GitBranch className="h-16 w-16 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Diff View</h3>
                    <p>
                      Advanced diff visualization coming soon.<br />
                      Compare changes between versions and collaborate with AI suggestions.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default MarkdownEditor;