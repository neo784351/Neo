export type AICapability = 'chat' | 'image' | 'writer' | 'tts' | 'transcribe';

export interface MediaAttachment {
  mimeType: string;
  data: string; // base64 string without data URL prefix
  name?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  attachments?: MediaAttachment[];
}

export interface ChatRequest {
  modelId: string;
  systemInstruction?: string;
  history: ChatTurn[];
  message: string;
  attachments?: MediaAttachment[];
  thinkingLevel?: 'low' | 'medium' | 'high';
}

export interface ChatStreamChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  error?: string;
  statusCode?: number;
  providerId?: string;
  modelId?: string;
}

export interface WriterRequest {
  modelId: string;
  category: string;
  topic: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  language?: string;
  extraContext?: string;
}

export interface WriterResponse {
  content: string;
  providerId: string;
  modelId: string;
  wordCount: number;
}

export interface ImageGenRequest {
  modelId: string;
  prompt: string;
  style: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}

export interface ImageGenResponse {
  imageDataUrl: string;
  mimeType: string;
  revisedPrompt?: string;
  providerId: string;
  modelId: string;
}

export interface TTSRequest {
  modelId?: string;
  text: string;
  voice?: string;
  style?: string;
}

export interface TTSResponse {
  audioDataUrl: string;
  mimeType: string;
  providerId: string;
}

export interface TranscribeRequest {
  modelId?: string;
  audioBase64: string;
  mimeType: string;
}

export interface TranscribeResponse {
  text: string;
  providerId: string;
}

export interface ModelBackendInfo {
  backendKey: string; // "<providerId>:<modelId>"
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  capabilities: AICapability[];
  configured: boolean;
  requiresPaidKey?: boolean;
  description: string;
}
