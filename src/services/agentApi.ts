import { supabase } from '@/integrations/supabase/client';

const PYTHON_API_BASE_URL = 'https://docpilot-backend.onrender.com';

// Helper function to get the JWT token from Supabase
const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
};

// Helper function to create headers with JWT token
const createAuthHeaders = async (): Promise<HeadersInit> => {
    const token = await getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
};

// Chat with workspace agent
export const chatWithWorkspaceAgent = async (
    message: string,
    workspaceId: string,
    model?: string,
    filename?: string
): Promise<any> => {
    const headers = await createAuthHeaders();

    const body: any = {
        message,
        workspace_id: workspaceId
    };

    if (model) {
        body.model = model;
    }

    if (filename) {
        body.filename = filename;
    }

    const response = await fetch(`${PYTHON_API_BASE_URL}/api/workspace/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Workspace agent chat failed: ${response.statusText}`);
    }

    return response.json();
};

// Get workspace agent status
export const getWorkspaceAgentStatus = async (workspaceId: string): Promise<any> => {
    const headers = await createAuthHeaders();

    const response = await fetch(`${PYTHON_API_BASE_URL}/api/workspace/status/${workspaceId}`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Workspace agent status check failed: ${response.statusText}`);
    }

    return response.json();
};

// Get workspace files
export const getWorkspaceFiles = async (workspaceId: string): Promise<any> => {
    const headers = await createAuthHeaders();

    const response = await fetch(`${PYTHON_API_BASE_URL}/api/workspace/files/${workspaceId}`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Get workspace files failed: ${response.statusText}`);
    }

    return response.json();
};

// Get specific file content
export const getWorkspaceFile = async (workspaceId: string, filename: string): Promise<any> => {
    const headers = await createAuthHeaders();

    const response = await fetch(`${PYTHON_API_BASE_URL}/api/workspace/file/${workspaceId}/${filename}`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Get workspace file failed: ${response.statusText}`);
    }

    return response.json();
};