/**
 * OpenAI Configuration for Deck Analysis Review
 */

export const OPENAI_MODELS = {
  'gpt-4.1-mini': {
    name: 'GPT-4.1 Mini',
    inputCost: 0.40, // per 1M tokens
    outputCost: 1.60, // per 1M tokens
    contextWindow: 1047576, // 1M tokens
    knowledgeCutoff: '2024-05-31',
    features: ['Fast', 'Cost-effective', 'Recent knowledge', 'Strong reasoning'],
    recommended: true
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini', 
    inputCost: 0.15, // per 1M tokens
    outputCost: 0.60, // per 1M tokens
    contextWindow: 128000, // 128K tokens
    knowledgeCutoff: '2023-10',
    features: ['Very cheap', 'Good for simple tasks'],
    recommended: false
  },
  'gpt-4o': {
    name: 'GPT-4o',
    inputCost: 5.00, // per 1M tokens
    outputCost: 20.00, // per 1M tokens
    contextWindow: 128000, // 128K tokens
    knowledgeCutoff: '2024-10',
    features: ['Most capable', 'Best vision', 'Expensive'],
    recommended: false
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    inputCost: 10.00, // per 1M tokens
    outputCost: 30.00, // per 1M tokens
    contextWindow: 128000, // 128K tokens
    knowledgeCutoff: '2023-04',
    features: ['Legacy model', 'Expensive'],
    recommended: false
  }
} as const;

export type OpenAIModelName = keyof typeof OPENAI_MODELS;

/**
 * Calculate the cost of a review
 */
export function calculateReviewCost(
  model: OpenAIModelName,
  inputTokens: number,
  outputTokens: number
): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  formattedCost: string;
} {
  const modelConfig = OPENAI_MODELS[model];
  
  const inputCost = (inputTokens / 1_000_000) * modelConfig.inputCost;
  const outputCost = (outputTokens / 1_000_000) * modelConfig.outputCost;
  const totalCost = inputCost + outputCost;
  
  return {
    inputCost,
    outputCost,
    totalCost,
    formattedCost: `$${totalCost.toFixed(4)}`
  };
}

/**
 * Estimate tokens for a deck analysis payload
 */
export function estimateTokens(payload: any): {
  inputTokens: number;
  outputTokens: number;
} {
  // Rough estimation: 1 token ≈ 4 characters
  const jsonString = JSON.stringify(payload);
  const inputTokens = Math.ceil(jsonString.length / 4);
  
  // Output is typically 400-600 tokens for a review
  const outputTokens = 500;
  
  return { inputTokens, outputTokens };
}

/**
 * Get the recommended model configuration
 */
export function getRecommendedModelConfig() {
  return {
    model: 'gpt-4.1-mini' as const,
    temperature: 0.3,
    maxTokens: 1500
  };
}

/**
 * Model selection helper for UI
 */
export function getModelOptions() {
  return Object.entries(OPENAI_MODELS).map(([key, config]) => ({
    value: key,
    label: config.name,
    description: `${config.features.join(', ')}`,
    recommended: config.recommended,
    costInfo: `Input: $${config.inputCost}/1M, Output: $${config.outputCost}/1M`
  }));
}