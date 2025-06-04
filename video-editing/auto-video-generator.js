#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    audioWatchFolder: '../zero-wire/Spark-TTS/audiooutput/done',
    videoTemplatesBase: '../VideoTemplates/style 1',
    outputFolder: './generated-videos',
    supportedAudioFormats: ['.wav', '.mp3', '.m4a', '.aac'],
    supportedVideoFormats: ['.mp4', '.mov', '.avi']
};

// Ensure output folder exists
if (!fs.existsSync(CONFIG.outputFolder)) {
    fs.mkdirSync(CONFIG.outputFolder, { recursive: true });
}

/**
 * Get duration of media file using ffprobe
 */
async function getMediaDuration(filePath) {
    try {
        const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
        return parseFloat(stdout.trim());
    } catch (error) {
        console.error(`Error getting duration for ${filePath}:`, error.message);
        return 0;
    }
}

/**
 * Get video dimensions using ffprobe
 */
async function getVideoDimensions(filePath) {
    try {
        const { stdout } = await execAsync(`ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filePath}"`);
        const [width, height] = stdout.trim().split(',').map(Number);
        return { width, height };
    } catch (error) {
        console.error(`Error getting dimensions for ${filePath}:`, error.message);
        return { width: 1920, height: 1080 }; // fallback
    }
}

/**
 * Get random file from directory with supported extensions
 */
function getRandomVideoFile(directory, extensions = CONFIG.supportedVideoFormats) {
    if (!fs.existsSync(directory)) {
        console.error(`Directory not found: ${directory}`);
        return null;
    }
    
    const files = fs.readdirSync(directory)
        .filter(file => extensions.some(ext => file.toLowerCase().endsWith(ext)))
        .filter(file => !file.startsWith('.'));
    
    if (files.length === 0) {
        console.error(`No video files found in: ${directory}`);
        return null;
    }
    
    const randomFile = files[Math.floor(Math.random() * files.length)];
    return path.join(directory, randomFile);
}

/**
 * Calculate required loop videos to fill the audio duration
 */
async function calculateVideoStructure(audioDuration) {
    const introFolder = path.join(CONFIG.videoTemplatesBase, 'Intro');
    const loopFolder = path.join(CONFIG.videoTemplatesBase, 'Loop');
    const endFolder = path.join(CONFIG.videoTemplatesBase, 'End');
    
    // Get random intro and end files
    const introFile = getRandomVideoFile(introFolder);
    const endFile = getRandomVideoFile(endFolder);
    
    if (!introFile || !endFile) {
        throw new Error('Could not find required intro or end video template files');
    }
    
    // Get all available loop files
    const loopFiles = [];
    if (fs.existsSync(loopFolder)) {
        const files = fs.readdirSync(loopFolder);
        for (const file of files) {
            const filePath = path.join(loopFolder, file);
            const ext = path.extname(file).toLowerCase();
            if (CONFIG.supportedVideoFormats.includes(ext) && fs.statSync(filePath).isFile()) {
                loopFiles.push(filePath);
            }
        }
    }
    
    if (loopFiles.length === 0) {
        throw new Error('Could not find any loop video template files');
    }
    
    // Get durations
    const introDuration = await getMediaDuration(introFile);
    const endDuration = await getMediaDuration(endFile);
    
    // Get durations for all loop files
    const loopDurations = [];
    for (const loopFile of loopFiles) {
        const duration = await getMediaDuration(loopFile);
        loopDurations.push({ file: loopFile, duration });
    }
    
    console.log(`📊 Video durations: Intro=${introDuration}s, End=${endDuration}s`);
    console.log(`🔄 Available loop files: ${loopFiles.length} files with durations: ${loopDurations.map(l => l.duration + 's').join(', ')}`);
    
    // CASE 1: Audio is shorter than or equal to intro video
    if (audioDuration <= introDuration) {
        console.log(`🎬 Short audio detected: Using only intro video cropped to ${audioDuration}s`);
        return {
            intro: { file: introFile, duration: audioDuration, fullDuration: false },
            loops: [],
            end: null,
            totalVideoDuration: audioDuration
        };
    }
    
    // CASE 2: Audio is longer than intro, check if we need end video
    const timeAfterIntro = audioDuration - introDuration;
    
    // If remaining time is very short (less than 2 seconds), just extend the intro slightly
    if (timeAfterIntro < 2) {
        console.log(`🎬 Using intro only, extended to match audio duration: ${audioDuration}s`);
        return {
            intro: { file: introFile, duration: audioDuration, fullDuration: false },
            loops: [],
            end: null,
            totalVideoDuration: audioDuration
        };
    }
    
    // CASE 3: Normal case - intro + loops + end
    const loops = [];
    let currentTime = 0;
    let loopIndex = 0;
    
    // Fill with full loop videos until we need to add the end video
    while (currentTime < timeAfterIntro - endDuration) {
        const currentLoop = loopDurations[loopIndex % loopDurations.length];
        
        // Only add if the full loop fits before we need to place the end video
        if (currentTime + currentLoop.duration <= timeAfterIntro - endDuration) {
            loops.push({
                file: currentLoop.file,
                duration: currentLoop.duration,
                fullDuration: true
            });
            currentTime += currentLoop.duration;
            loopIndex++;
        } else {
            break;
        }
    }
    
    // Calculate how much time remains for the end video
    const remainingTimeForEnd = audioDuration - introDuration - currentTime;
    const endVideoDuration = Math.min(endDuration, remainingTimeForEnd);
    
    const totalCalculatedDuration = introDuration + currentTime + endVideoDuration;
    
    console.log(`🎬 Structure: 1 intro (${introDuration}s) + ${loops.length} loops (${currentTime}s total) + 1 end (${endVideoDuration}s${endVideoDuration < endDuration ? ' cropped' : ''}) = ${totalCalculatedDuration}s (audio: ${audioDuration}s)`);
    
    return {
        intro: { file: introFile, duration: introDuration, fullDuration: true },
        loops: loops,
        end: { file: endFile, duration: endVideoDuration, fullDuration: endVideoDuration >= endDuration },
        totalVideoDuration: totalCalculatedDuration
    };
}

/**
 * Generate editly configuration for the video
 */
async function generateEditlyConfig(audioFile, videoStructure, outputPath) {
    const { intro, loops, end } = videoStructure;
    
    // Get dimensions from intro video (all should match)
    const dimensions = await getVideoDimensions(intro.file);
    
    // Get actual audio duration to ensure exact matching
    const audioDuration = await getMediaDuration(audioFile);
    
    const clips = [];
    
    // Add intro clip (may be cropped for short audio)
    clips.push({
        duration: intro.duration,
        layers: [{
            type: 'video',
            path: intro.file,
            // If intro video is cropped, specify the cutFrom
            ...(intro.fullDuration ? {} : { cutFrom: 0, cutTo: intro.duration })
        }]
        // NO transitions - completely removed
    });
    
    // Add loop clips (all full duration, NO TRANSITIONS for seamless looping)
    for (let i = 0; i < loops.length; i++) {
        const loop = loops[i];
        clips.push({
            duration: loop.duration,
            layers: [{
                type: 'video', 
                path: loop.file
            }]
            // NO transition property = seamless cuts between loops
        });
    }
    
    // Add end clip only if it exists (may be cropped to fit audio)
    if (end) {
        clips.push({
            duration: end.duration,
            layers: [{
                type: 'video',
                path: end.file,
                // If end video is cropped, specify the cutFrom
                ...(end.fullDuration ? {} : { cutFrom: 0, cutTo: end.duration })
            }]
            // NO transitions - completely removed
        });
    }
    
    const config = {
        outPath: outputPath,
        width: dimensions.width,
        height: dimensions.height,
        fps: 30,
        // Set exact output duration to match audio
        outDuration: audioDuration,
        audioFilePath: audioFile,
        keepSourceAudio: false, // Replace video audio with our audio
        // Use dummy transition with zero duration for seamless hard cuts
        defaults: {
            transition: { name: 'dummy', duration: 0 }
        },
        clips
    };
    
    return config;
}

/**
 * Process new audio file
 */
async function processAudioFile(audioFilePath) {
    try {
        console.log(`\n🎵 Processing new audio file: ${path.basename(audioFilePath)}`);
        
        // Check if file still exists (may have been processed by another instance)
        if (!fs.existsSync(audioFilePath)) {
            console.warn(`⚠️ Audio file no longer exists, skipping: ${path.basename(audioFilePath)}`);
            return;
        }
        
        // Get audio duration
        const audioDuration = await getMediaDuration(audioFilePath);
        console.log(`⏱️ Audio duration: ${audioDuration.toFixed(2)} seconds`);
        
        if (audioDuration <= 0) {
            console.error('❌ Invalid audio duration');
            return;
        }
        
        // Calculate video structure
        console.log('🎬 Calculating video structure...');
        const videoStructure = await calculateVideoStructure(audioDuration);
        
        // Generate output filename
        const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const outputPath = path.join(CONFIG.outputFolder, `${audioBasename}_${timestamp}.mp4`);
        
        // Check if video already exists
        if (fs.existsSync(outputPath)) {
            console.warn(`⚠️ Video already exists, skipping: ${path.basename(outputPath)}`);
            return;
        }
        
        // Generate editly config
        console.log('⚙️ Generating video configuration...');
        const editlyConfig = await generateEditlyConfig(audioFilePath, videoStructure, outputPath);
        
        // Save config file for debugging
        const configPath = path.join(CONFIG.outputFolder, `${audioBasename}_config.json5`);
        fs.writeFileSync(configPath, JSON.stringify(editlyConfig, null, 2));
        console.log(`💾 Config saved: ${configPath}`);
        
        // Double-check audio file still exists before video generation
        if (!fs.existsSync(audioFilePath)) {
            console.warn(`⚠️ Audio file disappeared during processing: ${path.basename(audioFilePath)}`);
            // Clean up config file
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
            return;
        }
        
        // Generate video using editly
        console.log('🎥 Generating video...');
        const editlyCommand = `npx editly "${configPath}"`;
        
        console.log(`🔄 Running: ${editlyCommand}`);
        const { stdout, stderr } = await execAsync(editlyCommand);
        
        if (stderr && !stderr.includes('ffmpeg version')) {
            console.warn('⚠️ Editly warnings:', stderr);
        }
        
        console.log('✅ Video generation complete!');
        console.log(`📁 Output: ${outputPath}`);
        console.log(`📊 Final video: ${videoStructure.totalVideoDuration.toFixed(2)}s`);
        
        // Clean up config file
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        console.log('✨ Audio processing pipeline complete!');
        console.log(`📦 Audio file remains in done folder: ${path.basename(audioFilePath)}`);
        
        return outputPath;
        
    } catch (error) {
        console.error('❌ Error processing audio file:', error.message);
        console.error(error.stack);
        
        // Clean up any partial config files on error
        try {
            const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
            const configPath = path.join(CONFIG.outputFolder, `${audioBasename}_config.json5`);
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                console.log('🗑️ Cleaned up config file after error');
            }
        } catch (cleanupError) {
            console.error('❌ Error during cleanup:', cleanupError.message);
        }
    }
}

/**
 * Initialize file watcher
 */
function initializeWatcher() {
    const watchPath = path.resolve(CONFIG.audioWatchFolder);
    
    if (!fs.existsSync(watchPath)) {
        console.error(`❌ Audio watch folder not found: ${watchPath}`);
        console.log('💡 Please ensure the Spark-TTS audiooutput/done folder exists');
        console.log('💡 The done folder is created automatically when audio files are generated');
        process.exit(1);
    }
    
    console.log(`👀 Watching for new audio files in: ${watchPath}`);
    console.log(`📁 Video templates: ${path.resolve(CONFIG.videoTemplatesBase)}`);
    console.log(`📤 Output folder: ${path.resolve(CONFIG.outputFolder)}`);
    console.log('🎯 Supported audio formats:', CONFIG.supportedAudioFormats.join(', '));
    
    const watcher = chokidar.watch(watchPath, {
        ignored: [
            /(^|[\/\\])\../ // ignore dotfiles
        ],
        persistent: true,
        ignoreInitial: true
    });
    
    watcher.on('add', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (CONFIG.supportedAudioFormats.includes(ext)) {
            console.log(`\n🆕 New audio file detected: ${path.basename(filePath)}`);
            
            // Wait a moment for file to be fully written
            setTimeout(() => {
                processAudioFile(filePath);
            }, 1000);
        }
    });
    
    watcher.on('error', (error) => {
        console.error('❌ Watcher error:', error);
    });
    
    console.log('\n✅ Auto Video Generator is running!');
    console.log('💡 Watching audiooutput/done folder for processed audio files');
    console.log('💡 Generate audio with chunk_clone.py to trigger video creation');
    console.log('🛑 Press Ctrl+C to stop\n');
}

// Start the watcher
if (require.main === module) {
    initializeWatcher();
}

module.exports = {
    processAudioFile,
    getMediaDuration,
    getVideoDimensions,
    calculateVideoStructure,
    generateEditlyConfig
}; 