import { ModelResponse, Provider } from '@/lib/types';

// Base interface for all model clients
export interface BaseModelClient {
  provider: Provider;
  modelName: string;
  
  // Core methods
  generateResponse(prompt: string, options?: GenerationOptions): Promise<ModelResponse>;
  generateResponseStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string>;
  
  // Utility methods
  estimateTokens(text: string): number;
  supportsCapability(capability: string): boolean;
  isAvailable(): Promise<boolean>;
}

// Options for text generation
export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  jsonMode?: boolean;
  functionCalling?: boolean;
  timeoutMs?: number;
}

// Base implementation with common functionality
export abstract class BaseModelClientImpl implements BaseModelClient {
  abstract provider: Provider;
  abstract modelName: string;
  
  // Default options
  protected defaultOptions: GenerationOptions = {
    maxTokens: 1000,
    temperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    timeoutMs: 30000,
  };

  // Abstract methods that must be implemented by each provider
  abstract generateResponse(prompt: string, options?: GenerationOptions): Promise<ModelResponse>;
  abstract generateResponseStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string>;
  abstract supportsCapability(capability: string): boolean;

  // Common token estimation (rough approximation)
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Default availability check
  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to generate a minimal response
      const response = await this.generateResponse('test', { maxTokens: 5 });
      return response.content.length > 0;
    } catch {
      return false;
    }
  }

  // Merge options with defaults
  protected mergeOptions(options?: GenerationOptions): GenerationOptions {
    return {
      ...this.defaultOptions,
      ...options,
    };
  }

  // Validate options
  protected validateOptions(options: GenerationOptions): void {
    if (options.maxTokens && options.maxTokens < 1) {
      throw new Error('maxTokens must be at least 1');
    }
    if (options.temperature && (options.temperature < 0 || options.temperature > 2)) {
      throw new Error('temperature must be between 0 and 2');
    }
    if (options.topP && (options.topP < 0 || options.topP > 1)) {
      throw new Error('topP must be between 0 and 1');
    }
  }

  // Create a standardized response object
  protected createResponse(
    content: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    latencyMs: number,
    metadata?: Record<string, unknown>
  ): ModelResponse {
    return {
      content,
      modelName: this.modelName,
      provider: this.provider,
      usage: {
        inputTokens,
        outputTokens,
        costUsd,
      },
      latency: latencyMs,
      timestamp: new Date(),
      metadata,
    };
  }

  // Error handling helper
  protected handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const enhancedError = new Error(`[${this.provider}:${this.modelName}] ${context}: ${errorMessage}`);
    
    // Preserve original error details
    (enhancedError as unknown as Record<string, unknown>).originalError = error;
    (enhancedError as unknown as Record<string, unknown>).provider = this.provider;
    (enhancedError as unknown as Record<string, unknown>).modelName = this.modelName;
    
    throw enhancedError;
  }
}
