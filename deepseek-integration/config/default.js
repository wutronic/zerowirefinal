import dotenv from 'dotenv';

dotenv.config();

/**
 * DeepSeek API Configuration
 * Loads settings from environment variables with sensible defaults
 */
export const config = {
  // API Configuration
  api: {
    baseURL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    timeout: parseInt(process.env.DEEPSEEK_TIMEOUT) || 30000,
    retries: parseInt(process.env.DEEPSEEK_RETRIES) || 3,
    retryDelay: parseInt(process.env.DEEPSEEK_RETRY_DELAY) || 1000,
  },

  // Model Configuration
  models: {
    chat: process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat',
    coder: process.env.DEEPSEEK_CODER_MODEL || 'deepseek-coder',
    reasoning: process.env.DEEPSEEK_REASONING_MODEL || 'deepseek-reasoner',
  },

  // Default Parameters
  defaults: {
    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 2048,
    topP: parseFloat(process.env.DEEPSEEK_TOP_P) || 0.95,
    frequencyPenalty: parseFloat(process.env.DEEPSEEK_FREQ_PENALTY) || 0,
    presencePenalty: parseFloat(process.env.DEEPSEEK_PRESENCE_PENALTY) || 0,
  },

  // CLI Configuration
  cli: {
    verbose: process.env.DEEPSEEK_VERBOSE === 'true',
    logLevel: process.env.DEEPSEEK_LOG_LEVEL || 'info',
    outputFormat: process.env.DEEPSEEK_OUTPUT_FORMAT || 'text', // text, json, markdown
  }
};

/**
 * Validate configuration
 */
export function validateConfig() {
  const errors = [];

  if (!config.api.apiKey) {
    errors.push('DEEPSEEK_API_KEY environment variable is required');
  }

  if (config.defaults.temperature < 0 || config.defaults.temperature > 2) {
    errors.push('Temperature must be between 0 and 2');
  }

  if (config.defaults.maxTokens < 1 || config.defaults.maxTokens > 8192) {
    errors.push('Max tokens must be between 1 and 8192');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default config; 