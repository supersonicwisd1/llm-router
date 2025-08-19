import { OpenAI } from 'openai';
import { BaseModelClientImpl, GenerationOptions } from './base-client';
import { ModelResponse, Provider } from '@/lib/types';
import { Logger } from '@/utils/logger';

export class HuggingFaceClient extends BaseModelClientImpl {
  public readonly provider = Provider.HUGGINGFACE;
  public readonly modelName: string;
  
  private client: OpenAI | null = null;
  private logger: Logger;

  constructor(modelName: string) {
    super();
    this.modelName = modelName;
    this.logger = new Logger(`HuggingFace:${modelName}`);
  }

  // Implement required abstract methods
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *generateResponseStream(prompt: string): AsyncGenerator<string> {
    throw new Error('Streaming not supported for Hugging Face models');
  }

  supportsCapability(capability: string): boolean {
    // Hugging Face models support basic text generation
    return ['text-generation', 'chat'].includes(capability);
  }

  // Build messages for the API call
  private buildMessages(prompt: string, options: GenerationOptions): Array<{ role: 'system' | 'user'; content: string }> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return messages;
  }

  private async getClient(): Promise<OpenAI | null> {
    if (this.client) {
      return this.client;
    }

    const { getServerEnv } = await import('@/config/env');
    const env = getServerEnv();
    
    if (!env.HF_TOKEN) {
      this.logger.warn('HF_TOKEN not found - Hugging Face model unavailable');
      return null;
    }

    this.client = new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: env.HF_TOKEN,
    });

    return this.client;
  }

  async generateResponse(prompt: string, options: GenerationOptions = {}): Promise<ModelResponse> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      if (!client) {
        throw new Error('Hugging Face model unavailable - HF_TOKEN not configured');
      }
      
      const mergedOptions = { ...this.defaultOptions, ...options };
      
      this.logger.info('Generating response', {
        promptLength: prompt.length,
        options: mergedOptions
      });

      const messages = this.buildMessages(prompt, mergedOptions);
      
      const response = await client.chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      const choice = response.choices?.[0];
      const message: unknown = choice?.message ?? {};
      // Some HF router models (e.g., fireworks gpt-oss-20b) return reasoning_content instead of content
      // Prefer content, fall back to reasoning_content, else empty string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = message as any;
      const text: string = (typeof msg?.content === 'string' && msg.content.trim() !== '')
        ? msg.content
        : (typeof msg?.reasoning_content === 'string' ? msg.reasoning_content : '');

      if (text === '') {
        this.logger.warn('Hugging Face: empty assistant text (no content/reasoning_content present)');
      }

      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;

      this.logger.info('Response generated successfully', {
        inputTokens,
        outputTokens,
        costUsd: 0, // Free model
        latencyMs: latency
      });

      return {
        content: text,
        modelName: this.modelName,
        provider: this.provider,
        usage: {
          inputTokens,
          outputTokens,
          costUsd: 0, // Free model
        },
        latency,
        timestamp: new Date()
      };

    } catch (error) {
      this.handleError(error, 'generateResponse');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) {
        return false;
      }
      
      // Simple test call to check availability
      await client.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      this.logger.warn('Model availability check failed', { error });
      return false;
    }
  }
}