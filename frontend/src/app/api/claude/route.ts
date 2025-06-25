import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const runtime = 'edge';

const anthropic = createAnthropic();

export async function POST(req: Request) {
  const { prompt, systemPrompt } = await req.json();

  const result = await streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    system: systemPrompt,
    prompt: prompt,
  });

  return result.toDataStreamResponse();
} 