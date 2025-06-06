const { processAudioFile, generateEditlyConfig, calculateVideoStructure, getMediaDuration } = require('./auto-video-generator.js');
const path = require('path');
const fs = require('fs');

async function debugConfig() {
    try {
        const audioFile = '../zero-wire/Spark-TTS/audiooutput/done/test_debug_overlay.wav';
        const audioDuration = await getMediaDuration(audioFile);
        console.log('🎵 Audio duration:', audioDuration);
        
        const videoStructure = await calculateVideoStructure(audioDuration);
        console.log('🎬 Video structure:', JSON.stringify(videoStructure, null, 2));
        
        const outputPath = './generated-videos/debug_output.mp4';
        
        // Test with debug overlay enabled
        const config = await generateEditlyConfig(audioFile, videoStructure, outputPath, true);
        
        console.log('\n=== GENERATED CONFIG WITH DEBUG OVERLAY ===');
        console.log(JSON.stringify(config, null, 2));
        
        // Save config for testing
        fs.writeFileSync('debug_config_output.json5', JSON.stringify(config, null, 2));
        console.log('\n💾 Config saved to debug_config_output.json5');
        console.log('🎥 Run: npx editly debug_config_output.json5 --out debug_with_overlay.mp4');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugConfig(); 