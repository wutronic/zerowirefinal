const { processAudioFile } = require('./video-editing/auto-video-generator');
const path = require('path');
const fs = require('fs');

async function debugActualFlow() {
    console.log('🔍 === DEBUGGING ACTUAL VIDEO GENERATION FLOW ===\n');
    
    // Use the sample audio file we created
    const audioFile = path.resolve('./audio/sample-tts.mp3');
    
    if (!fs.existsSync(audioFile)) {
        console.error(`❌ Test audio file not found: ${audioFile}`);
        return;
    }
    
    console.log(`🎵 Using audio file: ${audioFile}`);
    console.log(`📂 Current working directory: ${process.cwd()}`);
    
    try {
        console.log(`\n🎬 === CALLING processAudioFile ===`);
        console.log(`This mimics the exact call that fails in the real system...`);
        
        const result = await processAudioFile(audioFile, false, false, null);
        
        if (result) {
            console.log(`✅ SUCCESS! Generated video: ${result}`);
        } else {
            console.log(`❌ FAILED: processAudioFile returned null/undefined`);
        }
        
    } catch (error) {
        console.error(`❌ ERROR in processAudioFile:`, error.message);
        console.error(`Stack trace:`, error.stack);
    }
}

debugActualFlow().catch(console.error); 