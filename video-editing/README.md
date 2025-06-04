# Auto Video Generator System

## Overview
Automated video generation system that watches for new audio files and creates videos using template structure (Intro → Loop(s) → End).

## Features
- 🎵 **Audio File Monitoring**: Watches `audiooutput/` folder for new audio files
- 🎬 **Template-Based Videos**: Uses random Intro/Loop/End video templates  
- ⏱️ **Duration Matching**: Calculates loop repetitions to match audio duration
- 🎯 **Original Dimensions**: Preserves video template aspect ratios and dimensions
- 🔄 **Automatic Processing**: Generates videos immediately when audio is added
- 📦 **File Management**: Moves processed audio to `done/` subfolder after completion
- 🛡️ **Smart Detection**: Ignores processed files to prevent reprocessing

## System Requirements
- ✅ Node.js v18.20.8 LTS (MANDATORY)
- ✅ Editly v0.14.2
- ✅ FFmpeg v7.1.1
- ✅ sparktts conda environment

## File Structure
```
video-editing/
├── auto-video-generator.js    # Main watcher script (with done folder support)
├── test-auto-generator.js     # Test script
├── start-watcher.sh          # Startup script
├── generated-videos/         # Output folder
└── README.md                # This file

../VideoTemplates/style 1/
├── Intro/                   # Opening videos
├── Loop/                    # Repeatable middle sections  
└── End/                     # Closing videos

../zero-wire/Spark-TTS/audiooutput/  # Watched folder
├── done/                    # ✅ NEW: Processed files archive
│   └── [completed audio]    # Files moved after video creation
└── [new audio files]       # Pending processing
```

## Usage

### Start the Watcher
```bash
# Option 1: Use startup script
./start-watcher.sh

# Option 2: Manual start
conda activate sparktts
nvm use 18
node auto-video-generator.js
```

### Test with Existing Audio
```bash
node test-auto-generator.js
```

### Generate New Videos
1. Create audio using Spark-TTS chunk_clone.py
2. Audio files are automatically detected in audiooutput/
3. Videos generated in `generated-videos/` folder

## Video Generation Logic

### 1. Audio Duration Analysis
- Analyzes new audio file duration (e.g., 16.92 seconds)

### 2. Template Selection
- **Intro**: Random video from `Intro/` folder
- **Loop**: Random video from `Loop/` folder  
- **End**: Random video from `End/` folder

### 3. Duration Calculation
```
Audio Duration: 16.92s
Intro Duration: 9.04s
End Duration: 9.04s
Fixed Duration: 18.08s

Remaining: 16.92s - 18.08s = -1.16s (negative means loop once)
Loop Count: 1 (minimum)
Total Video: 9.04s + 9.04s + 9.04s = 27.13s
```

### 4. Video Structure
- 1 × Intro video
- N × Loop videos (calculated to cover audio duration)
- 1 × End video
- Audio replaces video soundtracks

## Output Details

### File Naming
```
{AudioBasename}_{Date}.mp4
Example: Welcome_to_the_2025-06-03.mp4
```

### Video Properties
- **Dimensions**: Inherited from template videos
- **Frame Rate**: 30fps
- **Transitions**: 0.2s fade between clips
- **Audio**: Replaces template audio completely

## Supported Formats

### Audio Input
- .wav ✅ (Primary from Spark-TTS)
- .mp3 ✅
- .m4a ✅  
- .aac ✅

### Video Templates
- .mp4 ✅ (Primary)
- .mov ✅
- .avi ✅

## Example Output
```
🎵 Processing new audio file: Welcome_to_the.wav
⏱️ Audio duration: 16.92 seconds
🎬 Calculating video structure...
📊 Video durations: Intro=9.04s, Loop=9.04s, End=9.04s
🎬 Structure: 1 intro + 1 loops + 1 end = 27.13s (audio: 16.92s)
⚙️ Generating video configuration...
🎥 Generating video...
✅ Video generation complete!
📁 Output: generated-videos/Welcome_to_the_2025-06-03.mp4
📦 Moving processed audio file...
📦 Moved audio file to done: Welcome_to_the.wav
✨ Audio processing pipeline complete!
📊 Final video: 27.13s
```

## Integration with Spark-TTS

### Workflow
1. Generate voice clones: `python chunk_clone.py "Your text here"`
2. Audio saved to: `audiooutput/Your_text_here.wav`
3. Auto video generator detects new file
4. Video created: `generated-videos/Your_text_here_2025-06-03.mp4`

### Chunked Audio Support
- Works with merged audio from chunking system
- Automatically processes files like `Multi-chunk_testing_scenario.wav`
- Maintains audio-video sync regardless of text length

## Technical Details

### Performance
- **Detection Delay**: 1 second (ensures file write completion)
- **Processing Time**: ~30-60 seconds per video
- **Memory Usage**: ~500MB during processing
- **Output Size**: ~7MB for 27-second video

### Error Handling
- Invalid audio files skipped
- Missing template folders reported
- Failed generations logged with details
- Automatic cleanup of temporary config files

## Troubleshooting

### Watcher Not Starting
```bash
# Check paths
ls "../VideoTemplates/style 1/"
ls "../zero-wire/Spark-TTS/audiooutput/"

# Check dependencies
node --version    # Should be v18.20.8
npx editly --version  # Should be 0.14.2
```

### No Video Generation
- Ensure audio file is valid (not corrupted)
- Check template folders have video files
- Verify Node.js v18 is active (newer versions break)

### Quality Issues
- Remove `--fast` flag for full resolution
- Check template video quality
- Verify audio file isn't clipped

---
**Status**: ✅ FULLY OPERATIONAL
**Last Updated**: June 3, 2025
**Latest Features**:
- ✅ Done folder auto-file management
- ✅ Smart file detection and organization
- ✅ Training voice default configuration
**Integration**: Ready for production use with complete file lifecycle management 