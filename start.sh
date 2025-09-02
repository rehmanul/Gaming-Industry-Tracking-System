#!/bin/bash
set -e
echo "🚀 Starting Gaming Company Tracker on Render..."
echo "NODE_ENV=${NODE_ENV} PORT=${PORT:-10000}"
# Optional: verify Chromium presence
if [ -x /usr/bin/chromium ]; then echo "✅ Chromium present"; else echo "⚠️ Chromium not found"; fi
exec node src/app.js
