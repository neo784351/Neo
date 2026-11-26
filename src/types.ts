export type ThemeMode = 'light' | 'dark' | 'system';

export type ScreenId =
  | 'home'
  | 'chat'
  | 'search'
  | 'image-gen'
  | 'library'
  | 'projects'
  | 'scheduled'
  | 'plugins'
  | 'voice'
  | 'profile'
  | 'settings'
  | 'premium';

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  username: string;
  avatarUrl: string;
  plan: string;
  theme: ThemeMode;
  language: string;
  notificationsEnabled: boolean;
  soundEffectsEnabled: boolean;
  preferredChatBackend: string;
  preferredImageBackend: string;
  preferredWriterBackend: string;
  preferredVoice: string;
  autoSpeakVoice: boolean;
  streamResponses: boolean;
  createdAt: string;
}

export interface UsageStats {
  totalChats: number;
  totalResponses: number;
  totalImages: number;
  totalWritings: number;
  totalProjects: number;
}

export interface ModelBackendInfo {
  backendKey: string;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  capabilities: Array<'chat' | 'image' | 'writer' | 'tts' | 'transcribe'>;
  configured: boolean;
  requiresPaidKey?: boolean;
  description: string;
}

export interface MediaAttachment {
  mimeType: string;
  data: string;
  name?: string;
}

export interface ConversationItem {
  id: string;
  user_id: string;
  title: string;
  tool_id: string;
  project_id?: string | null;
  is_favorite?: number;
  is_saved?: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MediaAttachment[];
  feedback?: 'like' | 'dislike' | null;
  providerId?: string;
  modelId?: string;
  createdAt: string;
}

export interface GeneratedImageItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageDataUrl: string;
  providerId: string;
  modelId: string;
  isFavorite?: boolean;
  savedToLibrary?: boolean;
  createdAt: string;
}

export interface LibraryFileItem {
  id: string;
  user_id: string;
  project_id?: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  category: 'document' | 'file' | 'note';
  content_data_url: string;
  is_favorite: number;
  created_at: string;
}

export interface ProjectItem {
  id: string;
  user_id: string;
  name: string;
  description: string;
  icon: string;
  conversationCount?: number;
  fileCount?: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskItem {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  schedule_label: string;
  enabled: number;
  last_output?: string | null;
  last_run_at?: string | null;
  created_at: string;
}

export interface PluginItem {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: number;
  created_at: string;
}

export const GENERATED_ASSETS = {
  whiteMascot: '/src/assets/images/neo_white_mascot_1795701072105.jpg',
  robotCompanion: '/src/assets/images/neo_robot_companion_1795613980484.jpg',
  creativeOrb: '/src/assets/images/neo_creative_orb_1795613980243.jpg',
  workflowGlass: '/src/assets/images/neo_workflow_glass_1795613980789.jpg',
  userAvatar: '/src/assets/images/neo_user_avatar_1795613981660.jpg',
} as const;
