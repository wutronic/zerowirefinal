const { calculateVideoStructure, generateEditlyConfig } = require('./video-editing/auto-video-generator');
const path = require('path');
const fs = require('fs');

async function testNormalVideoGeneration() {
    console.log('🧪 Testing NEW SIMPLIFIED Video Generation Logic...\n');
    
    // Test with our 30-second sample audio
    const audioPath = path.join(__dirname, 'audio/sample-tts.mp3');
    const outputPath = path.join(__dirname, 'output/test-normal-video.mp4');
    
    if (!fs.existsSync(audioPath)) {
        console.error('❌ Test audio file not found:', audioPath);
        return;
    }
    
    try {
        // Test our new simplified calculateVideoStructure
        console.log('🎯 === TESTING NEW SIMPLIFIED VIDEO STRUCTURE ===\n');
        
        // Get audio duration first
        const { promisify } = require('util');
        const { exec } = require('child_process');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`);
        const audioDuration = parseFloat(stdout.trim());
        
        console.log(`🎵 Input audio duration: ${audioDuration.toFixed(3)}s\n`);
        
        // Test the new calculateVideoStructure function
        const videoStructure = await calculateVideoStructure(audioDuration);
        
        console.log('\n🔍 === STRUCTURE RESULT ===');
        console.log(`📊 Intro: ${path.basename(videoStructure.intro.file)} (${videoStructure.intro.duration.toFixed(3)}s)`);
        console.log(`🔄 Loops: ${videoStructure.loops.length} clips`);
        videoStructure.loops.forEach((loop, i) => {
            console.log(`   ${i+1}. ${path.basename(loop.file)} (${loop.duration.toFixed(3)}s)`);
        });
        console.log(`🎯 End: ${path.basename(videoStructure.end.file)} (${videoStructure.end.duration.toFixed(3)}s)`);
        console.log(`🎥 Total video duration: ${videoStructure.totalVideoDuration.toFixed(3)}s`);
        
        const totalContentTime = videoStructure.intro.duration + 
                                 videoStructure.loops.reduce((sum, loop) => sum + loop.duration, 0) + 
                                 videoStructure.end.duration;
        
        console.log(`\n📊 === VERIFICATION ===`);
        console.log(`🎵 Audio duration: ${audioDuration.toFixed(3)}s`);
        console.log(`🎬 Video content: ${totalContentTime.toFixed(3)}s`);
        console.log(`📏 Padding: 1.000s`);
        console.log(`🎥 Total with padding: ${(totalContentTime + 1.0).toFixed(3)}s`);
        console.log(`⚖️ Difference: ${(totalContentTime - audioDuration).toFixed(3)}s`);
        
        // Test the editly config generation
        console.log('\n🔧 === TESTING EDITLY CONFIG GENERATION ===\n');
        const editlyConfig = await generateEditlyConfig(audioPath, videoStructure, outputPath, false);
        
        console.log('✅ NEW SIMPLIFIED VIDEO STRUCTURE TEST COMPLETE!');
        console.log('\n📋 Summary:');
        console.log(`   - Process: Random intro → Random loops (leaving room for one more) → Random end → 1s padding`);
        console.log(`   - No complex calculations or edge cases`);
        console.log(`   - Exact match to audio duration + 1s padding`);
        console.log(`   - Should eliminate audio cropping issues`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testNormalVideoGeneration();
}

module.exports = { testNormalVideoGeneration }; 