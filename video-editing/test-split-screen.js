#!/usr/bin/env node

const { processAudioFile } = require('./auto-video-generator.js');
const path = require('path');
const fs = require('fs');

// Import the functions from auto-video-generator.js
// We'll copy the necessary functions here for testing

// Test the split screen functionality by calling the actual function
async function testSplitScreenDirect() {
    try {
        console.log('🧪 Testing split screen functionality directly...');
        
        // Import the generateSplitScreenVideo function
        const autoVideoGenerator = require('./auto-video-generator.js');
        
        const statusData = {
            requestId: "test_debug_direct",
            audioFile: "audiooutput/done/testing_new_split.wav",
            splitScreenPath: "/Users/lukaszwieczorek/Documents/zerowirefinal/splitscreensource/Original audio(750).MP4"
        };
        
        const statusFilePath = "status/test_debug_direct.json";
        
        // Call the function directly
        console.log('🔧 Calling generateSplitScreenVideo...');
        const result = await autoVideoGenerator.generateSplitScreenVideo(statusData, statusFilePath);
        
        if (result) {
            console.log('✅ Split screen generation successful!');
            console.log(`📁 Output: ${result}`);
        } else {
            console.log('❌ Split screen generation failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testSplitScreenDirect();

// Run the test
if (require.main === module) {
    testSplitScreenDirect();
} 