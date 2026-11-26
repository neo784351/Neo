import { BaseAIProvider } from '../baseProvider.ts';
import type {
  ChatRequest,
  ChatStreamChunk,
  ImageGenRequest,
  ImageGenResponse,
  ModelBackendInfo,
  WriterRequest,
  WriterResponse,
} from '../types.ts';

function isSafeHttpsEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export class OpenAICompatibleProvider extends BaseAIProvider {
  readonly id = 'openai-compatible';
  readonly name = 'OpenAI-Compatible Endpoint';

  private getConfig() {
    const apiKey = process.env.OPENAI_COMPAT_API_KEY?.trim() || '';
    const baseUrl = (process.env.OPENAI_COMPAT_BASE_URL?.trim() || '').replace(/\/+$/, '');
    const chatModel = process.env.OPENAI_COMPAT_CHAT_MODEL?.trim() || 'gpt-4o-mini';
    const imageModel = process.env.OPENAI_COMPAT_IMAGE_MODEL?.trim() || 'dall-e-3';
    return { apiKey, baseUrl, chatModel, imageModel };
  }

  isConfigured(): boolean {
    const { apiKey, baseUrl } = this.getConfig();
    return Boolean(apiKey && baseUrl && isSafeHttpsEndpoint(baseUrl));
  }

  getSupportedModels(): ModelBackendInfo[] {
    const { chatModel, imageModel } = this.getConfig();
    const configured = this.isConfigured();

    return [
      {
        backendKey: `openai-compatible:${chatModel}`,
        providerId: this.id,
        providerName: this.name,
        modelId: chatModel,
        displayName: `External Chat (${chatModel})`,
        capabilities: ['chat', 'writer'],
        configured,
        description: configured
          ? `Connected to ${this.getConfig().baseUrl}`
          : 'Configure OPENAI_COMPAT_API_KEY and OPENAI_COMPAT_BASE_URL to enable.',
      },
      {
        backendKey: `openai-compatible:${imageModel}`,
        providerId: this.id,
        providerName: this.name,
        modelId: imageModel,
        displayName: `External Image (${imageModel})`,
        capabilities: ['image'],
        configured,
        description: configured
          ? `Connected to ${this.getConfig().baseUrl}`
          : 'Configure OPENAI_COMPAT_API_KEY and OPENAI_COMPAT_BASE_URL to enable.',
      },
    ];
  }

  async streamChat(req: ChatRequest, onChunk: (chunk: ChatStreamChunk) => void): Promise<void> {
    if (!this.isConfigured()) {
      onChunk({
        type: 'error',
        statusCode: 400,
        error:
          'OpenAI-compatible provider is not configured. Set OPENAI_COMPAT_API_KEY and OPENAI_COMPAT_BASE_URL in environment secrets or switch back to Google Gemini.',
        providerId: this.id,
        modelId: req.modelId,
      });
      return;
    }

    const { apiKey, baseUrl, chatModel } = this.getConfig();
    const modelId = req.modelId || chatModel;

    const messages: Array<{ role: string; content: unknown }> = [];
    if (req.systemInstruction) {
      messages.push({ role: 'system', content: req.systemInstruction });
    }
    for (const turn of req.history) {
      messages.push({ role: turn.role, content: turn.content });
    }
    if (req.attachments && req.attachments.length > 0) {
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: req.message }];
      for (const att of req.attachments) {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType};base64,${att.data}` },
        });
      }
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: req.message });
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        onChunk({
          type: 'error',
          statusCode: res.status,
          error: errText || 'External provider returned an error.',
          providerId: this.id,
          modelId,
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
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              onChunk({ type: 'text', text, providerId: this.id, modelId });
            }
          } catch {
            // Skip malformed SSE partial frame
          }
        }
      }

      onChunk({ type: 'done', providerId: this.id, modelId });
    } catch (error) {
      const normalized = this.normalizeError(error);
      onChunk({
        type: 'error',
        statusCode: normalized.statusCode,
        error: normalized.message,
        providerId: this.id,
        modelId,
      });
    }
  }

  async generateWriter(req: WriterRequest): Promise<WriterResponse> {
    if (!this.isConfigured()) {
      const err = new Error(
        'OpenAI-compatible provider is not configured. Please switch to Google Gemini or configure OPENAI_COMPAT_* environment variables.'
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const { apiKey, baseUrl, chatModel } = this.getConfig();
    const modelId = req.modelId || chatModel;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content:
              'You are Neo AI Writer, an expert copywriter. Return clean Markdown content without meta-commentary.',
          },
          {
            role: 'user',
            content: `Category: ${req.category}\nTopic: ${req.topic}\nTone: ${req.tone}\nLength: ${req.length}\n${req.extraContext || ''}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      const err = new Error(errText || 'Writer request failed.') as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = (data.choices?.[0]?.message?.content ?? '').trim();
    const wordCount = content ? content.split(/\s+/).length : 0;

    return {
      content,
      providerId: this.id,
      modelId,
      wordCount,
    };
  }

  async generateImage(req: ImageGenRequest): Promise<ImageGenResponse> {
    if (!this.isConfigured()) {
      const err = new Error(
        'OpenAI-compatible image provider is not configured. Switch to Gemini Flash Image or configure OPENAI_COMPAT_* environment variables.'
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const { apiKey, baseUrl, imageModel } = this.getConfig();
    const modelId = req.modelId || imageModel;
    const size =
      req.aspectRatio === '16:9'
        ? '1792x1024'
        : req.aspectRatio === '9:16'
          ? '1024x1792'
          : '1024x1024';

    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt: `${req.prompt}. Style: ${req.style}.`,
        n: 1,
        size,
        response_format: 'b64_json',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      const err = new Error(errText || 'Image generation failed.') as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };
    const first = data.data?.[0];
    if (!first?.b64_json) {
      throw new Error('External image provider did not return base64 image data.');
    }

    return {
      imageDataUrl: `data:image/png;base64,${first.b64_json}`,
      mimeType: 'image/png',
      revisedPrompt: first.revised_prompt,
      providerId: this.id,
      modelId,
    };
  }
}
