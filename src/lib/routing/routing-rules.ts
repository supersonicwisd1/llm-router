import { PromptType, PriorityPreset, RoutingRule } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// Default routing rules based on the new 4-model portfolio
export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  // Classification - Use free model
  {
    id: uuidv4(),
    promptType: PromptType.UNKNOWN,
    priorityCost: 0.8,
    priorityLatency: 0.2,
    priorityQuality: 0.0,
    targetModel: 'gpt-4o-mini',
    fallbackModel: 'gemini-2.5-flash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Code Generation - Use Claude for best quality
  {
    id: uuidv4(),
    promptType: PromptType.CODE,
    priorityCost: 0.3,
    priorityLatency: 0.2,
    priorityQuality: 0.5,
    targetModel: 'claude-3-7-sonnet-20250219',
    fallbackModel: 'gemini-1.5-flash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Creative Writing - Use Claude for best quality
  {
    id: uuidv4(),
    promptType: PromptType.CREATIVE,
    priorityCost: 0.3,
    priorityLatency: 0.2,
    priorityQuality: 0.5,
    targetModel: 'claude-3-7-sonnet-20250219',
    fallbackModel: 'gemini-1.5-flash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Summarization - Use Gemini for cost-effectiveness and speed
  {
    id: uuidv4(),
    promptType: PromptType.SUMMARIZE,
    priorityCost: 0.6,
    priorityLatency: 0.3,
    priorityQuality: 0.1,
    targetModel: 'gemini-2-5-flash',
    fallbackModel: 'gpt-4o-mini',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Q&A/Reasoning - Use GPT-5 for highest quality
  {
    id: uuidv4(),
    promptType: PromptType.QA,
    priorityCost: 0.2,
    priorityLatency: 0.1,
    priorityQuality: 0.7,
    targetModel: 'gpt-5',
    fallbackModel: 'claude-3-7-sonnet-20250219',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Context-aware routing rules
export const CONTEXT_AWARE_RULES = {
  // For prompts requiring >200K tokens, route to Gemini 1.5 Flash
  LONG_CONTEXT_THRESHOLD: 200000,
  LONG_CONTEXT_MODEL: 'gemini-1.5-flash',
  LONG_CONTEXT_FALLBACK: 'gpt-5',
};

// Priority-based routing weights for different presets
export const PRIORITY_WEIGHTS = {
  [PriorityPreset.BALANCED]: { quality: 0.45, cost: 0.30, latency: 0.25 },
  [PriorityPreset.QUALITY]: { quality: 0.70, cost: 0.20, latency: 0.10 },
  [PriorityPreset.COST]: { quality: 0.20, cost: 0.70, latency: 0.10 },
  [PriorityPreset.LATENCY]: { quality: 0.20, cost: 0.10, latency: 0.70 },
};

// Model-specific routing overrides
export const MODEL_OVERRIDES = {
  // Force certain models for specific capabilities
  JSON_REQUIRED: ['claude-3-7-sonnet-20250219', 'gpt-5', 'gemini-1.5-flash'],
  VISION_REQUIRED: ['claude-3-7-sonnet-20250219', 'gpt-5', 'gemini-1.5-flash'],
  FUNCTION_CALLING_REQUIRED: ['claude-3-7-sonnet-20250219', 'gpt-5', 'gemini-1.5-flash'],
  
  // Free tier for simple tasks
  FREE_TIER: ['gpt-4o-mini'],
  
  // Premium tier for complex tasks
  PREMIUM_TIER: ['claude-3-7-sonnet-20250219', 'gpt-5'],
};

// Helper functions for routing decisions
export const getRoutingRule = (promptType: PromptType): RoutingRule | undefined => {
  return DEFAULT_ROUTING_RULES.find(rule => 
    rule.promptType === promptType && rule.isActive
  );
};

export const getFallbackModel = (primaryModel: string, promptType: PromptType): string | undefined => {
  const rule = getRoutingRule(promptType);
  return rule?.fallbackModel;
};

export const shouldUseLongContextModel = (estimatedTokens: number): boolean => {
  return estimatedTokens > CONTEXT_AWARE_RULES.LONG_CONTEXT_THRESHOLD;
};

export const getLongContextModel = (): string => {
  return CONTEXT_AWARE_RULES.LONG_CONTEXT_MODEL;
};

export const getFreeModel = (): string => {
  return 'gpt-4o-mini';
};

export const isFreeModel = (modelName: string): boolean => {
  return MODEL_OVERRIDES.FREE_TIER.includes(modelName);
};

export const isPremiumModel = (modelName: string): boolean => {
  return MODEL_OVERRIDES.PREMIUM_TIER.includes(modelName);
};

// Additional helper functions for routing engine
export const getRoutingRules = (): RoutingRule[] => {
  return DEFAULT_ROUTING_RULES.filter(rule => rule.isActive);
};

export const getContextAwareRules = () => {
  return CONTEXT_AWARE_RULES;
};

export const getPriorityWeights = () => {
  return PRIORITY_WEIGHTS;
};
