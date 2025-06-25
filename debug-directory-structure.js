const { calculateVideoStructure } = require('./video-editing/auto-video-generator');
const fs = require('fs');
const path = require('path');

async function debugDirectoryStructure() {
    console.log('🔍 === DIRECTORY STRUCTURE DEBUG TEST ===\n');
    
    // Show current working directory
    console.log(`📂 Current working directory: ${process.cwd()}`);
    
    // Check what exists in root
    console.log(`\n📁 Root directory contents:`);
    const rootContents = fs.readdirSync('.');
    rootContents.forEach(item => {
        const stats = fs.statSync(item);
        console.log(`   ${stats.isDirectory() ? '📁' : '📄'} ${item}`);
    });
    
    // Check VideoTemplates specifically
    if (fs.existsSync('VideoTemplates')) {
        console.log(`\n📁 VideoTemplates contents:`);
        const vtContents = fs.readdirSync('VideoTemplates');
        vtContents.forEach(item => {
            const itemPath = path.join('VideoTemplates', item);
            const stats = fs.statSync(itemPath);
            console.log(`   ${stats.isDirectory() ? '📁' : '📄'} ${item}`);
            
            // If it's a directory, show its contents
            if (stats.isDirectory()) {
                console.log(`     📂 Contents of ${item}:`);
                try {
                    const subContents = fs.readdirSync(itemPath);
                    subContents.forEach(subItem => {
                        const subPath = path.join(itemPath, subItem);
                        const subStats = fs.statSync(subPath);
                        console.log(`       ${subStats.isDirectory() ? '📁' : '📄'} ${subItem}`);
                    });
                } catch (error) {
                    console.log(`       ❌ Error reading: ${error.message}`);
                }
            }
        });
    } else {
        console.log(`❌ VideoTemplates directory not found`);
    }
    
    // Test our CONFIG paths
    console.log(`\n🎯 === TESTING CONFIG PATHS ===`);
    
    // Read the current CONFIG
    const configContent = fs.readFileSync('./video-editing/auto-video-generator.js', 'utf-8');
    const configMatch = configContent.match(/const CONFIG = \{[\s\S]*?\};/);
    if (configMatch) {
        console.log(`\n📋 Current CONFIG:`);
        console.log(configMatch[0]);
    }
    
    // Test the paths from CONFIG
    const testPaths = [
        './VideoTemplates/style 1',
        './VideoTemplates/style 1/Intro',
        './VideoTemplates/style 1/Loop', 
        './VideoTemplates/style 1/End',
        'VideoTemplates/style 1',
        'VideoTemplates/style 1/Intro',
        'VideoTemplates/style 1/Loop',
        'VideoTemplates/style 1/End'
    ];
    
    console.log(`\n🧪 Testing different path variations:`);
    testPaths.forEach(testPath => {
        const exists = fs.existsSync(testPath);
        const resolved = path.resolve(testPath);
        console.log(`   ${exists ? '✅' : '❌'} ${testPath} -> ${resolved}`);
    });
    
    // Try to trigger calculateVideoStructure to see the actual error
    console.log(`\n🎯 === TESTING calculateVideoStructure ===`);
    try {
        await calculateVideoStructure(30.0);
        console.log(`✅ calculateVideoStructure worked!`);
    } catch (error) {
        console.log(`❌ calculateVideoStructure failed: ${error.message}`);
    }
}

debugDirectoryStructure().catch(console.error); 