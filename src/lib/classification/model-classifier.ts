import { PromptType } from '@/lib/types';
import { Logger } from '@/utils/logger';
import { modelClientFactory } from '@/lib/models';

export interface ModelClassificationResult {
  promptType: PromptType;
  confidence: number;
  method: 'model';
  metadata: {
    modelUsed: string;
    responseTime: number;
    reasoning: string;
    rawResponse: string;
  };
}

export class ModelClassifier {
  private logger: Logger;
  private classificationModel: string;

  constructor(classificationModel: string = 'gpt-4o-mini') {
    this.logger = new Logger('ModelClassifier');
    this.classificationModel = classificationModel;
  }

  /**
   * Classify prompt using the classification model
   */
  async classify(prompt: string): Promise<ModelClassificationResult> {
    const startTime = Date.now();
    this.logger.info('Starting model classification', { 
      promptLength: prompt.length, 
      model: this.classificationModel 
    });

    try {
      const client = modelClientFactory.getClient(this.classificationModel);
      
      // Create classification prompt
      const classificationPrompt = this.createClassificationPrompt(prompt);
      
      // Generate classification response
      const response = await client.generateResponse(classificationPrompt, {
        maxTokens: 200,
        temperature: 0.1, // Low temperature for consistent classification
        systemPrompt: 'You are a prompt classification expert. Analyze the given prompt and classify it into one of the specified categories.',
      });

      const responseTime = Date.now() - startTime;
      
      // Parse the response
      const parsedResult = this.parseClassificationResponse(response.content);
      
      const result: ModelClassificationResult = {
        promptType: parsedResult.promptType,
        confidence: parsedResult.confidence,
        method: 'model',
        metadata: {
          modelUsed: this.classificationModel,
          responseTime,
          reasoning: parsedResult.reasoning,
          rawResponse: response.content,
        },
      };

      this.logger.info('Model classification completed', {
        promptType: result.promptType,
        confidence: result.confidence,
        responseTime,
        model: this.classificationModel,
      });

      return result;

    } catch (error) {
      this.logger.error('Model classification failed', error);
      throw new Error(`Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a structured prompt for classification
   */
  private createClassificationPrompt(prompt: string): string {
    return `Please classify the following prompt into one of these categories:

1. CODE - Programming, algorithms, technical implementation
2. SUMMARIZE - Summarization, brief overview, key points
3. QA - Questions, explanations, how-to, what-is
4. CREATIVE - Creative writing, stories, poems, imaginative content

Prompt to classify:
"${prompt}"

Respond in this exact JSON format:
{
  "category": "CODE|SUMMARIZE|QA|CREATIVE",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category was chosen"
}

Only respond with the JSON, no additional text.`;
  }

  /**
   * Parse the classification response from the model
   */
  private parseClassificationResponse(response: string): {
    promptType: PromptType;
    confidence: number;
    reasoning: string;
  } {
    try {
      // Clean the response and extract JSON
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      if (!parsed.category || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Invalid response format');
      }

      // Map category to PromptType
      const promptType = this.mapCategoryToPromptType(parsed.category);
      
      // Validate confidence
      const confidence = Math.max(0, Math.min(1, parsed.confidence));

      return {
        promptType,
        confidence,
        reasoning: parsed.reasoning,
      };

    } catch (error) {
      this.logger.warn('Failed to parse classification response', { 
        response, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Fallback to UNKNOWN with low confidence
      return {
        promptType: PromptType.UNKNOWN,
        confidence: 0.1,
        reasoning: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Map category string to PromptType enum
   */
  private mapCategoryToPromptType(category: string): PromptType {
    const categoryUpper = category.toUpperCase();
    
    switch (categoryUpper) {
      case 'CODE':
        return PromptType.CODE;
      case 'SUMMARIZE':
        return PromptType.SUMMARIZE;
      case 'QA':
        return PromptType.QA;
      case 'CREATIVE':
        return PromptType.CREATIVE;
      default:
        this.logger.warn('Unknown category in response', { category });
        return PromptType.UNKNOWN;
    }
  }

  /**
   * Check if the classification model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await modelClientFactory.isModelAvailable(this.classificationModel);
    } catch (error) {
      this.logger.warn('Failed to check model availability', error);
      return false;
    }
  }

  /**
   * Get the classification model name
   */
  getModelName(): string {
    return this.classificationModel;
  }
}
