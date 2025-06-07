import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePath = resolvedParams.path.join('/');
    const audioFilePath = path.join(process.cwd(), '..', 'zero-wire', 'Spark-TTS', filePath);
    
    // Read the audio file
    const audioBuffer = await readFile(audioFilePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'audio/wav'; // default
    
    if (ext === '.mp3') {
      contentType = 'audio/mpeg';
    } else if (ext === '.wav') {
      contentType = 'audio/wav';
    } else if (ext === '.m4a') {
      contentType = 'audio/mp4';
    } else if (ext === '.ogg') {
      contentType = 'audio/ogg';
    }
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Audio file serve error:', error);
    return NextResponse.json(
      { error: 'Audio file not found' },
      { status: 404 }
    );
  }
} 