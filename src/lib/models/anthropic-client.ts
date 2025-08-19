import Anthropic from '@anthropic-ai/sdk';
import { BaseModelClientImpl, GenerationOptions } from './base-client';
import { ModelResponse, Provider } from '@/lib/types';
import { Logger } from '@/utils/logger';

export class AnthropicClient extends BaseModelClientImpl {
  public readonly provider = Provider.ANTHROPIC;
  public readonly modelName: string;
  
  private client: Anthropic | null = null;
  private logger: Logger;

  constructor(modelName: string) {
    super();
    this.modelName = modelName;
    this.logger = new Logger(`Anthropic:${modelName}`);
  }

  private async getClient(): Promise<Anthropic> {
    if (!this.client) {
      // Only initialize client on server side
      if (typeof window === 'undefined') {
        const { getServerEnv } = await import('@/config/env');
        const env = getServerEnv();
        
        this.client = new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
        });
      } else {
        throw new Error('Anthropic client cannot be initialized on the client side');
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
      const messages = this.buildMessages(prompt);
      
      const response = await client.messages.create({
        model: this.modelName,
        messages,
        max_tokens: mergedOptions.maxTokens || 1000,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        system: mergedOptions.systemPrompt,
      });

      const content = response.content[0];
      const contentText = content && 'text' in content ? content.text : '';
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const latencyMs = Date.now() - startTime;

      // Calculate cost using the model registry pricing
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      this.logger.info('Response generated successfully', {
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
      });

      return this.createResponse(contentText, inputTokens, outputTokens, costUsd, latencyMs, {
        finishReason: response.stop_reason,
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
      const messages = this.buildMessages(prompt);
      
      const stream = await client.messages.create({
        model: this.modelName,
        messages,
        max_tokens: mergedOptions.maxTokens || 1000,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.topP,
        system: mergedOptions.systemPrompt,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
          const content = chunk.delta.text;
          if (content) {
            yield content;
          }
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
      json: true, // Claude models support JSON mode
      function_calling: true, // Claude models support function calling
      vision: this.modelName.includes('haiku') || this.modelName.includes('sonnet'), // Both support vision
      tool_use: true, // Claude models support tool use
    };

    return capabilities[capability as keyof typeof capabilities] || false;
  }

  private buildMessages(prompt: string) {
    return [
      {
        role: 'user' as const,
        content: prompt,
      },
    ];
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // This is a simplified calculation - in production, you'd want to use
    // the actual pricing from your model registry
    let inputCost = 0;
    let outputCost = 0;

    if (this.modelName.includes('sonnet')) {
      inputCost = (inputTokens / 1000000) * 3.0;
      outputCost = (outputTokens / 1000000) * 15.0;
    } else if (this.modelName.includes('haiku')) {
      inputCost = (inputTokens / 1000000) * 0.80;
      outputCost = (outputTokens / 1000000) * 4.0;
    }

    return inputCost + outputCost;
  }

  // Override availability check for Anthropic
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we can make a simple API call
      const client = await this.getClient();
      await client.messages.create({
        model: this.modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      return true;
    } catch (error) {
      this.logger.warn('Anthropic API not available', error);
      return false;
    }
  }
}
