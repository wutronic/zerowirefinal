import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Clear all progress messages
    if (global.progressMessages) {
      global.progressMessages = [];
    }
    return NextResponse.json({ success: true, cleared: true });
  } catch (error) {
    console.error('Progress clear error:', error);
    return NextResponse.json({ error: 'Failed to clear progress' }, { status: 500 });
  }
} 