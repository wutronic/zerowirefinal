const { processAudioFile, generateEditlyConfig, calculateVideoStructure, getMediaDuration } = require('./auto-video-generator.js');
const path = require('path');
const fs = require('fs');

async function debugConfig() {
    try {
        const audioFile = '../zero-wire/Spark-TTS/audiooutput/done/test_dummy_transition.wav';
        const audioDuration = await getMediaDuration(audioFile);
        console.log('Audio duration:', audioDuration);
        
        const videoStructure = await calculateVideoStructure(audioDuration);
        console.log('Video structure:', JSON.stringify(videoStructure, null, 2));
        
        const outputPath = './generated-videos/debug_output.mp4';
        const config = await generateEditlyConfig(audioFile, videoStructure, outputPath);
        
        console.log('\n=== GENERATED CONFIG ===');
        console.log(JSON.stringify(config, null, 2));
        
        // Save config without running editly
        fs.writeFileSync('./debug_config_output.json5', JSON.stringify(config, null, 2));
        console.log('\nConfig saved to debug_config_output.json5');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugConfig(); 