const path = require('path');
const fs = require('fs');

// Simulate CONFIG from auto-video-generator.js
const CONFIG = {
    videoTemplatesBase: './VideoTemplates/style 1',
    supportedVideoFormats: ['.mp4', '.mov', '.avi']
};

console.log('🔍 === PATH RESOLUTION DEBUG ===\n');

console.log(`📂 Current working directory: ${process.cwd()}`);
console.log(`📋 CONFIG.videoTemplatesBase: "${CONFIG.videoTemplatesBase}"`);

// Test path.join exactly like calculateVideoStructure does
const introFolder = path.join(CONFIG.videoTemplatesBase, 'Intro');
const loopFolder = path.join(CONFIG.videoTemplatesBase, 'Loop');
const endFolder = path.join(CONFIG.videoTemplatesBase, 'End');

console.log(`\n🎯 Path.join results:`);
console.log(`   introFolder: "${introFolder}"`);
console.log(`   loopFolder: "${loopFolder}"`);
console.log(`   endFolder: "${endFolder}"`);

console.log(`\n✅ Existence checks:`);
console.log(`   introFolder exists: ${fs.existsSync(introFolder)}`);
console.log(`   loopFolder exists: ${fs.existsSync(loopFolder)}`);
console.log(`   endFolder exists: ${fs.existsSync(endFolder)}`);

// Test absolute resolution
console.log(`\n📍 Absolute paths:`);
console.log(`   introFolder absolute: "${path.resolve(introFolder)}"`);
console.log(`   loopFolder absolute: "${path.resolve(loopFolder)}"`);
console.log(`   endFolder absolute: "${path.resolve(endFolder)}"`);

// Test what happens if we remove the ./ prefix
const CONFIG_NO_DOT = {
    videoTemplatesBase: 'VideoTemplates/style 1'
};

const introFolder2 = path.join(CONFIG_NO_DOT.videoTemplatesBase, 'Intro');
const loopFolder2 = path.join(CONFIG_NO_DOT.videoTemplatesBase, 'Loop'); 
const endFolder2 = path.join(CONFIG_NO_DOT.videoTemplatesBase, 'End');

console.log(`\n🎯 Path.join without ./ prefix:`);
console.log(`   introFolder2: "${introFolder2}"`);
console.log(`   loopFolder2: "${loopFolder2}"`);
console.log(`   endFolder2: "${endFolder2}"`);

console.log(`\n✅ Existence checks (no ./ prefix):`);
console.log(`   introFolder2 exists: ${fs.existsSync(introFolder2)}`);
console.log(`   loopFolder2 exists: ${fs.existsSync(loopFolder2)}`);
console.log(`   endFolder2 exists: ${fs.existsSync(endFolder2)}`);

// Let's see if both work
if (fs.existsSync(introFolder) && fs.existsSync(introFolder2)) {
    console.log(`\n🎉 BOTH PATHS WORK!`);
} else if (fs.existsSync(introFolder)) {
    console.log(`\n✅ Only path with ./ works`);
} else if (fs.existsSync(introFolder2)) {
    console.log(`\n✅ Only path without ./ works`);
} else {
    console.log(`\n❌ NEITHER PATH WORKS!`);
}

console.log('\n================================='); 