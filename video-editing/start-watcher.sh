#!/bin/bash

# Auto Video Generator Startup Script
echo "🎬 Starting Auto Video Generator..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Activate conda environment
echo "🔄 Activating conda environment..."
source ~/anaconda3/etc/profile.d/conda.sh
conda activate sparktts

# Use Node.js v18 LTS
echo "🔄 Setting Node.js version..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

# Check dependencies
echo "🔍 Checking dependencies..."
node --version
npx editly --version

# Start the watcher
echo "🚀 Starting video generator watcher..."
node auto-video-generator.js 