import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { chatWithWorkspaceAgent, getWorkspaceAgentStatus, getWorkspaceFiles } from '@/services/agentApi';
import { Bot, Users, Send, MessageSquare, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  is_ai: boolean;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
}

interface AIMessage {
  id: string;
  content: string;
  is_ai: boolean;
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

interface ChatSidebarProps {
  workspaceId: string | null;
  activeFile?: File | null;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ workspaceId, activeFile }) => {
  const [teamMessages, setTeamMessages] = useState<ChatMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('ai');
  const [selectedModel, setSelectedModel] = useState('llama3-70b-8192');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<any>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [isLoadingWorkspaceInfo, setIsLoadingWorkspaceInfo] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Available AI models (Groq API)
  const aiModels = [
    // Llama Models
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Versatile)', category: 'Llama' },
    { value: 'llama-3.2-90b-text-preview', label: 'Llama 3.2 90B (Preview)', category: 'Llama' },
    { value: 'llama-3.2-11b-text-preview', label: 'Llama 3.2 11B (Preview)', category: 'Llama' },
    { value: 'llama-3.2-3b-preview', label: 'Llama 3.2 3B (Preview)', category: 'Llama' },
    { value: 'llama-3.2-1b-preview', label: 'Llama 3.2 1B (Preview)', category: 'Llama' },
    { value: 'llama3-groq-70b-8192-tool-use-preview', label: 'Llama 3 Groq 70B (Tool Use)', category: 'Llama' },
    { value: 'llama3-groq-8b-8192-tool-use-preview', label: 'Llama 3 Groq 8B (Tool Use)', category: 'Llama' },
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B (Versatile)', category: 'Llama' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Instant)', category: 'Llama' },
    { value: 'llama3-70b-8192', label: 'Llama 3 70B', category: 'Llama' },
    { value: 'llama3-8b-8192', label: 'Llama 3 8B', category: 'Llama' },

    // Mixtral Models
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', category: 'Mixtral' },

    // Gemma Models
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B (Instruct)', category: 'Gemma' },
    { value: 'gemma-7b-it', label: 'Gemma 7B (Instruct)', category: 'Gemma' },

    // Specialized Models
    { value: 'whisper-large-v3', label: 'Whisper Large v3 (Audio)', category: 'Audio' },
    { value: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo', category: 'Audio' },
    { value: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11B (Vision)', category: 'Vision' },
    { value: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B (Vision)', category: 'Vision' },

    // Legacy/Other Models
    { value: 'distil-whisper-large-v3-en', label: 'Distil Whisper Large v3', category: 'Audio' }
  ];

  // Helper function to generate user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  // Helper function to generate consistent color for user
  const getUserColor = (userId: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500'
    ];

    // Generate a consistent index based on userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Helper function to fetch user info for a message
  const fetchUserInfo = async (senderId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', senderId)
      .single();

    if (error) {
      console.error('Error fetching user info:', error);
      return { name: 'Unknown', email: null };
    }

    return {
      name: data.name || data.email?.split('@')[0] || 'Unknown',
      email: data.email
    };
  };

  // Check if current user is workspace owner
  const checkOwnership = async () => {
    if (!workspaceId || !user) {
      console.log('No workspace or user, setting isOwner to false');
      setIsOwner(false);
      return;
    }

    console.log('Checking ownership for workspace:', workspaceId, 'user:', user.id);

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

      console.log('Ownership check result:', { data, error });

      if (error) {
        console.error('Error checking workspace ownership:', error);
        setIsOwner(false);
        return;
      }

      const isOwnerResult = data.owner_id === user.id;
      console.log('Is owner?', isOwnerResult, 'Owner ID:', data.owner_id, 'User ID:', user.id);
      setIsOwner(isOwnerResult);
    } catch (error) {
      console.error('Error in checkOwnership:', error);
      setIsOwner(false);
    }
  };

  // Clear all chat messages (owner only)
  const clearChat = async () => {
    if (!workspaceId || !user || !isOwner) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "Only workspace owners can clear chat messages."
      });
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to clear all chat messages? This action cannot be undone."
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('is_ai', false); // Only clear team messages, not AI messages

      if (error) {
        console.error('Error clearing chat:', error);
        toast({
          variant: "destructive",
          title: "Clear failed",
          description: `Failed to clear chat: ${error.message}`
        });
        return;
      }

      toast({
        title: "Chat cleared",
        description: "All team chat messages have been cleared successfully."
      });

      // Messages will be cleared automatically via real-time subscription
    } catch (error) {
      console.error('Error in clearChat:', error);
      toast({
        variant: "destructive",
        title: "Clear failed",
        description: "An unexpected error occurred while clearing chat."
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Load workspace info (status and files)
  const loadWorkspaceInfo = async () => {
    if (!workspaceId) return;

    setIsLoadingWorkspaceInfo(true);
    try {
      // Load workspace status and files in parallel
      const [statusResponse, filesResponse] = await Promise.all([
        getWorkspaceAgentStatus(workspaceId).catch(err => {
          console.error('Failed to load workspace status:', err);
          return null;
        }),
        getWorkspaceFiles(workspaceId).catch(err => {
          console.error('Failed to load workspace files:', err);
          return { files: [] };
        })
      ]);

      setWorkspaceStatus(statusResponse);
      setWorkspaceFiles(filesResponse?.files || []);

      // Add initial welcome message with workspace info
      if (aiMessages.length === 0) {
        const welcomeMessage = createWelcomeMessage(statusResponse, filesResponse?.files || []);
        setAiMessages([{
          id: 'welcome',
          content: welcomeMessage,
          is_ai: true,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error loading workspace info:', error);
    } finally {
      setIsLoadingWorkspaceInfo(false);
    }
  };

  // Create welcome message with workspace info
  const createWelcomeMessage = (status: any, files: any[]) => {
    const fileCount = files.length;
    const fileTypes = [...new Set(files.map(f => f.file_type || 'unknown'))].join(', ');

    let message = `👋 Hello! I'm your AI workspace assistant.\n\n`;
    message += `📊Workspace Status:\n`;
    message += `• Agent Status: ${status?.status || 'Unknown'}\n`;
    message += `• Agent Type: ${status?.agent_type || 'supabase_graph_based'}\n\n`;
    message += `📁 Available Files: ${fileCount} files\n`;

    if (fileCount > 0) {
      message += `• File Types: ${fileTypes}\n`;
      message += `• Recent Files:\n`;
      files.slice(0, 5).forEach(file => {
        message += `  - ${file.filename}\n`;
      });
      if (fileCount > 5) {
        message += `  ... and ${fileCount - 5} more files\n`;
      }
    }

    message += `\n💡What I can help with:\n`;
    message += `• View and analyze your files\n`;
    message += `• Edit and update content\n`;
    message += `• Search through documents\n`;
    message += `• Answer questions about your workspace\n\n`;
    message += `Just ask me anything about your files or request edits!`;

    return message;
  };

  useEffect(() => {
    if (workspaceId) {
      fetchTeamMessages();
      checkOwnership();
      loadWorkspaceInfo();

      // Subscribe to real-time team messages
      const channel = supabase
        .channel(`workspace-${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `workspace_id=eq.${workspaceId}`
          },
          async (payload) => {
            const newMessage = payload.new as ChatMessage;

            // Fetch user info for the new message
            const userInfo = await fetchUserInfo(newMessage.sender_id);
            const messageWithSender = {
              ...newMessage,
              sender_name: userInfo.name,
              sender_email: userInfo.email
            };

            // Avoid duplicate messages by checking if message already exists
            setTeamMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, messageWithSender];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages',
            filter: `workspace_id=eq.${workspaceId}`
          },
          (payload) => {
            const updatedMessage = payload.new as ChatMessage;
            setTeamMessages(prev =>
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'chat_messages',
            filter: `workspace_id=eq.${workspaceId}`
          },
          (payload) => {
            const deletedMessage = payload.old as ChatMessage;
            setTeamMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // Clear messages when no workspace is selected
      setTeamMessages([]);
      setAiMessages([]);
      setWorkspaceStatus(null);
      setWorkspaceFiles([]);
    }
  }, [workspaceId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [teamMessages, aiMessages]);

  const fetchTeamMessages = async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      // First, fetch the messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_ai', false)
        .order('created_at', { ascending: true });

      if (messagesError) {
        toast({
          variant: "destructive",
          title: "Error fetching messages",
          description: messagesError.message
        });
        return;
      }

      if (!messagesData || messagesData.length === 0) {
        setTeamMessages([]);
        return;
      }

      // Get unique sender IDs
      const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];

      // Fetch user data for all senders
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', senderIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        // Still show messages even if user data fails
        const messagesWithFallback = messagesData.map(msg => ({
          ...msg,
          sender_name: 'Unknown',
          sender_email: null
        }));
        setTeamMessages(messagesWithFallback);
        return;
      }

      // Create a map of user data for quick lookup
      const usersMap = new Map(
        (usersData || []).map(user => [
          user.id,
          {
            name: user.name || user.email?.split('@')[0] || 'Unknown',
            email: user.email
          }
        ])
      );

      // Combine messages with user data
      const messagesWithSender = messagesData.map(msg => ({
        ...msg,
        sender_name: usersMap.get(msg.sender_id)?.name || 'Unknown',
        sender_email: usersMap.get(msg.sender_id)?.email || null
      }));

      setTeamMessages(messagesWithSender);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        variant: "destructive",
        title: "Error fetching messages",
        description: "Failed to load chat messages"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !workspaceId || !user) return;

    const messageContent = newMessage;
    setNewMessage('');

    if (activeTab === 'team') {
      // Send team message
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          workspace_id: workspaceId,
          sender_id: user.id,
          content: messageContent,
          is_ai: false
        }]);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error sending message",
          description: error.message
        });
        return;
      }
    } else if (activeTab === 'ai') {
      // Send AI message
      setIsAiLoading(true);

      // Add user message to AI chat
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        content: messageContent,
        is_ai: false,
        created_at: new Date().toISOString()
      };

      setAiMessages(prev => [...prev, userMessage]);

      try {
        // Call the workspace agent API with selected model and active file context
        const response = await chatWithWorkspaceAgent(
          messageContent,
          workspaceId,
          selectedModel,
          activeFile?.filename
        );

        // Add AI response to chat
        const aiMessage: AIMessage = {
          id: `ai-${Date.now()}`,
          content: response.response || 'I received your message but couldn\'t generate a response.',
          is_ai: true,
          created_at: new Date().toISOString()
        };

        setAiMessages(prev => [...prev, aiMessage]);

      } catch (error) {
        console.error('AI chat error:', error);

        // Add error message to chat
        const errorMessage: AIMessage = {
          id: `error-${Date.now()}`,
          content: 'Sorry, I encountered an error while processing your request. Please try again.',
          is_ai: true,
          created_at: new Date().toISOString()
        };

        setAiMessages(prev => [...prev, errorMessage]);

        toast({
          variant: "destructive",
          title: "AI Chat Error",
          description: "Failed to get response from AI assistant"
        });
      } finally {
        setIsAiLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!workspaceId) {
    return (
      <div className="h-full bg-editor-sidebar border-l border-editor-border flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No workspace selected</h3>
            <p className="text-muted-foreground text-sm">
              Select a workspace to start chatting with AI and team members
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render AI Chat Content
  const renderAIChat = () => (
    <>
      {/* AI Header with Model Selection - Fixed at top */}
      <div className="flex-shrink-0 p-4 border-b border-editor-border bg-editor-panel">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Bot className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs text-muted-foreground">
                Chat with AI about your workspace files
              </p>
            </div>
          </div>
        </div>

        {/* Active File Indicator */}
        {activeFile && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Active File: {activeFile.filename}
              </span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              AI has context about this document
            </p>
          </div>
        )}

        {/* Model Selection */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground">Model:</span>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aiModels.map((model) => (
                <SelectItem key={model.value} value={model.value} className="text-xs">
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        {aiMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="text-center space-y-4 p-6">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                <p className="text-muted-foreground text-sm">
                  Ask me about your workspace files, request edits, or get help with your content.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {aiMessages.map((message) => (
              <div key={message.id} className={`flex items-start space-x-3 ${!message.is_ai ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className="flex flex-col items-center space-y-1">
                  <Avatar className={`h-8 w-8 ${message.is_ai ? 'bg-blue-500' : 'bg-green-500'} text-white`}>
                    <AvatarFallback className={`${message.is_ai ? 'bg-blue-500' : 'bg-green-500'} text-white text-xs font-semibold`}>
                      {message.is_ai ? <Bot className="h-4 w-4" /> : 'You'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {message.is_ai ? 'AI' : 'You'}
                  </span>
                </div>
                <Card className={`max-w-[70%] p-3 ${!message.is_ai
                  ? 'bg-primary/10 border-primary/20 ml-auto'
                  : 'bg-editor-panel border-editor-border'
                  }`}>
                  {message.is_ai ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:mb-2 prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-3 prose-li:my-0.5 prose-ul:mb-2 prose-ol:mb-2 prose-pre:mb-2 prose-blockquote:mb-2">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 leading-relaxed text-sm">{children}</p>,
                          h1: ({ children }) => <h1 className="text-base font-semibold mb-2 mt-3">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 mt-3">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-medium mb-2 mt-3">{children}</h3>,
                          ul: ({ children }) => <ul className="mb-2 pl-4 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-2 pl-4 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          code: ({ children, className }) => {
                            const isInline = !className;
                            return isInline ?
                              <code className="px-1 py-0.5 bg-gray-700 rounded text-xs font-mono">{children}</code> :
                              <code className={`${className} text-xs`}>{children}</code>;
                          },
                          pre: ({ children }) => (
                            <pre className="mb-2 p-3 bg-gray-800 rounded text-xs overflow-x-auto">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="mb-2 pl-3 border-l-2 border-gray-500 text-gray-300 italic">
                              {children}
                            </blockquote>
                          ),
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </Card>
              </div>
            ))}
            {isAiLoading && (
              <div className="flex items-start space-x-3">
                <Avatar className="h-8 w-8 bg-blue-500 text-white">
                  <AvatarFallback className="bg-blue-500 text-white">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="bg-editor-panel border-editor-border p-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* AI Input - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-editor-border bg-editor-panel">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask AI about your workspace files..."
            className="bg-input border-editor-border"
            disabled={isAiLoading}
          />
          <Button
            onClick={sendMessage}
            size="sm"
            disabled={!newMessage.trim() || isAiLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  // Render Team Chat Content
  const renderTeamChat = () => (
    <>
      {/* Team Header - Fixed at top */}
      <div className="flex-shrink-0 p-4 border-b border-editor-border bg-editor-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-accent/20">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Team Chat</h3>
              <p className="text-xs text-muted-foreground">
                Collaborate with your team members
              </p>
            </div>
          </div>

          {/* Owner-only actions */}
          {isOwner && (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={isClearing}
                className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20"
                title="Clear all chat messages"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isClearing ? 'Clearing...' : 'Clear'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {teamMessages.filter(msg => !msg.is_ai).map((message) => {
              const isCurrentUser = message.sender_id === user?.id;
              const senderName = message.sender_name || 'Unknown';
              const userInitials = getUserInitials(senderName);
              const userColor = getUserColor(message.sender_id);

              return (
                <div key={message.id} className={`flex items-start space-x-3 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className="flex flex-col items-center space-y-1">
                    <Avatar className={`h-8 w-8 ${userColor} text-white`}>
                      <AvatarFallback className={`${userColor} text-white text-xs font-semibold`}>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[60px]" title={senderName}>
                      {senderName}
                    </span>
                  </div>
                  <Card className={`max-w-[70%] p-3 ${isCurrentUser
                    ? 'bg-primary/10 border-primary/20 ml-auto'
                    : 'bg-editor-panel border-editor-border'
                    }`}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </Card>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-editor-border bg-editor-panel">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Message your team..."
            className="bg-input border-editor-border"
          />
          <Button
            onClick={sendMessage}
            size="sm"
            disabled={!newMessage.trim()}
            className="bg-gradient-accent hover:shadow-glow transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-full bg-editor-sidebar border-l border-editor-border flex flex-col">
      {/* Tab Header */}
      <div className="flex border-b border-editor-border bg-editor-panel">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ai'
            ? 'border-blue-500 text-blue-500 bg-editor-tab-active'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-editor-tab-hover'
            }`}
        >
          <Bot className="h-4 w-4 mr-2" />
          AI Assistant
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'team'
            ? 'border-accent text-accent bg-editor-tab-active'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-editor-tab-hover'
            }`}
        >
          <Users className="h-4 w-4 mr-2" />
          Team Chat
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'ai' ? renderAIChat() : renderTeamChat()}
    </div>
  );
};

export default ChatSidebar;