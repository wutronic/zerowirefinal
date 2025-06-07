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

// Split screen configuration for overlay positioning
const SPLIT_SCREEN_CONFIG = {
    // Template video positioned at 25% from top (center), cropped to 50% height
    templateVideo: {
        x: 0.0,      // Full width
        y: 0.125,    // 12.5% from top (25% center - 12.5% half height = 12.5%)
        width: 1.0,  // 100% of screen width
        height: 0.25, // 25% of screen height (50% cropped)
        cropY: 0.25, // Crop 25% from top
        cropHeight: 0.5 // Use middle 50% of video
    },
    // User uploaded video positioned at 75% from top (center), cropped to 50% height  
    userVideo: {
        x: 0.0,      // Full width
        y: 0.625,    // 62.5% from top (75% center - 12.5% half height = 62.5%)
        width: 1.0,  // 100% of screen width
        height: 0.25, // 25% of screen height (50% cropped)
        cropY: 0.25, // Crop 25% from top
        cropHeight: 0.5 // Use middle 50% of video
    }
};

// Ensure output folder exists
if (!fs.existsSync(CONFIG.outputFolder)) {
    fs.mkdirSync(CONFIG.outputFolder, { recursive: true });
}

/**
 * Atomic write helper function to prevent race conditions
 */
async function writeStatusFileAtomically(filePath, data) {
    const tempPath = filePath + '.tmp';
    const content = JSON.stringify(data, null, 2);
    
    try {
        await fs.promises.writeFile(tempPath, content, 'utf-8');
        await fs.promises.rename(tempPath, filePath);
        console.log(`🔒 Atomic write completed: ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`❌ Atomic write failed: ${error.message}`);
        // Clean up temp file if it exists
        try {
            await fs.promises.unlink(tempPath);
        } catch (unlinkError) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Safe JSON parse with retry logic for handling race conditions
 */
function safeJsonParse(content, retries = 3, baseDelay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            return JSON.parse(content);
        } catch (error) {
            if (i === retries - 1) {
                console.error(`❌ JSON parse failed after ${retries} attempts: ${error.message}`);
                throw error;
            }
            console.log(`⚠️ JSON parse attempt ${i + 1} failed, retrying...`);
            // Synchronous delay for retry
            const delay = baseDelay * Math.pow(2, i);
            const start = Date.now();
            while (Date.now() - start < delay) {
                // Busy wait
            }
        }
    }
}

/**
 * Safe file read with retry logic for status files
 */
async function readStatusFileWithRetry(filePath, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return safeJsonParse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw error; // File doesn't exist, don't retry
            }
            if (i === maxRetries - 1) {
                console.error(`❌ File read failed after ${maxRetries} attempts: ${error.message}`);
                throw error;
            }
            console.log(`⚠️ File read attempt ${i + 1} failed, retrying in ${200 * (i + 1)}ms...`);
            await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
        }
    }
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
 * Process status file for API coordination
 */
async function processStatusFile(statusFilePath, debugOverlay = false, splitScreenMode = false) {
    try {
        console.log(`🔄 Processing status file: ${path.basename(statusFilePath)}`);
        
        // Read and parse status file safely
        const statusContent = fs.readFileSync(statusFilePath, 'utf-8');
        const statusData = safeJsonParse(statusContent);
        
        if (statusData.status !== 'audio_ready') {
            console.log(`⚠️ Status file not ready: ${statusData.status}`);
            return;
        }
        
        // 🐛 DEBUG: Log all status data for split screen debugging
        console.log(`\n🔍 DEBUG: Status file analysis:`);
        console.log(`   - Request ID: ${statusData.requestId}`);
        console.log(`   - Split Screen Enabled: ${statusData.splitScreenEnabled}`);
        console.log(`   - Split Screen Path: ${statusData.splitScreenPath}`);
        console.log(`   - Audio File: ${statusData.audioFile}`);
        console.log(`   - Debug Mode: ${statusData.debugMode}`);
        
        // Update status to video_processing
        statusData.status = 'video_processing';
        statusData.videoStartTime = new Date().toISOString();
        await writeStatusFileAtomically(statusFilePath, statusData);
        console.log(`📋 Status updated: video_processing`);
        
        // 🔀 SPLIT SCREEN DETECTION AND PROCESSING
        if (statusData.splitScreenEnabled) {
            console.log(`\n🔀 SPLIT SCREEN MODE DETECTED!`);
            
            // Check if a specific split screen file was uploaded
            if (statusData.splitScreenPath && fs.existsSync(statusData.splitScreenPath)) {
                console.log(`📁 Using uploaded split screen file: ${statusData.splitScreenPath}`);
                
                // Get file info for debugging
                const stats = fs.statSync(statusData.splitScreenPath);
                console.log(`📊 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
                
                // Get video properties for debugging
                try {
                    const duration = await getMediaDuration(statusData.splitScreenPath);
                    const dimensions = await getVideoDimensions(statusData.splitScreenPath);
                    console.log(`⏱️ Duration: ${duration.toFixed(2)}s, Dimensions: ${dimensions.width}x${dimensions.height}`);
                } catch (error) {
                    console.warn(`⚠️ Could not get video properties: ${error.message}`);
                }
            } else {
                // No uploaded file - use random video from splitscreen folder
                console.log(`📁 No uploaded file - using random split screen video from folder`);
                statusData.splitScreenPath = null; // Will be handled by generateSplitScreenVideo
            }
            
            const outputPath = await generateSplitScreenVideo(statusData, statusFilePath);
            
            if (outputPath && fs.existsSync(outputPath)) {
                console.log(`✅ Split screen video generated successfully!`);
                console.log(`📁 Output: ${path.basename(outputPath)}`);
                
                // Update status to complete
                statusData.status = 'video_complete';
                statusData.videoFile = path.basename(outputPath);
                statusData.videoCompleteTime = new Date().toISOString();
                statusData.coordinationMethod = 'file_watcher';
                
                await writeStatusFileAtomically(statusFilePath, statusData);
                console.log(`🎉 Split screen processing complete: ${path.basename(outputPath)}`);
                
                return outputPath;
            } else {
                throw new Error('Split screen video generation failed');
            }
        }
        
        // 🎬 NORMAL VIDEO PROCESSING (non-split screen)
        else {
            console.log(`\n🎬 Normal video mode (no split screen)`);
            
            // Extract audio file path and resolve it properly
            const audioFile = path.resolve('../zero-wire/Spark-TTS', statusData.audioFile);
            
            if (!fs.existsSync(audioFile)) {
                throw new Error(`Audio file not found: ${audioFile}`);
            }
            
            console.log(`🎵 Processing audio file: ${path.basename(audioFile)}`);
            
            const outputPath = await processAudioFile(audioFile, statusData.debugMode || false, false, null);
            
            if (outputPath && fs.existsSync(outputPath)) {
                console.log(`✅ Normal video generated successfully!`);
                console.log(`📁 Output: ${path.basename(outputPath)}`);
                
                // Update status to complete
                statusData.status = 'video_complete';
                statusData.videoFile = path.basename(outputPath);
                statusData.videoCompleteTime = new Date().toISOString();
                statusData.coordinationMethod = 'file_watcher';
                
                await writeStatusFileAtomically(statusFilePath, statusData);
                console.log(`🎉 Normal video processing complete: ${path.basename(outputPath)}`);
                
                return outputPath;
            } else {
                throw new Error('Normal video generation failed');
            }
        }
        
    } catch (error) {
        console.error(`❌ Status file processing failed:`, error.message);
        
        // Update status to error
        try {
            const statusContent = fs.readFileSync(statusFilePath, 'utf-8');
            const statusData = safeJsonParse(statusContent);
            
            statusData.status = 'error';
            statusData.error = error.message;
            statusData.errorTime = new Date().toISOString();
            
            await writeStatusFileAtomically(statusFilePath, statusData);
        } catch (updateError) {
            console.error(`❌ Failed to update error status:`, updateError.message);
        }
        
        return null;
    }
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
    
    // FIXED: Ensure end video duration matches exactly what's needed to reach audio duration
    // If there's remaining time, use all of it for the end video (may extend beyond original end duration)
    const endVideoDuration = remainingTimeForEnd;
    
    // FIXED: Total video duration MUST exactly match audio duration
    const totalCalculatedDuration = audioDuration;
    
    console.log(`📊 Structure: 1 intro (${introDuration}s) + ${loops.length} loops (${currentTime}s total) + 1 end (${endVideoDuration}s${endVideoDuration < endDuration ? ' cropped' : endVideoDuration > endDuration ? ' extended' : ''}) = ${totalCalculatedDuration}s (audio: ${audioDuration}s)`);
    
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
 * Generate split screen video using the simplified flow
 */
// ========================================================================================
// OLD SPLIT SCREEN CODE - COMMENTED OUT FOR FRESH START
// ========================================================================================

/* 
async function generateSplitScreenVideo_OLD(statusData, statusFilePath) {
    try {
        console.log(`🎬 Starting split screen video generation`);
        
        // Extract required data from status
        const audioFile = path.resolve('../zero-wire/Spark-TTS', statusData.audioFile);
        const splitScreenVideoPath = statusData.splitScreenPath;
        
        // Validate inputs
        if (!fs.existsSync(audioFile)) {
            throw new Error(`Audio file not found: ${audioFile}`);
        }
        
        if (!fs.existsSync(splitScreenVideoPath)) {
            throw new Error(`Split screen video not found: ${splitScreenVideoPath}`);
        }
        
        // Get TTS audio duration for timing structure
        const ttsAudioDuration = await getMediaDuration(audioFile);
        console.log(`⏱️ TTS audio duration: ${ttsAudioDuration.toFixed(2)} seconds`);
        
        // Generate output path
        const audioBasename = path.basename(audioFile, path.extname(audioFile));
        const timestamp = new Date().toISOString().split('T')[0];
        const outputPath = path.join(CONFIG.outputFolder, `${audioBasename}_splitscreen_${timestamp}.mp4`);
        
        // Generate split screen editly config
        console.log(`🔧 Generating split screen configuration...`);
        const splitScreenConfig = await generateSimpleSplitScreenEditlyConfig_OLD(splitScreenVideoPath, ttsAudioDuration, outputPath, audioFile);
        
        // Save config file
        const configPath = path.join(CONFIG.outputFolder, `${audioBasename}_splitscreen_config.json5`);
        fs.writeFileSync(configPath, JSON.stringify(splitScreenConfig, null, 2));
        
        console.log(`💾 Config saved: ${path.basename(configPath)}`);
        console.log(`🎬 Executing split screen video generation...`);
        
        // Execute editly
        const editlyCommand = `./node_modules/.bin/editly "${configPath}"`;
        await execAsync(editlyCommand);
        
        // Clean up config file
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        // Verify output exists
        if (fs.existsSync(outputPath)) {
            const outputDuration = await getMediaDuration(outputPath);
            console.log(`✅ Split screen video generated successfully`);
            console.log(`📁 Output: ${path.basename(outputPath)}`);
            console.log(`⏱️ Duration: ${outputDuration.toFixed(2)} seconds`);
            
            return outputPath;
        } else {
            throw new Error('Split screen video generation failed - no output file created');
        }
        
    } catch (error) {
        console.error(`❌ Split screen video generation failed:`, error.message);
        return null;
    }
}
*/

/*
async function generateSimpleSplitScreenEditlyConfig_OLD(splitScreenVideoPath, ttsAudioDuration, outputPath, ttsAudioFile) {
    console.log(`\n🔧 === SPLIT SCREEN CONFIG GENERATION ===`);
    console.log(`📁 Split screen video: ${path.basename(splitScreenVideoPath)}`);
    console.log(`🎵 TTS audio file: ${path.basename(ttsAudioFile)}`);
    console.log(`⏱️ TTS audio duration: ${ttsAudioDuration.toFixed(2)}s`);
    console.log(`📤 Output path: ${path.basename(outputPath)}`);
    
    // Get video dimensions from template
    const splitscreenFolder = CONFIG.splitscreenFolder;
    const templateFile = getRandomVideoFile(splitscreenFolder);
    if (!templateFile) {
        throw new Error('No template video found in splitscreen folder');
    }
    
    const dimensions = await getVideoDimensions(templateFile);
    console.log(`📐 Canvas dimensions: ${dimensions.width}x${dimensions.height} (from template: ${path.basename(templateFile)})`);
    
    // Get uploaded video audio duration for split screen segment
    const uploadedAudioDuration = await getMediaDuration(splitScreenVideoPath);
    const uploadedDimensions = await getVideoDimensions(splitScreenVideoPath);
    console.log(`⏱️ Uploaded video duration: ${uploadedAudioDuration.toFixed(2)}s`);
    console.log(`📐 Uploaded video dimensions: ${uploadedDimensions.width}x${uploadedDimensions.height}`);
    
    const clips = [];
    
    // Phase 1: Split screen segment using uploaded video's audio
    const splitScreenSegmentDuration = uploadedAudioDuration;
    console.log(`🎬 Split screen segment duration: ${splitScreenSegmentDuration.toFixed(2)}s (full uploaded video duration)`);
    
    const splitScreenLayers = [
        // Template video: Top half of screen 
        {
            type: 'video',
            path: templateFile,
            resizeMode: 'crop',
            position: {
                x: 0,
                y: 0,
                originX: 'left',
                originY: 'top'
            },
            width: 1.0,
            height: 0.5,
            // Crop the source video to use only center portion for better composition
            cropX: 0,           // No horizontal cropping
            cropY: 0.25,        // Crop 25% from top to center the subject
            cropWidth: 1.0,     // Full width
            cropHeight: 0.5     // Use middle 50% of source video
        },
        // User uploaded video: Bottom half of screen with proper cropping  
        {
            type: 'video',
            path: splitScreenVideoPath,
            resizeMode: 'crop',
            position: {
                x: 0,
                y: 0.5,
                originX: 'left',
                originY: 'top'
            },
            width: 1.0,
            height: 0.5,
            // Use full frame for user video in bottom half
            cropX: 0,           // No horizontal cropping  
            cropY: 0,           // No vertical cropping
            cropWidth: 1.0,     // Full width
            cropHeight: 1.0     // Full height
        }
    ];

    console.log(`\n🎯 === SPLIT SCREEN LAYER CONFIGURATION ===`);
    console.log(`📹 Layer 1 (Template - TOP HALF):`);
    console.log(`   - File: ${path.basename(templateFile)}`);
    console.log(`   - Position: x=${splitScreenLayers[0].position.x}, y=${splitScreenLayers[0].position.y}`);
    console.log(`   - Size: width=${splitScreenLayers[0].width}, height=${splitScreenLayers[0].height}`);
    console.log(`   - Crop: x=${splitScreenLayers[0].cropX}, y=${splitScreenLayers[0].cropY}, w=${splitScreenLayers[0].cropWidth}, h=${splitScreenLayers[0].cropHeight}`);
    console.log(`   - Mode: ${splitScreenLayers[0].resizeMode}`);
    
    console.log(`📹 Layer 2 (User Video - BOTTOM HALF):`);
    console.log(`   - File: ${path.basename(splitScreenVideoPath)}`);
    console.log(`   - Position: x=${splitScreenLayers[1].position.x}, y=${splitScreenLayers[1].position.y}`);
    console.log(`   - Size: width=${splitScreenLayers[1].width}, height=${splitScreenLayers[1].height}`);
    console.log(`   - Crop: x=${splitScreenLayers[1].cropX}, y=${splitScreenLayers[1].cropY}, w=${splitScreenLayers[1].cropWidth}, h=${splitScreenLayers[1].cropHeight}`);
    console.log(`   - Mode: ${splitScreenLayers[1].resizeMode}`);
    
    clips.push({
        duration: splitScreenSegmentDuration,
        layers: splitScreenLayers
    });
    
    // No additional segments - split screen is standalone using uploaded video duration only
    console.log(`\n⏭️ Split screen is standalone - no TTS segments added`);
    
    console.log(`\n🔊 === AUDIO CONFIGURATION ===`);
    console.log(`🎵 Split screen audio: ${path.basename(splitScreenVideoPath)} (uploaded video audio only)`);
    
    const config = {
        outPath: outputPath,
        width: dimensions.width,
        height: dimensions.height,
        fps: 30,                              // Fixed 30fps
        outDuration: uploadedAudioDuration,
        // No global audio - split screen uses only uploaded video audio
        keepSourceAudio: false,
        defaults: {
            transition: { name: 'dummy', duration: 0 }
        },
        clips
    };
    
    // Set audio for split screen clip to use source audio
    if (clips.length > 0) {
        clips[0].audioFilePath = splitScreenVideoPath;
        console.log(`🔄 Audio applied: Split screen uses uploaded video audio only`);
    }
    
    console.log(`\n📊 === FINAL CONFIGURATION SUMMARY ===`);
    console.log(`🎬 Total clips: ${clips.length}`);
    console.log(`⏱️ Split screen duration: ${splitScreenSegmentDuration.toFixed(2)}s`);
    console.log(`⏱️ Total duration: ${uploadedAudioDuration.toFixed(2)}s`);
    console.log(`📐 Output resolution: ${dimensions.width}x${dimensions.height}`);
    console.log(`🎞️ Frame rate: 30fps`);
    console.log(`📤 Output file: ${path.basename(outputPath)}`);
    console.log(`===========================================\n`);
    
    return config;
}
*/

// ========================================================================================
// NEW SPLIT SCREEN IMPLEMENTATION - FRESH START
// ========================================================================================

/**
 * NEW Split Screen Video Generation
 * Requirements:
 * - Top video: Random from splitscreen folder, center at 25% from top (crop 25% top/bottom)
 * - Bottom video: Uploaded video, center at 75% from top (crop 25% top/bottom) 
 * - Duration: Full length of uploaded video
 * - Audio: From uploaded video only
 */
async function generateSplitScreenVideo(statusData, statusFilePath) {
    try {
        console.log(`\n🎬 === NEW SPLIT SCREEN VIDEO GENERATION ===`);
        
        // Extract required data from status
        const audioFile = path.resolve('../zero-wire/Spark-TTS', statusData.audioFile);
        let uploadedVideoPath = statusData.splitScreenPath;
        
        // If no uploaded video provided, select a random one from splitscreen folder
        if (!uploadedVideoPath || !fs.existsSync(uploadedVideoPath)) {
            console.log(`📁 No uploaded video - selecting random video from splitscreen folder`);
            uploadedVideoPath = getRandomVideoFile(CONFIG.splitscreenFolder);
            if (!uploadedVideoPath) {
                throw new Error('No videos found in splitscreen folder');
            }
            console.log(`📹 Selected video: ${path.basename(uploadedVideoPath)}`);
        } else {
            console.log(`📁 Using uploaded video: ${path.basename(uploadedVideoPath)}`);
        }
        
        // Get uploaded video properties
        const uploadedVideoDuration = await getMediaDuration(uploadedVideoPath);
        const uploadedVideoDimensions = await getVideoDimensions(uploadedVideoPath);
        
        console.log(`⏱️ Video duration: ${uploadedVideoDuration.toFixed(2)} seconds`);
        console.log(`📐 Video dimensions: ${uploadedVideoDimensions.width}x${uploadedVideoDimensions.height}`);
        
        // Generate output path with unique timestamp
        const audioBasename = path.basename(audioFile, path.extname(audioFile));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19); // Include date and time
        const outputPath = path.join(CONFIG.outputFolder, `${audioBasename}_splitscreen_${timestamp}.mp4`);
        
        // Generate split screen editly config
        console.log(`🔧 Generating NEW split screen configuration...`);
        const splitScreenConfig = await generateNewSplitScreenConfig(uploadedVideoPath, outputPath);
        
        // Save config file
        const configPath = path.join(CONFIG.outputFolder, `${audioBasename}_splitscreen_config.json5`);
        fs.writeFileSync(configPath, JSON.stringify(splitScreenConfig, null, 2));
        
        console.log(`💾 Config saved: ${path.basename(configPath)}`);
        console.log(`🎬 Executing split screen video generation...`);
        
        // Execute editly
        const editlyCommand = `./node_modules/.bin/editly "${configPath}"`;
        await execAsync(editlyCommand);
        
        // Clean up config file
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        // Verify split screen output exists
        if (fs.existsSync(outputPath)) {
            const splitScreenDuration = await getMediaDuration(outputPath);
            console.log(`✅ NEW Split screen video generated successfully`);
            console.log(`📁 Split screen output: ${path.basename(outputPath)}`);
            console.log(`⏱️ Split screen duration: ${splitScreenDuration.toFixed(2)} seconds`);
            
            // === STEP 2: GENERATE NORMAL VIDEO ===
            console.log(`\n🎬 === GENERATING NORMAL VIDEO FOR FUSION ===`);
            
            // Calculate video structure for normal video using TTS audio
            const audioDuration = await getMediaDuration(audioFile);
            const videoStructure = await calculateVideoStructure(audioDuration);
            
            // Generate normal video output path
            const normalVideoPath = path.join(CONFIG.outputFolder, `${audioBasename}_normal_${timestamp}.mp4`);
            
            console.log(`🎵 TTS audio duration: ${audioDuration.toFixed(2)} seconds`);
            console.log(`📁 Normal video output: ${path.basename(normalVideoPath)}`);
            
            // Generate normal video editly config
            const normalEditlyConfig = await generateEditlyConfig(audioFile, videoStructure, normalVideoPath, false);
            
            // Save normal video config
            const normalConfigPath = path.join(CONFIG.outputFolder, `${audioBasename}_normal_config.json5`);
            fs.writeFileSync(normalConfigPath, JSON.stringify(normalEditlyConfig, null, 2));
            
            console.log(`🔧 Generating normal video configuration...`);
            console.log(`💾 Normal config saved: ${path.basename(normalConfigPath)}`);
            
            // Execute editly for normal video
            const normalEditlyCommand = `./node_modules/.bin/editly "${normalConfigPath}"`;
            console.log(`🎬 Generating normal video with command: ${normalEditlyCommand}`);
            await execAsync(normalEditlyCommand);
            
            // Clean up normal config file
            if (fs.existsSync(normalConfigPath)) {
                fs.unlinkSync(normalConfigPath);
            }
            
            // Verify normal video was created
            if (!fs.existsSync(normalVideoPath)) {
                throw new Error('Normal video generation failed - no output file created');
            }
            
            const normalVideoDuration = await getMediaDuration(normalVideoPath);
            console.log(`✅ Normal video generated successfully`);
            console.log(`📁 Normal video: ${path.basename(normalVideoPath)}`);
            console.log(`⏱️ Normal video duration: ${normalVideoDuration.toFixed(2)} seconds`);
            
            // === STEP 3: FUSE VIDEOS TOGETHER ===
            console.log(`\n🔗 === FUSING SPLIT SCREEN + NORMAL VIDEO ===`);
            
            // Generate final fused output path
            const fusedVideoPath = path.join(CONFIG.outputFolder, `${audioBasename}_fused_splitscreen_${timestamp}.mp4`);
            
            // Create concat file list for ffmpeg
            const concatListPath = path.join(CONFIG.outputFolder, `${audioBasename}_concat_list.txt`);
            const concatContent = `file '${path.basename(outputPath)}'\nfile '${path.basename(normalVideoPath)}'`;
            fs.writeFileSync(concatListPath, concatContent);
            
            console.log(`📋 Concat list created: ${path.basename(concatListPath)}`);
            console.log(`🎬 Part 1: Split screen video (${splitScreenDuration.toFixed(2)}s)`);
            console.log(`🎬 Part 2: Normal video (${normalVideoDuration.toFixed(2)}s)`);
            console.log(`📁 Final output: ${path.basename(fusedVideoPath)}`);
            
            // Execute ffmpeg concat (use relative paths since we're running from CONFIG.outputFolder)
            const ffmpegConcatCommand = `ffmpeg -f concat -safe 0 -i "${path.basename(concatListPath)}" -c copy "${path.basename(fusedVideoPath)}"`;
            console.log(`🔗 Fusing videos with command: ${ffmpegConcatCommand}`);
            
            try {
                await execAsync(ffmpegConcatCommand, { cwd: CONFIG.outputFolder });
                
                // Verify fused video was created
                if (fs.existsSync(fusedVideoPath)) {
                    const fusedVideoDuration = await getMediaDuration(fusedVideoPath);
                    const expectedDuration = splitScreenDuration + normalVideoDuration;
                    
                    console.log(`✅ FUSED VIDEO GENERATED SUCCESSFULLY!`);
                    console.log(`📁 Final output: ${path.basename(fusedVideoPath)}`);
                    console.log(`⏱️ Total duration: ${fusedVideoDuration.toFixed(2)}s (expected: ${expectedDuration.toFixed(2)}s)`);
                    
                    // Clean up intermediate files
                    console.log(`🗑️ Cleaning up intermediate files...`);
                    if (fs.existsSync(concatListPath)) {
                        fs.unlinkSync(concatListPath);
                        console.log(`   - Deleted: ${path.basename(concatListPath)}`);
                    }
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                        console.log(`   - Deleted: ${path.basename(outputPath)} (split screen only)`);
                    }
                    if (fs.existsSync(normalVideoPath)) {
                        fs.unlinkSync(normalVideoPath);
                        console.log(`   - Deleted: ${path.basename(normalVideoPath)} (normal video only)`);
                    }
                    
                    console.log(`🎉 FINAL FUSED SPLIT SCREEN VIDEO COMPLETE!`);
                    return fusedVideoPath;
                } else {
                    throw new Error('Video fusion failed - no fused output file created');
                }
                
            } catch (ffmpegError) {
                console.error(`❌ FFmpeg fusion failed:`, ffmpegError.message);
                // Clean up concat list file
                if (fs.existsSync(concatListPath)) {
                    fs.unlinkSync(concatListPath);
                }
                throw new Error(`Video fusion failed: ${ffmpegError.message}`);
            }
            
        } else {
            throw new Error('Split screen video generation failed - no output file created');
        }
        
    } catch (error) {
        console.error(`❌ NEW Split screen video generation failed:`, error.message);
        return null;
    }
}

/**
 * NEW Split Screen Configuration Generator
 * Creates proper cropping with center positioning according to requirements
 */
async function generateNewSplitScreenConfig(uploadedVideoPath, outputPath) {
    console.log(`\n🔧 === NEW SPLIT SCREEN CONFIG GENERATION ===`);
    console.log(`📁 Uploaded video: ${path.basename(uploadedVideoPath)}`);
    console.log(`📤 Output path: ${path.basename(outputPath)}`);
    
    // Get random template video from splitscreen folder
    const templateVideoPath = getRandomVideoFile(CONFIG.splitscreenFolder);
    if (!templateVideoPath) {
        throw new Error('No template video found in splitscreen folder');
    }
    console.log(`📹 Template video: ${path.basename(templateVideoPath)}`);
    
    // Get video properties
    const uploadedVideoDuration = await getMediaDuration(uploadedVideoPath);
    const uploadedVideoDimensions = await getVideoDimensions(uploadedVideoPath);
    const templateVideoDimensions = await getVideoDimensions(templateVideoPath);
    
    console.log(`⏱️ Duration: ${uploadedVideoDuration.toFixed(2)}s (from uploaded video)`);
    console.log(`📐 Canvas: ${uploadedVideoDimensions.width}x${uploadedVideoDimensions.height} (from uploaded video)`);
    console.log(`📐 Template: ${templateVideoDimensions.width}x${templateVideoDimensions.height}`);
    
    // NEW SPLIT SCREEN LAYER CONFIGURATION
    const splitScreenLayers = [
        // TOP VIDEO: Template video - crop center 50%, fill top half of screen
        {
            type: 'video',
            path: templateVideoPath,
            resizeMode: 'cover',      // Changed from 'crop' to 'cover'
            left: 0,                  // X-position: left edge
            top: 0,                   // Y-position: top of screen
            width: 1.0,               // Full canvas width
            height: 0.5,              // 50% of canvas height (top half)
            cutFrom: 0,               // Start from beginning
            cutTo: uploadedVideoDuration,  // Match uploaded video duration
            originX: 'left',
            originY: 'top'
        },
        // BOTTOM VIDEO: Uploaded video - crop center 50%, fill bottom half of screen
        {
            type: 'video',
            path: uploadedVideoPath,
            resizeMode: 'cover',      // Changed from 'crop' to 'cover'
            left: 0,                  // X-position: left edge
            top: 0.5,                 // Y-position: 50% down (bottom half)
            width: 1.0,               // Full canvas width
            height: 0.5,              // 50% of canvas height (bottom half)
            cutFrom: 0,               // Start from beginning
            cutTo: uploadedVideoDuration,  // Full duration
            originX: 'left',
            originY: 'top'
        }
    ];
    
    console.log(`\n🎯 === NEW SPLIT SCREEN LAYER DETAILS ===`);
    console.log(`📹 TOP LAYER (Template - top 50% of screen):`);
    console.log(`   - File: ${path.basename(templateVideoPath)}`);
    console.log(`   - Canvas Position: left=${splitScreenLayers[0].left}, top=${splitScreenLayers[0].top} (top half)`);
    console.log(`   - Canvas Size: width=${splitScreenLayers[0].width}, height=${splitScreenLayers[0].height} (50% height)`);
    console.log(`   - Duration: ${splitScreenLayers[0].cutFrom}s to ${splitScreenLayers[0].cutTo}s`);
    console.log(`   - Resize Mode: ${splitScreenLayers[0].resizeMode}`);
    
    console.log(`📹 BOTTOM LAYER (Uploaded - bottom 50% of screen):`);
    console.log(`   - File: ${path.basename(uploadedVideoPath)}`);
    console.log(`   - Canvas Position: left=${splitScreenLayers[1].left}, top=${splitScreenLayers[1].top} (bottom half)`);
    console.log(`   - Canvas Size: width=${splitScreenLayers[1].width}, height=${splitScreenLayers[1].height} (50% height)`);
    console.log(`   - Duration: ${splitScreenLayers[1].cutFrom}s to ${splitScreenLayers[1].cutTo}s`);
    console.log(`   - Resize Mode: ${splitScreenLayers[1].resizeMode}`);
    
    // Create single clip with both layers
    const clips = [{
        duration: uploadedVideoDuration,
        layers: splitScreenLayers
    }];
    
    // Build final editly configuration
    const config = {
        outPath: outputPath,
        width: uploadedVideoDimensions.width,
        height: uploadedVideoDimensions.height,
        fps: 30,
        outDuration: uploadedVideoDuration,
        keepSourceAudio: true,  // FIXED: Keep source audio so uploaded video audio is preserved
        defaults: {
            transition: { name: 'dummy', duration: 0 }
        },
        clips
    };
    
    // Set audio to come from uploaded video
    if (clips.length > 0) {
        clips[0].audioFilePath = uploadedVideoPath;
        console.log(`🔊 Audio source: ${path.basename(uploadedVideoPath)} (uploaded video audio - keepSourceAudio: true)`);
    }
    
    console.log(`\n📊 === NEW SPLIT SCREEN SUMMARY ===`);
    console.log(`🎬 Total clips: ${clips.length}`);
    console.log(`⏱️ Duration: ${uploadedVideoDuration.toFixed(2)}s`);
    console.log(`📐 Resolution: ${uploadedVideoDimensions.width}x${uploadedVideoDimensions.height}`);
    console.log(`🎞️ Frame rate: 30fps`);
    console.log(`🎵 Audio: From uploaded video`);
    console.log(`📤 Output: ${path.basename(outputPath)}`);
    console.log(`===============================================\n`);
    
    return config;
}

/**
 * Process new audio file
 */
async function processAudioFile(audioFilePath, debugOverlay = false, splitScreenMode = false, splitScreenClipPath = null) {
    // FIXED: Use mode-specific lock files to prevent race conditions between normal and split screen processing
    const processingMode = splitScreenMode ? 'splitscreen' : 'normal';
    const lockFile = audioFilePath + `.processing_${processingMode}`;
    
    try {
        // Check for processing lock to prevent duplicate processing in SAME MODE
        if (fs.existsSync(lockFile)) {
            console.log(`🔒 File already being processed in ${processingMode} mode: ${path.basename(audioFilePath)}`);
            // Wait for the other process to complete and return its result
            const maxWait = 60000; // 60 seconds
            const checkInterval = 1000; // 1 second
            let waited = 0;
            
            while (waited < maxWait) {
                if (!fs.existsSync(lockFile)) {
                    // Other process completed, check if video exists for THIS MODE
                    const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
                    const timestamp = new Date().toISOString().split('T')[0];
                    
                    let expectedOutputPath;
                    if (splitScreenMode) {
                        expectedOutputPath = path.join(CONFIG.finalOutputFolder, `${audioBasename}_splitscreen_${timestamp}.mp4`);
                    } else {
                        expectedOutputPath = path.join(CONFIG.outputFolder, `${audioBasename}_${timestamp}.mp4`);
                    }
                    
                    if (fs.existsSync(expectedOutputPath)) {
                        console.log(`✅ Found ${processingMode} video created by parallel process: ${path.basename(expectedOutputPath)}`);
                        return expectedOutputPath;
                    }
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waited += checkInterval;
            }
            
            console.log(`⏰ Timeout waiting for parallel ${processingMode} process`);
            return null;
        }
        
        // Create mode-specific processing lock
        fs.writeFileSync(lockFile, `${Date.now()}_${processingMode}`);
        
        console.log(`\n🎵 Processing new audio file: ${path.basename(audioFilePath)}`);
        
        if (splitScreenMode) {
            console.log('🔀 Split-screen mode enabled');
        }
        
        // Check if file still exists (may have been processed by another instance)
        if (!fs.existsSync(audioFilePath)) {
            console.warn(`⚠️ Audio file no longer exists, skipping: ${path.basename(audioFilePath)}`);
            // Clean up lock file
            if (fs.existsSync(lockFile)) {
                fs.unlinkSync(lockFile);
            }
            return null;
        }
        
        // Get audio duration
        const audioDuration = await getMediaDuration(audioFilePath);
        console.log(`⏱️ Audio duration: ${audioDuration.toFixed(2)} seconds`);
        
        if (audioDuration <= 0) {
            console.error('❌ Invalid audio duration');
            // Clean up lock file
            if (fs.existsSync(lockFile)) {
                fs.unlinkSync(lockFile);
            }
            return null;
        }
        
        // Generate base filename components with unique timestamp
        const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19); // Include date and time
        
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
            
            // Add duration validation and logging
            const actualNormalVideoDuration = await getMediaDuration(tempOutputPath);
            console.log(`🔍 Duration validation - Spark TTS audio: ${audioDuration.toFixed(2)}s, Normal video: ${actualNormalVideoDuration.toFixed(2)}s`);
            
            // Check for duration mismatch and regenerate if needed
            const durationDifference = Math.abs(actualNormalVideoDuration - audioDuration);
            if (durationDifference > 0.1) {
                console.warn(`⚠️ Duration mismatch detected! Regenerating normal video with forced duration...`);
                console.log(`   📊 Difference: ${durationDifference.toFixed(2)}s (tolerance: 0.1s)`);
                
                // Force video structure to match exact audio duration
                const forcedVideoStructure = await calculateVideoStructure(audioDuration);
                forcedVideoStructure.totalVideoDuration = audioDuration;
                
                // Regenerate editly config with forced duration
                const forcedEditlyConfig = await generateEditlyConfig(audioFilePath, forcedVideoStructure, tempOutputPath, debugOverlay);
                forcedEditlyConfig.outDuration = audioDuration;
                
                // Save and execute forced config
                const forcedConfigPath = path.join(CONFIG.outputFolder, `temp_forced_${audioBasename}_config.json5`);
                fs.writeFileSync(forcedConfigPath, JSON.stringify(forcedEditlyConfig, null, 2));
                
                console.log('🔄 Regenerating normal video with exact audio duration...');
                const forcedEditlyCommand = `./node_modules/.bin/editly "${forcedConfigPath}"`;
                await execAsync(forcedEditlyCommand);
                
                // Clean up forced config
                if (fs.existsSync(forcedConfigPath)) {
                    fs.unlinkSync(forcedConfigPath);
                }
                
                // Verify the fix worked
                const verifyDuration = await getMediaDuration(tempOutputPath);
                console.log(`✅ Normal video regenerated - New duration: ${verifyDuration.toFixed(2)}s`);
                
                if (Math.abs(verifyDuration - audioDuration) > 0.1) {
                    console.warn(`⚠️ Duration still mismatched after regeneration: ${verifyDuration.toFixed(2)}s vs ${audioDuration.toFixed(2)}s`);
                }
            } else {
                console.log(`✅ Duration validation passed - Difference: ${durationDifference.toFixed(3)}s`);
            }
            
            // Step 2: Generate split-screen clip
            console.log('🔀 Preparing split-screen generation...');
            
            // Get videos for split-screen generation
            const splitscreenTopFile = getRandomVideoFile(CONFIG.splitscreenFolder);
            let splitscreenBottomFile;
            
            if (!splitscreenTopFile) {
                throw new Error(`No videos found in splitscreen folder: ${CONFIG.splitscreenFolder}`);
            }
            
            // Use uploaded file if provided, otherwise fallback to random selection
            if (splitScreenClipPath && fs.existsSync(splitScreenClipPath)) {
                console.log(`🎬 Using uploaded split-screen clip: ${path.basename(splitScreenClipPath)}`);
                splitscreenBottomFile = splitScreenClipPath;
                
                // Validate that the uploaded file is a video
                const ext = path.extname(splitScreenClipPath).toLowerCase();
                if (!CONFIG.supportedVideoFormats.includes(ext)) {
                    throw new Error(`Uploaded file is not a supported video format: ${ext}`);
                }
            } else {
                if (splitScreenClipPath) {
                    console.warn(`⚠️ Uploaded split-screen clip not found: ${splitScreenClipPath}, falling back to random selection`);
                }
                
                splitscreenBottomFile = getRandomVideoFile(CONFIG.splitscreenSourceFolder);
                
                if (!splitscreenBottomFile) {
                    console.warn('⚠️ No videos found in splitscreensource folder, using splitscreen video for both top and bottom');
                    // Use the same video for both if splitscreensource is empty
                    splitscreenBottomFile = splitscreenTopFile;
                }
            }
            
            // Define split-screen duration based on splitscreensource video
            let splitscreenDuration;
            try {
                splitscreenDuration = await getMediaDuration(splitscreenBottomFile);
                console.log(`🔀 Using splitscreensource duration: ${splitscreenDuration.toFixed(2)}s`);
            } catch (error) {
                console.warn('⚠️ Could not get splitscreensource duration, falling back to 4 seconds:', error.message);
                splitscreenDuration = 4.0;
            }
            
            const splitscreenOutputPath = path.join(CONFIG.outputFolder, `temp_splitscreen_${audioBasename}_${timestamp}.mp4`);
            
            // Generate split-screen video
            await generateSplitScreenClip(splitscreenTopFile, splitscreenBottomFile, splitscreenOutputPath, splitscreenDuration);
            
            /* OLD BUGGY APPROACH - COMMENTED OUT TO PREVENT FUTURE CONFUSION
             * This approach concatenated splitscreensource audio + Spark TTS audio, 
             * which caused audio to stop halfway through and sync issues.
             * The correct approach is to use per-clip audio (silent split screen + audio on normal video).
             */
            
            // Step 3: CORRECTED APPROACH - Use per-clip audio for proper synchronization
            console.log('🔗 Using per-clip audio approach (splitscreen source audio + Spark TTS on normal video)...');
            
            // Get final normal video duration for logging
            const finalNormalVideoDuration = await getMediaDuration(tempOutputPath);
            
            // Comprehensive duration logging for debugging
            console.log(`📊 Final duration summary:`);
            console.log(`   🔀 Split-screen duration: ${splitscreenDuration.toFixed(2)}s (with source audio)`);
            console.log(`   🎵 Spark TTS audio duration: ${audioDuration.toFixed(2)}s`);
            console.log(`   🎬 Normal video duration: ${finalNormalVideoDuration.toFixed(2)}s`);
            console.log(`   📺 Total video will be: ${(splitscreenDuration + finalNormalVideoDuration).toFixed(2)}s`);
            console.log(`   🔊 Audio sync: Split-screen plays source audio, then Spark TTS starts with normal video (${splitscreenDuration.toFixed(2)}s offset)`);
            
            /* REMOVED: Audio extraction, concatenation, and validation
             * - No splitscreenAudioPath needed
             * - No combinedAudioPath needed  
             * - No combineAudioCommand needed
             * - No audio duration validation needed
             * This eliminates the source of audio sync bugs.
             */
            
            // Step 4: Combine split-screen + normal video using Editly (with per-clip audio)
            console.log('🔗 Combining split-screen and normal video with per-clip audio synchronization...');
            
            const finalOutputPath = path.join(CONFIG.finalOutputFolder, `${audioBasename}_splitscreen_${timestamp}.mp4`);
            
            // Ensure final output directory exists
            if (!fs.existsSync(CONFIG.finalOutputFolder)) {
                fs.mkdirSync(CONFIG.finalOutputFolder, { recursive: true });
            }
            
            // Generate split-screen + normal video configuration (with per-clip audio)
            console.log('⚙️ Generating split-screen + normal video configuration...');
            const splitscreenConfig = await generateSplitScreenEditlyConfig(audioFilePath, splitscreenDuration, splitscreenOutputPath, tempOutputPath, finalOutputPath, debugOverlay, splitscreenBottomFile);
            
            const splitscreenConfigPath = path.join(CONFIG.outputFolder, `temp_splitscreen_${audioBasename}_config.json5`);
            fs.writeFileSync(splitscreenConfigPath, JSON.stringify(splitscreenConfig, null, 2));
            
            console.log('🎥 Generating final split-screen video with synchronized audio...');
            const finalEditlyCommand = `./node_modules/.bin/editly "${splitscreenConfigPath}"`;
            
            console.log(`🎬 Generating final video with command: ${finalEditlyCommand}`);
            await execAsync(finalEditlyCommand);
            
            // Clean up temporary files
            [tempOutputPath, splitscreenOutputPath, splitscreenConfigPath].forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`🗑️ Cleaned up: ${path.basename(file)}`);
                }
            });
            
            console.log('✅ Split-screen video generation complete!');
            console.log(`📁 Final output: ${finalOutputPath}`);
            console.log(`📦 Split-screen intro (${splitscreenDuration.toFixed(2)}s with source audio) + Normal video (${finalNormalVideoDuration.toFixed(2)}s with Spark TTS audio)`);
            console.log(`🔊 Total video duration: ${(splitscreenDuration + finalNormalVideoDuration).toFixed(2)}s with properly synchronized audio`);
            
            // Clean up lock file
            if (fs.existsSync(lockFile)) {
                fs.unlinkSync(lockFile);
            }
            
            return finalOutputPath;
            
        } else {
            // NORMAL MODE: Standard video generation
        console.log('🎬 Calculating video structure...');
        const videoStructure = await calculateVideoStructure(audioDuration);
        
        const outputPath = path.join(CONFIG.outputFolder, `${audioBasename}_${timestamp}.mp4`);
        
        // Check if video already exists
        if (fs.existsSync(outputPath)) {
                console.warn(`⚠️ Video already exists: ${path.basename(outputPath)}`);
                console.log(`✅ Using existing video file`);
                // Clean up lock file
                if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                }
                return outputPath;
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
                // Clean up lock file
                if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                }
                return null;
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
            
            // Clean up lock file
            if (fs.existsSync(lockFile)) {
                fs.unlinkSync(lockFile);
            }
        
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
        
        // Clean up lock file
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
        
        // Return null to indicate failure
        return null;
    }
}

/**
 * Initialize file watcher
 */
function initializeWatcher(debugOverlay = false, splitScreenMode = false) {
    const watchPath = path.resolve(CONFIG.audioWatchFolder);
    const statusPath = path.resolve('./status');
    
    if (!fs.existsSync(watchPath)) {
        console.error(`❌ Audio watch folder not found: ${watchPath}`);
        console.log('💡 Please ensure the Spark-TTS audiooutput/done folder exists');
        console.log('💡 The done folder is created automatically when audio files are generated');
        process.exit(1);
    }
    
    // Ensure status directory exists
    if (!fs.existsSync(statusPath)) {
        fs.mkdirSync(statusPath, { recursive: true });
    }
    
    console.log(`👀 Watching for new audio files in: ${watchPath}`);
    console.log(`📁 Video templates: ${path.resolve(CONFIG.videoTemplatesBase)}`);
    console.log(`🔄 Status coordination: ${statusPath}`);
    
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
        console.log('🔀 SPLIT-SCREEN MODE: Videos will include dynamic split-screen intro');
    }
    
    // Watch for audio files
    const audioWatcher = chokidar.watch(watchPath, {
        ignored: [
            /(^|[\/\\])\../ // ignore dotfiles
        ],
        persistent: true,
        ignoreInitial: true
    });
    
    audioWatcher.on('add', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (CONFIG.supportedAudioFormats.includes(ext)) {
            console.log(`\n🆕 New audio file detected: ${path.basename(filePath)}`);
            
            // Wait a moment for file to be fully written
            setTimeout(() => {
                processAudioFile(filePath, debugOverlay, splitScreenMode);
            }, 1000);
        }
    });
    
    // Watch for status files (coordination with API)
    const statusWatcher = chokidar.watch(statusPath, {
        ignored: [
            /(^|[\/\\])\../ // ignore dotfiles
        ],
        persistent: true,
        ignoreInitial: true
    });
    
    statusWatcher.on('add', (statusFilePath) => {
        if (path.extname(statusFilePath).toLowerCase() === '.json') {
            console.log(`\n📋 New status file detected: ${path.basename(statusFilePath)}`);
            
            // Wait a moment for file to be fully written
            setTimeout(() => {
                processStatusFile(statusFilePath, debugOverlay, splitScreenMode);
            }, 500);
        }
    });
    
    audioWatcher.on('error', (error) => {
        console.error('❌ Audio watcher error:', error);
    });
    
    statusWatcher.on('error', (error) => {
        console.error('❌ Status watcher error:', error);
    });
    
    console.log('\n✅ Auto Video Generator is running!');
    console.log('💡 Watching audiooutput/done folder for processed audio files');
    console.log('💡 Watching status folder for API coordination');
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
// FFmpeg-based generateSplitScreenClip function removed - using Editly exclusively

// Old generateSplitScreenEditlyConfig function removed - using new Editly-only approach

module.exports = {
    processAudioFile,
    getMediaDuration,
    getVideoDimensions,
    calculateVideoStructure,
    generateEditlyConfig,
    generateSplitScreenVideo,
    generateNewSplitScreenConfig
};