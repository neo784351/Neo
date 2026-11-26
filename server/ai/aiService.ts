import type { BaseAIProvider } from './baseProvider.ts';
import { GeminiProvider } from './providers/geminiProvider.ts';
import { OpenAICompatibleProvider } from './providers/openaiCompatibleProvider.ts';
import type {
  AICapability,
  ChatRequest,
  ChatStreamChunk,
  ImageGenRequest,
  ImageGenResponse,
  ModelBackendInfo,
  TranscribeRequest,
  TranscribeResponse,
  TTSRequest,
  TTSResponse,
  WriterRequest,
  WriterResponse,
} from './types.ts';

class AIServiceRegistry {
  private providers = new Map<string, BaseAIProvider>();

  constructor() {
    this.register(new GeminiProvider());
    this.register(new OpenAICompatibleProvider());
  }

  register(provider: BaseAIProvider): void {
    this.providers.set(provider.id, provider);
  }

  listBackends(capability?: AICapability): ModelBackendInfo[] {
    const all: ModelBackendInfo[] = [];
    for (const provider of this.providers.values()) {
      for (const model of provider.getSupportedModels()) {
        if (!capability || model.capabilities.includes(capability)) {
          all.push(model);
        }
      }
    }
    return all;
  }

  resolveBackend(
    backendKey: string | undefined,
    fallbackKey: string
  ): { provider: BaseAIProvider; modelId: string; providerId: string } {
    const candidate = backendKey && backendKey.includes(':') ? backendKey : fallbackKey;
    const colonIdx = candidate.indexOf(':');
    const providerId = colonIdx >= 0 ? candidate.slice(0, colonIdx) : 'gemini';
    const modelId = colonIdx >= 0 ? candidate.slice(colonIdx + 1) : candidate;

    const provider = this.providers.get(providerId) ?? this.providers.get('gemini');
    if (!provider) {
      throw new Error('No AI providers are registered.');
    }

    return { provider, modelId, providerId: provider.id };
  }

  async streamChat(
    backendKey: string | undefined,
    req: Omit<ChatRequest, 'modelId'>,
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<{ providerId: string; modelId: string }> {
    const { provider, modelId, providerId } = this.resolveBackend(
      backendKey,
      'gemini:gemini-4-hydrogen'
    );
    await provider.streamChat({ ...req, modelId }, onChunk);
    return { providerId, modelId };
  }

  async generateWriter(
    backendKey: string | undefined,
    req: Omit<WriterRequest, 'modelId'>
  ): Promise<WriterResponse> {
    const { provider, modelId } = this.resolveBackend(
      backendKey,
      'gemini:gemini-4-hydrogen'
    );
    return provider.generateWriter({ ...req, modelId });
  }

  async generateImage(
    backendKey: string | undefined,
    req: Omit<ImageGenRequest, 'modelId'>
  ): Promise<ImageGenResponse> {
    const configuredImageModel = this.listBackends('image').find((b) => b.configured);
    const fallback = configuredImageModel?.backendKey || 'openai-compatible:dall-e-3';
    const selected =
      backendKey && !backendKey.startsWith('gemini:') ? backendKey : fallback;
    const { provider, modelId } = this.resolveBackend(selected, fallback);
    return provider.generateImage({ ...req, modelId });
  }

  async generateSpeech(req: TTSRequest): Promise<TTSResponse> {
    const provider = this.providers.get('gemini');
    if (!provider) throw new Error('Speech provider unavailable.');
    return provider.generateSpeech(req);
  }

  async transcribeAudio(req: TranscribeRequest): Promise<TranscribeResponse> {
    const provider = this.providers.get('gemini');
    if (!provider) throw new Error('Transcription provider unavailable.');
    return provider.transcribeAudio(req);
  }
}

export const aiService = new AIServiceRegistry();
