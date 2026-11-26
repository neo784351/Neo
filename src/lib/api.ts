import type {
  ChatMessage,
  ConversationItem,
  GeneratedImageItem,
  LibraryFileItem,
  MediaAttachment,
  ModelBackendInfo,
  NotificationItem,
  PluginItem,
  ProjectItem,
  ScheduledTaskItem,
  UsageStats,
  UserProfile,
} from '../types';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'NeoAI');
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Request failed (${res.status})`
    );
  }
  return data as T;
}

export async function streamSseRequest(
  url: string,
  body: Record<string, unknown>,
  onEvent: (evt: {
    type: 'text' | 'done' | 'error';
    text?: string;
    error?: string;
    userMessageId?: string;
    assistantMessageId?: string;
    providerId?: string;
    modelId?: string;
  }) => void
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'NeoAI',
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    onEvent({
      type: 'error',
      error: (errBody as { error?: string }).error || `Request failed (${res.status})`,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr));
      } catch {
        // Skip malformed chunk
      }
    }
  }
}

export const api = {
  getAuthProviders: () =>
    apiFetch<{
      emailEnabled: boolean;
      googleConfigured: boolean;
      appleConfigured: boolean;
      billingConfigured: boolean;
    }>('/api/auth/providers'),

  register: (payload: {
    email: string;
    phone?: string;
    username: string;
    password: string;
    rememberMe?: boolean;
  }) =>
    apiFetch<{ token: string; user: UserProfile; usage: UsageStats }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { identifier: string; password: string; rememberMe?: boolean }) =>
    apiFetch<{ token: string; user: UserProfile; usage: UsageStats }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ sent: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getMe: () => apiFetch<{ user: UserProfile; usage: UsageStats }>('/api/auth/me'),

  updateProfile: (payload: Partial<UserProfile>) =>
    apiFetch<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBackends: () => apiFetch<{ backends: ModelBackendInfo[] }>('/api/ai/backends'),
  getUsage: () => apiFetch<{ usage: UsageStats }>('/api/usage'),

  getNotifications: () =>
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
  markAllNotificationsRead: () =>
    apiFetch<{ ok: boolean }>('/api/notifications/read-all', { method: 'PATCH' }),

  globalSearch: (q: string) =>
    apiFetch<{
      conversations: ConversationItem[];
      images: GeneratedImageItem[];
      files: LibraryFileItem[];
      projects: ProjectItem[];
    }>(`/api/search?q=${encodeURIComponent(q)}`),

  getConversations: (q = '', projectId = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return apiFetch<{ conversations: ConversationItem[] }>(
      `/api/conversations${qs ? `?${qs}` : ''}`
    );
  },

  createConversation: (title = 'New Conversation', toolId = 'ai-chat', projectId?: string) =>
    apiFetch<{ conversation: ConversationItem }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, toolId, projectId }),
    }),

  getConversation: (id: string) =>
    apiFetch<{ conversation: ConversationItem; messages: ChatMessage[] }>(
      `/api/conversations/${encodeURIComponent(id)}`
    ),

  updateConversation: (
    id: string,
    patch: { title?: string; isFavorite?: boolean; isSaved?: boolean; projectId?: string | null }
  ) =>
    apiFetch<{ conversation: ConversationItem }>(
      `/api/conversations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),

  deleteConversation: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  setMessageFeedback: (messageId: string, feedback: 'like' | 'dislike' | null) =>
    apiFetch<{ ok: boolean }>(`/api/messages/${encodeURIComponent(messageId)}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    }),

  streamChat: (
    conversationId: string,
    payload: {
      message: string;
      attachments?: MediaAttachment[];
      backendKey?: string;
      systemInstruction?: string;
    },
    onEvent: Parameters<typeof streamSseRequest>[2]
  ) =>
    streamSseRequest(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages/stream`,
      payload,
      onEvent
    ),

  regenerateChat: (
    conversationId: string,
    backendKey: string | undefined,
    onEvent: Parameters<typeof streamSseRequest>[2]
  ) =>
    streamSseRequest(
      `/api/conversations/${encodeURIComponent(conversationId)}/regenerate`,
      { backendKey },
      onEvent
    ),

  streamTool: (
    payload: { toolId: string; input: string; targetLanguage?: string; backendKey?: string },
    onEvent: Parameters<typeof streamSseRequest>[2]
  ) => streamSseRequest('/api/tools/run/stream', payload, onEvent),

  generateImage: (payload: {
    prompt: string;
    style: string;
    aspectRatio: string;
    backendKey?: string;
    count?: number;
  }) =>
    apiFetch<{ image: GeneratedImageItem; images: GeneratedImageItem[] }>(
      '/api/images/generate',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  getImageHistory: () => apiFetch<{ images: GeneratedImageItem[] }>('/api/images/history'),

  updateImage: (id: string, patch: { isFavorite?: boolean; savedToLibrary?: boolean }) =>
    apiFetch<{ ok: boolean }>(`/api/images/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteImage: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/images/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getLibrary: () =>
    apiFetch<{
      conversations: ConversationItem[];
      images: GeneratedImageItem[];
      files: LibraryFileItem[];
    }>('/api/library'),

  uploadFile: (payload: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    category?: 'document' | 'file' | 'note';
    contentDataUrl: string;
    projectId?: string;
  }) =>
    apiFetch<{ file: LibraryFileItem }>('/api/files', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateFile: (id: string, patch: { isFavorite?: boolean; projectId?: string | null }) =>
    apiFetch<{ ok: boolean }>(`/api/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteFile: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getProjects: () => apiFetch<{ projects: ProjectItem[] }>('/api/projects'),
  createProject: (payload: { name: string; description?: string; icon?: string }) =>
    apiFetch<{ project: ProjectItem }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProjectDetails: (id: string) =>
    apiFetch<{
      project: ProjectItem;
      conversations: ConversationItem[];
      files: LibraryFileItem[];
    }>(`/api/projects/${encodeURIComponent(id)}`),
  updateProject: (id: string, patch: { name?: string; description?: string; icon?: string }) =>
    apiFetch<{ project: ProjectItem }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getTasks: () => apiFetch<{ tasks: ScheduledTaskItem[] }>('/api/tasks'),
  createTask: (payload: { title: string; prompt: string; scheduleLabel?: string }) =>
    apiFetch<{ task: ScheduledTaskItem }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTask: (
    id: string,
    patch: { enabled?: boolean; title?: string; prompt?: string; scheduleLabel?: string }
  ) =>
    apiFetch<{ task: ScheduledTaskItem }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  runTask: (id: string) =>
    apiFetch<{ task: ScheduledTaskItem }>(`/api/tasks/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    }),
  deleteTask: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getPlugins: () => apiFetch<{ plugins: PluginItem[] }>('/api/plugins'),
  togglePlugin: (id: string, enabled: boolean) =>
    apiFetch<{ ok: boolean; enabled: boolean }>(`/api/plugins/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  transcribeAudio: (audioBase64: string, mimeType: string) =>
    apiFetch<{ text: string; providerId: string }>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mimeType }),
    }),

  generateSpeech: (text: string, voice?: string) =>
    apiFetch<{ audioDataUrl: string; mimeType: string; providerId: string }>('/api/ai/tts', {
      method: 'POST',
      body: JSON.stringify({ text, voice }),
    }),
};
