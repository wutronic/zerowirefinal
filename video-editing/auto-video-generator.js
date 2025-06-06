#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');
const minimist = require('minimist');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    audioWatchFolder: '../zero-wire/Spark-TTS/audiooutput/done',
    videoTemplatesBase: '../VideoTemplates/style 1',
    outputFolder: './generated-videos',
    finalOutputFolder: '../FinalOutput',  // New: Final output for split-screen videos
    splitscreenFolder: '../VideoTemplates/style 1/splitscreen',
    splitscreenSourceFolder: '../splitscreensource',
    supportedAudioFormats: ['.wav', '.mp3', '.m4a', '.aac'],
    supportedVideoFormats: ['.mp4', '.mov', '.avi']
};

// Ensure output folder exists
if (!fs.existsSync(CONFIG.outputFolder)) {
    fs.mkdirSync(CONFIG.outputFolder, { recursive: true });
}

/**
 * Generate debug text for a clip
 */
function generateDebugText(clipType, clipIndex, fullDuration, usedDuration, transitionType = 'dummy') {
    const fullDur = fullDuration.toFixed(2);
    const usedDur = usedDuration.toFixed(2);
    const clipName = clipType === 'loop' ? `${clipType.toUpperCase()}${clipIndex}` : clipType.toUpperCase();
    
    return `${clipName} | Full: ${fullDur}s | Used: ${usedDur}s | Trans: ${transitionType}`;
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
async function generateEditlyConfig(audioFile, videoStructure, outputPath, debugOverlay = false) {
    const { intro, loops, end } = videoStructure;
    
    // Get dimensions from intro video (all should match)
    const dimensions = await getVideoDimensions(intro.file);
    
    // Get actual audio duration to ensure exact matching
    const audioDuration = await getMediaDuration(audioFile);
    
    const clips = [];
    
    // Add intro clip (may be cropped for short audio)
    const introLayers = [{
        type: 'video',
        path: intro.file,
        // If intro video is cropped, specify the cutFrom
        ...(intro.fullDuration ? {} : { cutFrom: 0, cutTo: intro.duration })
    }];
    
    // Add debug overlay for intro if enabled
    if (debugOverlay) {
        const debugText = generateDebugText('intro', 1, await getMediaDuration(intro.file), intro.duration, 'none');
        introLayers.push({
            type: 'title',
            text: debugText,
            fontsize: 16,
            textColor: '#ffffff',
            position: { x: 0.02, y: 0.02, originX: 'left', originY: 'top' },
            box: 1,
            boxcolor: '#000000@0.7',
            boxborderw: 2
        });
    }
    
    clips.push({
        duration: intro.duration,
        layers: introLayers
        // NO transitions - completely removed
    });
    
    // Add loop clips (all full duration, NO TRANSITIONS for seamless looping)
    for (let i = 0; i < loops.length; i++) {
        const loop = loops[i];
        
        const loopLayers = [{
            type: 'video', 
            path: loop.file
        }];
        
        // Add debug overlay for loop if enabled
        if (debugOverlay) {
            const debugText = generateDebugText('loop', i + 1, await getMediaDuration(loop.file), loop.duration, 'none');
            loopLayers.push({
                type: 'title',
                text: debugText,
                fontsize: 16,
                textColor: '#ffffff',
                position: { x: 0.02, y: 0.02, originX: 'left', originY: 'top' },
                box: 1,
                boxcolor: '#000000@0.7',
                boxborderw: 2
            });
        }
        
        clips.push({
            duration: loop.duration,
            layers: loopLayers
            // NO transition property = seamless cuts between loops
        });
    }
    
    // Add end clip only if it exists (may be cropped to fit audio)
    if (end) {
        const endLayers = [{
            type: 'video',
            path: end.file,
            // If end video is cropped, specify the cutFrom
            ...(end.fullDuration ? {} : { cutFrom: 0, cutTo: end.duration })
        }];
        
        // Add debug overlay for end if enabled
        if (debugOverlay) {
            const debugText = generateDebugText('end', 1, await getMediaDuration(end.file), end.duration, 'none');
            endLayers.push({
                type: 'title',
                text: debugText,
                fontsize: 16,
                textColor: '#ffffff',
                position: { x: 0.02, y: 0.02, originX: 'left', originY: 'top' },
                box: 1,
                boxcolor: '#000000@0.7',
                boxborderw: 2
            });
        }
        
        clips.push({
            duration: end.duration,
            layers: endLayers
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
async function processAudioFile(audioFilePath, debugOverlay = false, splitScreenMode = false) {
    try {
        console.log(`\n🎵 Processing new audio file: ${path.basename(audioFilePath)}`);
        
        if (splitScreenMode) {
            console.log('🔀 Split-screen mode enabled');
        }
        
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
        
        // Generate base filename components
        const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        
        if (splitScreenMode) {
            // SPLIT-SCREEN MODE: Generate normal video first, then combine with split-screen
            console.log('🎬 Generating normal video structure for combination...');
            
            // Step 1: Generate normal video
            const videoStructure = await calculateVideoStructure(audioDuration);
            const tempOutputPath = path.join(CONFIG.outputFolder, `temp_normal_${audioBasename}_${timestamp}.mp4`);
            
            console.log('⚙️ Generating normal video configuration...');
            const normalEditlyConfig = await generateEditlyConfig(audioFilePath, videoStructure, tempOutputPath, debugOverlay);
            
            const normalConfigPath = path.join(CONFIG.outputFolder, `temp_normal_${audioBasename}_config.json5`);
            fs.writeFileSync(normalConfigPath, JSON.stringify(normalEditlyConfig, null, 2));
            
            console.log('🎥 Generating normal video...');
            const editlyCommand = `./node_modules/.bin/editly "${normalConfigPath}"`;
            
            console.log(`🎬 Generating normal video with command: ${editlyCommand}`);
            await execAsync(editlyCommand);
            
            // Clean up normal config
            if (fs.existsSync(normalConfigPath)) {
                fs.unlinkSync(normalConfigPath);
            }
            
            console.log('✅ Normal video generated');
            
            // Step 2: Generate split-screen clip
            console.log('🔀 Preparing split-screen generation...');
            
            // Get random videos from split-screen folders
            const splitscreenTopFile = getRandomVideoFile(CONFIG.splitscreenFolder);
            let splitscreenBottomFile = getRandomVideoFile(CONFIG.splitscreenSourceFolder);
            
            if (!splitscreenTopFile) {
                throw new Error(`No videos found in splitscreen folder: ${CONFIG.splitscreenFolder}`);
            }
            
            if (!splitscreenBottomFile) {
                console.warn('⚠️ No videos found in splitscreensource folder, using splitscreen video for both top and bottom');
                // Use the same video for both if splitscreensource is empty
                splitscreenBottomFile = splitscreenTopFile;
            }
            
            // Define split-screen duration (3-5 seconds)
            const splitscreenDuration = 4.0; // Fixed 4 seconds for split-screen intro
            
            const splitscreenOutputPath = path.join(CONFIG.outputFolder, `temp_splitscreen_${audioBasename}_${timestamp}.mp4`);
            
            // Generate split-screen video
            await generateSplitScreenClip(splitscreenTopFile, splitscreenBottomFile, splitscreenOutputPath, splitscreenDuration);
            
            // Step 3: Create combined audio track manually using FFmpeg
            console.log('🔗 Creating combined audio track...');
            
            // Extract 4 seconds of audio from splitscreensource video
            const splitscreenAudioPath = path.join(CONFIG.outputFolder, `temp_splitscreen_audio_${audioBasename}_${timestamp}.wav`);
            const extractSplitscreenAudioCommand = `ffmpeg -y -i "${splitscreenBottomFile}" -t 4.0 -vn -acodec pcm_s16le "${splitscreenAudioPath}"`;
            
            console.log('🎵 Extracting splitscreensource audio for first 4 seconds...');
            await execAsync(extractSplitscreenAudioCommand);
            
            // Create combined audio: splitscreensource audio (4s) + silence gap + Spark TTS audio
            const combinedAudioPath = path.join(CONFIG.outputFolder, `temp_combined_audio_${audioBasename}_${timestamp}.wav`);
            
            // Check if we should add Spark TTS audio based on video length
            const normalVideoDuration = await getMediaDuration(tempOutputPath);
            
            let combineAudioCommand;
            if (normalVideoDuration >= audioDuration) {
                // Normal video is long enough - add Spark TTS audio after split-screen
                console.log('🎵 Combining: splitscreensource audio (4s) + Spark TTS audio...');
                combineAudioCommand = `ffmpeg -y -i "${splitscreenAudioPath}" -i "${audioFilePath}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[outa]" -map "[outa]" "${combinedAudioPath}"`;
            } else {
                // Normal video is too short - only use splitscreensource audio
                console.log('🎵 Using only splitscreensource audio (normal video too short for Spark TTS audio)...');
                combineAudioCommand = `ffmpeg -y -i "${splitscreenAudioPath}" "${combinedAudioPath}"`;
            }
            
            await execAsync(combineAudioCommand);
            
            // Step 4: Combine split-screen + normal video using Editly (with combined audio)
            console.log('🔗 Combining split-screen and normal video with synchronized audio...');
            
            const finalOutputPath = path.join(CONFIG.finalOutputFolder, `${audioBasename}_splitscreen_${timestamp}.mp4`);
            
            // Ensure final output directory exists
            if (!fs.existsSync(CONFIG.finalOutputFolder)) {
                fs.mkdirSync(CONFIG.finalOutputFolder, { recursive: true });
            }
            
            // Generate split-screen + normal video configuration (without per-clip audio)
            console.log('⚙️ Generating split-screen + normal video configuration...');
            const splitscreenConfig = await generateSplitScreenEditlyConfig(combinedAudioPath, splitscreenDuration, splitscreenOutputPath, tempOutputPath, finalOutputPath, debugOverlay);
            
            const splitscreenConfigPath = path.join(CONFIG.outputFolder, `temp_splitscreen_${audioBasename}_config.json5`);
            fs.writeFileSync(splitscreenConfigPath, JSON.stringify(splitscreenConfig, null, 2));
            
            console.log('🎥 Generating final split-screen video with synchronized audio...');
            const finalEditlyCommand = `./node_modules/.bin/editly "${splitscreenConfigPath}"`;
            
            console.log(`🎬 Generating final video with command: ${finalEditlyCommand}`);
            await execAsync(finalEditlyCommand);
            
            // Clean up temporary files
            [tempOutputPath, splitscreenOutputPath, splitscreenAudioPath, combinedAudioPath, splitscreenConfigPath].forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`🗑️ Cleaned up: ${path.basename(file)}`);
                }
            });
            
            console.log('✅ Split-screen video generation complete!');
            console.log(`📁 Final output: ${finalOutputPath}`);
            console.log(`📦 Split-screen intro (${splitscreenDuration}s) + Normal video (${videoStructure.totalVideoDuration.toFixed(2)}s)`);
            
            return finalOutputPath;
            
        } else {
            // NORMAL MODE: Standard video generation
            console.log('🎬 Calculating video structure...');
            const videoStructure = await calculateVideoStructure(audioDuration);
            
            const outputPath = path.join(CONFIG.outputFolder, `${audioBasename}_${timestamp}.mp4`);
            
            // Check if video already exists
            if (fs.existsSync(outputPath)) {
                console.warn(`⚠️ Video already exists, skipping: ${path.basename(outputPath)}`);
                return;
            }
            
            // Generate editly config
            console.log('⚙️ Generating video configuration...');
            const editlyConfig = await generateEditlyConfig(audioFilePath, videoStructure, outputPath, debugOverlay);
            
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
            const editlyCommand = `./node_modules/.bin/editly "${configPath}"`;
            
            console.log(`🎬 Generating video with command: ${editlyCommand}`);
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
        }
        
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
function initializeWatcher(debugOverlay = false, splitScreenMode = false) {
    const watchPath = path.resolve(CONFIG.audioWatchFolder);
    
    if (!fs.existsSync(watchPath)) {
        console.error(`❌ Audio watch folder not found: ${watchPath}`);
        console.log('💡 Please ensure the Spark-TTS audiooutput/done folder exists');
        console.log('💡 The done folder is created automatically when audio files are generated');
        process.exit(1);
    }
    
    console.log(`👀 Watching for new audio files in: ${watchPath}`);
    console.log(`📁 Video templates: ${path.resolve(CONFIG.videoTemplatesBase)}`);
    
    if (splitScreenMode) {
        console.log(`📤 Final output folder: ${path.resolve(CONFIG.finalOutputFolder)}`);
        console.log(`🔀 Split-screen folders: ${path.resolve(CONFIG.splitscreenFolder)} + ${path.resolve(CONFIG.splitscreenSourceFolder)}`);
    } else {
        console.log(`📤 Output folder: ${path.resolve(CONFIG.outputFolder)}`);
    }
    
    console.log('🎯 Supported audio formats:', CONFIG.supportedAudioFormats.join(', '));
    
    if (debugOverlay) {
        console.log('🔍 DEBUG MODE: Text overlays will show clip information');
    }
    
    if (splitScreenMode) {
        console.log('🔀 SPLIT-SCREEN MODE: Videos will include 4s split-screen intro');
    }
    
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
                processAudioFile(filePath, debugOverlay, splitScreenMode);
            }, 1000);
        }
    });
    
    watcher.on('error', (error) => {
        console.error('❌ Watcher error:', error);
    });
    
    console.log('\n✅ Auto Video Generator is running!');
    console.log('💡 Watching audiooutput/done folder for processed audio files');
    console.log('💡 Generate audio with chunk_clone.py to trigger video creation');
    
    if (splitScreenMode) {
        console.log('🔀 Split-screen videos will be saved to FinalOutput folder');
    }
    
    console.log('🛑 Press Ctrl+C to stop\n');
}

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const debugOverlay = argv['debug-overlay'] || false;
const splitScreenMode = argv['split'] || false;
const processFile = argv['process-file'] || argv['file'];
const showHelp = argv.help || argv.h;

// Show help if requested
if (showHelp) {
    console.log(`
🎬 Auto Video Generator - Automated video creation from audio files

USAGE:
  node auto-video-generator.js [OPTIONS]

OPTIONS:
  --debug-overlay           Enable debug text overlay showing clip information
  --split                   Enable split-screen mode with intelligent cropping
  --process-file <path>     Process a specific audio file manually (can use --file as shorthand)
  --help, -h               Show this help message

EXAMPLES:
  node auto-video-generator.js
    Start watching for audio files (normal mode)
    
  node auto-video-generator.js --debug-overlay
    Start with debug overlays enabled - shows clip name, durations, and transitions
    
  node auto-video-generator.js --split
    Start with split-screen mode - adds 4s split-screen intro before normal video
    
  node auto-video-generator.js --split --debug-overlay
    Start with both split-screen mode and debug overlays enabled
    
  node auto-video-generator.js --process-file "../zero-wire/Spark-TTS/audiooutput/done/audio_20241206.wav" --split
    Manually process a specific audio file with split-screen mode (no folder watching)
    
  node auto-video-generator.js --file "audio.wav" --split --debug-overlay
    Process specific file with split-screen and debug overlays (shorthand version)
    
DESCRIPTION:
  Watches ../zero-wire/Spark-TTS/audiooutput/done/ for new audio files and 
  automatically generates videos using templates from ../VideoTemplates/style 1/
  
  Normal mode: Creates videos with Intro → Loop(s) → End structure
  Split-screen mode: Creates videos with Split-screen (4s) → Intro → Loop(s) → End structure
  
  Split-screen videos use:
  - Random video from ../VideoTemplates/style 1/splitscreen/ (top half)
  - Random video from ../splitscreensource/ (bottom half) 
  
  INTELLIGENT CROPPING:
  - If splitscreensource video height ≥ 50% of loop template height: CROP both videos
    * Both videos cropped to middle 50% (remove 25% from top and bottom)
    * Stacked vertically to create split-screen effect
  - If splitscreensource video height < 50% of loop template height: POSITION without cropping
    * Top half: splitscreen template scaled to fit
    * Bottom half: splitscreensource positioned at 25% from top (for top) and 75% from top (for bottom)
    * Measured from center of splitscreensource video
  
  Final videos saved to ../FinalOutput/ folder
  
  Debug overlay format: "CLIP_NAME | Full: Xs | Used: Ys | Trans: none"
  - CLIP_NAME: SPLITSCREEN, INTRO, LOOP1, LOOP2, etc., or END
  - Full: Original video file duration
  - Used: Actual duration used in timeline (may be trimmed for end clip)
  - Trans: Transition type applied (always "none" for seamless cuts)
    
  MANUAL PROCESSING:
  - Use --process-file to manually process a specific audio file
  - Audio will be synchronized only with main video content (not split-screen intro)
  - If main video is shorter than audio, audio will be ignored
  - Ideal for processing files that weren't picked up by folder watching
`);
    process.exit(0);
}

// Start the watcher or process specific file
if (require.main === module) {
    if (processFile) {
        // Manual file processing mode
        console.log('📁 Manual file processing mode');
        
        // Resolve the file path
        const filePath = path.resolve(processFile);
        
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Audio file not found: ${filePath}`);
            process.exit(1);
        }
        
        // Check if it's a supported audio format
        const ext = path.extname(filePath).toLowerCase();
        if (!CONFIG.supportedAudioFormats.includes(ext)) {
            console.error(`❌ Unsupported audio format: ${ext}`);
            console.error(`🎯 Supported formats: ${CONFIG.supportedAudioFormats.join(', ')}`);
            process.exit(1);
        }
        
        console.log(`🎵 Processing file: ${filePath}`);
        
        if (debugOverlay) {
            console.log('🔍 Debug overlay enabled');
        }
        if (splitScreenMode) {
            console.log('🔀 Split-screen mode enabled');
        }
        
        // Process the file directly
        processAudioFile(filePath, debugOverlay, splitScreenMode)
            .then((outputPath) => {
                if (outputPath) {
                    console.log(`\n✅ Processing complete!`);
                    console.log(`📁 Output: ${outputPath}`);
                } else {
                    console.log(`\n⚠️ Processing completed but no output generated`);
                }
                process.exit(0);
            })
            .catch((error) => {
                console.error(`\n❌ Processing failed:`, error.message);
                process.exit(1);
            });
            
    } else {
        // Normal file watching mode
        if (debugOverlay) {
            console.log('🔍 Starting with debug overlay enabled');
        }
        if (splitScreenMode) {
            console.log('🔀 Starting with split-screen mode enabled');
        }
        initializeWatcher(debugOverlay, splitScreenMode);
    }
}

/**
 * Generate split-screen video clip with intelligent cropping based on source video height
 */
async function generateSplitScreenClip(splitscreenTopFile, splitscreenBottomFile, outputPath, duration) {
    try {
        console.log('🔀 Generating split-screen video...');
        console.log(`   📹 Top video: ${path.basename(splitscreenTopFile)}`);
        console.log(`   📹 Bottom video: ${path.basename(splitscreenBottomFile)}`);
        
        // Get dimensions from both videos
        const topDimensions = await getVideoDimensions(splitscreenTopFile);
        const bottomDimensions = await getVideoDimensions(splitscreenBottomFile);
        
        // Get reference dimensions from loop video templates to determine if cropping is needed
        const loopFolder = path.join(CONFIG.videoTemplatesBase, 'Loop');
        let referenceHeight = topDimensions.height; // fallback to top video height
        
        if (fs.existsSync(loopFolder)) {
            const loopFiles = fs.readdirSync(loopFolder)
                .filter(file => CONFIG.supportedVideoFormats.some(ext => file.toLowerCase().endsWith(ext)));
            
            if (loopFiles.length > 0) {
                const firstLoopFile = path.join(loopFolder, loopFiles[0]);
                const loopDimensions = await getVideoDimensions(firstLoopFile);
                referenceHeight = loopDimensions.height;
                console.log(`   📐 Reference dimensions from loop template: ${loopDimensions.width}x${loopDimensions.height}`);
            }
        }
        
        const { width: topWidth, height: topHeight } = topDimensions;
        const { width: bottomWidth, height: bottomHeight } = bottomDimensions;
        
        console.log(`   📐 Top video: ${topWidth}x${topHeight}, Bottom video: ${bottomWidth}x${bottomHeight}`);
        console.log(`   📏 Reference height: ${referenceHeight}`);
        
        // Check if bottom video (splitscreensource) is less than 50% of reference height
        const bottomHeightRatio = bottomHeight / referenceHeight;
        const shouldCrop = bottomHeightRatio >= 0.5;
        
        console.log(`   🔍 Bottom video height ratio: ${(bottomHeightRatio * 100).toFixed(1)}%`);
        console.log(`   ✂️ Cropping strategy: ${shouldCrop ? 'CROP both videos' : 'POSITION without cropping'}`);
        
        let ffmpegCommand;
        
        if (shouldCrop) {
            // Original logic: Crop both videos to middle 50%
            const cropHeight = Math.floor(topHeight * 0.5);
            const cropY = Math.floor(topHeight * 0.25);
            
            console.log(`   📏 Crop dimensions: ${topWidth}x${cropHeight} from y=${cropY}`);
            
            ffmpegCommand = `ffmpeg -y ` +
                `-stream_loop -1 -i "${splitscreenTopFile}" ` +
                `-stream_loop -1 -i "${splitscreenBottomFile}" ` +
                `-filter_complex "` +
                    `[0:v]crop=${topWidth}:${cropHeight}:0:${cropY},scale=${topWidth}:${Math.floor(referenceHeight/2)}[top]; ` +
                    `[1:v]crop=${bottomWidth}:${cropHeight}:0:${cropY},scale=${topWidth}:${Math.floor(referenceHeight/2)}[bottom]; ` +
                    `[top][bottom]vstack=inputs=2[splitscreen]" ` +
                `-map "[splitscreen]" -t ${duration} -r 30 -c:v libx264 -preset medium -crf 23 ` +
                `"${outputPath}"`;
                
        } else {
            // New logic: Position videos without cropping
            // Top video: positioned at 25% from top (measured from center of splitscreensource video)
            // Bottom video: positioned at 75% from top (measured from center of splitscreensource video)
            
            const finalWidth = Math.max(topWidth, bottomWidth);
            const finalHeight = referenceHeight;
            const halfHeight = Math.floor(finalHeight / 2);
            
            // Calculate positioning for top placement (25% from top)
            const topCenterY = Math.floor(finalHeight * 0.25);
            const topVideoY = topCenterY - Math.floor(bottomHeight / 2);
            
            // Calculate positioning for bottom placement (75% from top) 
            const bottomCenterY = Math.floor(finalHeight * 0.75);
            const bottomVideoY = bottomCenterY - Math.floor(bottomHeight / 2);
            
            console.log(`   📍 Final canvas: ${finalWidth}x${finalHeight}`);
            console.log(`   📍 Top positioning: center at ${topCenterY}px (video at y=${topVideoY})`);
            console.log(`   📍 Bottom positioning: center at ${bottomCenterY}px (video at y=${bottomVideoY})`);
            
            ffmpegCommand = `ffmpeg -y ` +
                `-stream_loop -1 -i "${splitscreenTopFile}" ` +
                `-stream_loop -1 -i "${splitscreenBottomFile}" ` +
                `-filter_complex "` +
                    // Create background canvas
                    `color=black:${finalWidth}x${finalHeight}[bg]; ` +
                    // Scale and position top video (splitscreen template) for top half
                    `[0:v]scale=${finalWidth}:${halfHeight}[top_scaled]; ` +
                    // Scale bottom video (splitscreensource) to fit width while maintaining aspect ratio
                    `[1:v]scale=${finalWidth}:-1[bottom_scaled]; ` +
                    // Create top half: overlay scaled splitscreen template
                    `[bg][top_scaled]overlay=0:0[with_top]; ` +
                    // Create bottom half: overlay positioned splitscreensource
                    `[with_top][bottom_scaled]overlay=0:${halfHeight + topVideoY}[splitscreen]" ` +
                `-map "[splitscreen]" -t ${duration} -r 30 -c:v libx264 -preset medium -crf 23 ` +
                `"${outputPath}"`;
        }
        
        console.log(`🔄 Running FFmpeg for split-screen generation...`);
        await execAsync(ffmpegCommand);
        
        console.log(`✅ Split-screen video generated: ${path.basename(outputPath)}`);
        return outputPath;
        
    } catch (error) {
        console.error('❌ Error generating split-screen video:', error.message);
        throw error;
    }
}

/**
 * Combine split-screen video with normal video structure
 */
async function generateSplitScreenEditlyConfig(combinedAudioFile, splitscreenDuration, splitscreenVideoPath, normalVideoPath, outputPath, debugOverlay = false) {
    try {
        console.log('⚙️ Generating split-screen + normal video configuration...');
        
        // Get durations
        const combinedAudioDuration = await getMediaDuration(combinedAudioFile);
        const normalVideoDuration = await getMediaDuration(normalVideoPath);
        const totalVideoDuration = splitscreenDuration + normalVideoDuration;
        
        console.log(`   📊 Split-screen: ${splitscreenDuration}s, Normal video: ${normalVideoDuration}s, Combined audio: ${combinedAudioDuration}s`);
        
        // Get dimensions from normal video
        const dimensions = await getVideoDimensions(normalVideoPath);
        
        const clips = [];
        
        // Add split-screen clip first (audio will be handled globally)
        const splitscreenLayers = [{
            type: 'video',
            path: splitscreenVideoPath
        }];
        
        if (debugOverlay) {
            const debugText = generateDebugText('splitscreen', 1, splitscreenDuration, splitscreenDuration, 'none');
            splitscreenLayers.push({
                type: 'title',
                text: debugText,
                fontsize: 16,
                textColor: '#ffffff',
                position: { x: 0.02, y: 0.02, originX: 'left', originY: 'top' },
                box: 1,
                boxcolor: '#000000@0.7',
                boxborderw: 2
            });
        }
        
        clips.push({
            duration: splitscreenDuration,
            layers: splitscreenLayers
        });
        
        // Add normal video after split-screen (audio will be handled globally)
        const normalLayers = [{
            type: 'video',
            path: normalVideoPath
        }];
        
        if (debugOverlay) {
            const debugText = generateDebugText('normal', 1, normalVideoDuration, normalVideoDuration, 'none');
            normalLayers.push({
                type: 'title',
                text: debugText,
                fontsize: 16,
                textColor: '#ffffff',
                position: { x: 0.02, y: 0.02, originX: 'left', originY: 'top' },
                box: 1,
                boxcolor: '#000000@0.7',
                boxborderw: 2
            });
        }
        
        clips.push({
            duration: normalVideoDuration,
            layers: normalLayers
        });
        
        console.log(`   🔊 Using combined audio track: ${path.basename(combinedAudioFile)}`);
        
        const config = {
            outPath: outputPath,
            width: dimensions.width,
            height: dimensions.height,
            fps: 30,
            outDuration: totalVideoDuration,
            // Use the combined audio file globally
            audioFilePath: combinedAudioFile,
            keepSourceAudio: false,
            defaults: {
                transition: { name: 'dummy', duration: 0 }
            },
            clips
        };
        
        return config;
        
    } catch (error) {
        console.error('❌ Error generating split-screen config:', error.message);
        throw error;
    }
}

module.exports = {
    processAudioFile,
    getMediaDuration,
    getVideoDimensions,
    calculateVideoStructure,
    generateEditlyConfig,
    generateSplitScreenClip,
    generateSplitScreenEditlyConfig
};