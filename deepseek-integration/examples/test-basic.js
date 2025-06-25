#!/usr/bin/env node

import { DeepSeekClient } from '../src/deepseek-client.js';
import { validateConfig } from '../config/default.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('info');

async function runBasicTests() {
  console.log('🧪 DeepSeek Integration - Basic Tests\n');

  // Validate configuration
  const validation = validateConfig();
  if (!validation.isValid) {
    logger.error('Configuration validation failed:');
    validation.errors.forEach(error => logger.error(`  - ${error}`));
    logger.error('\nPlease set DEEPSEEK_API_KEY environment variable');
    process.exit(1);
  }

  try {
    // Initialize client
    const client = new DeepSeekClient();
    
    // Test 1: Connection test
    logger.info('Test 1: Testing API connection...');
    const connectionTest = await client.testConnection();
    if (connectionTest.success) {
      logger.success('✅ Connection test passed');
    } else {
      logger.error('❌ Connection test failed:', connectionTest.error);
      return;
    }

    // Test 2: Simple completion
    logger.info('\nTest 2: Simple text completion...');
    const simpleResponse = await client.complete('What is 2+2?', {
      maxTokens: 50,
      temperature: 0
    });
    logger.success('✅ Simple completion:');
    console.log(`   Response: "${simpleResponse}"`);

    // Test 3: Chat completion with conversation
    logger.info('\nTest 3: Chat completion...');
    const chatResponse = await client.chatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful math tutor.' },
        { role: 'user', content: 'Explain the Pythagorean theorem briefly.' }
      ],
      maxTokens: 200
    });
    logger.success('✅ Chat completion:');
    console.log(`   Response: "${chatResponse.content}"`);
    console.log(`   Tokens: ${chatResponse.usage.totalTokens}`);

    // Test 4: Code completion (if available)
    logger.info('\nTest 4: Code completion...');
    const codeResponse = await client.codeCompletion({
      messages: [
        { role: 'user', content: 'Write a simple JavaScript function to reverse a string.' }
      ],
      maxTokens: 150
    });
    logger.success('✅ Code completion:');
    console.log(`   Response: "${codeResponse.content}"`);

    logger.success('\n🎉 All tests completed successfully!');

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    if (error.type) {
      logger.error(`   Error type: ${error.type}`);
    }
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicTests();
} 