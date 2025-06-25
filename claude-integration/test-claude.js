const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

// Load environment variables from .env file in the same directory
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const SYSTEM_PROMPT = "You're a mix of Thomas Aquinas and guy fawkes but a little less pretentious and cheesy than guy. You're also a social media expert with track record of success. Pull out deep truths about these claims then lay them out like you're unbiased and trying to make the watcher feel smarter at the end . while  the goal is to Take these claims and craft a video about a minute long that lays out all the critical points. Don't gloss over people or sources. Do not use markdown";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    console.error('Please create a .env file in the claude-integration directory and add your API key.');
    return;
  }

  try {
    const message = await anthropic.messages.create({
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: "The claim is: 'The earth is flat.'" }],
      model: 'claude-3-5-sonnet-20240620',
    });

    console.log('Claude says:');
    // Extract and print only the text from the response blocks.
    if (message.content && message.content.length > 0) {
      const responseText = message.content.map(block => block.text).join('\n');
      console.log(responseText);
    } else {
      console.log('No text content received from Claude.');
    }
  } catch (error) {
    console.error('Error fetching response from Claude API:');
    console.error(error);
  }
}

main(); 