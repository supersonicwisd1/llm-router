import { 
  PromptType, 
  PriorityPreset, 
  ModelConfig, 
  RoutingRequest, 
  RoutingRule,
  PriorityWeights,
  RoutingDecision
} from '@/lib/types';
import { MODEL_REGISTRY, getModelByName, updateModelAvailability } from '@/lib/models/model-registry';
import { getRoutingRules, getContextAwareRules, getPriorityWeights } from './routing-rules';

// Use RoutingDecision from '@/lib/types'

export interface RoutingMetrics {
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  modelUsage: Record<string, number>;
  promptTypeDistribution: Record<PromptType, number>;
  costSavings: number;
}

export class RoutingEngine {
  private routingRules: RoutingRule[];
  private contextAwareRules: Record<string, unknown>;
  private priorityWeights: Record<PriorityPreset, PriorityWeights[keyof PriorityWeights]>;
  private metrics: RoutingMetrics;

  constructor() {
    this.routingRules = getRoutingRules();
    this.contextAwareRules = getContextAwareRules();
    this.priorityWeights = getPriorityWeights();
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): RoutingMetrics {
    return {
      totalRequests: 0,
      totalCost: 0,
      averageLatency: 0,
      modelUsage: {},
      promptTypeDistribution: {
        [PromptType.CODE]: 0,
        [PromptType.SUMMARIZE]: 0,
        [PromptType.QA]: 0,
        [PromptType.CREATIVE]: 0,
        [PromptType.MATH_REASONING]: 0,
        [PromptType.UNKNOWN]: 0,
      },
      costSavings: 0,
    };
  }

  /**
   * Main routing method - selects the optimal model for a given request
   */
  async routeRequest(request: RoutingRequest): Promise<RoutingDecision> {
    const { promptType, priorityPreset } = request;
    
    if (!promptType) {
      throw new Error('Prompt type is required for routing');
    }
    
    // Update metrics
    this.updateMetrics(promptType);
    
    // Get applicable routing rules
    const applicableRules = this.getApplicableRules(promptType);
    
    // Estimate tokens from prompt length (rough estimation)
    const estimatedTokens = Math.ceil((request.prompt?.length || 0) / 4);
    
    // Get available models for this prompt type
    const availableModels = this.getAvailableModels(promptType, estimatedTokens);
    
    if (availableModels.length === 0) {
      throw new Error(`No available models for prompt type: ${promptType}`);
    }

    // Score models based on priorities and constraints
    const scoredModels = this.scoreModels(availableModels, applicableRules, priorityPreset, promptType, estimatedTokens);
    
    // Select the best model
    const selectedModel = scoredModels[0];
    
    // Smart fallback selection: choose the best available model as fallback
    const fallbackModel = scoredModels.find(model => 
      model.modelName !== selectedModel.modelName && 
      model.isAvailable !== false
    );
    
    // Calculate estimated costs and latency
    const estimatedCost = this.estimateCost(selectedModel, estimatedTokens);
    const estimatedLatency = selectedModel.latencyMs;
    
    // Generate smart alternatives: only include available models with good prompt type fit
    const smartAlternatives = scoredModels
      .slice(1) // Skip the selected model
      .filter(model => model.isAvailable !== false) // Only available models
      .slice(0, 4) // Top 4 alternatives
      .map(model => ({
        modelName: model.modelName,
        score: (model as ModelConfig & { score: number }).score || 0,
        reason: this.generateAlternativeReasoning(model, selectedModel, promptType),
        provider: model.provider,
        qualityScore: model.qualityPriors[promptType] || 0,
        costPer1kTokens: model.inputCostPer1kTokens,
        latencyMs: model.latencyMs
      }));
    
    // Generate routing decision
    const decision: RoutingDecision = {
      selectedModel: selectedModel.modelName,
      provider: selectedModel.provider,
      promptType,
      fallbackModel: fallbackModel?.modelName,
      reasoning: this.generateReasoning(selectedModel, scoredModels, promptType, priorityPreset),
      confidence: this.calculateConfidence(selectedModel, scoredModels),
      estimatedCost,
      estimatedLatency,
      score: (selectedModel as ModelConfig & { score: number }).score || 0,
      priorityWeights: this.priorityWeights[priorityPreset],
      alternatives: smartAlternatives
    };

    return decision;
  }

  /**
   * Get applicable routing rules for the prompt type and priority
   */
  private getApplicableRules(promptType: PromptType): RoutingRule[] {
    return this.routingRules.filter(rule => 
      rule.promptType === promptType && 
      rule.isActive
    );
  }

  /**
   * Get available models that can handle the prompt type and token count
   */
  private getAvailableModels(promptType: PromptType, estimatedTokens: number): ModelConfig[] {
    const models: ModelConfig[] = [];
    
    console.log(`Routing Engine: Looking for models for prompt type: ${promptType}, estimated tokens: ${estimatedTokens}`);
    
    for (const [modelName] of Object.entries(MODEL_REGISTRY)) {
      // Get the computed model config with all properties
      const config = getModelByName(modelName);
      if (!config) {
        console.log(`Routing Engine: Model config not found for: ${modelName}`);
        continue;
      }
      
      console.log(`Routing Engine: Checking model ${modelName}:`);
      console.log(`  - Capabilities: [${config.capabilities.join(', ')}]`);
      console.log(`  - Includes ${promptType}? ${config.capabilities.includes(promptType)}`);
      console.log(`  - Context window: ${config.contextWindow}, Required: ${estimatedTokens}`);
      
      // Check if model supports the prompt type
      if (config.capabilities.includes(promptType)) {
        // Check if model can handle the token count
        if (config.contextWindow >= estimatedTokens) {
          // Check if model is marked as available
          console.log(`Routing Engine: Model ${modelName} availability check:`, {
            isAvailable: config.isAvailable,
            isAvailableType: typeof config.isAvailable,
            isAvailableNotFalse: config.isAvailable !== false
          });
          
          if (config.isAvailable !== false) {
            console.log(`Routing Engine: Model ${modelName} is available`);
            models.push(config);
          } else {
            console.log(`Routing Engine: Model ${modelName} is marked as unavailable`);
          }
        } else {
          console.log(`Routing Engine: Model ${modelName} context window too small`);
        }
      } else {
        console.log(`Routing Engine: Model ${modelName} doesn't support ${promptType}`);
      }
    }
    
    console.log(`Routing Engine: Found ${models.length} available models: [${models.map(m => m.modelName).join(', ')}]`);
    
    // Return models without pre-sorting - let the scoring algorithm handle the ranking
    return models;
  }

  /**
   * Score models based on priorities and constraints
   */
  private scoreModels(
    models: ModelConfig[], 
    _rules: RoutingRule[], 
    priorityPreset: PriorityPreset, 
    promptType: PromptType,
    estimatedTokens: number
  ): Array<ModelConfig & { score: number }> {
    const weights = this.priorityWeights[priorityPreset];
    
    console.log(`Routing Engine: Scoring models with priority preset: ${priorityPreset}`);
    console.log(`Routing Engine: Priority weights: Quality=${weights.quality}, Cost=${weights.cost}, Latency=${weights.latency}`);
    
    const scoredModels = models.map(model => {
      let score = 0;
      
      // Quality score with stronger amplification for quality priority
      const qualityScore = model.qualityPriors[promptType] || 0.5;
      let effectiveQualityScore = qualityScore;
      
      // When quality is the primary concern, amplify differences more aggressively
      if (weights.quality > 0.5) {
        // Use exponential scaling to make quality differences more pronounced
        effectiveQualityScore = Math.pow(qualityScore, 0.3); // Cube root for stronger amplification
        
        // Additional bonus for high-quality models when quality is prioritized
        if (qualityScore > 0.9) {
          effectiveQualityScore += 0.1; // Extra boost for top-tier models
        }
      }
      
      const qualityContribution = effectiveQualityScore * weights.quality;
      score += qualityContribution;
      
      // Improved cost scoring that doesn't over-reward free models
      let costScore = 0;
      const costs = models.map(m => m.inputCostPer1kTokens);
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs);
      
      if (maxCost > 0) {
        if (weights.cost > 0.4) {
          // When cost is prioritized, use standard inverse scoring
          costScore = 1 - (model.inputCostPer1kTokens / maxCost);
        } else {
          // When quality/latency is prioritized, use much fairer cost scoring
          if (model.inputCostPer1kTokens === 0) {
            // Free models get good but not perfect cost score
            costScore = 0.6;
          } else {
            // Use logarithmic scaling for much fairer cost distribution
            const normalizedCost = (model.inputCostPer1kTokens - minCost) / (maxCost - minCost);
            // Logarithmic scaling reduces extreme cost penalties
            costScore = 1 - Math.log(1 + normalizedCost * 2) / Math.log(3);
            
            // Additional bonus: when quality is heavily prioritized, give premium models better cost scores
            if (weights.quality > 0.6) {
              // Premium models (Claude, GPT-5) get better cost scores
              if (model.modelName.includes('claude') || model.modelName.includes('gpt-5')) {
                costScore = Math.max(costScore, 0.6); // Higher minimum for premium models
              } else {
                costScore = Math.max(costScore, 0.4); // Standard minimum for others
              }
            }
          }
        }
      } else {
        costScore = 0.5;
      }
      
      const costContribution = costScore * weights.cost;
      score += costContribution;
      
      // Latency score (inverted, so lower latency = higher score)
      const maxLatency = Math.max(...models.map(m => m.latencyMs));
      let latencyScore = 1 - (model.latencyMs / maxLatency);
      
      // When quality is prioritized, reduce latency penalty for premium models
      if (weights.quality > 0.6) {
        // Premium models get better latency scores
        if (model.modelName.includes('claude') || model.modelName.includes('gpt-5')) {
          // Use square root scaling to reduce extreme latency penalties
          latencyScore = Math.sqrt(latencyScore);
        }
      }
      
      const latencyContribution = latencyScore * weights.latency;
      score += latencyContribution;
      
      // Context window bonus (prefer models with larger context for long prompts)
      if (estimatedTokens > 1000) {
        const contextBonus = Math.min(0.1, (model.contextWindow - estimatedTokens) / 10000);
        score += contextBonus;
      }
      
      // Throughput bonus (prefer models with higher throughput)
      const maxThroughput = Math.max(...models.map(m => m.throughputTps));
      const throughputScore = (model.throughputTps / maxThroughput) * 0.05;
      score += throughputScore;
      
      console.log(`Routing Engine: Model ${model.modelName} scoring:`);
      console.log(`  - Quality: ${qualityScore} → ${effectiveQualityScore} → ${qualityContribution.toFixed(4)}`);
      console.log(`  - Cost: ${costScore.toFixed(4)} → ${costContribution.toFixed(4)}`);
      console.log(`  - Latency: ${latencyScore.toFixed(4)} → ${latencyContribution.toFixed(4)}`);
      console.log(`  - Final Score: ${score.toFixed(4)}`);
      
      return { ...model, score };
    }).sort((a, b) => b.score - a.score);
    
    console.log(`Routing Engine: Final model ranking:`);
    scoredModels.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.modelName}: ${model.score.toFixed(4)}`);
    });
    
    return scoredModels;
  }

  /**
   * Generate reasoning for the selected model
   */
  private generateReasoning(
    selectedModel: ModelConfig, 
    scoredModels: Array<ModelConfig & { score: number }>, 
    promptType: PromptType, 
    priorityPreset: PriorityPreset
  ): string {
    const weights = this.priorityWeights[priorityPreset];
    const reasons: string[] = [];
    
    // Add primary reason based on priority
    if (weights.quality > weights.cost && weights.quality > weights.latency) {
      reasons.push(`Selected for highest quality (${(selectedModel.qualityPriors[promptType] * 100).toFixed(1)}%)`);
    } else if (weights.cost > weights.quality && weights.cost > weights.latency) {
      reasons.push(`Selected for lowest cost ($${selectedModel.inputCostPer1kTokens}/1K tokens)`);
    } else if (weights.latency > weights.quality && weights.latency > weights.cost) {
      reasons.push(`Selected for fastest response (${selectedModel.latencyMs}ms)`);
    } else {
      reasons.push(`Selected for balanced performance`);
    }
    
    // Add context window info if relevant
    if (selectedModel.contextWindow > 100000) {
      reasons.push(`Large context window (${(selectedModel.contextWindow / 1000).toFixed(0)}K tokens)`);
    }
    
    // Add throughput info
    reasons.push(`Throughput: ${selectedModel.throughputTps} TPS`);
    
    return reasons.join('. ');
  }

  /**
   * Generate reasoning for alternative models
   */
  private generateAlternativeReasoning(
    alternativeModel: ModelConfig, 
    selectedModel: ModelConfig, 
    promptType: PromptType
  ): string {
    const reasons: string[] = [];
    
    // Quality comparison
    const altQuality = alternativeModel.qualityPriors[promptType] || 0;
    const selectedQuality = selectedModel.qualityPriors[promptType] || 0;
    
    if (altQuality > selectedQuality) {
      reasons.push(`Higher quality (${(altQuality * 100).toFixed(1)}% vs ${(selectedQuality * 100).toFixed(1)}%)`);
    } else if (altQuality === selectedQuality) {
      reasons.push(`Equal quality (${(altQuality * 100).toFixed(1)}%)`);
    } else {
      reasons.push(`Quality: ${(altQuality * 100).toFixed(1)}%`);
    }
    
    // Cost comparison
    if (alternativeModel.inputCostPer1kTokens < selectedModel.inputCostPer1kTokens) {
      reasons.push(`Lower cost ($${alternativeModel.inputCostPer1kTokens.toFixed(4)}/1K tokens)`);
    } else if (alternativeModel.inputCostPer1kTokens === 0) {
      reasons.push(`Free model`);
    } else {
      reasons.push(`Cost: $${alternativeModel.inputCostPer1kTokens.toFixed(4)}/1K tokens`);
    }
    
    // Latency comparison
    if (alternativeModel.latencyMs < selectedModel.latencyMs) {
      reasons.push(`Faster (${alternativeModel.latencyMs}ms)`);
    } else {
      reasons.push(`Latency: ${alternativeModel.latencyMs}ms`);
    }
    
    // Special strengths
    if (alternativeModel.contextWindow > selectedModel.contextWindow) {
      reasons.push(`Larger context (${alternativeModel.contextWindow.toLocaleString()} tokens)`);
    }
    
    return reasons.join(' • ');
  }

  /**
   * Calculate confidence in the routing decision
   */
  private calculateConfidence(
    selectedModel: ModelConfig, 
    scoredModels: Array<ModelConfig & { score: number }>
  ): number {
    if (scoredModels.length === 1) return 1.0;
    
    const selectedScore = (selectedModel as ModelConfig & { score: number }).score || 0;
    const secondBestScore = (scoredModels[1] as ModelConfig & { score: number })?.score || 0;
    
    // Confidence is high if there's a clear winner
    if (secondBestScore === 0) return 1.0;
    
    const scoreDifference = selectedScore - secondBestScore;
    const maxScore = Math.max(selectedScore, secondBestScore);
    
    // Normalize confidence based on score difference
    return Math.min(1.0, 0.5 + (scoreDifference / maxScore) * 0.5);
  }

  /**
   * Estimate cost for a model and token count
   */
  private estimateCost(model: ModelConfig, estimatedTokens: number): number {
    const inputCost = (estimatedTokens / 1000) * model.inputCostPer1kTokens;
    const outputCost = (estimatedTokens * 0.3 / 1000) * model.outputCostPer1kTokens; // Assume 30% output ratio
    return inputCost + outputCost;
  }

  /**
   * Update metrics after routing
   */
  private updateMetrics(promptType: PromptType): void {
    this.metrics.totalRequests++;
    this.metrics.promptTypeDistribution[promptType]++;
  }

  /**
   * Get current routing metrics
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Mark a model as unavailable (called when errors occur)
   */
  public markModelUnavailable(modelName: string): void {
    console.log(`Routing Engine: Marking model ${modelName} as unavailable`);
    
    // Update the model registry to mark this model as unavailable
    updateModelAvailability(modelName, false);
  }

  /**
   * Get the best alternative model for a specific prompt type when primary fails
   */
  public getBestAlternativeForPromptType(promptType: PromptType, excludeModel?: string): ModelConfig | null {
    const availableModels = Object.values(MODEL_REGISTRY)
      .map(baseConfig => getModelByName(baseConfig.modelName))
      .filter(model => 
        model && 
        model.isAvailable !== false && 
        model.modelName !== excludeModel &&
        model.capabilities.includes(promptType)
      ) as ModelConfig[];
    
    if (availableModels.length === 0) return null;
    
    // Score models for this prompt type and return the best
    const scoredModels = availableModels.map(model => ({
      ...model,
      score: (model.qualityPriors[promptType] || 0.5) * 0.6 + 
             (1 - model.inputCostPer1kTokens / Math.max(...availableModels.map(m => m.inputCostPer1kTokens))) * 0.3 +
             (1 - model.latencyMs / Math.max(...availableModels.map(m => m.latencyMs))) * 0.1
    }));
    
    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0];
  }

  /**
   * Get cost savings compared to using the most expensive model
   */
  calculateCostSavings(actualCost: number, promptType: PromptType): number {
    const mostExpensiveModel = Object.values(MODEL_REGISTRY)
      .map(baseConfig => getModelByName(baseConfig.modelName))
      .filter(model => model && model.capabilities.includes(promptType))
      .sort((a, b) => (b?.inputCostPer1kTokens || 0) - (a?.inputCostPer1kTokens || 0))[0];
    
    if (!mostExpensiveModel) return 0;
    
    const maxCost = (1000 / 1000) * mostExpensiveModel.inputCostPer1kTokens;
    return Math.max(0, maxCost - actualCost);
  }
}
