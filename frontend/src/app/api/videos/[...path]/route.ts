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
    const videoFilePath = path.join(process.cwd(), '..', 'video-editing', 'generated-videos', filePath);
    
    // Read the video file
    const videoBuffer = await readFile(videoFilePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4'; // default
    
    if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.webm') {
      contentType = 'video/webm';
    } else if (ext === '.mov') {
      contentType = 'video/quicktime';
    } else if (ext === '.avi') {
      contentType = 'video/x-msvideo';
    }
    
    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes', // Allow range requests for video streaming
      },
    });
    
  } catch (error) {
    console.error('Video file serve error:', error);
    return NextResponse.json(
      { error: 'Video file not found' },
      { status: 404 }
    );
  }
} 