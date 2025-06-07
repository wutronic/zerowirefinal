import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  console.log('=== Audio Generation API Called ===');
  console.log('Request method:', request.method);
  console.log('Request URL:', request.url);
  
  try {
    console.log('Parsing request body...');
    const body = await request.json();
    console.log('Request body parsed successfully:', JSON.stringify(body, null, 2));
    const { 
      text, 
      targetLevel = "0.8", 
      compressionRatio = "6.0", 
      audioEnhancement = true,
      audioNormalization = true,
      audioCompression = true,
      outputPrefix = "chunk",
      voiceFile = ""
    } = body;

    console.log('Validating text parameter...');
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.log('Text validation failed');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }
    console.log('Text validation passed');

    // Build the command arguments
    const sparkTTSDir = path.join(process.cwd(), '..', 'zero-wire', 'Spark-TTS');
    const chunkCloneScript = path.join(sparkTTSDir, 'chunk_clone.py');
    
    // Check if the script exists
    try {
      await access(chunkCloneScript, constants.F_OK);
    } catch {
      console.error('chunk_clone.py not found at:', chunkCloneScript);
      return NextResponse.json(
        { error: 'Spark TTS script not found. Please check the file path.' },
        { status: 500 }
      );
    }
    
    const args = [
      chunkCloneScript,
      text
    ];

    if (targetLevel !== "0.7") {
      args.push('--target-level', targetLevel);
    }

    if (compressionRatio !== "3.0") {
      args.push('--compression-ratio', compressionRatio);
    }

    if (!audioEnhancement) {
      args.push('--no-enhance');
    } else {
      if (!audioNormalization) {
        args.push('--no-normalize');
      }
      if (!audioCompression) {
        args.push('--no-compress');
      }
    }

    if (outputPrefix !== "chunk") {
      args.push('--output-prefix', outputPrefix);
    }

    if (voiceFile) {
      args.push('--voice', voiceFile);
    }

    console.log('Executing:', 'python', args.join(' '));
    console.log('Working directory:', sparkTTSDir);

    // Check if the script exists before executing
    try {
      await access(chunkCloneScript, constants.F_OK);
      console.log('Script exists, proceeding with execution');
    } catch {
      console.error('Script not found, returning error');
      return NextResponse.json(
        { error: 'Python script not found' },
        { status: 500 }
      );
    }

    // Execute the Python script
    console.log('Starting Python process...');
    const pythonProcess = spawn('python', args, {
      cwd: sparkTTSDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log('Python process started with PID:', pythonProcess.pid);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise((resolve, reject) => {
      console.log('Setting up process event handlers...');
      
      const timeout = setTimeout(() => {
        console.log('Process timed out, killing...');
        pythonProcess.kill();
        reject(new Error('Audio generation timed out after 3 minutes'));
      }, 3 * 60 * 1000); // 3 minute timeout

      pythonProcess.on('close', (code) => {
        console.log('Process closed with code:', code);
        clearTimeout(timeout);
        resolve(code);
      });

      pythonProcess.on('error', (error) => {
        console.log('Process error:', error);
        clearTimeout(timeout);
        reject(error);
      });

      pythonProcess.on('spawn', () => {
        console.log('Process spawned successfully');
      });
    });

    console.log('Python process exit code:', exitCode);
    console.log('Python stdout:', stdout);
    if (stderr) console.log('Python stderr:', stderr);

    if (exitCode !== 0) {
      console.error('Python script error:', stderr);
      return NextResponse.json(
        { error: 'Audio generation failed', details: stderr, stdout },
        { status: 500 }
      );
    }

    // Parse the output to find the generated audio file
    const finalOutputMatch = stdout.match(/Final output: (.+)/);
    let audioFilePath = null;
    
    if (finalOutputMatch) {
      // Extract just the relative path from the full path
      const fullPath = finalOutputMatch[1].trim();
      const relativePath = fullPath.split('/zero-wire/Spark-TTS/')[1];
      audioFilePath = relativePath;
    } else {
      // Fallback: construct expected filename in done folder
      audioFilePath = `audiooutput/done/${text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
    }

    return NextResponse.json({
      success: true,
      audioFilePath,
      commandExecuted: `python ${args.join(' ')}`,
      output: stdout,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== Audio Generation API Error ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 