import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import cache from '../../../video-editing/template-cache.json';

const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../'); // Adjust as per your final structure
const VIDEO_PADDING_DURATION = 1.0;

interface VideoClip {
    file: string;
    duration: number;
}

interface VideoStructure {
    intro: VideoClip & { fullDuration: boolean };
    loops: (VideoClip & { fullDuration: boolean })[];
    end: VideoClip & { fullDuration: boolean };
    totalVideoDuration: number;
}

async function getMediaDuration(filePath: string): Promise<number> {
    try {
        const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
        return parseFloat(stdout.trim());
    } catch (error) {
        console.error(`Error getting duration for ${filePath}:`, error);
        return 0;
    }
}

async function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
    try {
        const { stdout } = await execAsync(`ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filePath}"`);
        const [width, height] = stdout.trim().split(',').map(Number);
        return { width, height };
    } catch (error) {
        console.error(`Error getting dimensions for ${filePath}:`, error);
        return { width: 1920, height: 1080 }; // Fallback
    }
}

function getRandomVideoFile(clips: VideoClip[]): VideoClip | null {
    if (!clips || clips.length === 0) {
        return null;
    }
    return clips[Math.floor(Math.random() * clips.length)];
}

async function calculateVideoStructure(audioDuration: number): Promise<VideoStructure> {
    const introClip = getRandomVideoFile(cache.intro);
    if (!introClip) throw new Error('Could not find intro video file in cache.');

    const endClip = getRandomVideoFile(cache.end);
    if (!endClip) throw new Error('Could not find end video file in cache.');
    
    if (!cache.loop || cache.loop.length === 0) {
        throw new Error('Could not find any loop video files in cache.');
    }

    const targetVideoDuration = audioDuration + VIDEO_PADDING_DURATION;
    let totalContentTime = introClip.duration;
    const loops: (VideoClip & { fullDuration: boolean })[] = [];

    // Fill with loops until we have enough time for the end clip
    while (totalContentTime < targetVideoDuration - endClip.duration) {
        const loopClip = getRandomVideoFile(cache.loop);
        if(!loopClip) break; // Should not happen given the check above
        loops.push({ ...loopClip, fullDuration: true });
        totalContentTime += loopClip.duration;
    }

    // Add the end clip
    let finalEndClip = { ...endClip, fullDuration: true };
    totalContentTime += endClip.duration;

    return {
        intro: { ...introClip, fullDuration: true },
        loops: loops,
        end: finalEndClip,
        totalVideoDuration: totalContentTime,
    };
}


async function generateEditlyConfig(audioFile: string, videoStructure: VideoStructure, outputPath: string) {
    const { intro, loops, end } = videoStructure;
    const dimensions = await getVideoDimensions(path.join(PROJECT_ROOT, intro.file));
    
    const clips = [];

    // Add intro
    clips.push({
        duration: intro.duration,
        layers: [{ type: 'video', path: path.join(PROJECT_ROOT, intro.file) }]
    });

    // Add loops
    for (const loop of loops) {
        clips.push({
            duration: loop.duration,
            layers: [{ type: 'video', path: path.join(PROJECT_ROOT, loop.file) }]
        });
    }

    // Add end
    clips.push({
        duration: end.duration,
        layers: [{ type: 'video', path: path.join(PROJECT_ROOT, end.file) }]
    });
    
    const totalClipDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);

    return {
        outPath: outputPath,
        width: dimensions.width,
        height: dimensions.height,
        fps: 30,
        outDuration: totalClipDuration,
        audioFilePath: audioFile,
        keepSourceAudio: false,
        defaults: {
            transition: { name: 'dummy', duration: 0 }
        },
        clips,
    };
}


export async function generateVideoFromAudio(audioFilePath: string): Promise<string> {
    console.log('🎬 Starting video generation from audio...');
    const audioBasename = path.basename(audioFilePath, path.extname(audioFilePath));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const outputFolder = path.join(PROJECT_ROOT, 'generated-videos');
    await fs.mkdir(outputFolder, { recursive: true });
    const outputPath = path.join(outputFolder, `${audioBasename}_${timestamp}.mp4`);

    try {
        const audioDuration = await getMediaDuration(audioFilePath);
        if (audioDuration === 0) {
            throw new Error('Could not determine audio duration or audio is empty.');
        }

        console.log('📊 Calculating video structure...');
        const videoStructure = await calculateVideoStructure(audioDuration);
        
        console.log('⚙️ Generating video configuration...');
        const editlyConfig = await generateEditlyConfig(audioFilePath, videoStructure, outputPath);
        
        const configPath = path.join(outputFolder, `temp_config_${timestamp}.json5`);
        await fs.writeFile(configPath, JSON.stringify(editlyConfig, null, 2));

        console.log('🎥 Generating video with Editly...');
        const editlyCommand = `npx editly@latest --config "${configPath}"`;
        await execAsync(editlyCommand);

        console.log(`✅ Video generation complete! Output: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error('❌ Video generation failed:', error);
        throw error;
    } finally {
        // Cleanup temp config file
        const configPath = path.join(outputFolder, `temp_config_${timestamp}.json5`);
        try {
            await fs.unlink(configPath);
        } catch (cleanupError) {
            // Ignore if file doesn't exist
        }
    }
} 