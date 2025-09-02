#!/bin/bash
set -e
echo "🚀 Starting Gaming Company Tracker on Render..."
echo "NODE_ENV=${NODE_ENV} PORT=${PORT:-10000}"

# Verify Chromium presence for Puppeteer
if [ -x /usr/bin/chromium ]; then 
  echo "✅ Chromium found at /usr/bin/chromium"
  export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
else 
  echo "⚠️ Chromium not found - Puppeteer may fail"
fi

# Set Puppeteer to skip download since we use system Chromium
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Start the application
echo "🎮 Starting Gaming Industry Tracker..."
exec node src/app.js
