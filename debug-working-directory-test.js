const { processAudioFile } = require('./video-editing/auto-video-generator');
const path = require('path');
const fs = require('fs');

async function testFromDifferentWorkingDirectories() {
    console.log('🔍 === TESTING FROM DIFFERENT WORKING DIRECTORIES ===\n');
    
    // Use absolute path for audio file to make it work from any directory
    const audioFile = path.resolve(__dirname, 'audio/sample-tts.mp3');
    
    if (!fs.existsSync(audioFile)) {
        console.error(`❌ Test audio file not found: ${audioFile}`);
        return;
    }
    
    console.log(`🎵 Using audio file: ${audioFile}`);
    console.log(`📂 Current working directory: ${process.cwd()}`);
    
    try {
        console.log(`\n🎬 === CALLING processAudioFile FROM: ${process.cwd()} ===`);
        console.log(`This tests our absolute path fix...`);
        
        const result = await processAudioFile(audioFile, false, false, null);
        
        if (result) {
            console.log(`✅ SUCCESS! Generated video: ${result}`);
            console.log(`🎯 Our absolute path fix works!`);
        } else {
            console.log(`❌ FAILED: processAudioFile returned null/undefined`);
        }
        
    } catch (error) {
        console.error(`❌ ERROR in processAudioFile:`, error.message);
        if (error.message.includes('Could not find intro video file')) {
            console.error(`🚨 This confirms the working directory issue!`);
            console.error(`🔧 Our absolute path fix should resolve this.`);
        }
    }
}

testFromDifferentWorkingDirectories().catch(console.error); 