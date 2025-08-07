import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Users, Send, Sparkles, MessageSquare, Settings, Zap } from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  is_ai: boolean;
  created_at: string;
}

interface ChatSidebarProps {
  workspaceId: string | null;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ workspaceId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('ai');
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (workspaceId) {
      fetchMessages();
      
      // Subscribe to real-time messages
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
          (payload) => {
            setMessages(prev => [...prev, payload.new as ChatMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [workspaceId]);

  const fetchMessages = async () => {
    if (!workspaceId) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching messages",
        description: error.message
      });
    } else {
      setMessages(data || []);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !workspaceId || !user) return;

    const messageContent = newMessage;
    setNewMessage('');

    // Send user message
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

    // Simulate AI response for demo
    if (activeTab === 'ai') {
      setIsTyping(true);
      setTimeout(async () => {
        const aiResponses = [
          "I can help you improve this document. Would you like me to suggest some edits?",
          "Based on the content, I recommend adding more examples and clarifying the main points.",
          "I notice you're working on a technical document. I can help with structure and clarity.",
          "Great progress! Would you like me to help with proofreading or content suggestions?",
          "I can generate additional sections or help refine the existing content. What would you prefer?"
        ];
        
        const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        
        await supabase
          .from('chat_messages')
          .insert([{
            workspace_id: workspaceId,
            sender_id: user.id, // In a real app, this would be the AI user ID
            content: randomResponse,
            is_ai: true
          }]);
          
        setIsTyping(false);
      }, 1500);
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

  return (
    <div className="h-full bg-editor-sidebar border-l border-editor-border flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start bg-editor-panel border-b border-editor-border rounded-none h-12">
          <TabsTrigger value="ai" className="data-[state=active]:bg-editor-tab-active">
            <Bot className="h-4 w-4 mr-2" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-editor-tab-active">
            <Users className="h-4 w-4 mr-2" />
            Team Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="flex-1 flex flex-col m-0 p-0">
          {/* AI Header */}
          <div className="p-4 border-b border-editor-border bg-gradient-ai">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-ai-primary/20">
                <Sparkles className="h-5 w-5 text-ai-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Assistant</h3>
                <p className="text-xs text-muted-foreground">
                  Get help with writing, editing, and content suggestions
                </p>
              </div>
            </div>
          </div>

          {/* AI Quick Actions */}
          <div className="p-4 border-b border-editor-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</p>
            <div className="grid grid-cols-1 gap-2">
              <Button variant="ghost" size="sm" className="justify-start h-8 text-xs">
                <Zap className="h-3 w-3 mr-2" />
                Improve writing
              </Button>
              <Button variant="ghost" size="sm" className="justify-start h-8 text-xs">
                <Settings className="h-3 w-3 mr-2" />
                Fix grammar
              </Button>
              <Button variant="ghost" size="sm" className="justify-start h-8 text-xs">
                <Bot className="h-3 w-3 mr-2" />
                Generate content
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.filter(msg => msg.is_ai || activeTab === 'ai').map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.is_ai ? '' : 'flex-row-reverse space-x-reverse'
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={message.is_ai ? 'bg-gradient-ai text-ai-primary' : 'bg-primary text-primary-foreground'}>
                      {message.is_ai ? <Bot className="h-4 w-4" /> : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Card className={`max-w-[80%] p-3 ${
                    message.is_ai 
                      ? 'bg-ai-background border-ai-primary/20' 
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </Card>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-ai text-ai-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="bg-ai-background border-ai-primary/20 p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-ai-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-ai-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-ai-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-editor-border">
            <div className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask AI anything..."
                className="bg-input border-editor-border"
              />
              <Button
                onClick={sendMessage}
                size="sm"
                disabled={!newMessage.trim()}
                className="bg-gradient-ai hover:shadow-ai transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team" className="flex-1 flex flex-col m-0 p-0">
          {/* Team Header */}
          <div className="p-4 border-b border-editor-border">
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
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.filter(msg => !msg.is_ai).map((message) => (
                <div key={message.id} className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <Card className="max-w-[80%] bg-editor-panel border-editor-border p-3">
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </Card>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-editor-border">
            <div className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatSidebar;