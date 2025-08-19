import { BaseModelClient } from './base-client';
import { OpenAIClient } from './openai-client';
import { AnthropicClient } from './anthropic-client';
import { GoogleAIClient } from './google-ai-client';
import { HuggingFaceClient } from './huggingface-client';
import { MODEL_REGISTRY } from './model-registry';
import { Provider } from '@/lib/types';
import { Logger } from '@/utils/logger';

export class ModelClientFactory {
  private static instance: ModelClientFactory;
  private clients: Map<string, BaseModelClient> = new Map();
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('ModelClientFactory');
  }

  static getInstance(): ModelClientFactory {
    if (!ModelClientFactory.instance) {
      ModelClientFactory.instance = new ModelClientFactory();
    }
    return ModelClientFactory.instance;
  }

  /**
   * Get or create a model client for the specified model
   */
  getClient(modelName: string): BaseModelClient {
    // Return cached client if exists
    if (this.clients.has(modelName)) {
      return this.clients.get(modelName)!;
    }

    // Resolve model config by registry key OR by underlying provider modelName
    let resolvedKey: string | undefined = modelName;
    let modelConfig = MODEL_REGISTRY[resolvedKey];

    if (!modelConfig) {
      const matched = Object.entries(MODEL_REGISTRY).find(([, cfg]) => cfg.modelName === modelName);
      if (matched) {
        resolvedKey = matched[0];
        modelConfig = matched[1];
      }
    }

    if (!modelConfig || !resolvedKey) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const client = this.createClient(modelConfig);
    // Cache by both the registry key and the full provider modelName for future lookups
    this.clients.set(resolvedKey, client);
    this.clients.set(modelConfig.modelName, client);
    
    this.logger.info('Created new model client', { modelName: resolvedKey, provider: modelConfig.provider, providerModel: modelConfig.modelName });
    
    return client;
  }

  /**
   * Get all available model clients
   */
  getAllClients(): BaseModelClient[] {
    return Object.keys(MODEL_REGISTRY).map(modelName => this.getClient(modelName));
  }

  /**
   * Get clients by provider
   */
  getClientsByProvider(provider: Provider): BaseModelClient[] {
    return Object.entries(MODEL_REGISTRY)
      .filter(([, config]) => config.provider === provider)
      .map(([modelName]) => this.getClient(modelName));
  }

  /**
   * Check if a model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const client = this.getClient(modelName);
      return await client.isAvailable();
    } catch (error) {
      this.logger.warn('Model availability check failed', { modelName, error });
      return false;
    }
  }

  /**
   * Get available models (models that are currently accessible)
   */
  async getAvailableModels(): Promise<string[]> {
    const availableModels: string[] = [];
    
    for (const modelName of Object.keys(MODEL_REGISTRY)) {
      if (await this.isModelAvailable(modelName)) {
        availableModels.push(modelName);
      }
    }

    this.logger.info('Available models', { count: availableModels.length, models: availableModels });
    return availableModels;
  }

  /**
   * Create a new client instance based on the model configuration
   */
  private createClient(modelConfig: { provider: Provider; modelName: string }): BaseModelClient {
    // Check if this is a Hugging Face model (identified by the model name pattern)
    if (modelConfig.modelName.includes(':') && modelConfig.modelName.includes('fireworks-ai')) {
      return new HuggingFaceClient(modelConfig.modelName);
    }

    switch (modelConfig.provider) {
      case Provider.OPENAI:
        return new OpenAIClient(modelConfig.modelName);
      
      case Provider.ANTHROPIC:
        return new AnthropicClient(modelConfig.modelName);
      
      case Provider.GOOGLE:
        return new GoogleAIClient(modelConfig.modelName);
      
      default:
        throw new Error(`Unknown provider: ${modelConfig.provider}`);
    }
  }

  /**
   * Clear all cached clients (useful for testing or when credentials change)
   */
  clearCache(): void {
    this.clients.clear();
    this.logger.info('Model client cache cleared');
  }

  /**
   * Get client statistics
   */
  getStats(): { totalClients: number; cachedClients: number } {
    return {
      totalClients: Object.keys(MODEL_REGISTRY).length,
      cachedClients: this.clients.size,
    };
  }
}

// Export singleton instance
export const modelClientFactory = ModelClientFactory.getInstance();
