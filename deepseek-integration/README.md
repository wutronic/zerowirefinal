# DeepSeek Integration

A clean, modular Node.js library and CLI for interacting with the DeepSeek API. Built with well-segregated logic, comprehensive error handling, and a beautiful command-line interface.

## 🚀 Features

- **Clean Architecture**: Well-organized, modular codebase with separation of concerns
- **Multiple Models**: Support for DeepSeek Chat, Coder, and Reasoning models  
- **CLI Interface**: Beautiful command-line tool with colored output
- **Environment Config**: Flexible configuration via environment variables
- **Error Handling**: Comprehensive error handling with detailed logging
- **TypeScript Ready**: ES modules with modern JavaScript features

## 📁 Project Structure

```
deepseek-integration/
├── src/
│   ├── deepseek-client.js    # Main API client
│   └── cli.js               # Command line interface
├── config/
│   └── default.js           # Configuration management
├── utils/
│   └── logger.js            # Logging utility
├── examples/
│   └── test-basic.js        # Usage examples
├── package.json
├── env.example              # Environment variables template
└── README.md
```

## 🛠️ Installation

1. **Clone or copy this directory**:
```bash
cd deepseek-integration
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp env.example .env
# Edit .env with your DeepSeek API key
```

4. **Set your API key**:
```bash
export DEEPSEEK_API_KEY="your_api_key_here"
```

## 🎯 Quick Start

### CLI Usage

**Test your connection**:
```bash
npm start test
```

**Get a simple completion**:
```bash
npm start complete "Explain quantum computing in simple terms"
```

**Use different models**:
```bash
npm start complete "Write a Python function to sort a list" --model coder
npm start complete "Analyze this logical problem step by step" --model reasoning
```

**Start interactive chat**:
```bash
npm start chat
```

**Check configuration**:
```bash
npm start config
```

### Programmatic Usage

```javascript
import { DeepSeekClient } from './src/deepseek-client.js';

const client = new DeepSeekClient();

// Simple completion
const response = await client.complete('What is the meaning of life?');
console.log(response);

// Chat with conversation history
const chatResponse = await client.chatCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

// Code generation
const codeResponse = await client.codeCompletion({
  messages: [
    { role: 'user', content: 'Create a REST API endpoint in Express.js' }
  ]
});
```

## ⚙️ Configuration

All configuration is handled via environment variables:

### Required
- `DEEPSEEK_API_KEY` - Your DeepSeek API key

### Optional API Settings
- `DEEPSEEK_API_URL` - API base URL (default: https://api.deepseek.com)
- `DEEPSEEK_TIMEOUT` - Request timeout in ms (default: 30000)
- `DEEPSEEK_RETRIES` - Number of retries (default: 3)

### Optional Model Settings
- `DEEPSEEK_CHAT_MODEL` - Chat model name (default: deepseek-chat)
- `DEEPSEEK_CODER_MODEL` - Code model name (default: deepseek-coder)
- `DEEPSEEK_REASONING_MODEL` - Reasoning model name (default: deepseek-reasoner)

### Optional Parameters
- `DEEPSEEK_TEMPERATURE` - Default temperature (default: 0.7)
- `DEEPSEEK_MAX_TOKENS` - Default max tokens (default: 2048)
- `DEEPSEEK_TOP_P` - Default top_p (default: 0.95)

### Optional CLI Settings
- `DEEPSEEK_VERBOSE` - Enable verbose logging (default: false)
- `DEEPSEEK_LOG_LEVEL` - Log level: debug, info, warn, error (default: info)
- `DEEPSEEK_OUTPUT_FORMAT` - Output format: text, json, markdown (default: text)

## 📚 CLI Commands

### `test`
Test your API connection:
```bash
npm start test
```

### `complete <prompt>`
Get a completion from DeepSeek:
```bash
npm start complete "Explain machine learning"
npm start complete "Write a Python script" --model coder --temperature 0.3
npm start complete "Solve this logic puzzle" --model reasoning --max-tokens 1000
```

Options:
- `-m, --model <model>` - Model to use: chat, coder, reasoning
- `-t, --temperature <temp>` - Temperature (0-2)
- `--max-tokens <tokens>` - Maximum tokens
- `--json` - Output as JSON
- `-v, --verbose` - Verbose logging

### `chat`
Start interactive chat:
```bash
npm start chat --model coder --temperature 0.5
```

### `config`
Show current configuration:
```bash
npm start config
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Or run tests manually:
```bash
node examples/test-basic.js
```

## 🎨 Features

### Clean Error Handling
- Detailed error messages with context
- Structured error types (API_ERROR, NETWORK_ERROR, REQUEST_ERROR)
- Automatic retry logic with exponential backoff

### Colored Logging
- Debug, info, warn, error levels
- Timestamps and structured output
- Configurable log levels

### Modular Design
- Separate concerns: API client, CLI, config, utilities
- Easy to extend and customize
- Clean interfaces between modules

### Configuration Validation
- Validates all settings on startup
- Clear error messages for misconfigurations
- Environment variable support

## 📖 API Reference

### DeepSeekClient

**Constructor:**
```javascript
const client = new DeepSeekClient(options)
```

**Methods:**
- `complete(prompt, options)` - Simple text completion
- `chatCompletion(options)` - Chat with conversation history
- `codeCompletion(options)` - Code generation
- `reasoning(options)` - Step-by-step reasoning
- `conversation(messages, options)` - Multi-turn conversation
- `testConnection()` - Test API connectivity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

If you encounter issues:

1. Check your API key is set correctly
2. Run `npm start config` to verify configuration
3. Run `npm start test` to test connectivity
4. Use `--verbose` flag for detailed error information

---

**Happy coding with DeepSeek! 🚀** 