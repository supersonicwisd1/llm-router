import OpenAI from 'openai';
import { BaseModelClientImpl, GenerationOptions } from './base-client';
import { ModelResponse, Provider } from '@/lib/types';
import { Logger } from '@/utils/logger';

export class OpenAIClient extends BaseModelClientImpl {
  public readonly provider = Provider.OPENAI;
  public readonly modelName: string;
  
  private client: OpenAI | null = null;
  private logger: Logger;

  constructor(modelName: string) {
    super();
    this.modelName = modelName;
    this.logger = new Logger(`OpenAI:${modelName}`);
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      // Only initialize client on server side
      if (typeof window === 'undefined') {
        const { getServerEnv } = await import('@/config/env');
        const env = getServerEnv();
        
        this.client = new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          organization: env.OPENAI_ORGANIZATION,
        });
      } else {
        throw new Error('OpenAI client cannot be initialized on the client side');
      }
    }
    return this.client;
  }

  async generateResponse(prompt: string, options?: GenerationOptions): Promise<ModelResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    this.validateOptions(mergedOptions);

    try {
      this.logger.info('Generating response', { promptLength: prompt.length, options: mergedOptions });

      const client = await this.getClient();
      const messages = this.buildMessages(prompt, mergedOptions);
      
      const response = await client.chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stopSequences,
        response_format: mergedOptions.jsonMode ? { type: 'json_object' } : undefined,
      }, {
        timeout: mergedOptions.timeoutMs,
      });

      const content = response.choices[0]?.message?.content || '';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const latencyMs = Date.now() - startTime;

      // Calculate cost (we'll use a helper function for this)
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      this.logger.info('Response generated successfully', {
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
      });

      return this.createResponse(content, inputTokens, outputTokens, costUsd, latencyMs, {
        finishReason: response.choices[0]?.finish_reason,
        model: response.model,
      });

    } catch (error) {
      this.logger.error('Failed to generate response', error);
      throw this.handleError(error, 'generateResponse');
    }
  }

  async *generateResponseStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string> {
    const mergedOptions = this.mergeOptions(options);
    this.validateOptions(mergedOptions);

    try {
      this.logger.info('Starting streaming response', { promptLength: prompt.length });

      const client = await this.getClient();
      const messages = this.buildMessages(prompt, mergedOptions);
      
      const stream = await client.chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        frequency_penalty: mergedOptions.frequencyPenalty,
        presence_penalty: mergedOptions.presencePenalty,
        stop: mergedOptions.stopSequences,
        response_format: mergedOptions.jsonMode ? { type: 'json_object' } : undefined,
        stream: true,
      }, {
        timeout: mergedOptions.timeoutMs,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      this.logger.info('Streaming response completed');

    } catch (error) {
      this.logger.error('Failed to generate streaming response', error);
      this.handleError(error, 'generateResponseStream');
    }
  }

  supportsCapability(capability: string): boolean {
    const capabilities = {
      json: true, // All OpenAI models support JSON mode
      function_calling: true, // All OpenAI models support function calling
      vision: this.modelName.includes('4o') || this.modelName.includes('4-vision'),
      tool_use: true, // OpenAI models support tool use
    };

    return capabilities[capability as keyof typeof capabilities] || false;
  }

  private buildMessages(prompt: string, options: GenerationOptions) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    return messages;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // This is a simplified calculation - in production, you'd want to use
    // the actual pricing from your model registry
    const inputCost = (inputTokens / 1000000) * 5.0; // Assuming GPT-4o pricing
    const outputCost = (outputTokens / 1000000) * 15.0;
    
    return inputCost + outputCost;
  }

  // Override availability check for OpenAI
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we can make a simple API call
      const client = await this.getClient();
      await client.models.list();
      return true;
    } catch (error) {
      this.logger.warn('OpenAI API not available', error);
      return false;
    }
  }
}
