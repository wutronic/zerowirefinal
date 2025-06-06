# Video Generation System Architecture

## Overview
Automated video generation system that converts text to speech and creates professional videos with multiple templates and split-screen capabilities.

## System Components

### 1. Audio Processing Pipeline
**Location**: `zero-wire/Spark-TTS/`
- **Primary Script**: `chunk_clone.py`
- **Audio Enhancement**: `sparktts/utils/audio.py`
- **Output**: `audiooutput/done/` folder (processed audio files)

### 2. Video Generation Pipeline  
**Location**: `video-editing/`
- **Primary Script**: `auto-video-generator.js`
- **Watcher**: Monitors audio output folder for new files
- **Video Templates**: `VideoTemplates/style 1/` with Intro, Loop, End folders
- **Output**: `generated-videos/` (normal) or `FinalOutput/` (split-screen)

### 3. Split-Screen System
**Templates**: 
- Top: `VideoTemplates/style 1/splitscreen/`
- Bottom: `splitscreensource/`

## Data Flow

```
Text Input → TTS Processing → Audio Enhancement → Video Generation → Final Output
     ↓             ↓                ↓                   ↓              ↓
chunk_clone.py → audio.py → auto-video-generator.js → editly → MP4 files
```

### Detailed Flow:
1. **Text → Audio**: `chunk_clone.py` generates speech using SparkTTS
2. **Audio Enhancement**: Automatic silence reduction and quality improvement
3. **File Movement**: Audio moved to `audiooutput/done/` when complete
4. **Video Generation**: Watcher detects new audio, triggers video creation
5. **Template Assembly**: Intro → Loop(s) → End structure based on audio duration
6. **Split-Screen Processing**: (Optional) Adds 4s split-screen intro with intelligent cropping
7. **Final Output**: Complete video with synchronized audio

## Intelligent Features

### Audio Post-Processing
- **Silence Detection**: Identifies segments >0.3s
- **Silence Reduction**: Shortens to 0.25s natural pause length  
- **Quality Preservation**: No speech degradation, improved RMS
- **Automatic Integration**: Applied to all generated audio

### Intelligent Split-Screen Cropping
- **Height Analysis**: Compares splitscreensource to loop template dimensions
- **Strategy Selection**:
  - `≥50% height`: Crop both videos (traditional split-screen)
  - `<50% height`: Position without cropping (preserve small video content)
- **Positioning Logic**: 25% from top (top) and 75% from top (bottom), measured from center

### Video Structure Calculation
- **Duration Matching**: Video length precisely matches audio duration
- **Template Selection**: Random files from each folder
- **Loop Calculation**: Fills remaining time with multiple loop videos
- **Seamless Transitions**: No fade/dissolve effects for continuous looping

## File Structure

```
zerowirefinal/
├── zero-wire/Spark-TTS/           # Audio generation
│   ├── chunk_clone.py             # Main TTS script
│   ├── sparktts/utils/audio.py    # Audio processing utilities
│   └── audiooutput/done/          # Processed audio output
├── video-editing/                 # Video generation
│   ├── auto-video-generator.js    # Main video script
│   ├── test-split-screen.js       # Testing utilities
│   ├── generated-videos/          # Normal video output
│   └── node_modules/              # Dependencies
├── VideoTemplates/style 1/        # Video templates
│   ├── Intro/                     # Opening videos
│   ├── Loop/                      # Repeatable middle content
│   ├── End/                       # Closing videos
│   └── splitscreen/               # Split-screen top videos
├── splitscreensource/             # Split-screen bottom videos
└── FinalOutput/                   # Split-screen video output
```

## Configuration

### Audio Settings
- **Target Level**: 0.8 (audio normalization)
- **Compression Ratio**: 6.0 (dynamic range compression)
- **Silence Threshold**: >0.3s segments reduced to 0.25s
- **Enhancement**: Automatic post-processing enabled

### Video Settings
- **Dimensions**: Inherited from template videos (typically 720x1280)
- **Frame Rate**: 30 FPS
- **Audio Sync**: Exact duration matching
- **Transitions**: None (seamless cuts)
- **Split-Screen Duration**: 4 seconds

### Folder Monitoring
- **Watch Path**: `../zero-wire/Spark-TTS/audiooutput/done`
- **File Types**: `.wav`, `.mp3`, `.m4a`, `.aac`
- **Processing Delay**: 1 second after file detection
- **Cleanup**: Automatic temporary file removal

## Technology Stack

### Audio Processing
- **Python 3.x**: Core language
- **SparkTTS**: Text-to-speech engine
- **soundfile**: Audio file I/O
- **numpy**: Numerical operations for audio processing

### Video Processing  
- **Node.js**: JavaScript runtime
- **editly**: Video editing framework
- **FFmpeg**: Video processing backend
- **chokidar**: File system watcher

### Dependencies
```bash
# Node.js packages
npm install editly chokidar minimist

# Python packages (in Spark-TTS environment)
pip install soundfile numpy
```

## Operational Modes

### Normal Mode
```bash
cd video-editing
node auto-video-generator.js [--debug-overlay]
```
- Creates standard video: Intro → Loop(s) → End
- Output: `generated-videos/`

### Split-Screen Mode  
```bash
cd video-editing
node auto-video-generator.js --split [--debug-overlay]
```
- Creates enhanced video: Split-screen (4s) → Intro → Loop(s) → End
- Output: `FinalOutput/`
- Uses intelligent cropping based on video dimensions

### Debug Mode
- `--debug-overlay`: Shows clip information on video
- Format: "CLIP_NAME | Full: Xs | Used: Ys | Trans: none"

## Error Handling

### Audio Pipeline
- **File Validation**: Checks audio duration and format
- **Enhancement Fallback**: Continues without enhancement if processing fails
- **Quality Monitoring**: Logs RMS and duration changes

### Video Pipeline
- **Template Validation**: Verifies required template folders exist
- **Duration Calculation**: Handles edge cases (very short/long audio)
- **Cleanup**: Removes temporary files on success/failure
- **Fallback Logic**: Uses splitscreen video for both if splitscreensource empty

## Performance Considerations

### Audio Processing
- **Streaming**: Processes audio in chunks for memory efficiency
- **Caching**: Reuses analysis results where possible
- **Quality vs Speed**: Balanced settings for production use

### Video Processing
- **Template Reuse**: Random selection without reloading
- **Memory Management**: Automatic cleanup of large temporary files
- **Parallel Processing**: Concurrent FFmpeg operations where safe

## Monitoring & Debugging

### Logging Levels
- **Info**: File detection, processing start/end
- **Debug**: Detailed timing and dimension information  
- **Error**: Failures with stack traces
- **Warning**: Non-fatal issues and fallbacks

### Key Metrics
- **Audio Duration**: Original vs final length
- **Video Structure**: Number of loops and total duration
- **Processing Time**: End-to-end pipeline performance
- **File Sizes**: Input audio vs output video

## Security Considerations

### File System
- **Path Validation**: Prevents directory traversal
- **File Type Checking**: Validates extensions and content
- **Temporary Files**: Secure cleanup prevents data leakage

### Process Isolation
- **FFmpeg Sandboxing**: Limited system access
- **Input Validation**: Sanitizes user-provided text
- **Resource Limits**: Prevents resource exhaustion

## Maintenance

### Regular Tasks
- **Template Updates**: Add new intro/loop/end videos
- **Dependency Updates**: Keep Node.js and Python packages current
- **Log Rotation**: Manage log file sizes
- **Storage Cleanup**: Archive old generated videos

### Troubleshooting
- **Module Compatibility**: Node.js version compatibility with native modules
- **FFmpeg Path**: Ensure FFmpeg is accessible in system PATH
- **Audio Codecs**: Verify supported formats match input files
- **Permissions**: Check read/write access to all required directories 