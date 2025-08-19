import { ModelConfig, Provider, PromptType } from '@/lib/types';

// Base model configuration without derived properties
type BaseModelConfig = Omit<ModelConfig, 'contextWindow' | 'inputCostPer1kTokens' | 'outputCostPer1kTokens' | 'latencyMs' | 'capabilities' | 'qualityPriors' | 'throughputTps'>;

// Updated Model Registry with the new 4-model portfolio
export const MODEL_REGISTRY: Record<string, BaseModelConfig> = {
  'claude-3-7-sonnet-20250219': {
    provider: Provider.ANTHROPIC,
    modelName: 'claude-3-7-sonnet-20250219',
    contextWindowTokens: 200000,
    priceInputPerMillion: 3.0,
    priceOutputPerMillion: 15.0,
    latencyP50Seconds: 1.34,
    supportsJson: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    qualityPriorByType: {
      [PromptType.CODE]: 0.98,
      [PromptType.SUMMARIZE]: 0.95,
      [PromptType.QA]: 0.96,
      [PromptType.CREATIVE]: 0.98,
      [PromptType.MATH_REASONING]: 0.95,
      [PromptType.UNKNOWN]: 0.92,
    },
    rpmLimit: 50,
    concurrentLimit: 3,
    notes: 'Highest quality for creative writing and code generation, slower but excellent results',
    isAvailable: true,
  },

  'gpt-5': {
    provider: Provider.OPENAI,
    modelName: 'gpt-5',
    contextWindowTokens: 400000,
    priceInputPerMillion: 1.25,
    priceOutputPerMillion: 10.0,
    latencyP50Seconds: 7.52,
    supportsJson: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    qualityPriorByType: {
      [PromptType.CODE]: 0.99,
      [PromptType.SUMMARIZE]: 0.96,
      [PromptType.QA]: 0.99,
      [PromptType.CREATIVE]: 0.97,
      [PromptType.MATH_REASONING]: 0.99,
      [PromptType.UNKNOWN]: 0.94,
    },
    rpmLimit: 30,
    concurrentLimit: 2,
    notes: 'Highest quality for Q&A, reasoning and math, very slow but most capable',
    isAvailable: true,
  },

  'gemini-1.5-flash': {
    provider: Provider.GOOGLE,
    modelName: 'gemini-1.5-flash',
    contextWindowTokens: 1050000,
    priceInputPerMillion: 0.30,
    priceOutputPerMillion: 2.50,
    latencyP50Seconds: 0.45,
    supportsJson: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    qualityPriorByType: {
      [PromptType.CODE]: 0.85,
      [PromptType.SUMMARIZE]: 0.88,
      [PromptType.QA]: 0.86,
      [PromptType.CREATIVE]: 0.84,
      [PromptType.MATH_REASONING]: 0.82,
      [PromptType.UNKNOWN]: 0.85,
    },
    rpmLimit: 80,
    concurrentLimit: 10,
    notes: 'Excellent cost-performance ratio, huge context window, fast responses',
    isAvailable: true,
  },

  'gpt-4o-mini': {
    provider: Provider.OPENAI,
    modelName: 'gpt-4o-mini',
    contextWindowTokens: 128000,
    priceInputPerMillion: 0.15,
    priceOutputPerMillion: 0.60,
    latencyP50Seconds: 0.46,
    supportsJson: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    qualityPriorByType: {
      [PromptType.CODE]: 0.82,
      [PromptType.SUMMARIZE]: 0.80,
      [PromptType.QA]: 0.81,
      [PromptType.CREATIVE]: 0.79,
      [PromptType.MATH_REASONING]: 0.75,
      [PromptType.UNKNOWN]: 0.85,
    },
    rpmLimit: 200,
    concurrentLimit: 25,
    notes: 'Cost-effective model, great for classification and simple tasks, good speed',
    isAvailable: true,
  },

  'gpt-oss-20b': {
    provider: Provider.HUGGINGFACE,
    modelName: 'openai/gpt-oss-20b:fireworks-ai',
    contextWindowTokens: 128000,
    priceInputPerMillion: 0.0,
    priceOutputPerMillion: 0.0,
    latencyP50Seconds: 0.8,
    supportsJson: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    qualityPriorByType: {
      [PromptType.CODE]: 0.78,
      [PromptType.SUMMARIZE]: 0.82,
      [PromptType.QA]: 0.80,
      [PromptType.CREATIVE]: 0.75,
      [PromptType.MATH_REASONING]: 0.70,
      [PromptType.UNKNOWN]: 0.85,
    },
    rpmLimit: 1000,
    concurrentLimit: 50,
    notes: 'Free Hugging Face model via router, excellent for cost-effective tasks',
    isAvailable: true, // Will be updated dynamically
  },
};

// Helper function to compute derived properties for routing compatibility
const computeDerivedProperties = (model: Omit<ModelConfig, 'contextWindow' | 'inputCostPer1kTokens' | 'outputCostPer1kTokens' | 'latencyMs' | 'capabilities' | 'qualityPriors' | 'throughputTps'>): ModelConfig => {
  const capabilities = Object.keys(model.qualityPriorByType).map(key => key as PromptType);
  const throughputTps = Math.round(1000 / model.latencyP50Seconds);
  
  // Create a complete qualityPriors record with defaults for missing types
  const qualityPriors: Record<PromptType, number> = {
    [PromptType.CODE]: model.qualityPriorByType[PromptType.CODE] || 0.5,
    [PromptType.SUMMARIZE]: model.qualityPriorByType[PromptType.SUMMARIZE] || 0.5,
    [PromptType.QA]: model.qualityPriorByType[PromptType.QA] || 0.5,
    [PromptType.CREATIVE]: model.qualityPriorByType[PromptType.CREATIVE] || 0.5,
    [PromptType.MATH_REASONING]: model.qualityPriorByType[PromptType.MATH_REASONING] || 0.5,
    [PromptType.UNKNOWN]: model.qualityPriorByType[PromptType.UNKNOWN] || 0.5,
  };
  
              return {
                ...model,
                contextWindow: model.contextWindowTokens,
                inputCostPer1kTokens: model.priceInputPerMillion / 1000,
                outputCostPer1kTokens: model.priceOutputPerMillion / 1000,
                latencyMs: model.latencyP50Seconds * 1000,
                capabilities,
                qualityPriors,
                throughputTps,
                isAvailable: model.isAvailable ?? true, // Default to true if not specified
              };
};

// Model selection helpers
export const getModelByName = (modelName: string): ModelConfig | undefined => {
  const model = MODEL_REGISTRY[modelName];
  return model ? computeDerivedProperties(model) : undefined;
};

export const getModelsByProvider = (provider: Provider): ModelConfig[] => {
  return Object.values(MODEL_REGISTRY)
    .filter(model => model.provider === provider)
    .map(model => computeDerivedProperties(model));
};

export const getModelsByCapability = (capability: keyof Pick<ModelConfig, 'supportsJson' | 'supportsFunctionCalling' | 'supportsVision'>): ModelConfig[] => {
  return Object.values(MODEL_REGISTRY)
    .filter(model => model[capability])
    .map(model => computeDerivedProperties(model));
};

export const getModelsByPromptType = (promptType: PromptType): ModelConfig[] => {
  return Object.values(MODEL_REGISTRY)
    .filter(model => model.qualityPriorByType[promptType] !== undefined)
    .map(model => computeDerivedProperties(model));
};

// Cost estimation helpers
export const estimateTokenCost = (
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number => {
  const model = MODEL_REGISTRY[modelName];
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1000000) * model.priceInputPerMillion;
  const outputCost = (outputTokens / 1000000) * model.priceOutputPerMillion;
  
  return inputCost + outputCost;
};

// Performance ranking helpers
export const rankModelsByCost = (promptType: PromptType): string[] => {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, model]) => model.qualityPriorByType[promptType] !== undefined)
    .sort(([, a], [, b]) => {
      const aCost = a.priceInputPerMillion + a.priceOutputPerMillion;
      const bCost = b.priceInputPerMillion + b.priceOutputPerMillion;
      return aCost - bCost;
    })
    .map(([name]) => name);
};

export const rankModelsByLatency = (promptType: PromptType): string[] => {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, model]) => model.qualityPriorByType[promptType] !== undefined)
    .sort(([, a], [, b]) => a.latencyP50Seconds - b.latencyP50Seconds)
    .map(([name]) => name);
};

export const rankModelsByQuality = (promptType: PromptType): string[] => {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, model]) => model.qualityPriorByType[promptType] !== undefined)
    .sort(([, a], [, b]) => {
      const aQuality = a.qualityPriorByType[promptType] || 0;
      const bQuality = b.qualityPriorByType[promptType] || 0;
      return bQuality - aQuality;
    })
    .map(([name]) => name);
};

// New helper for context-aware routing
export const getModelsByContextSize = (requiredTokens: number): string[] => {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, model]) => model.contextWindowTokens >= requiredTokens)
    .sort(([, a], [, b]) => a.contextWindowTokens - b.contextWindowTokens)
    .map(([name]) => name);
};

// Helper for free models
export const getFreeModels = (): string[] => {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, model]) => model.priceInputPerMillion === 0 && model.priceOutputPerMillion === 0)
    .map(([name]) => name);
};

// Function to update model availability dynamically
export const updateModelAvailability = (modelName: string, isAvailable: boolean): void => {
  console.log(`Model Registry: updateModelAvailability called for ${modelName} with ${isAvailable}`);
  console.log(`Model Registry: Before update - ${modelName}.isAvailable =`, MODEL_REGISTRY[modelName]?.isAvailable);
  
  if (MODEL_REGISTRY[modelName]) {
    MODEL_REGISTRY[modelName].isAvailable = isAvailable;
    console.log(`Model Registry: After update - ${modelName}.isAvailable =`, MODEL_REGISTRY[modelName].isAvailable);
    console.log(`Model Registry: Updated ${modelName} availability to ${isAvailable}`);
    
    // Persist to localStorage (client-side) or memory (server-side)
    if (typeof window !== 'undefined') {
      // Client-side: use localStorage
      const key = `model_availability_${modelName}`;
      localStorage.setItem(key, isAvailable.toString());
    } else {
          // Server-side: use a simple in-memory cache
    if (!(global as Record<string, unknown>).modelAvailabilityCache) {
      (global as Record<string, unknown>).modelAvailabilityCache = new Map();
    }
    ((global as Record<string, unknown>).modelAvailabilityCache as Map<string, boolean>).set(modelName, isAvailable);
    }
  } else {
    console.log(`Model Registry: Model ${modelName} not found in registry`);
  }
};

// Function to reset all models to available (useful for testing)
export const resetAllModelAvailability = (): void => {
  Object.keys(MODEL_REGISTRY).forEach(modelName => {
    MODEL_REGISTRY[modelName].isAvailable = true;
  });
  console.log('Model Registry: Reset all models to available');
};
