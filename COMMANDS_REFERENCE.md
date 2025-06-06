# Commands Reference Guide

## Quick Start Workflow

### Standard Video Generation
```bash
# Terminal 1 - Start video generator (normal mode)
cd video-editing
node auto-video-generator.js

# Terminal 2 - Generate audio (triggers video creation)
cd zero-wire/Spark-TTS  
python chunk_clone.py "Your text here"
```

### Split-Screen Video Generation
```bash
# Terminal 1 - Start video generator (split-screen mode)
cd video-editing
node auto-video-generator.js --split

# Terminal 2 - Generate audio (triggers split-screen video creation)
cd zero-wire/Spark-TTS
python chunk_clone.py "Your text here"
```

## Audio Generation Commands

### Basic Text-to-Speech
```bash
python chunk_clone.py "Text to convert to speech"
```

### Advanced Audio Options
```bash
python chunk_clone.py "Text here" \
  --voice "default_voice" \
  --target-level 0.8 \
  --compression-ratio 6.0 \
  --output-prefix "custom_name"
```

### Audio Enhancement Control
```bash
# Skip audio enhancement
python chunk_clone.py "Text here" --no-enhance

# Skip normalization
python chunk_clone.py "Text here" --no-normalize

# Skip compression
python chunk_clone.py "Text here" --no-compress
```

## Video Generation Commands

### Auto Video Generator Options
```bash
# Normal mode - standard video generation
node auto-video-generator.js

# Split-screen mode - adds 4s split-screen intro
node auto-video-generator.js --split

# Debug mode - shows clip information overlays
node auto-video-generator.js --debug-overlay

# Combined - split-screen with debug overlays
node auto-video-generator.js --split --debug-overlay

# Help - show all options and usage
node auto-video-generator.js --help
```

### Manual Processing (Testing)
```bash
# Test split-screen functionality with existing audio
node test-split-screen.js
```

## File Management Commands

### Directory Navigation
```bash
# Audio generation
cd zero-wire/Spark-TTS

# Video generation  
cd video-editing

# Return to project root
cd ../../
```

### Output Monitoring
```bash
# Watch audio output folder
ls -la zero-wire/Spark-TTS/audiooutput/done/

# Watch video output (normal mode)
ls -la video-editing/generated-videos/

# Watch video output (split-screen mode)  
ls -la FinalOutput/

# Watch template folders
ls -la VideoTemplates/style\ 1/
ls -la splitscreensource/
```

## Debugging & Analysis Commands

### Audio Analysis
```bash
# Check audio file duration
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "audio_file.wav"

# Check audio file details
ffprobe -v quiet -show_format -show_streams "audio_file.wav"

# Listen to audio file (macOS)
afplay "audio_file.wav"
```

### Video Analysis  
```bash
# Check video dimensions
ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "video_file.mp4"

# Check video duration
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "video_file.mp4"

# Get detailed video info
ffprobe -v quiet -show_format -show_streams "video_file.mp4"

# Play video (macOS)
open "video_file.mp4"
```

### System Status
```bash
# Check Node.js version
node --version

# Check Python version  
python --version

# Check FFmpeg installation
ffmpeg -version

# Check available disk space
df -h
```

## Process Management

### Starting Services
```bash
# Start video generator in background
cd video-editing
nohup node auto-video-generator.js > video-generator.log 2>&1 &

# Start split-screen video generator in background
nohup node auto-video-generator.js --split > video-generator-split.log 2>&1 &
```

### Stopping Services
```bash
# Find and kill video generator process
ps aux | grep "auto-video-generator"
kill [process_id]

# Or use pkill
pkill -f "auto-video-generator"
```

### Log Monitoring
```bash
# Watch video generator logs
tail -f video-generator.log

# Watch split-screen logs  
tail -f video-generator-split.log
```

## Maintenance Commands

### Dependency Management
```bash
# Node.js dependencies
cd video-editing
npm install
npm update

# Python dependencies (in Spark-TTS environment)
cd zero-wire/Spark-TTS
pip install -r requirements.txt
pip list --outdated
```

### Cleanup Operations
```bash
# Clean temporary video files
cd video-editing
rm -f generated-videos/temp_*
rm -f generated-videos/*_config.json5

# Clean old audio files (be careful!)
cd zero-wire/Spark-TTS/audiooutput/done
ls -la *.wav | head -10  # Check before deleting
# rm old_files.wav  # Only if you're sure

# Clean old generated videos (archive first!)
cd FinalOutput
ls -la *.mp4 | head -10  # Check before deleting
```

## Template Management

### Adding New Templates
```bash
# Copy new intro videos
cp new_intro.mp4 VideoTemplates/style\ 1/Intro/

# Copy new loop videos  
cp new_loop.mp4 VideoTemplates/style\ 1/Loop/

# Copy new end videos
cp new_end.mp4 VideoTemplates/style\ 1/End/

# Copy new split-screen templates
cp new_splitscreen.mp4 VideoTemplates/style\ 1/splitscreen/

# Copy new split-screen source videos
cp new_source.mp4 splitscreensource/
```

### Template Validation
```bash
# Check template folders exist and have content
find VideoTemplates/style\ 1/ -name "*.mp4" | wc -l

# Verify all required folders exist
ls -la VideoTemplates/style\ 1/
```

## Troubleshooting Commands

### Common Issues

#### Fix Node.js Module Issues
```bash
cd video-editing
rm -rf node_modules package-lock.json
npm install
```

#### Rebuild Native Modules
```bash
cd video-editing  
npm rebuild
```

#### Check Audio Processing
```bash
cd zero-wire/Spark-TTS
python -c "import soundfile; print('soundfile works')"
python -c "import numpy; print('numpy works')"
```

#### Test FFmpeg Integration
```bash
# Simple test
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 test.mp4

# Test with audio
ffmpeg -f lavfi -i testsrc=duration=3:size=640x480:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=3 \
       -c:v libx264 -c:a aac test_with_audio.mp4
```

## Environment Setup Commands

### Initial Setup
```bash
# Clone/setup project structure
mkdir -p VideoTemplates/style\ 1/{Intro,Loop,End,splitscreen}
mkdir -p splitscreensource
mkdir -p FinalOutput
mkdir -p video-editing/generated-videos

# Set permissions
chmod +x video-editing/auto-video-generator.js
chmod +x video-editing/test-split-screen.js
```

### Development Environment
```bash
# Install development tools
npm install -g nodemon  # For auto-restart during development

# Use nodemon for development
cd video-editing
nodemon auto-video-generator.js --split --debug-overlay
```

## Performance Monitoring

### Resource Usage
```bash
# Monitor CPU and memory usage
top -pid $(pgrep -f "auto-video-generator")

# Monitor disk I/O
iostat -x 1

# Monitor folder sizes
du -sh VideoTemplates/ splitscreensource/ FinalOutput/ video-editing/generated-videos/
```

### Processing Times
```bash
# Time audio generation
time python chunk_clone.py "Test message"

# Time video generation (check logs)
grep "processing pipeline complete" video-generator.log
```

## Batch Operations

### Bulk Audio Generation
```bash
# Generate multiple audio files
for text in "Message 1" "Message 2" "Message 3"; do
    python chunk_clone.py "$text"
    sleep 5  # Wait between generations
done
```

### Batch File Processing
```bash
# Process all pending audio files (if watcher is stopped)
cd video-editing
for audio_file in ../zero-wire/Spark-TTS/audiooutput/done/*.wav; do
    echo "Processing: $audio_file"
    node -e "
        const { processAudioFile } = require('./auto-video-generator.js');
        processAudioFile('$audio_file', false, true);  // split-screen mode
    "
done
```

## Error Recovery

### Reset Everything
```bash
# Stop all processes
pkill -f "auto-video-generator"
pkill -f "chunk_clone"

# Clean temporary files
find . -name "temp_*" -delete
find . -name "*_config.json5" -delete

# Restart fresh
cd video-editing
node auto-video-generator.js --split
```

### Recover from Failures
```bash
# Check for stuck processes
ps aux | grep -E "(node|python|ffmpeg)"

# Check disk space
df -h

# Check permissions
ls -la VideoTemplates/style\ 1/
ls -la splitscreensource/
ls -la FinalOutput/
```

## Integration Commands

### Webhook Integration (Future)
```bash
# Example POST request to trigger video generation
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Your message", "splitScreen": true}'
```

### API Testing
```bash
# Test audio generation via API
curl -X POST http://localhost:3000/audio \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message", "voice": "default"}'
```

This reference guide provides comprehensive command documentation for all aspects of the video generation system. Keep this handy for daily operations and troubleshooting. 