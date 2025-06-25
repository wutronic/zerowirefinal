import chalk from 'chalk';

/**
 * Simple, colorful logger utility
 */
export class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    let formatted = message;
    if (data) {
      formatted += ' ' + (typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    }

    return { prefix, formatted };
  }

  debug(message, data) {
    if (!this.shouldLog('debug')) return;
    
    const { prefix, formatted } = this.formatMessage('debug', message, data);
    console.log(chalk.gray(prefix), chalk.gray(formatted));
  }

  info(message, data) {
    if (!this.shouldLog('info')) return;
    
    const { prefix, formatted } = this.formatMessage('info', message, data);
    console.log(chalk.blue(prefix), chalk.white(formatted));
  }

  warn(message, data) {
    if (!this.shouldLog('warn')) return;
    
    const { prefix, formatted } = this.formatMessage('warn', message, data);
    console.log(chalk.yellow(prefix), chalk.yellow(formatted));
  }

  error(message, data) {
    if (!this.shouldLog('error')) return;
    
    const { prefix, formatted } = this.formatMessage('error', message, data);
    console.error(chalk.red(prefix), chalk.red(formatted));
  }

  success(message, data) {
    const { prefix, formatted } = this.formatMessage('info', message, data);
    console.log(chalk.green(prefix), chalk.green(formatted));
  }
} 