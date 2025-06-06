# Technical Specifications

## System Requirements

### Hardware Requirements
- **CPU**: Multi-core processor (4+ cores recommended)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB+ free space for templates and output
- **GPU**: Optional for accelerated video processing

### Software Dependencies

#### Core Runtime
- **Node.js**: v18.20.8+ (LTS recommended)
- **Python**: 3.8+ with virtual environment support
- **FFmpeg**: v4.4+ with H.264 support

#### Node.js Packages
```json
{
  "editly": "^0.14.2",
  "chokidar": "^3.5.3",
  "minimist": "^1.2.8"
}
```

#### Python Packages
```
soundfile>=0.12.1
numpy>=1.21.0
```

#### System Tools
- **macOS**: `afplay` for audio playback
- **Linux**: `aplay` or equivalent
- **Windows**: Windows Media Player or equivalent

## Audio Processing Specifications

### Text-to-Speech Engine
- **Engine**: SparkTTS
- **Quality**: High-definition voice synthesis
- **Output Format**: WAV, 16-bit, 44.1kHz (configurable)
- **Voice Models**: Pretrained and custom training support

### Audio Enhancement Pipeline

#### Silence Detection Algorithm
```python
# Threshold-based silence detection
silence_threshold = 0.02  # RMS threshold
min_silence_duration = 0.3  # seconds
target_silence_duration = 0.25  # seconds

# Implementation details:
- Window size: 512 samples
- Overlap: 50%
- Analysis: RMS calculation per window
- Detection: Consecutive windows below threshold
```

#### Dynamic Range Compression
```python
# Compression parameters
compression_ratio = 6.0  # default
target_level = 0.8  # normalization target
attack_time = 0.01  # seconds
release_time = 0.1  # seconds

# Processing chain:
1. RMS analysis
2. Gain reduction calculation
3. Envelope following
4. Signal multiplication
5. Peak limiting
```

#### Quality Metrics
- **RMS Preservation**: ±2% of original
- **Peak Limiting**: -1dB maximum
- **Frequency Response**: Flat (20Hz-20kHz)
- **THD+N**: <0.01% at 1kHz, -20dB

### Audio File Handling

#### Supported Input Formats
- **WAV**: Uncompressed PCM
- **MP3**: MPEG-1 Audio Layer 3
- **M4A**: MPEG-4 Audio
- **AAC**: Advanced Audio Coding

#### Output Specifications
- **Format**: WAV (primary), MP3 (optional)
- **Bit Depth**: 16-bit
- **Sample Rate**: 44.1kHz
- **Channels**: Mono (TTS) or Stereo (enhanced)

## Video Processing Specifications

### Video Assembly Architecture

#### Template Structure
```
VideoTemplates/style 1/
├── Intro/          # 5-15 second opening clips
├── Loop/           # 8-12 second repeatable content  
├── End/            # 5-10 second closing clips
└── splitscreen/    # 4-8 second split-screen templates
```

#### Duration Calculation Algorithm
```javascript
// Precise duration matching
totalAudioDuration = getAudioDuration(audioFile);
introDuration = getRandomIntroDuration();
endDuration = getRandomEndDuration();

remainingDuration = totalAudioDuration - introDuration - endDuration;
loopDuration = getRandomLoopDuration();
numLoops = Math.ceil(remainingDuration / loopDuration);

// Adjust last loop for perfect sync
lastLoopDuration = remainingDuration - (loopDuration * (numLoops - 1));
```

### Split-Screen Processing

#### Intelligent Cropping Algorithm
```javascript
// Height-based strategy selection
function determineStrategy(topHeight, bottomHeight, referenceHeight) {
    const bottomRatio = bottomHeight / referenceHeight;
    
    if (bottomRatio >= 0.5) {
        return 'CROP_AND_STACK';
    } else {
        return 'POSITION_OVERLAY';
    }
}

// Cropping strategy implementation
CROP_AND_STACK: {
    topCrop: "crop=iw:ih*0.5:0:ih*0.25",
    bottomCrop: "crop=iw:ih*0.5:0:ih*0.25",
    assembly: "vstack"
}

POSITION_OVERLAY: {
    topScale: "scale=720:640",
    bottomPosition: "overlay=0:640",
    canvasSize: "1280x720"
}
```

#### FFmpeg Command Generation
```javascript
// Dynamic command building
function buildFFmpegCommand(strategy, files, output) {
    let filters = [];
    
    if (strategy === 'CROP_AND_STACK') {
        filters.push(`[0:v]crop=iw:ih*0.5:0:ih*0.25[top]`);
        filters.push(`[1:v]crop=iw:ih*0.5:0:ih*0.25[bottom]`);
        filters.push(`[top][bottom]vstack[out]`);
    } else {
        filters.push(`[0:v]scale=${outputWidth}:${outputHeight/2}[top]`);
        filters.push(`[top][1:v]overlay=0:${outputHeight/2}[out]`);
    }
    
    return `ffmpeg -i "${files.top}" -i "${files.bottom}" -filter_complex "${filters.join(';')}" -map "[out]" -t ${duration} "${output}"`;
}
```

### Video Quality Settings

#### Output Specifications
- **Resolution**: Maintains template resolution (typically 720x1280)
- **Frame Rate**: 30 FPS (configurable)
- **Codec**: H.264 (libx264)
- **Bitrate**: Variable (CRF 18-23)
- **Color Space**: YUV420P

#### Compression Settings
```javascript
const videoSettings = {
    codec: 'libx264',
    crf: 20,            // Constant Rate Factor (quality)
    preset: 'medium',   // Encoding speed vs compression
    tune: 'film',       // Optimization for content type
    pixelFormat: 'yuv420p',
    frameRate: 30
};
```

## File System Architecture

### Directory Structure Requirements
```
Required Directories:
- VideoTemplates/style 1/Intro/     (minimum 1 video)
- VideoTemplates/style 1/Loop/      (minimum 1 video)
- VideoTemplates/style 1/End/       (minimum 1 video)
- VideoTemplates/style 1/splitscreen/ (for split-screen mode)
- splitscreensource/                (user content)
- FinalOutput/                      (split-screen output)
- video-editing/generated-videos/   (normal output)
- zero-wire/Spark-TTS/audiooutput/done/ (processed audio)
```

### File Naming Conventions
```javascript
// Audio files
const audioPattern = /^[a-zA-Z0-9_\-\s]+\.(wav|mp3|m4a|aac)$/;

// Video files
const videoPattern = /^[a-zA-Z0-9_\-\s]+\.(mp4|mov|avi)$/;

// Output naming
function generateOutputName(audioFile, mode) {
    const baseName = path.basename(audioFile, path.extname(audioFile));
    const timestamp = new Date().toISOString().slice(0, 10);
    const prefix = mode === 'split' ? 'split_' : '';
    return `${prefix}${baseName}_${timestamp}.mp4`;
}
```

### File Watching Implementation
```javascript
// Chokidar configuration
const watcher = chokidar.watch(audioPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,      // only new files
    awaitWriteFinish: {       // wait for file write completion
        stabilityThreshold: 1000,
        pollInterval: 100
    }
});
```

## Performance Specifications

### Processing Benchmarks

#### Audio Processing Performance
```
Text Length | TTS Generation | Enhancement | Total Time
50 chars   | 3-5 seconds   | <1 second   | 4-6 seconds
100 chars  | 5-8 seconds   | <1 second   | 6-9 seconds
200 chars  | 8-15 seconds  | 1-2 seconds | 9-17 seconds
```

#### Video Processing Performance
```
Audio Duration | Template Assembly | Split-Screen | Total Time
10 seconds    | 15-25 seconds    | +5 seconds   | 20-30 seconds
30 seconds    | 30-45 seconds    | +8 seconds   | 38-53 seconds
60 seconds    | 45-70 seconds    | +12 seconds  | 57-82 seconds
```

### Memory Usage Patterns
```
Component          | Peak Memory | Average Memory
Audio Processing   | 100-200MB  | 50-80MB
Video Assembly     | 500-800MB  | 200-400MB
Split-Screen       | 800-1.2GB  | 400-600MB
File Watching      | 20-50MB    | 15-25MB
```

### Storage Requirements
```
Component          | Size per File | Accumulation
Audio Output       | 200KB-1.5MB  | Linear growth
Video Templates    | 2-5MB each    | Fixed overhead
Generated Videos   | 5-25MB each   | Linear growth
Temporary Files    | 10-50MB       | Automatic cleanup
```

## Error Handling Specifications

### Error Categories and Responses

#### Audio Processing Errors
```javascript
const audioErrors = {
    'TTS_GENERATION_FAILED': {
        severity: 'high',
        action: 'retry_once',
        fallback: 'log_and_skip'
    },
    'ENHANCEMENT_FAILED': {
        severity: 'medium',
        action: 'continue_without_enhancement',
        fallback: 'use_original_audio'
    },
    'FILE_CORRUPTION': {
        severity: 'high',
        action: 'regenerate',
        fallback: 'manual_intervention'
    }
};
```

#### Video Processing Errors
```javascript
const videoErrors = {
    'TEMPLATE_MISSING': {
        severity: 'critical',
        action: 'validate_templates',
        fallback: 'stop_processing'
    },
    'FFMPEG_COMMAND_FAILED': {
        severity: 'high',
        action: 'retry_with_fallback_settings',
        fallback: 'log_detailed_error'
    },
    'DURATION_MISMATCH': {
        severity: 'medium',
        action: 'recalculate_timing',
        fallback: 'accept_small_variance'
    }
};
```

### Recovery Mechanisms
```javascript
// Exponential backoff for retries
function retryWithBackoff(operation, maxRetries = 3) {
    return new Promise((resolve, reject) => {
        let retries = 0;
        
        function attempt() {
            operation()
                .then(resolve)
                .catch(error => {
                    if (retries < maxRetries) {
                        retries++;
                        const delay = Math.pow(2, retries) * 1000;
                        setTimeout(attempt, delay);
                    } else {
                        reject(error);
                    }
                });
        }
        
        attempt();
    });
}
```

## Security Specifications

### Input Validation
```javascript
// Text input sanitization
function sanitizeTextInput(text) {
    // Remove potential command injection
    const cleaned = text.replace(/[;&|`$(){}[\]]/g, '');
    
    // Limit length
    if (cleaned.length > 1000) {
        throw new Error('Text input too long');
    }
    
    // Check for valid characters
    if (!/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(cleaned)) {
        throw new Error('Invalid characters in text input');
    }
    
    return cleaned;
}
```

### File System Security
```javascript
// Path traversal prevention
function validatePath(inputPath, allowedBase) {
    const resolved = path.resolve(inputPath);
    const base = path.resolve(allowedBase);
    
    if (!resolved.startsWith(base)) {
        throw new Error('Path traversal attempt detected');
    }
    
    return resolved;
}
```

### Resource Limits
```javascript
const resourceLimits = {
    maxConcurrentProcesses: 3,
    maxFileSize: 100 * 1024 * 1024,  // 100MB
    maxProcessingTime: 300000,        // 5 minutes
    maxTempFiles: 10,
    maxDiskUsage: 10 * 1024 * 1024 * 1024  // 10GB
};
```

## API Specifications (Future)

### REST Endpoints
```javascript
// Proposed API structure
const apiEndpoints = {
    '/api/v1/generate': {
        method: 'POST',
        payload: {
            text: 'string (required)',
            mode: 'normal|split',
            voice: 'string (optional)',
            template: 'string (optional)'
        },
        response: {
            jobId: 'string',
            status: 'queued|processing|complete|failed',
            estimatedTime: 'number (seconds)'
        }
    },
    '/api/v1/status/:jobId': {
        method: 'GET',
        response: {
            status: 'string',
            progress: 'number (0-1)',
            result: 'object (when complete)'
        }
    }
};
```

### WebSocket Events
```javascript
// Real-time processing updates
const wsEvents = {
    'processing.start': {
        jobId: 'string',
        stage: 'audio|video|enhancement'
    },
    'processing.progress': {
        jobId: 'string',
        stage: 'string',
        progress: 'number'
    },
    'processing.complete': {
        jobId: 'string',
        outputPath: 'string',
        metadata: 'object'
    }
};
```

## Testing Specifications

### Unit Test Coverage
- **Audio Processing**: 90%+ coverage
- **Video Assembly**: 85%+ coverage
- **File Management**: 95%+ coverage
- **Error Handling**: 80%+ coverage

### Integration Test Scenarios
```javascript
const testScenarios = [
    'normal_video_generation',
    'split_screen_with_large_source',
    'split_screen_with_small_source',
    'audio_enhancement_pipeline',
    'template_validation',
    'error_recovery',
    'concurrent_processing',
    'resource_cleanup'
];
```

### Performance Test Criteria
- **Audio Processing**: <20 seconds for 200-character input
- **Video Generation**: <90 seconds for 60-second audio
- **Memory Usage**: <1GB peak during processing
- **File System**: <5GB temporary storage usage

This technical specification provides the foundation for understanding, maintaining, and extending the video generation system. 