import type {
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

export interface ProviderErrorInfo {
  statusCode: number;
  message: string;
}

export abstract class BaseAIProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  abstract isConfigured(): boolean;
  abstract getSupportedModels(): ModelBackendInfo[];

  abstract streamChat(
    req: ChatRequest,
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<void>;

  abstract generateWriter(req: WriterRequest): Promise<WriterResponse>;

  abstract generateImage(req: ImageGenRequest): Promise<ImageGenResponse>;

  async generateSpeech(_req: TTSRequest): Promise<TTSResponse> {
    throw new Error(`${this.name} does not support text-to-speech.`);
  }

  async transcribeAudio(_req: TranscribeRequest): Promise<TranscribeResponse> {
    throw new Error(`${this.name} does not support audio transcription.`);
  }

  protected normalizeError(error: unknown): ProviderErrorInfo {
    if (error instanceof Error) {
      const msg = error.message || 'AI provider request failed.';
      const lower = msg.toLowerCase();
      if (
        lower.includes('api_key_invalid') ||
        lower.includes('api key not valid') ||
        lower.includes('401') ||
        lower.includes('403') ||
        lower.includes('permission_denied')
      ) {
        return {
          statusCode: 403,
          message:
            'API key missing or rejected by the AI provider. Check Settings > Secrets for a valid API key.',
        };
      }
      if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
        return {
          statusCode: 429,
          message:
            'Provider rate limit or quota reached. If using a paid-tier model (like image generation or Pro reasoning), select a billing-enabled key in Settings > Secrets.',
        };
      }
      if (lower.includes('404') || lower.includes('not_found')) {
        return {
          statusCode: 404,
          message: 'Requested model is unavailable on this provider.',
        };
      }
      return { statusCode: 500, message: msg };
    }
    return { statusCode: 500, message: String(error) };
  }
}
