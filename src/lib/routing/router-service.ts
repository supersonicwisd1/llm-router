import { 
  RoutingRequest, 
  PromptType, 
  PriorityPreset,
  RequestLog,
  RoutingDecision,
  PROMPT_TYPE_MAPPING
} from '@/lib/types';
import { HybridClassifier } from '@/lib/classification';
import { RoutingEngine } from './routing-engine';
import { modelClientFactory, MODEL_REGISTRY } from '@/lib/models';
import { getServerEnv } from '@/config/env';

export interface RouterResponse {
  response: string;
  modelUsed: string;
  promptType: PromptType;
  classificationConfidence: number;
  routingDecision: RoutingDecision;
  actualCost: number;
  actualLatency: number;
  costSavings: number;
  timestamp: Date;
  wasTruncated?: boolean;
}

export interface RouterMetrics {
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  modelUsage: Record<string, number>;
  promptTypeDistribution: Record<PromptType, number>;
  totalCostSavings: number;
  classificationAccuracy: number;
}

export class RouterService {
  private classifier: HybridClassifier;
  private routingEngine: RoutingEngine;
  private modelFactory = modelClientFactory;
  private requestLogs: RequestLog[] = [];
  private maxLogs: number = 1000;

  constructor() {
    this.classifier = new HybridClassifier();
    this.routingEngine = new RoutingEngine();
  }

  /**
   * Main router method - handles the complete flow from prompt to response
   */
  async routePrompt(
    prompt: string, 
    priorityPreset: PriorityPreset = PriorityPreset.BALANCED,
    userId?: string,
    sessionId?: string
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    
    // Initialize variables outside try block for error handling
    let promptType: PromptType = PromptType.UNKNOWN;
    let classificationConfidence = 0.5;
    
    try {
      // Step 1: Classify the prompt
      const classificationResult = await this.classifier.classify(prompt);
      promptType = classificationResult.promptType;
      classificationConfidence = classificationResult.confidence;
      
      // Step 2: Estimate token count
      // Keep for future adaptive budgeting; currently unused
      // const estimatedTokens = this.estimateTokenCount(prompt, promptType);
      
      // Step 3: Create routing request
      const routingRequest: RoutingRequest = {
        prompt,
        promptType,
        priorityPreset,
        userId,
        sessionId
      };
      
      // Step 4: Get routing decision
      const routingDecision = await this.routingEngine.routeRequest(routingRequest);
      
      // Step 5: Execute the request with selected model
      console.log(`RouterService: Creating client for model: ${routingDecision.selectedModel}`);
      const modelClient = this.modelFactory.getClient(routingDecision.selectedModel);
      if (!modelClient) {
        throw new Error(`Model client not found for: ${routingDecision.selectedModel}`);
      }
      
      console.log(`RouterService: Generated client for provider: ${modelClient.provider}`);
      
      // Step 6: Generate response
      console.log(`RouterService: Generating response with model: ${routingDecision.selectedModel}`);
      
      let modelResponse;
      try {
        modelResponse = await modelClient.generateResponse(prompt, {
          maxTokens: this.getMaxOutputTokens(promptType),
          temperature: this.getTemperatureForPromptType(promptType),
          timeoutMs: await this.getRequestTimeout()
        });
        
        console.log(`RouterService: Response generated successfully:`, {
          responseLength: modelResponse.content?.length || 0,
          hasResponse: !!modelResponse.content
        });
        
      } catch (error) {
        // Model failed - mark it as unavailable and throw error for fallback
        console.log(`RouterService: Model ${routingDecision.selectedModel} failed, marking as unavailable`);
        this.routingEngine.markModelUnavailable(routingDecision.selectedModel);
        throw error;
      }
      
      const endTime = Date.now();
      const actualLatency = endTime - startTime;
      
      // Step 7: Calculate actual costs
      const actualCost = this.calculateActualCost(
        routingDecision.selectedModel, 
        prompt.length, 
        modelResponse.content?.length || 0
      );
      
      // Step 8: Calculate cost savings
      const costSavings = this.routingEngine.calculateCostSavings(actualCost, promptType);
      
      // Step 9: Log the request
      this.logRequest({
        id: this.generateRequestId(),
        prompt,
        promptType,
        selectedModel: routingDecision.selectedModel,
        provider: modelClient.provider,
        costUsd: actualCost,
        latencyMs: actualLatency,
        qualityScore: routingDecision.confidence,
        classificationMethod: classificationResult.method,
        classificationConfidence,
        priorityPreset,
        timestamp: new Date(),
        userId,
        sessionId
      });
      
      // Step 10: Return response with truncation if needed
      const maxResponseLength = 3000; // Characters, not tokens
      let finalResponse = modelResponse.content || 'No response generated';
      let wasTruncated = false;
      
      if (finalResponse.length > maxResponseLength) {
        // Find a good truncation point (end of sentence or paragraph)
        const truncationPoint = finalResponse.lastIndexOf('.', maxResponseLength);
        const fallbackPoint = finalResponse.lastIndexOf('\n', maxResponseLength);
        const cutPoint = truncationPoint > fallbackPoint ? truncationPoint : fallbackPoint;
        
        if (cutPoint > maxResponseLength * 0.8) { // Only truncate if we can find a good break point
          finalResponse = finalResponse.substring(0, cutPoint + 1) + '...';
          wasTruncated = true;
        }
      }
      
      const routerResponse: RouterResponse = {
        response: finalResponse,
        modelUsed: routingDecision.selectedModel,
        promptType,
        classificationConfidence,
        routingDecision,
        actualCost,
        actualLatency,
        costSavings,
        timestamp: new Date(),
        wasTruncated
      };
      
      return routerResponse;
      
    } catch (error) {
      // Handle errors and try fallback if available
      return this.handleRoutingError(prompt, priorityPreset, error, startTime, userId, sessionId, promptType, classificationConfidence);
    }
  }

  /**
   * Handle routing errors with fallback logic
   */
  private async handleRoutingError(
    prompt: string,
    priorityPreset: PriorityPreset,
    error: unknown,
    startTime: number,
    userId?: string,
    sessionId?: string,
    classifiedPromptType?: PromptType,
    classifiedConfidence?: number
  ): Promise<RouterResponse> {
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error occurred');
    
    // Try to use a fallback model (GPT-4o-mini as it's reliable and cost-effective)
    try {
      const fallbackClient = this.modelFactory.getClient('gpt-4o-mini');
      if (fallbackClient) {
        const fallbackResponse = await fallbackClient.generateResponse(prompt, {
          maxTokens: this.getMaxOutputTokens(classifiedPromptType || PromptType.UNKNOWN),
          temperature: 0.7,
          timeoutMs: 30000
        });
        
        const endTime = Date.now();
        const actualLatency = endTime - startTime;
        
        // Log the fallback request
        this.logRequest({
          id: this.generateRequestId(),
          prompt,
          promptType: classifiedPromptType || PromptType.UNKNOWN,
          selectedModel: 'gpt-4o-mini',
          provider: fallbackClient.provider,
          costUsd: 0.00015, // Cost per 1K tokens
          latencyMs: actualLatency,
          qualityScore: 0.5,
          classificationMethod: 'fallback',
          classificationConfidence: classifiedConfidence || 0.5,
          priorityPreset,
          timestamp: new Date(),
          userId,
          sessionId,
          error: errorMessage
        });
        
        // Apply same truncation logic to fallback
        const maxResponseLength = 3000;
        let finalFallbackResponse = fallbackResponse.content;
        let wasTruncated = false;
        
        if (finalFallbackResponse.length > maxResponseLength) {
          const truncationPoint = finalFallbackResponse.lastIndexOf('.', maxResponseLength);
          const fallbackPoint = finalFallbackResponse.lastIndexOf('\n', maxResponseLength);
          const cutPoint = truncationPoint > fallbackPoint ? truncationPoint : fallbackPoint;
          
          if (cutPoint > maxResponseLength * 0.8) {
            finalFallbackResponse = finalFallbackResponse.substring(0, cutPoint + 1) + '...';
            wasTruncated = true;
          }
        }
        
        return {
          response: finalFallbackResponse,
          modelUsed: 'gpt-4o-mini (fallback)',
          promptType: classifiedPromptType || PromptType.UNKNOWN,
          classificationConfidence: classifiedConfidence || 0.5,
          routingDecision: {
            selectedModel: 'gpt-4o-mini',
            provider: fallbackClient.provider,
            promptType: classifiedPromptType || PromptType.UNKNOWN,
            reasoning: 'Used as fallback due to routing error',
            confidence: 0.5,
            estimatedCost: 0.00015,
            estimatedLatency: actualLatency,
            score: 0.0,
            priorityWeights: { quality: 0.3, cost: 0.5, latency: 0.2 },
            alternatives: []
          },
          actualCost: 0.00015,
          actualLatency,
          costSavings: 0,
          timestamp: new Date(),
          wasTruncated
        };
      }
    } catch (fallbackError) {
      // If even fallback fails, return error response
      console.error('Fallback model also failed:', fallbackError);
    }
    
    // If all else fails, throw the original error
    const safeErrorMessage = errorMessage || 'Unknown routing error';
    throw new Error(`Routing failed: ${safeErrorMessage}`);
  }

  /**
   * Estimate token count for a prompt
   */
  private estimateTokenCount(prompt: string, promptType: PromptType): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const baseTokens = Math.ceil(prompt.length / 4);
    
    // Add buffer based on prompt type
    const typeMultiplier: Record<PromptType, number> = {
      [PromptType.CODE]: 1.2,            // Code is more token-dense
      [PromptType.SUMMARIZE]: 1.0,       // Standard text
      [PromptType.QA]: 1.1,              // Questions might need context
      [PromptType.CREATIVE]: 1.3,        // Creative prompts might be longer
      [PromptType.MATH_REASONING]: 1.4,  // Mathematical proofs can be lengthy
      [PromptType.UNKNOWN]: 1.0          // Default
    };
    
    return Math.ceil(baseTokens * (typeMultiplier[promptType] || 1.0));
  }

  /**
   * Get appropriate temperature for prompt type
   */
  private getTemperatureForPromptType(promptType: PromptType): number {
    const temperatures: Record<PromptType, number> = {
      [PromptType.CODE]: 0.1,            // Low temperature for precise code
      [PromptType.SUMMARIZE]: 0.3,       // Medium-low for factual summaries
      [PromptType.QA]: 0.2,              // Low for accurate answers
      [PromptType.CREATIVE]: 0.8,        // High for creative content
      [PromptType.MATH_REASONING]: 0.1,  // Very low for precise mathematical calculations
      [PromptType.UNKNOWN]: 0.5          // Default
    };
    
    return temperatures[promptType] ?? 0.5;
  }

  /**
   * Determine a sensible max output tokens based on prompt type
   */
  private getMaxOutputTokens(promptType: PromptType): number {
    const fallback = 800;
    const base = PROMPT_TYPE_MAPPING[promptType]?.estimatedOutputTokens ?? fallback;
    // Increased limits for better response quality - can be made configurable later
    const limits = {
      [PromptType.QA]: 2000,           // Q&A needs detailed explanations
      [PromptType.CREATIVE]: 2500,     // Creative content needs room to develop
      [PromptType.MATH_REASONING]: 3000, // Math proofs need full development
      [PromptType.CODE]: 2000,         // Code examples need to be complete
      [PromptType.SUMMARIZE]: 1500,    // Summaries need to be comprehensive
      [PromptType.UNKNOWN]: 1500,      // Default to generous limit
    };
    
    return limits[promptType] ?? Math.max(base * 2, 1500);
  }

  /**
   * Get request timeout from environment
   */
  private async getRequestTimeout(): Promise<number> {
    try {
      const env = await getServerEnv();
      return env.REQUEST_TIMEOUT_MS;
    } catch {
      return 30000; // Default 30 seconds
    }
  }

  /**
   * Calculate actual cost based on input/output tokens
   */
  private calculateActualCost(modelName: string, inputChars: number, outputChars: number): number {
    const modelConfig = MODEL_REGISTRY[modelName];
    if (!modelConfig) return 0;

    // Rough token estimation
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);

    const inputCost = (inputTokens / 1000000) * modelConfig.priceInputPerMillion;
    const outputCost = (outputTokens / 1000000) * modelConfig.priceOutputPerMillion;

    return inputCost + outputCost;
  }

  /**
   * Log a request for analytics
   */
  private logRequest(log: RequestLog): void {
    this.requestLogs.push(log);
    
    // Keep only the last N logs
    if (this.requestLogs.length > this.maxLogs) {
      this.requestLogs = this.requestLogs.slice(-this.maxLogs);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get router metrics
   */
  getMetrics(): RouterMetrics {
    const routingMetrics = this.routingEngine.getMetrics();
    
    // Calculate classification accuracy (simplified)
    const totalRequests = this.requestLogs.length;
    const successfulClassifications = this.requestLogs.filter(log => 
      log.classificationConfidence > 0.6
    ).length;
    
    const classificationAccuracy = totalRequests > 0 
      ? successfulClassifications / totalRequests 
      : 0;
    
    // Calculate total cost savings
    const totalCostSavings = this.requestLogs.reduce((sum, log) => {
      // This is a simplified calculation - in practice you'd compare against baseline
      return sum + (log.costUsd * 0.2); // Assume 20% savings on average
    }, 0);
    
    return {
      totalRequests,
      totalCost: routingMetrics.totalCost,
      averageLatency: routingMetrics.averageLatency,
      modelUsage: routingMetrics.modelUsage,
      promptTypeDistribution: routingMetrics.promptTypeDistribution,
      totalCostSavings,
      classificationAccuracy
    };
  }

  /**
   * Get recent request logs
   */
  getRecentLogs(limit: number = 50): RequestLog[] {
    return this.requestLogs.slice(-limit).reverse();
  }

  /**
   * Reset all metrics and logs
   */
  resetMetrics(): void {
    this.routingEngine.resetMetrics();
    this.requestLogs = [];
  }
}
