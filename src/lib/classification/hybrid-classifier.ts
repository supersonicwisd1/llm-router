import { PromptType } from '@/lib/types';
import { Logger } from '@/utils/logger';
import { HeuristicClassifier, HeuristicClassificationResult as HeuristicResult } from './heuristic-classifier';
import { ModelClassifier, ModelClassificationResult } from './model-classifier';

export interface HybridClassificationResult {
  promptType: PromptType;
  confidence: number;
  method: 'heuristic' | 'model' | 'hybrid';
  metadata: {
    heuristicResult?: HeuristicResult;
    modelResult?: ModelClassificationResult;
    finalMethod: string;
    reasoning: string;
    totalTime: number;
  };
}

export class HybridClassifier {
  private logger: Logger;
  private heuristicClassifier: HeuristicClassifier;
  private modelClassifier: ModelClassifier;
  private confidenceThreshold: number;

  constructor() {
    this.logger = new Logger('HybridClassifier');
    this.heuristicClassifier = new HeuristicClassifier();
    this.modelClassifier = new ModelClassifier();
    // Default confidence threshold - will be set when used on server side
    this.confidenceThreshold = 0.6;
  }

  private async getConfidenceThreshold(): Promise<number> {
    if (typeof window === 'undefined') {
      // Server-side: get from environment
      const { getServerEnv } = await import('@/config/env');
      const env = getServerEnv();
      return env.CLASSIFICATION_CONFIDENCE_THRESHOLD;
    } else {
      // Client-side: use default
      return this.confidenceThreshold;
    }
  }

  /**
   * Classify prompt using hybrid approach
   */
  async classify(prompt: string): Promise<HybridClassificationResult> {
    const startTime = Date.now();
    this.logger.info('Starting hybrid classification', { promptLength: prompt.length });

    try {
      // Get confidence threshold
      const confidenceThreshold = await this.getConfidenceThreshold();
      
      // Step 1: Try heuristic classification first (fast, free)
      const heuristicResult = this.heuristicClassifier.classify(prompt);
      
      this.logger.info('Heuristic classification result', {
        promptType: heuristicResult.promptType,
        confidence: heuristicResult.confidence,
        method: 'heuristic',
      });

      // Step 2: Check if heuristic is confident enough
      if (this.heuristicClassifier.shouldUseHeuristic(heuristicResult.confidence)) {
        const totalTime = Date.now() - startTime;
        
        this.logger.info('Using heuristic classification', {
          promptType: heuristicResult.promptType,
          confidence: heuristicResult.confidence,
          totalTime,
        });

        return {
          promptType: heuristicResult.promptType,
          confidence: heuristicResult.confidence,
          method: 'heuristic',
          metadata: {
            heuristicResult,
            finalMethod: 'heuristic_only',
            reasoning: `Heuristic classification confident enough (${heuristicResult.confidence.toFixed(2)} >= ${confidenceThreshold})`,
            totalTime,
          },
        };
      }

      // Step 3: Heuristic not confident enough, use model classification
      this.logger.info('Heuristic not confident, falling back to model classification', {
        heuristicConfidence: heuristicResult.confidence,
        threshold: confidenceThreshold,
      });

      const modelResult = await this.modelClassifier.classify(prompt);
      
      this.logger.info('Model classification result', {
        promptType: modelResult.promptType,
        confidence: modelResult.confidence,
        method: 'model',
      });

      // Step 4: Combine results and make final decision
      const finalResult = this.combineResults(heuristicResult, modelResult);
      const totalTime = Date.now() - startTime;

      this.logger.info('Hybrid classification completed', {
        finalPromptType: finalResult.promptType,
        finalConfidence: finalResult.confidence,
        method: finalResult.method,
        totalTime,
      });

      return {
        promptType: finalResult.promptType,
        confidence: finalResult.confidence,
        method: finalResult.method,
        metadata: {
          heuristicResult,
          modelResult,
          finalMethod: finalResult.method,
          reasoning: finalResult.reasoning,
          totalTime,
        },
      };

    } catch (error) {
      this.logger.error('Hybrid classification failed', error);
      
      // Fallback to heuristic result if available, otherwise UNKNOWN
      const heuristicResult = this.heuristicClassifier.classify(prompt);
      const totalTime = Date.now() - startTime;
      
      return {
        promptType: heuristicResult.promptType,
        confidence: Math.max(0.1, heuristicResult.confidence * 0.5), // Reduce confidence due to error
        method: 'heuristic',
        metadata: {
          heuristicResult,
          finalMethod: 'heuristic_fallback',
          reasoning: `Classification failed, using heuristic fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
          totalTime,
        },
      };
    }
  }

  /**
   * Combine heuristic and model results to make final decision
   */
  private combineResults(
    heuristicResult: HeuristicResult,
    modelResult: ModelClassificationResult
  ): {
    promptType: PromptType;
    confidence: number;
    method: 'heuristic' | 'model' | 'hybrid';
    reasoning: string;
  } {
    // If both agree on the same prompt type, use the higher confidence
    if (heuristicResult.promptType === modelResult.promptType) {
      const maxConfidence = Math.max(heuristicResult.confidence, modelResult.confidence);
      const method: 'heuristic' | 'model' | 'hybrid' = maxConfidence === heuristicResult.confidence ? 'heuristic' : 'model';
      
      return {
        promptType: heuristicResult.promptType,
        confidence: maxConfidence,
        method,
        reasoning: `Both methods agree on ${heuristicResult.promptType}. Using ${method} result with confidence ${maxConfidence.toFixed(2)}.`,
      };
    }

    // If they disagree, use the model result if it's significantly more confident
    const confidenceDifference = modelResult.confidence - heuristicResult.confidence;
    
    if (confidenceDifference > 0.2) {
      return {
        promptType: modelResult.promptType,
        confidence: modelResult.confidence,
        method: 'model',
        reasoning: `Methods disagree. Model is ${confidenceDifference.toFixed(2)} more confident, using model result: ${modelResult.promptType}.`,
      };
    }

    // If confidence is close, use the model result (more sophisticated)
    if (confidenceDifference > 0) {
      return {
        promptType: modelResult.promptType,
        confidence: modelResult.confidence,
        method: 'model',
        reasoning: `Methods disagree but model is slightly more confident. Using model result: ${modelResult.promptType}.`,
      };
    }

    // Otherwise, use heuristic result
    return {
      promptType: heuristicResult.promptType,
      confidence: heuristicResult.confidence,
      method: 'heuristic',
      reasoning: `Methods disagree. Heuristic is more confident, using heuristic result: ${heuristicResult.promptType}.`,
    };
  }

  /**
   * Get classification statistics
   */
  getStats(): {
    confidenceThreshold: number;
    heuristicThreshold: number;
    classificationModel: string;
  } {
    return {
      confidenceThreshold: this.confidenceThreshold,
      heuristicThreshold: this.heuristicClassifier.getConfidenceThreshold(),
      classificationModel: this.modelClassifier.getModelName(),
    };
  }

  /**
   * Update confidence threshold
   */
  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.confidenceThreshold = threshold;
    this.logger.info('Updated confidence threshold', { newThreshold: threshold });
  }

  /**
   * Check if model classification is available
   */
  async isModelAvailable(): Promise<boolean> {
    return await this.modelClassifier.isAvailable();
  }

  /**
   * Force model classification (bypass heuristic)
   */
  async forceModelClassification(prompt: string): Promise<ModelClassificationResult> {
    this.logger.info('Forcing model classification', { promptLength: prompt.length });
    return await this.modelClassifier.classify(prompt);
  }

  /**
   * Force heuristic classification (bypass model)
   */
  forceHeuristicClassification(prompt: string): HeuristicResult {
    this.logger.info('Forcing heuristic classification', { promptLength: prompt.length });
    return this.heuristicClassifier.classify(prompt);
  }
}
