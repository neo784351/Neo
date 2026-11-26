import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import { BaseAIProvider } from '../baseProvider.ts';
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
} from '../types.ts';

export class GeminiProvider extends BaseAIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  isConfigured(): boolean {
    const apiKey = process.env.GEMINI_API_KEY;
    return Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY');
  }

  getSupportedModels(): ModelBackendInfo[] {
    const configured = this.isConfigured();
    return [
      {
        backendKey: 'gemini:gemini-4-hydrogen',
        providerId: this.id,
        providerName: this.name,
        modelId: 'gemini-4-hydrogen',
        displayName: 'Gemini 4 Hydrogen',
        capabilities: ['chat', 'writer'],
        configured,
        requiresPaidKey: false,
        description: 'Fast, balanced next-gen model for everyday chat, tools, and writing.',
      },
      {
        backendKey: 'gemini:gemini-3.1-flash-lite',
        providerId: this.id,
        providerName: this.name,
        modelId: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash Lite',
        capabilities: ['chat', 'writer'],
        configured,
        requiresPaidKey: false,
        description: 'Ultra-low-latency model optimized for rapid drafts and summaries.',
      },
    ];
  }

  private mapThinkingLevel(level?: 'low' | 'medium' | 'high'): ThinkingLevel | undefined {
    if (level === 'low') return ThinkingLevel.LOW;
    if (level === 'medium') return ThinkingLevel.MEDIUM;
    if (level === 'high') return ThinkingLevel.HIGH;
    return undefined;
  }

  async streamChat(req: ChatRequest, onChunk: (chunk: ChatStreamChunk) => void): Promise<void> {
    try {
      const ai = this.getClient();
      const contents: Content[] = [];

      for (const turn of req.history) {
        const parts: Part[] = [];
        if (turn.attachments) {
          for (const att of turn.attachments) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }
        if (turn.content) {
          parts.push({ text: turn.content });
        }
        if (parts.length > 0) {
          contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts,
          });
        }
      }

      const currentParts: Part[] = [];
      if (req.attachments) {
        for (const att of req.attachments) {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }
      currentParts.push({ text: req.message });
      contents.push({ role: 'user', parts: currentParts });

      const thinking = this.mapThinkingLevel(req.thinkingLevel);
      const modelId = req.modelId || 'gemini-4-hydrogen';

      const stream = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: {
          systemInstruction:
            req.systemInstruction ||
            'You are Neo AI, a helpful, accurate, next-generation AI assistant. Format responses cleanly with Markdown when helpful.',
          ...(thinking && modelId !== 'gemini-3.1-flash-lite'
            ? { thinkingConfig: { thinkingLevel: thinking } }
            : {}),
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          onChunk({
            type: 'text',
            text,
            providerId: this.id,
            modelId,
          });
        }
      }

      onChunk({ type: 'done', providerId: this.id, modelId });
    } catch (error) {
      const normalized = this.normalizeError(error);
      onChunk({
        type: 'error',
        error: normalized.message,
        statusCode: normalized.statusCode,
        providerId: this.id,
        modelId: req.modelId,
      });
    }
  }

  async generateWriter(req: WriterRequest): Promise<WriterResponse> {
    const ai = this.getClient();
    const modelId = req.modelId || 'gemini-4-hydrogen';
    const lengthGuide =
      req.length === 'short'
        ? 'concise (around 120-200 words)'
        : req.length === 'medium'
          ? 'well-developed (around 350-500 words)'
          : 'comprehensive and detailed (around 750-1000 words)';

    const prompt = [
      `Write a ${req.category} piece on the following topic:`,
      `Topic: ${req.topic}`,
      `Tone: ${req.tone}`,
      `Target Length: ${lengthGuide}`,
      req.language ? `Language: ${req.language}` : '',
      req.extraContext ? `Additional Context: ${req.extraContext}` : '',
      'Deliver ready-to-publish copy cleanly formatted with Markdown headings or paragraphs where appropriate.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction:
            'You are Neo AI Writer, an expert editorial and creative copywriter. Produce high-craft, engaging, ready-to-use writing without meta-commentary.',
        },
      });

      const content = (response.text ?? '').trim();
      const wordCount = content ? content.split(/\s+/).length : 0;

      return {
        content,
        providerId: this.id,
        modelId,
        wordCount,
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      const err = new Error(normalized.message) as Error & { statusCode?: number };
      err.statusCode = normalized.statusCode;
      throw err;
    }
  }

  async generateImage(_req: ImageGenRequest): Promise<ImageGenResponse> {
    const err = new Error(
      'Gemini image generation models require a paid API key. Configure an OpenAI-compatible image provider in environment variables (OPENAI_COMPAT_API_KEY and OPENAI_COMPAT_BASE_URL) or enable a paid Gemini key in Settings > Secrets.'
    ) as Error & { statusCode?: number };
    err.statusCode = 402;
    throw err;
  }

  async generateSpeech(req: TTSRequest): Promise<TTSResponse> {
    const ai = this.getClient();
    const modelId = req.modelId || 'gemini-3.8-flash-lite-tts';
    const voiceName = req.voice || 'Kore';

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: req.text.slice(0, 2500),
                speechMetadata: {
                  style: req.style || 'Clear, warm, natural AI assistant',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Speech synthesis returned empty audio data.');
      }

      return {
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        mimeType: 'audio/wav',
        providerId: this.id,
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      const err = new Error(normalized.message) as Error & { statusCode?: number };
      err.statusCode = normalized.statusCode;
      throw err;
    }
  }

  async transcribeAudio(req: TranscribeRequest): Promise<TranscribeResponse> {
    const ai = this.getClient();
    const modelId = req.modelId || 'gemini-3.5-transcribe';

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: req.mimeType || 'audio/webm',
                data: req.audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken words accurately. Return only the transcription text without extra commentary.',
            },
          ],
        },
      });

      return {
        text: (response.text ?? '').trim(),
        providerId: this.id,
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      const err = new Error(normalized.message) as Error & { statusCode?: number };
      err.statusCode = normalized.statusCode;
      throw err;
    }
  }
}
