// LLM Router Type Definitions

// ============================================================================
// ENUMS
// ============================================================================

export enum Provider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  HUGGINGFACE = 'huggingface',
}

export enum PromptType {
  CODE = 'code',
  SUMMARIZE = 'summarize',
  QA = 'qa',
  CREATIVE = 'creative',
  MATH_REASONING = 'math_reasoning',
  UNKNOWN = 'unknown',
}

export enum PriorityPreset {
  BALANCED = 'balanced',
  QUALITY = 'quality',
  COST = 'cost',
  LATENCY = 'latency',
}

export enum ModelCapability {
  JSON = 'json',
  FUNCTION_CALLING = 'function_calling',
  VISION = 'vision',
  TOOL_USE = 'tool_use',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ModelConfig {
  provider: Provider;
  modelName: string;
  contextWindowTokens: number;
  priceInputPerMillion: number;
  priceOutputPerMillion: number;
  latencyP50Seconds: number;
  supportsJson: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  qualityPriorByType: Partial<Record<PromptType, number>>;
  rpmLimit?: number;
  concurrentLimit?: number;
  notes?: string;
  isAvailable?: boolean; // Optional availability flag
  
  // Additional properties for routing engine compatibility
  contextWindow: number; // Alias for contextWindowTokens
  inputCostPer1kTokens: number; // Alias for priceInputPerMillion / 1000
  outputCostPer1kTokens: number; // Alias for priceOutputPerMillion / 1000
  latencyMs: number; // Alias for latencyP50Seconds * 1000
  capabilities: PromptType[]; // Derived from qualityPriorByType
  qualityPriors: Record<PromptType, number>; // Alias for qualityPriorByType
  throughputTps: number; // Calculated from latency
}

export interface RoutingRequest {
  prompt: string;
  promptType?: PromptType;
  priorityPreset: PriorityPreset;
  needsJson?: boolean;
  maxBudgetUsd?: number;
  classificationConfidence?: number;
  userId?: string;
  sessionId?: string;
}

export interface ClassificationResult {
  promptType: PromptType;
  confidence: number;
  method: 'embeddings' | 'model' | 'heuristic';
  metadata?: Record<string, unknown>;
}

export interface ModelScore {
  modelName: string;
  provider: Provider;
  score: number;
  breakdown: {
    quality: number;
    cost: number;
    latency: number;
    fit: number;
  };
  estimatedCost: number;
  estimatedLatency: number;
  constraints: {
    contextFits: boolean;
    capabilitiesMet: boolean;
    budgetOk: boolean;
  };
}

export interface RoutingDecision {
  selectedModel: string;
  provider: Provider;
  promptType: PromptType;
  confidence: number;
  reasoning: string;
  fallbackModel?: string;
  estimatedCost: number;
  estimatedLatency: number;
  score: number;
  priorityWeights: {
    quality: number;
    cost: number;
    latency: number;
  };
  alternatives: Array<{
    modelName: string;
    score: number;
    reason: string;
    provider: Provider;
    qualityScore: number;
    costPer1kTokens: number;
    latencyMs: number;
  }>;
}

export interface ModelResponse {
  content: string;
  modelName: string;
  provider: Provider;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  latency: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RequestLog {
  id: string;
  prompt: string;
  promptType: PromptType;
  selectedModel: string;
  provider: Provider;
  costUsd: number;
  latencyMs: number;
  qualityScore?: number;
  classificationMethod: string;
  classificationConfidence: number;
  priorityPreset: PriorityPreset;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  error?: string;
}

export interface ModelPerformance {
  modelName: string;
  provider: Provider;
  promptType: PromptType;
  avgCostUsd: number;
  avgLatencyMs: number;
  avgQualityScore: number;
  requestCount: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface RoutingRule {
  id: string;
  promptType: PromptType;
  priorityCost: number;
  priorityLatency: number;
  priorityQuality: number;
  targetModel: string;
  fallbackModel?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

export type PriorityWeights = Record<PriorityPreset, {
  quality: number;
  cost: number;
  latency: number;
}>;

export type ModelRegistry = Record<string, ModelConfig>;

export type PromptTypeMapping = Record<PromptType, {
  estimatedOutputTokens: number;
  keywords: string[];
  examples: string[];
}>;

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  [PriorityPreset.BALANCED]: { quality: 0.45, cost: 0.30, latency: 0.25 },
  [PriorityPreset.QUALITY]: { quality: 0.65, cost: 0.15, latency: 0.20 },
  [PriorityPreset.COST]: { quality: 0.30, cost: 0.50, latency: 0.20 },
  [PriorityPreset.LATENCY]: { quality: 0.30, cost: 0.20, latency: 0.50 },
};

export const PROMPT_TYPE_MAPPING: PromptTypeMapping = {
  [PromptType.CODE]: {
    estimatedOutputTokens: 500,
    keywords: ['write', 'code', 'function', 'class', 'algorithm', 'program', 'script'],
    examples: ['Write a Python function to...', 'Create a React component...', 'Implement an algorithm...'],
  },
  [PromptType.SUMMARIZE]: {
    estimatedOutputTokens: 300,
    keywords: ['summarize', 'summary', 'brief', 'overview', 'tl;dr', 'key points'],
    examples: ['Summarize this article...', 'Give me a brief overview...', 'What are the key points...'],
  },
  [PromptType.QA]: {
    estimatedOutputTokens: 200,
    keywords: ['what is', 'how to', 'explain', 'why', 'when', 'where', 'question', 'hello', 'hi', 'how are you', 'how do you do', 'greeting', 'conversation'],
    examples: ['What is the difference between...', 'How to implement...', 'Explain the concept of...', 'Hello, how are you?', 'Hi there!'],
  },
  [PromptType.CREATIVE]: {
    estimatedOutputTokens: 400,
    keywords: ['write', 'story', 'poem', 'creative', 'imagine', 'describe', 'narrative'],
    examples: ['Write a story about...', 'Create a poem...', 'Describe a scene...'],
  },
  [PromptType.MATH_REASONING]: {
    estimatedOutputTokens: 600,
    keywords: ['calculate', 'solve', 'equation', 'mathematical', 'math', 'algebra', 'geometry', 'calculus', 'statistics', 'probability', 'proof', 'theorem', 'formula', 'cos', 'sin', 'tan', 'log', 'ln', 'derivative', 'integral', 'matrix', 'vector', 'sqrt', 'exp', 'pi', '=', '+', '-', '*', '/', '^', 'x', 'y', 'z'],
    examples: ['Solve this equation...', 'Calculate the derivative...', 'Prove that...', 'Find the probability of...', 'solve 1 = cos2(x) + sin2(x)', 'Divide: z = (5 - i) / (2 + 3i)'],
  },
  [PromptType.UNKNOWN]: {
    estimatedOutputTokens: 300,
    keywords: [],
    examples: [],
  },
};

export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.6;
export const MAX_RETRY_ATTEMPTS = 2;
export const REQUEST_TIMEOUT_MS = 30000;
