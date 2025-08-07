-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create files table
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT DEFAULT ''::text,
  file_type TEXT DEFAULT 'markdown'::text,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collaborators table
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor'::text CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create file versions table for tracking changes
CREATE TABLE public.file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  change_summary TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view workspaces they own or collaborate on"
ON public.workspaces FOR SELECT
USING (
  owner_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.collaborators WHERE workspace_id = workspaces.id AND user_id = auth.uid())
);

CREATE POLICY "Users can create workspaces"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Workspace owners can update their workspaces"
ON public.workspaces FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Workspace owners can delete their workspaces"
ON public.workspaces FOR DELETE
USING (owner_id = auth.uid());

-- Files policies
CREATE POLICY "Users can view files in accessible workspaces"
ON public.files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = files.workspace_id 
    AND (w.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);

CREATE POLICY "Editors can create files"
ON public.files FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = files.workspace_id 
    AND (w.owner_id = auth.uid() OR (c.user_id = auth.uid() AND c.role IN ('editor', 'owner')))
  )
);

CREATE POLICY "Editors can update files"
ON public.files FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = files.workspace_id 
    AND (w.owner_id = auth.uid() OR (c.user_id = auth.uid() AND c.role IN ('editor', 'owner')))
  )
);

CREATE POLICY "Owners and editors can delete files"
ON public.files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = files.workspace_id 
    AND (w.owner_id = auth.uid() OR (c.user_id = auth.uid() AND c.role IN ('editor', 'owner')))
  )
);

-- Collaborators policies
CREATE POLICY "Users can view collaborators in accessible workspaces"
ON public.collaborators FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    WHERE w.id = collaborators.workspace_id 
    AND (w.owner_id = auth.uid() OR user_id = auth.uid())
  )
);

CREATE POLICY "Workspace owners can manage collaborators"
ON public.collaborators FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    WHERE w.id = collaborators.workspace_id AND w.owner_id = auth.uid()
  )
);

-- Chat messages policies
CREATE POLICY "Users can view messages in accessible workspaces"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = chat_messages.workspace_id 
    AND (w.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages to accessible workspaces"
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.workspaces w 
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE w.id = chat_messages.workspace_id 
    AND (w.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);

-- File versions policies
CREATE POLICY "Users can view versions of accessible files"
ON public.file_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files f
    JOIN public.workspaces w ON f.workspace_id = w.id
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE f.id = file_versions.file_id 
    AND (w.owner_id = auth.uid() OR c.user_id = auth.uid())
  )
);

CREATE POLICY "Users can create file versions"
ON public.file_versions FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.files f
    JOIN public.workspaces w ON f.workspace_id = w.id
    LEFT JOIN public.collaborators c ON w.id = c.workspace_id 
    WHERE f.id = file_versions.file_id 
    AND (w.owner_id = auth.uid() OR (c.user_id = auth.uid() AND c.role IN ('editor', 'owner')))
  )
);

-- Create function for updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();