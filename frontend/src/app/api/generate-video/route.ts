import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { writeFile, readFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';

// Declare global progress messages for progress API
declare global {
  var progressMessages: Array<{ message: string; timestamp: number }> | undefined;
}

/**
 * Atomic write helper function for API route
 */
async function writeStatusFileAtomically(filePath: string, data: any) {
  const tempPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2);
  
  try {
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, filePath);
    console.log(`🔒 API: Atomic write completed: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ API: Atomic write failed: ${error}`);
    // Clean up temp file if it exists
    try {
      await writeFile(tempPath, ''); // Clear temp file
    } catch (unlinkError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safe JSON parse for API route with retry logic
 */
function safeJsonParseAPI(content: string, retries = 3): any {
  for (let i = 0; i < retries; i++) {
    try {
      return JSON.parse(content);
    } catch (error) {
      if (i === retries - 1) {
        console.error(`❌ API: JSON parse failed after ${retries} attempts: ${error}`);
        throw error;
      }
      console.log(`⚠️ API: JSON parse attempt ${i + 1} failed, retrying...`);
      // Small delay for retry
      const delay = 100 * Math.pow(2, i);
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request data - handle both JSON and FormData
    let text = '';
    let splitScreenEnabled = false;
    let targetLevel = "0.7";
    let compressionRatio = "3.0";
    let audioEnhancement = true;
    let audioNormalization = true;
    let audioCompression = true;
    let outputPrefix = "chunk";
    let voiceFile = "";
    let debugMode = false;
    let splitScreenClip: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      text = body.text;
      splitScreenEnabled = body.splitScreenEnabled === 'true' || body.splitScreenEnabled === true;
      targetLevel = body.targetLevel || "0.7";
      compressionRatio = body.compressionRatio || "3.0";
      audioEnhancement = body.audioEnhancement !== false;
      audioNormalization = body.audioNormalization !== false;
      audioCompression = body.audioCompression !== false;
      outputPrefix = body.outputPrefix || "chunk";
      voiceFile = body.voiceFile || "";
      debugMode = body.debugMode === 'true' || body.debugMode === true;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      text = formData.get('text') as string;
      splitScreenEnabled = formData.get('splitScreenEnabled') === 'true';
      targetLevel = formData.get('targetLevel') as string || "0.7";
      compressionRatio = formData.get('compressionRatio') as string || "3.0";
      audioEnhancement = formData.get('audioEnhancement') === 'true';
      audioNormalization = formData.get('audioNormalization') === 'true';
      audioCompression = formData.get('audioCompression') === 'true';
      outputPrefix = formData.get('outputPrefix') as string || "chunk";
      voiceFile = formData.get('voiceFile') as string || "";
      debugMode = formData.get('debugMode') === 'true';
      splitScreenClip = formData.get('splitScreenClip') as File;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Generate unique request ID for coordination
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let splitScreenPath = '';
    
    // Handle split screen clip upload if provided
    if (splitScreenEnabled && splitScreenClip) {
      const bytes = await splitScreenClip.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Save uploaded file to a temporary location
      const tempDir = path.join(process.cwd(), '..', 'video-editing', 'temp');
      await mkdir(tempDir, { recursive: true });
      splitScreenPath = path.join(tempDir, `splitscreen_${requestId}_${splitScreenClip.name}`);
      
      try {
        await writeFile(splitScreenPath, buffer);
      } catch (error) {
        console.error('Failed to save split screen clip:', error);
        return NextResponse.json(
          { error: 'Failed to save split screen clip' },
          { status: 500 }
        );
      }
    }

    // Step 1: Generate audio using Spark TTS
    console.log('Step 1: Generating audio...');
    const sparkTTSDir = path.join(process.cwd(), '..', 'zero-wire', 'Spark-TTS');
    const chunkCloneScript = path.join(sparkTTSDir, 'chunk_clone.py');
    const audioArgs = [chunkCloneScript, text];
    
    if (targetLevel !== "0.7") {
      audioArgs.push('--target-level', targetLevel);
    }
    if (compressionRatio !== "3.0") {
      audioArgs.push('--compression-ratio', compressionRatio);
    }
    if (!audioEnhancement) {
      audioArgs.push('--no-enhance');
    } else {
      if (!audioNormalization) audioArgs.push('--no-normalize');
      if (!audioCompression) audioArgs.push('--no-compress');
    }
    if (outputPrefix !== "chunk") {
      audioArgs.push('--output-prefix', outputPrefix);
    }
    if (voiceFile) {
      audioArgs.push('--voice', voiceFile);
    }

    const audioProcess = spawn('python', audioArgs, {
      cwd: sparkTTSDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let audioStdout = '';
    let audioStderr = '';

    audioProcess.stdout.on('data', (data) => {
      const output = data.toString();
      audioStdout += output;
      
      // Log ALL progress indicators for debugging
      const lines = output.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && (
          trimmedLine.includes('🔄 Processing chunk') || 
          trimmedLine.includes('✅ Generated:') || 
          trimmedLine.includes('📝 Text split into') ||
          trimmedLine.includes('🔗 Merging audio chunks') ||
          trimmedLine.includes('✨ Audio merging completed') ||
          trimmedLine.includes('📝 Input text:') ||
          trimmedLine.includes('📏 Text length:') ||
          trimmedLine.includes('🎯 Processing Complete') ||
          trimmedLine.includes('📊 Summary:')
        )) {
          console.log('📤 TTS Progress:', trimmedLine);
          
          // Store progress message for polling API
          if (global.progressMessages) {
            global.progressMessages.push({
              message: trimmedLine,
              timestamp: Date.now()
            });
            // Keep only last 20 messages
            if (global.progressMessages.length > 20) {
              global.progressMessages = global.progressMessages.slice(-20);
            }
          } else {
            global.progressMessages = [{
              message: trimmedLine,
              timestamp: Date.now()
            }];
          }
        }
      }
    });

    audioProcess.stderr.on('data', (data) => {
      const error = data.toString();
      audioStderr += error;
      
      // Log any stderr that might indicate processing status
      if (error.includes('FutureWarning') || error.includes('Setting')) {
        console.log('⚠️ TTS Warning:', error.trim());
      }
    });

    const audioExitCode = await new Promise((resolve, reject) => {
      // Calculate dynamic timeout based on text length - much more generous for longer text
      const baseTimeout = 5 * 60 * 1000; // 5 minutes base
      const extraTime = Math.max(0, (text.length - 100) * 1000); // 1 second per extra character (was 10ms)
      const dynamicTimeout = Math.min(baseTimeout + extraTime, 20 * 60 * 1000); // Max 20 minutes
      
      console.log(`Audio generation timeout set to: ${Math.round(dynamicTimeout / 60000)} minutes for ${text.length} characters`);
      
      const timeout = setTimeout(() => {
        audioProcess.kill();
        reject(new Error(`Audio generation timed out after ${Math.round(dynamicTimeout / 60000)} minutes`));
      }, dynamicTimeout);

      audioProcess.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });

      audioProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    if (audioExitCode !== 0) {
      console.error('Audio generation failed:', audioStderr);
      return NextResponse.json(
        { error: 'Audio generation failed', details: audioStderr },
        { status: 500 }
      );
    }

    // Parse actual audio output path from Python stdout
    const finalOutputMatch = audioStdout.match(/✅ Enhanced audio saved: (.+)/);
    let audioFilePath = '';
    
    if (finalOutputMatch) {
      const fullPath = finalOutputMatch[1].trim();
      // Convert absolute path to relative path for video generator
      const relativePath = fullPath.replace(/.*\/zero-wire\/Spark-TTS\//, '');
      audioFilePath = relativePath;
      console.log('Parsed audio file path:', audioFilePath);
    } else {
      // Fallback: construct expected path in done folder
      const cleanText = text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
      audioFilePath = `audiooutput/done/${cleanText}.wav`;
      console.log('Using fallback audio file path:', audioFilePath);
    }

    // Step 2: Create status file for coordination with file watcher
    console.log('Step 2: Creating coordination status file...');
    
    const statusDir = path.join(process.cwd(), '..', 'video-editing', 'status');
    await mkdir(statusDir, { recursive: true });
    
    const statusFile = path.join(statusDir, `${requestId}.json`);
    const statusData = {
      requestId,
      audioFile: audioFilePath,
      status: 'audio_ready',
      splitScreenEnabled,
      splitScreenPath: splitScreenPath || null,
      debugMode,
      videoFile: null,
      timestamp: new Date().toISOString(),
      text: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    };

    await writeStatusFileAtomically(statusFile, statusData);
    console.log('Status file created:', statusFile);

    // Step 3: Wait for video generation to complete (polling)
    console.log('Step 3: Waiting for video generation...');
    
    const maxWaitTime = 15 * 60 * 1000; // 15 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();
    
    let finalStatus = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusContent = await readFile(statusFile, 'utf-8');
        const currentStatus = safeJsonParseAPI(statusContent);
        
        if (currentStatus.status === 'video_complete') {
          finalStatus = currentStatus;
          break;
        } else if (currentStatus.status === 'error') {
          throw new Error(currentStatus.error || 'Video generation failed');
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Status file doesn't exist yet, continue polling
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        // Handle JSON parse errors gracefully during polling
        if (error.message && error.message.includes('JSON')) {
          console.log(`⚠️ API: JSON parse error during polling, retrying...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        throw error;
      }
    }

    if (!finalStatus) {
      return NextResponse.json(
        { 
          error: 'Video generation timed out', 
          details: 'The file watcher did not complete video generation within 15 minutes',
          audioFilePath,
          statusFile: statusFile
        },
        { status: 500 }
      );
    }

    // Success! Return the results
    return NextResponse.json({
      success: true,
      requestId,
      audioFilePath: finalStatus.audioFile,
      videoFilePath: finalStatus.videoFile,
      splitScreenUsed: splitScreenEnabled,
      audioCommandExecuted: `python ${audioArgs.join(' ')}`,
      coordinationMethod: 'file_watcher',
      processingTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      audioOutput: audioStdout.substring(0, 1000) + (audioStdout.length > 1000 ? '...' : ''),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Video generation API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 