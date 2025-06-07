import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Check global progress messages first
    if (global.progressMessages && global.progressMessages.length > 0) {
      const recent = global.progressMessages
        .filter(p => Date.now() - p.timestamp < 30000) // Only messages from last 30 seconds
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (recent) {
        // Return the message and then remove it to prevent repeats
        const message = recent.message;
        // Remove this message from the array
        global.progressMessages = global.progressMessages.filter(p => p !== recent);
        return NextResponse.json({ message });
      }
    }

    // Try to read from frontend log for TTS progress
    try {
      const logPath = path.join(process.cwd(), '..', 'frontend.log');
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf8');
        const lines = logContent.split('\n').reverse(); // Most recent first
        
        // Look for TTS progress messages in recent log lines
        for (const line of lines.slice(0, 50)) { // Check last 50 lines
          if (line.includes('📤 TTS Progress:')) {
            const progressMatch = line.match(/📤 TTS Progress: (.+)/);
            if (progressMatch) {
              const message = progressMatch[1];
              return NextResponse.json({ message });
            }
          }
        }
      }
    } catch (error) {
      // Ignore log reading errors
    }

    return NextResponse.json({ message: null });
  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json({ message: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (message) {
      // Add to global progress messages
      if (global.progressMessages) {
        global.progressMessages.push({
          message,
          timestamp: Date.now()
        });
        // Keep only last 20 messages
        if (global.progressMessages.length > 20) {
          global.progressMessages = global.progressMessages.slice(-20);
        }
      } else {
        global.progressMessages = [{
          message,
          timestamp: Date.now()
        }];
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  } catch (error) {
    console.error('Progress POST error:', error);
    return NextResponse.json({ error: 'Failed to add progress' }, { status: 500 });
  }
} 