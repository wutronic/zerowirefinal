import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekClient } from '../../../../../deepseek-integration/src/deepseek-client.js';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_SYSTEM_PROMPT = "You're a mix of Thomas Aquinas and guy fawkes but a little less pretentious and cheesy than guy. You're also a social media expert with track record of success. Pull out deep truths about these claims then lay them out like you're unbiased and trying to make the watcher feel smarter at the end . while  the goal is to Take these claims and craft a video about a minute long that lays out all the critical points. Don't gloss over people or sources. Do not use markdown";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Check environment variables
if (!process.env.DEEPSEEK_API_KEY) {
  console.warn('Warning: DEEPSEEK_API_KEY environment variable is not set');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY environment variable is not set');
}

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt, provider = 'deepseek', model = 'chat' } = await request.json();

    // Validate inputs
    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'User prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!['deepseek', 'claude'].includes(provider)) {
      return NextResponse.json(
        { error: 'Provider must be either "deepseek" or "claude"' },
        { status: 400 }
      );
    }

    // Use provided system prompt or default
    const finalSystemPrompt = systemPrompt && systemPrompt.trim().length > 0 
      ? systemPrompt 
      : DEFAULT_SYSTEM_PROMPT;

    let response;

    if (provider === 'claude') {
      // Handle Claude Sonnet 4
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
          { error: 'Anthropic API key is not configured' },
          { status: 401 }
        );
      }

      try {
        const claudeResponse = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022', // Latest Claude Sonnet model
          max_tokens: 2048,
          temperature: 0.7,
          system: finalSystemPrompt,
          messages: [
            { role: 'user', content: userPrompt.trim() }
          ]
        });

        const content = claudeResponse.content[0]?.type === 'text' 
          ? claudeResponse.content[0].text 
          : '';

        response = {
          content,
          model: claudeResponse.model,
          usage: {
            prompt_tokens: claudeResponse.usage.input_tokens,
            completion_tokens: claudeResponse.usage.output_tokens,
            total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
          }
        };

      } catch (error: any) {
        console.error('Claude API Error:', error);
        
        if (error.status === 401) {
          return NextResponse.json(
            { error: 'Claude API authentication failed. Please check your API key.' },
            { status: 401 }
          );
        } else if (error.status === 429) {
          return NextResponse.json(
            { error: 'Claude API rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        } else {
          return NextResponse.json(
            { error: `Claude API error: ${error.message}` },
            { status: error.status || 500 }
          );
        }
      }

    } else {
      // Handle DeepSeek
      if (!process.env.DEEPSEEK_API_KEY) {
        return NextResponse.json(
          { error: 'DeepSeek API key is not configured' },
          { status: 401 }
        );
      }

      try {
        const client = new DeepSeekClient();
        const messages = [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: userPrompt.trim() }
        ];

        if (model === 'coder') {
          response = await client.codeCompletion({ messages });
        } else if (model === 'reasoning') {
          response = await client.reasoning({ messages });
        } else {
          response = await client.chatCompletion({ messages });
        }

      } catch (error: any) {
        console.error('DeepSeek API Error:', error);

        if (error.type === 'API_ERROR') {
          if (error.status === 401) {
            return NextResponse.json(
              { error: 'DeepSeek API authentication failed. Please check your API key.' },
              { status: 401 }
            );
          } else if (error.status === 402) {
            return NextResponse.json(
              { error: 'Insufficient balance in DeepSeek account. Please add credits.' },
              { status: 402 }
            );
          } else {
            return NextResponse.json(
              { error: `DeepSeek API error: ${error.message}` },
              { status: error.status || 500 }
            );
          }
        }

        return NextResponse.json(
          { error: 'Internal server error while processing DeepSeek request' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      content: response.content,
      model: response.model,
      usage: response.usage,
      systemPrompt: finalSystemPrompt,
      provider
    });

  } catch (error: any) {
    console.error('AI Assistant API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing AI request' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Assistant API endpoint is active',
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    supportedProviders: {
      deepseek: {
        models: ['chat', 'coder', 'reasoning'],
        configured: !!process.env.DEEPSEEK_API_KEY
      },
      claude: {
        models: ['claude-3-5-sonnet-20241022'],
        configured: !!process.env.ANTHROPIC_API_KEY
      }
    }
  });
} 