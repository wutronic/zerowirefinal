#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VIDEO_TEMPLATES_BASE = path.join(PROJECT_ROOT, 'VideoTemplates/style 1');
const CACHE_FILE_PATH = path.join(__dirname, 'template-cache.json');
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi'];

async function getMediaDuration(filePath) {
    try {
        const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
        return parseFloat(stdout.trim());
    } catch (error) {
        console.error(`Error getting duration for ${filePath}:`, error.message);
        return 0;
    }
}

async function scanDirectory(directoryPath, category) {
    const results = [];
    if (!fs.existsSync(directoryPath)) {
        console.warn(`⚠️ Directory not found, skipping: ${directoryPath}`);
        return results;
    }

    const files = fs.readdirSync(directoryPath)
        .filter(file => SUPPORTED_VIDEO_FORMATS.some(ext => file.toLowerCase().endsWith(ext)))
        .filter(file => !file.startsWith('.'));

    for (const file of files) {
        const fullPath = path.join(directoryPath, file);
        const relativePath = path.relative(PROJECT_ROOT, fullPath);
        console.log(`🔎 Processing ${category}: ${relativePath}`);
        const duration = await getMediaDuration(fullPath);
        if (duration > 0) {
            results.push({ file: relativePath, duration });
        }
    }
    return results;
}

async function generateCache() {
    console.log('🚀 Starting video template cache generation...');
    const cache = {
        intro: [],
        loop: [],
        end: []
    };

    cache.intro = await scanDirectory(path.join(VIDEO_TEMPLATES_BASE, 'Intro'), 'intro');
    cache.loop = await scanDirectory(path.join(VIDEO_TEMPLATES_BASE, 'Loop'), 'loop');
    cache.end = await scanDirectory(path.join(VIDEO_TEMPLATES_BASE, 'End'), 'end');

    try {
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
        console.log(`✅ Successfully generated cache file at: ${CACHE_FILE_PATH}`);
        console.log(`📊 Summary: Found ${cache.intro.length} intros, ${cache.loop.length} loops, and ${cache.end.length} end clips.`);
    } catch (error) {
        console.error(`❌ Failed to write cache file:`, error.message);
    }
}

if (require.main === module) {
    generateCache();
} 