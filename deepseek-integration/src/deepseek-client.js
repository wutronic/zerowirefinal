import axios from 'axios';
import { config } from '../config/default.js';
import { Logger } from '../utils/logger.js';

/**
 * DeepSeek API Client
 * Clean, modular client for interacting with DeepSeek API
 */
export class DeepSeekClient {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.logger = new Logger(this.config.cli.logLevel);
    
    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: this.config.api.baseURL,
      timeout: this.config.api.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.api.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'deepseek-integration/1.0.0'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('API Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        this.logger.error('Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        this.logger.error('Response Error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Format API errors into consistent structure
   */
  formatError(error) {
    if (error.response) {
      return {
        type: 'API_ERROR',
        status: error.response.status,
        message: error.response.data?.message || 'API request failed',
        details: error.response.data
      };
    }
    
    if (error.request) {
      return {
        type: 'NETWORK_ERROR',
        message: 'No response received from API',
        details: error.request
      };
    }
    
    return {
      type: 'REQUEST_ERROR',
      message: error.message,
      details: error
    };
  }

  /**
   * Make a chat completion request
   */
  async chatCompletion(options) {
    const {
      messages,
      model = this.config.models.chat,
      temperature = this.config.defaults.temperature,
      maxTokens = this.config.defaults.maxTokens,
      topP = this.config.defaults.topP,
      frequencyPenalty = this.config.defaults.frequencyPenalty,
      presencePenalty = this.config.defaults.presencePenalty,
      stream = false,
      ...additionalOptions
    } = options;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream,
      ...additionalOptions
    };

    this.logger.info(`Making chat completion request with model: ${model}`);
    
    try {
      const response = await this.client.post('/v1/chat/completions', payload);
      return this.processResponse(response.data);
    } catch (error) {
      this.logger.error('Chat completion failed:', error);
      throw error;
    }
  }

  /**
   * Make a code completion request (using coder model)
   */
  async codeCompletion(options) {
    return this.chatCompletion({
      ...options,
      model: options.model || this.config.models.coder
    });
  }

  /**
   * Make a reasoning request
   */
  async reasoning(options) {
    return this.chatCompletion({
      ...options,
      model: options.model || this.config.models.reasoning
    });
  }

  /**
   * Process API response and extract useful information
   */
  processResponse(data) {
    const choice = data.choices?.[0];
    
    return {
      content: choice?.message?.content || '',
      role: choice?.message?.role || 'assistant',
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      raw: data
    };
  }

  /**
   * Simple text completion helper
   */
  async complete(prompt, options = {}) {
    const messages = [
      { role: 'user', content: prompt }
    ];

    const response = await this.chatCompletion({
      messages,
      ...options
    });

    return response.content;
  }

  /**
   * Multi-turn conversation helper
   */
  async conversation(messages, options = {}) {
    return this.chatCompletion({
      messages,
      ...options
    });
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      this.logger.info('Testing DeepSeek API connection...');
      
      const response = await this.complete('Hello, can you respond with just "OK"?', {
        maxTokens: 10,
        temperature: 0
      });

      this.logger.info('Connection test successful');
      return {
        success: true,
        response: response.trim()
      };
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
} 