# Zero Wire - AI Voice Cloning & Video Generation System

## 🎯 Overview
Complete automated pipeline that converts text to professional videos with cloned voice narration. Features intelligent text chunking, high-quality voice synthesis, template-based video generation, and automatic file lifecycle management.

## ✨ Key Features
- 🎤 **AI Voice Cloning**: High-quality voice synthesis using Spark-TTS
- 📝 **Smart Text Processing**: Intelligent chunking for long content (≤200 chars per chunk)
- 🎬 **Automated Video Generation**: Template-based video creation with perfect audio sync
- 📦 **File Lifecycle Management**: Automatic organization with done folder system
- 🔄 **Real-time Processing**: Background monitoring with instant video generation
- 🎯 **Production Ready**: Comprehensive error handling and recovery systems

## 🏗️ System Architecture

```
TEXT INPUT → Voice Cloning → Auto Video Generation → File Management
     ↓              ↓                    ↓               ↓
chunk_clone.py → audiooutput/ → auto-video-generator → done/ archive
```

### Complete Workflow
1. **Text Input** → Intelligent chunking and voice synthesis
2. **Audio Generation** → High-quality .wav files in `audiooutput/`
3. **Auto Detection** → Real-time file monitoring and processing
4. **Video Creation** → Template-based video with intro/loop/end structure
5. **File Management** → Automatic archiving to `done/` subfolder

## 🚀 Quick Start

### Prerequisites
- **Python**: 3.10+ with conda
- **Node.js**: v18.20.8 LTS (MANDATORY)
- **FFmpeg**: v7.1.1+
- **System**: macOS Darwin 24.5.0 (tested)

### Installation & Setup
```bash
# 1. Clone and setup environments
git clone [repository]
cd zerowirefinal

# 2. Setup Python environment
conda activate sparktts
cd zero-wire/Spark-TTS

# 3. Setup Node.js environment  
nvm use 18.20.8
cd ../../video-editing
npm install

# 4. Verify installation
python chunk_clone.py --help
node auto-video-generator.js --help
```

### Basic Usage
```bash
# 1. Generate voice (from zero-wire/Spark-TTS/)
conda activate sparktts
python chunk_clone.py 'Your text content here!'
# Output: audiooutput/Your_text_content.wav

# 2. Start auto video generation (from video-editing/)
./start-watcher.sh
# Background process monitors audiooutput/ folder

# 3. Result: Automatic video generation
# Video: generated-videos/Your_text_content_2025-06-03.mp4
# Audio moved to: audiooutput/done/Your_text_content.wav
```

## 📁 Project Structure

```
zerowirefinal/
├── zero-wire/Spark-TTS/
│   ├── chunk_clone.py              # 🎤 Main voice generation script
│   ├── audiooutput/                # 📁 Generated audio files
│   │   ├── done/                   # ✅ Processed files archive
│   │   └── [new audio files]       # ⏳ Pending processing
│   ├── training/                   # 🎵 Training voice files
│   └── pretrained_models/          # 🤖 Spark-TTS models
├── video-editing/
│   ├── auto-video-generator.js     # 🎬 Main video processing
│   ├── start-watcher.sh           # 🚀 Quick start script
│   └── generated-videos/          # 📹 Output videos
├── VideoTemplates/style 1/
│   ├── Intro/                     # 🎬 Opening video clips
│   ├── Loop/                      # 🔄 Repeatable content
│   └── End/                       # 🎯 Closing video clips
└── zero-wire/memory-bank/         # 📚 Documentation
```

## 🎛️ Configuration

### Voice Configuration
```python
# Default: High-quality training voice
python chunk_clone.py 'Your text here!'

# Custom voice override
python chunk_clone.py 'Text' --voice audiooutput/custom_voice.wav
python chunk_clone.py 'Text' --voice training/specific_voice.wav
```

### Video Configuration
- **Templates**: Random selection from Intro/Loop/End folders
- **Duration**: Automatically calculated to match audio length
- **Quality**: Inherits dimensions from template videos (maintains aspect ratio)
- **Output**: H.264 MP4 format, 30fps, 0.2s fade transitions

## 📊 Performance Metrics

| Operation | Duration | Resource Usage |
|-----------|----------|----------------|
| Text Chunking | <1 second | CPU-light |
| Voice Generation | 5-30 seconds | CPU-intensive |
| Video Creation | 30-60 seconds | CPU+Memory intensive |
| File Management | <1 second | I/O-light |

### File Size Characteristics
- **Generated Audio**: 200KB-1.5MB (3-40 seconds)
- **Output Video**: 5-15MB (27-60 seconds)
- **Template Videos**: 2.5MB each (9 seconds)

## 🛡️ Error Handling & Recovery

### Automatic Recovery
- **Voice Generation Fails**: Error logged, no audio file created
- **Video Generation Fails**: Audio remains for retry, detailed error logging
- **File Move Fails**: Video still created, manual intervention flagged
- **Watcher Crashes**: Auto-restart capability, persistent monitoring

### Success Indicators
```
✅ Video generation complete!
📦 Moved audio file to done: filename.wav
✨ Audio processing pipeline complete!
```

## 🔧 Advanced Usage

### Batch Processing
```bash
# Multiple files processed automatically
python chunk_clone.py 'First text content'
python chunk_clone.py 'Second text content'
python chunk_clone.py 'Third text content'
# All videos generated automatically by watcher
```

### Custom Templates
```bash
# Add new video templates
VideoTemplates/style 1/
├── Intro/new_intro.mp4    # Automatically detected
├── Loop/new_loop.mp4      # Random selection includes new files
└── End/new_ending.mp4     # System adapts to new content
```

### Monitoring & Management
```bash
# Check pending files
ls zero-wire/Spark-TTS/audiooutput/

# Check processed files
ls zero-wire/Spark-TTS/audiooutput/done/

# Check generated videos
ls video-editing/generated-videos/

# Monitor processing
tail -f [watcher logs]
```

## 📚 Documentation

### Comprehensive Guides
- **[System Architecture](zero-wire/memory-bank/12-system-architecture-current.md)**: Complete technical overview
- **[Auto Video System](zero-wire/memory-bank/08-auto-video-system.md)**: Video generation details  
- **[Done Folder Management](zero-wire/memory-bank/11-done-folder-functionality.md)**: File lifecycle management
- **[Default Voice Setup](zero-wire/memory-bank/10-default-cloned-voice.md)**: Voice configuration guide
- **[Audio Migration](zero-wire/memory-bank/09-audiooutput-migration.md)**: Folder structure updates

### Component Documentation
- **[Video Editing README](video-editing/README.md)**: Video processing details
- **[Spark-TTS Documentation](zero-wire/Spark-TTS/README.md)**: Voice synthesis guide

## 🚦 System Status

### ✅ Current Capabilities
- **Voice Generation**: Fully operational with training voice default
- **Video Processing**: Fully operational with template system
- **File Management**: Fully operational with done folder
- **Background Monitoring**: Fully operational with auto-detection
- **Error Handling**: Comprehensive error recovery implemented

### 🎯 Production Readiness
- **Stability**: Tested with various text lengths and content types
- **Performance**: Optimized for real-time processing  
- **Reliability**: Automatic error recovery and file management
- **Scalability**: Handles multiple files and batch processing

## 🔍 Troubleshooting

### Common Issues
```bash
# Node.js version (must be v18.20.8)
nvm use 18.20.8

# Conda environment
conda activate sparktts

# Check system status
node --version        # Should be v18.20.8
npx editly --version  # Should be 0.14.2
```

### Support Resources
- **Error Logs**: Detailed logging for all operations
- **Memory Bank**: Comprehensive troubleshooting guides
- **File Structure**: Clear organization for easy debugging

---

## 📈 Version History
- **v2.0** (June 2025): Done folder management, training voice default
- **v1.5** (June 2025): Audio output migration, improved file organization
- **v1.0** (June 2025): Initial auto video generation system

## 🏆 Status
**Status**: ✅ PRODUCTION READY  
**Last Updated**: June 3, 2025  
**Architecture**: Complete voice-to-video pipeline with automatic file management  
**Next Phase**: Ready for content creation workflows

---
*Zero Wire System - Transforming text into professional video content with AI-powered voice synthesis and automated video generation.* 