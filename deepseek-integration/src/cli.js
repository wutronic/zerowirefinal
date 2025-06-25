#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DeepSeekClient } from './deepseek-client.js';
import { validateConfig } from '../config/default.js';
import { Logger } from '../utils/logger.js';

const program = new Command();
const logger = new Logger();

program
  .name('deepseek')
  .description('DeepSeek API CLI - Clean command line interface for DeepSeek AI')
  .version('1.0.0');

/**
 * Test connection command
 */
program
  .command('test')
  .description('Test connection to DeepSeek API')
  .action(async () => {
    try {
      // Validate configuration first
      const validation = validateConfig();
      if (!validation.isValid) {
        logger.error('Configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        process.exit(1);
      }

      logger.info('Testing DeepSeek API connection...');
      
      const client = new DeepSeekClient();
      const result = await client.testConnection();
      
      if (result.success) {
        logger.success('✅ Connection test successful!');
        logger.info(`Response: "${result.response}"`);
      } else {
        logger.error('❌ Connection test failed');
        logger.error(`Error: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Unexpected error during connection test:', error.message);
      process.exit(1);
    }
  });

/**
 * Simple completion command
 */
program
  .command('complete')
  .description('Get a completion from DeepSeek')
  .argument('<prompt>', 'The prompt to send to DeepSeek')
  .option('-m, --model <model>', 'Model to use (chat, coder, reasoning)', 'chat')
  .option('-t, --temperature <temp>', 'Temperature (0-2)', parseFloat, 0.7)
  .option('--max-tokens <tokens>', 'Maximum tokens', parseInt, 2048)
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (prompt, options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      const validation = validateConfig();
      if (!validation.isValid) {
        logger.error('Configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        process.exit(1);
      }

      logger.info(`Sending prompt to DeepSeek (${options.model})...`);
      
      const client = new DeepSeekClient();
      
      let response;
      if (options.model === 'coder') {
        response = await client.codeCompletion({
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature,
          maxTokens: options.maxTokens
        });
      } else if (options.model === 'reasoning') {
        response = await client.reasoning({
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature,
          maxTokens: options.maxTokens
        });
      } else {
        response = await client.chatCompletion({
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature,
          maxTokens: options.maxTokens
        });
      }

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        console.log('\n' + chalk.green('Response:'));
        console.log(chalk.white(response.content));
        console.log('\n' + chalk.gray(`Tokens used: ${response.usage.totalTokens} (prompt: ${response.usage.promptTokens}, completion: ${response.usage.completionTokens})`));
      }
    } catch (error) {
      logger.error('Error getting completion:', error.message);
      if (options.verbose) {
        logger.error('Full error:', error);
      }
      process.exit(1);
    }
  });

/**
 * Interactive chat command
 */
program
  .command('chat')
  .description('Start an interactive chat session with DeepSeek')
  .option('-m, --model <model>', 'Model to use (chat, coder, reasoning)', 'chat')
  .option('-t, --temperature <temp>', 'Temperature (0-2)', parseFloat, 0.7)
  .option('--max-tokens <tokens>', 'Maximum tokens', parseInt, 2048)
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      const validation = validateConfig();
      if (!validation.isValid) {
        logger.error('Configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        process.exit(1);
      }

      logger.info(`Starting interactive chat with DeepSeek (${options.model})`);
      logger.info('Type "exit" or "quit" to end the session');
      
      const client = new DeepSeekClient();
      const messages = [];
      
      // Simple input handling (for now)
      process.stdin.setEncoding('utf8');
      
      const askQuestion = () => {
        process.stdout.write(chalk.cyan('\nYou: '));
      };

      askQuestion();

      process.stdin.on('data', async (input) => {
        const message = input.toString().trim();
        
        if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
          logger.info('Goodbye!');
          process.exit(0);
        }

        if (!message) {
          askQuestion();
          return;
        }

        try {
          messages.push({ role: 'user', content: message });
          
          logger.debug('Sending message to DeepSeek...');
          
          let response;
          if (options.model === 'coder') {
            response = await client.codeCompletion({
              messages,
              temperature: options.temperature,
              maxTokens: options.maxTokens
            });
          } else if (options.model === 'reasoning') {
            response = await client.reasoning({
              messages,
              temperature: options.temperature,
              maxTokens: options.maxTokens
            });
          } else {
            response = await client.chatCompletion({
              messages,
              temperature: options.temperature,
              maxTokens: options.maxTokens
            });
          }

          messages.push({ role: 'assistant', content: response.content });
          
          console.log(chalk.green('\nDeepSeek: ') + chalk.white(response.content));
          console.log(chalk.gray(`(${response.usage.totalTokens} tokens)`));
          
        } catch (error) {
          logger.error('Error in chat:', error.message);
        }
        
        askQuestion();
      });

    } catch (error) {
      logger.error('Error starting chat:', error.message);
      process.exit(1);
    }
  });

/**
 * Configuration info command
 */
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const validation = validateConfig();
    
    console.log(chalk.blue('\n🔧 DeepSeek Configuration:'));
    console.log(chalk.gray('────────────────────────────'));
    
    if (validation.isValid) {
      console.log(chalk.green('✅ Configuration is valid'));
    } else {
      console.log(chalk.red('❌ Configuration has errors:'));
      validation.errors.forEach(error => console.log(chalk.red(`   - ${error}`)));
    }
    
    console.log(`\n${chalk.cyan('API:')} ${validation.isValid ? '🔑 Key configured' : '❌ No API key'}`);
    console.log(`${chalk.cyan('Models:')} chat, coder, reasoning`);
    console.log(`${chalk.cyan('Defaults:')} temp=0.7, max_tokens=2048`);
    console.log(chalk.gray('\nSet DEEPSEEK_API_KEY environment variable to get started.'));
  });

// Parse command line arguments
program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 