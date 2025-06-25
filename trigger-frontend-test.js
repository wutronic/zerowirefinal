const fetch = require('node-fetch');

async function triggerFrontendTest() {
    console.log('🧪 Triggering frontend video generation to debug working directory...\n');
    
    const testText = "This is a test video to debug the working directory issue.";
    
    try {
        console.log('📤 Sending POST request to frontend API...');
        const response = await fetch('http://localhost:3000/api/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: testText,
                splitScreenEnabled: false,
                debugMode: true
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ API Response:', result);
        } else {
            console.error('❌ API Error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        console.log('\n💡 Make sure the frontend is running on http://localhost:3000');
        console.log('Run: cd frontend && npm run dev');
    }
}

// Check if node-fetch is available, if not suggest installation
try {
    require('node-fetch');
    triggerFrontendTest();
} catch (error) {
    console.log('📦 Installing node-fetch...');
    const { execSync } = require('child_process');
    try {
        execSync('npm install node-fetch@2', { stdio: 'inherit' });
        const fetch = require('node-fetch');
        triggerFrontendTest();
    } catch (installError) {
        console.error('❌ Failed to install node-fetch');
        console.log('\n🔧 Manual alternative:');
        console.log('1. Install: npm install node-fetch@2');
        console.log('2. Run: node trigger-frontend-test.js');
    }
} 