import { PromptType, PromptTypeMapping, PROMPT_TYPE_MAPPING } from '@/lib/types';
import { Logger } from '@/utils/logger';

export interface HeuristicClassificationResult {
  promptType: PromptType;
  confidence: number;
  method: 'heuristic';
  metadata: {
    matchedKeywords: string[];
    keywordCount: number;
    totalKeywords: number;
    reasoning: string;
  };
}

export class HeuristicClassifier {
  private logger: Logger;
  private promptTypeMapping: PromptTypeMapping;

  constructor() {
    this.logger = new Logger('HeuristicClassifier');
    this.promptTypeMapping = PROMPT_TYPE_MAPPING;
  }

  /**
   * Classify prompt using keyword matching
   */
  classify(prompt: string): HeuristicClassificationResult {
    const startTime = Date.now();
    this.logger.info('Starting heuristic classification', { promptLength: prompt.length });

    const promptLower = prompt.toLowerCase();
    const scores: Record<PromptType, { score: number; matchedKeywords: string[] }> = {
      [PromptType.CODE]: { score: 0, matchedKeywords: [] },
      [PromptType.SUMMARIZE]: { score: 0, matchedKeywords: [] },
      [PromptType.QA]: { score: 0, matchedKeywords: [] },
      [PromptType.CREATIVE]: { score: 0, matchedKeywords: [] },
      [PromptType.MATH_REASONING]: { score: 0, matchedKeywords: [] },
      [PromptType.UNKNOWN]: { score: 0, matchedKeywords: [] },
    };

    // Calculate scores for each prompt type
    Object.entries(this.promptTypeMapping).forEach(([promptType, config]) => {
      if (promptType === PromptType.UNKNOWN) return;

      const matchedKeywords = config.keywords.filter(keyword => 
        promptLower.includes(keyword.toLowerCase())
      );

      const score = this.calculateKeywordScore(matchedKeywords, config.keywords);
      scores[promptType as PromptType] = {
        score,
        matchedKeywords,
      };
    });

    // Find the best match
    const bestMatch = this.findBestMatch(scores);
    const confidence = this.calculateConfidence(bestMatch, scores);

    const result: HeuristicClassificationResult = {
      promptType: bestMatch.promptType,
      confidence,
      method: 'heuristic',
      metadata: {
        matchedKeywords: bestMatch.matchedKeywords,
        keywordCount: bestMatch.matchedKeywords.length,
        totalKeywords: this.promptTypeMapping[bestMatch.promptType].keywords.length,
        reasoning: this.generateReasoning(bestMatch, scores),
      },
    };

    const latencyMs = Date.now() - startTime;
    this.logger.info('Heuristic classification completed', {
      promptType: result.promptType,
      confidence: result.confidence,
      latencyMs,
      metadata: result.metadata,
    });

    return result;
  }

  /**
   * Calculate score based on keyword matches
   */
  private calculateKeywordScore(matchedKeywords: string[], allKeywords: string[]): number {
    if (allKeywords.length === 0) return 0;
    
    const matchRatio = matchedKeywords.length / allKeywords.length;
    const exactMatches = matchedKeywords.filter(keyword => 
      allKeywords.includes(keyword)
    ).length;
    
    // Bonus for exact matches
    const exactMatchBonus = exactMatches * 0.1;
    
    return Math.min(1.0, matchRatio + exactMatchBonus);
  }

  /**
   * Find the prompt type with the highest score
   */
  private findBestMatch(scores: Record<PromptType, { score: number; matchedKeywords: string[] }>): {
    promptType: PromptType;
    score: number;
    matchedKeywords: string[];
  } {
    let bestMatch = {
      promptType: PromptType.UNKNOWN as PromptType,
      score: 0,
      matchedKeywords: [] as string[],
    };

    Object.entries(scores).forEach(([promptType, data]) => {
      if (promptType === PromptType.UNKNOWN) return;
      
      if (data.score > bestMatch.score) {
        bestMatch = {
          promptType: promptType as PromptType,
          score: data.score,
          matchedKeywords: data.matchedKeywords,
        };
      }
    });

    return bestMatch;
  }

  /**
   * Calculate confidence based on score and competition
   */
  private calculateConfidence(
    bestMatch: { promptType: PromptType; score: number; matchedKeywords: string[] },
    scores: Record<PromptType, { score: number; matchedKeywords: string[] }>
  ): number {
    const bestScore = bestMatch.score;
    
    // If no keywords matched, confidence is very low
    if (bestScore === 0) return 0.1;
    
    // Calculate how much better the best match is than others
    const otherScores = Object.entries(scores)
      .filter(([promptType]) => promptType !== bestMatch.promptType && promptType !== PromptType.UNKNOWN)
      .map(([, data]) => data.score);
    
    const maxOtherScore = Math.max(...otherScores, 0);
    const scoreDifference = bestScore - maxOtherScore;
    
    // Confidence increases with score difference
    let confidence = bestScore;
    if (scoreDifference > 0.3) confidence += 0.2;
    if (scoreDifference > 0.5) confidence += 0.1;
    
    // Cap confidence at 0.9 for heuristic classification
    return Math.min(0.9, confidence);
  }

  /**
   * Generate reasoning for the classification
   */
  private generateReasoning(
    bestMatch: { promptType: PromptType; score: number; matchedKeywords: string[] },
    scores: Record<PromptType, { score: number; matchedKeywords: string[] }>
  ): string {
    if (bestMatch.score === 0) {
      return 'No keywords matched any prompt type';
    }

    const promptTypeName = bestMatch.promptType === PromptType.UNKNOWN ? 'Unknown' : bestMatch.promptType;
    const keywordList = bestMatch.matchedKeywords.join(', ');
    
    let reasoning = `Classified as ${promptTypeName} with score ${bestMatch.score.toFixed(2)}. `;
    reasoning += `Matched keywords: ${keywordList}`;

    // Add competition analysis
    const competitors = Object.entries(scores)
      .filter(([promptType]) => promptType !== bestMatch.promptType && promptType !== PromptType.UNKNOWN)
      .filter(([, data]) => data.score > 0)
      .sort(([, a], [, b]) => b.score - a.score);

    if (competitors.length > 0) {
      const topCompetitor = competitors[0];
      reasoning += ` Top competitor: ${topCompetitor[0]} (${topCompetitor[1].score.toFixed(2)})`;
    }

    return reasoning;
  }

  /**
   * Check if heuristic classification is confident enough
   */
  shouldUseHeuristic(confidence: number): boolean {
    return confidence >= 0.7; // Use heuristic if confidence >= 70%
  }

  /**
   * Get classification confidence threshold
   */
  getConfidenceThreshold(): number {
    return 0.7;
  }
}
