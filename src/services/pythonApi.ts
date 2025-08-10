import { supabase } from '@/integrations/supabase/client';

const PYTHON_API_BASE_URL = 'http://localhost:8000';

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

// Upload file to Python backend
export const uploadFile = async (file: File, workspaceId?: string): Promise<any> => {
    const token = await getAuthToken();

    const formData = new FormData();
    formData.append('file', file);

    // Add workspace ID if provided
    if (workspaceId) {
        formData.append('workspace_id', workspaceId);
    }

    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${PYTHON_API_BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
};

// Index documents for embedding
export const indexDocuments = async (workspaceId?: string): Promise<any> => {
    const headers = await createAuthHeaders();

    const body: any = {};
    if (workspaceId) {
        body.workspace_id = workspaceId;
    }

    const response = await fetch(`${PYTHON_API_BASE_URL}/index`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Indexing failed: ${response.statusText}`);
    }

    return response.json();
};

// Get indexing status
export const getIndexingStatus = async (): Promise<any> => {
    const headers = await createAuthHeaders();

    const response = await fetch(`${PYTHON_API_BASE_URL}/index/status`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
    }

    return response.json();
};

