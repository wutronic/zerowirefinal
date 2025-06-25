const { generateSplitScreenVideo } = require('./video-editing/auto-video-generator');
const path = require('path');
const fs = require('fs');

async function testDebugSystem() {
    console.log('🧪 Starting Debug System Test...\n');
    
    // Create a temporary status file that mimics the actual workflow
    const testStatusFile = path.join(__dirname, 'test-status.json');
    const testStatusData = {
        audioFile: 'sample-tts.mp3', // Relative path that will be resolved to zero-wire/Spark-TTS
        splitScreenPath: path.join(__dirname, 'VideoTemplates/style 1/splitscreen/splitscreen.mp4'), // Use existing splitscreen video
        timestamp: new Date().toISOString(),
        duration: 30.0 // Our test audio is 30 seconds
    };
    
    // Create the status file
    fs.writeFileSync(testStatusFile, JSON.stringify(testStatusData, null, 2));
    
    // Also copy our test audio to the expected location
    const expectedAudioPath = path.join(__dirname, '../zero-wire/Spark-TTS/sample-tts.mp3');
    const actualAudioPath = path.join(__dirname, 'audio/sample-tts.mp3');
    
    // Create the directory structure if it doesn't exist
    const audioDir = path.dirname(expectedAudioPath);
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }
    
    // Copy the audio file
    if (fs.existsSync(actualAudioPath)) {
        fs.copyFileSync(actualAudioPath, expectedAudioPath);
    }
    
    console.log('📋 Test Setup:');
    console.log(`  Status File: ${testStatusFile}`);
    console.log(`  Audio File: ${expectedAudioPath}`);
    console.log(`  Split Screen Video: ${testStatusData.splitScreenPath}`);
    console.log(`  Debug Mode: Enabled`);
    console.log('\n' + '='.repeat(60) + '\n');
    
    try {
        // Call our modified function with debugging enabled
        const result = await generateSplitScreenVideo(testStatusData, testStatusFile, true);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Debug System Test Completed Successfully!');
        if (result) {
            console.log(`🎉 Generated video: ${path.basename(result)}`);
        }
        
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ Debug System Test Failed:');
        console.error(error.message);
        console.error('\nFull Error:', error);
    } finally {
        // Clean up test files
        if (fs.existsSync(testStatusFile)) {
            fs.unlinkSync(testStatusFile);
        }
        if (fs.existsSync(expectedAudioPath)) {
            fs.unlinkSync(expectedAudioPath);
        }
    }
}

// Run the test
if (require.main === module) {
    testDebugSystem();
}

module.exports = { testDebugSystem }; 