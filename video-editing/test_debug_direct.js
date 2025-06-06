const { processAudioFile, generateEditlyConfig, calculateVideoStructure, getMediaDuration } = require('./auto-video-generator.js');
const fs = require('fs');

async function testDebugOverlay() {
    try {
        console.log('🔍 Testing debug overlay functionality directly...');
        
        // Generate config with debug overlay enabled
        const audioFile = '../zero-wire/Spark-TTS/audiooutput/done/test_debug_overlay.wav';
        const audioDuration = await getMediaDuration(audioFile);
        const videoStructure = await calculateVideoStructure(audioDuration);
        const outputPath = './generated-videos/debug_test_output.mp4';
        
        const configWithDebug = await generateEditlyConfig(audioFile, videoStructure, outputPath, true);
        
        // Save config for inspection
        fs.writeFileSync('debug_test_config_with_overlay.json5', JSON.stringify(configWithDebug, null, 2));
        
        console.log('📊 Config with debug overlay saved to: debug_test_config_with_overlay.json5');
        console.log('🔍 Debug overlay example from INTRO clip:');
        
        if (configWithDebug.clips[0].layers.length > 1) {
            console.log('✅ DEBUG OVERLAY FOUND!');
            console.log('📝 Debug text:', configWithDebug.clips[0].layers[1].text);
        } else {
            console.log('❌ NO DEBUG OVERLAY FOUND');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDebugOverlay(); 