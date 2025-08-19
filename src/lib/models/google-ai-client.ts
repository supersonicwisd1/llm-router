import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseModelClientImpl, GenerationOptions } from './base-client';
import { ModelResponse, Provider } from '@/lib/types';
import { Logger } from '@/utils/logger';

export class GoogleAIClient extends BaseModelClientImpl {
  public readonly provider = Provider.GOOGLE;
  public readonly modelName: string;
  
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private logger: Logger;

  constructor(modelName: string) {
    super();
    this.modelName = modelName;
    this.logger = new Logger(`GoogleAI:${modelName}`);
  }

  private async getClient(): Promise<{ client: GoogleGenerativeAI; model: GenerativeModel }> {
    if (!this.client || !this.model) {
      // Only initialize client on server side
      if (typeof window === 'undefined') {
        const { getServerEnv } = await import('@/config/env');
        const env = getServerEnv();
        
        this.client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY || '');
        this.model = this.client.getGenerativeModel({ model: this.modelName });
      } else {
        throw new Error('Google AI client cannot be initialized on the client side');
      }
    }
    return { client: this.client, model: this.model };
  }

  async generateResponse(prompt: string, options?: GenerationOptions): Promise<ModelResponse> {
    const startTime = Date.now();
    const mergedOptions = this.mergeOptions(options);
    this.validateOptions(mergedOptions);

    try {
      this.logger.info('Generating response', { promptLength: prompt.length, options: mergedOptions });

      const { model } = await this.getClient();
      const generationConfig = {
        maxOutputTokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        topP: mergedOptions.topP,
        topK: 40, // Google AI default
      };

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });

      const content = result.response.text() || '';
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(content);
      const latencyMs = Date.now() - startTime;

      // Calculate cost using the model registry pricing
      const costUsd = this.calculateCost(inputTokens, outputTokens);

      this.logger.info('Response generated successfully', {
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
      });

      return this.createResponse(content, inputTokens, outputTokens, costUsd, latencyMs, {
        model: this.modelName,
        finishReason: 'STOP',
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

      const { model } = await this.getClient();
      const generationConfig = {
        maxOutputTokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
        topP: mergedOptions.topP,
        topK: 40,
      };

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
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
      json: true, // Gemini models support JSON mode
      function_calling: true, // Gemini models support function calling
      vision: true, // Gemini models support vision
      tool_use: true, // Gemini models support tool use
    };

    return capabilities[capability as keyof typeof capabilities] || false;
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // This is a simplified calculation - in production, you'd want to use
    // the actual pricing from your model registry
    let inputCost = 0;
    let outputCost = 0;

    if (this.modelName.includes('gemini-2-5-flash')) {
      inputCost = (inputTokens / 1000000) * 0.30;
      outputCost = (outputTokens / 1000000) * 2.50;
    }

    return inputCost + outputCost;
  }

  // Override availability check for Google AI
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we can make a simple API call
      const { model } = await this.getClient();
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
      return result.response.text().length > 0;
    } catch (error) {
      this.logger.warn('Google AI API not available', error);
      return false;
    }
  }
}
