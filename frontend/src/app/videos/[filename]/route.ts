import { NextRequest, NextResponse } from 'next/server';
import { readFile, existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Get the video file path - check both generated-videos and FinalOutput folders
    let videoPath = path.join(process.cwd(), '..', 'video-editing', 'generated-videos', filename);
    
    // If not found in generated-videos, check FinalOutput folder for split-screen videos
    if (!existsSync(videoPath)) {
      videoPath = path.join(process.cwd(), '..', 'FinalOutput', filename);
    }
    
    if (!existsSync(videoPath)) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    // Read the video file
    const videoBuffer = await new Promise<Buffer>((resolve, reject) => {
      readFile(videoPath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'video/mp4'; // default
    
    switch (ext) {
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.avi':
        contentType = 'video/x-msvideo';
        break;
      case '.mov':
        contentType = 'video/quicktime';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
    }

    // Return the video file with appropriate headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error serving video file:', error);
    return NextResponse.json(
      { error: 'Failed to serve video file' },
      { status: 500 }
    );
  }
} 