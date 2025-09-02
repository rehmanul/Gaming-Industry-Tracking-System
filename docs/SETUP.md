# 🚀 Gaming Company Tracker - Setup Guide

## Step-by-Step Setup Instructions

### 1. System Requirements
- Node.js 18+ (recommended: 20+)
- npm 9+
- 2GB RAM minimum
- 1GB disk space
- Stable internet connection

### 2. People Data Labs Setup
1. Go to [peopledatalabs.com](https://www.peopledatalabs.com)
2. Sign up for an account
3. Navigate to API section
4. Generate 2 API keys (recommended for rate limiting)
5. Note your monthly credit limit

### 3. Google Cloud Setup
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "Gaming Company Tracker"
3. Enable Google Sheets API
4. Go to IAM & Admin > Service Accounts
5. Create service account: "company-tracker"
6. Download JSON key file as `credentials.json`
7. Place file in project root directory

### 4. Google Sheet Preparation
1. Open your existing Google Sheet with gaming companies
2. Share sheet with service account email (from credentials.json)
3. Grant "Editor" permissions
4. Verify column structure matches documentation
5. Ensure companies have TRUE/FALSE in tracking columns

### 5. Slack Bot Setup
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" > "From scratch"
3. Name: "Gaming Company Tracker"
4. Select your workspace
5. Go to OAuth & Permissions
6. Add Bot Token Scopes:
   - `chat:write`
   - `channels:read`
7. Install app to workspace
8. Copy Bot User OAuth Token (starts with xoxb-)
9. Get channel ID where you want notifications

### 6. Email Setup (Optional)
1. Use Gmail account with 2-factor authentication
2. Go to Google Account settings
3. Security > 2-Step Verification > App passwords
4. Generate app password for "Mail"
5. Use this 16-character password (not your regular password)

### 7. Environment Configuration
1. Copy `.env.template` to `.env`
2. Fill in all required values
3. Test configuration with sample run
4. Verify all services connect successfully

### 8. First Run
```bash
# Install dependencies
npm install

# Test configuration
npm run dev

# Check logs for any errors
tail -f logs/combined.log
```

### 9. Production Deployment
```bash
# PM2 (recommended)
npm run pm2:start

# Docker
docker-compose up -d

# Manual
npm start
```

### 10. Monitoring Setup
- Set up log rotation
- Configure system monitoring
- Set up backup for configuration files
- Monitor API usage and limits

## Common Setup Issues

### Google Sheets Access Denied
- Ensure service account email is shared with sheet
- Check that credentials.json is in correct location
- Verify Google Sheets API is enabled

### People Data Labs Rate Limits
- Use 2 API keys for better rate limiting
- Monitor your credit usage
- Adjust delays if needed

### Slack Notifications Not Working
- Verify bot token is correct
- Ensure bot is invited to channel
- Check bot permissions

### Puppeteer Issues
- Install Chrome dependencies on Linux
- Use Docker for consistent environment
- Allocate sufficient memory

## Next Steps
1. Monitor first few cycles
2. Adjust company priorities as needed
3. Fine-tune notification preferences
4. Set up backup and monitoring
5. Scale as needed