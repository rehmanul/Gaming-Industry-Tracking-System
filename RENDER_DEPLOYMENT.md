# Render Deployment Guide

## Quick Deploy to Render

### 1. Prerequisites
- GitHub repository with this code
- Render account (free tier available)
- Required API keys and credentials

### 2. Deploy Steps

1. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

2. **Configure Service**
   - **Name**: `gaming-tracker-ui`
   - **Environment**: `Docker`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Build Command**: (leave empty - Docker handles this)
   - **Start Command**: `npm run web`

3. **Environment Variables** (CRITICAL - Add these in Render dashboard)
   ```
   NODE_ENV=production
   PORT=10000
   DOCKER_ENV=true
   HEADLESS_MODE=true
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
   
   # Required API Keys (get from respective services)
   PEOPLE_DATA_LABS_API_KEY_1=your_pdl_key_here
   PEOPLE_DATA_LABS_API_KEY_2=your_second_pdl_key_here
   
   # Google Sheets (upload credentials.json as secret file)
   GOOGLE_SHEETS_CREDENTIALS_PATH=/etc/secrets/credentials.json
   GOOGLE_SHEET_ID=your_google_sheet_id_here
   
   # Slack Integration
   SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   SLACK_CHANNEL_ID=C1234567890
   
   # Optional Email Notifications
   EMAIL_USER=your.email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_RECIPIENTS=admin@company.com,alerts@company.com
   
   # Optional: Advanced Configuration
   LOG_LEVEL=info
   API_DELAY=2000
   SCRAPING_DELAY=3000
   ```

4. **Secret Files** (if using Google Sheets)
   - Upload your `credentials.json` file as a secret file
   - Set path to `/etc/secrets/credentials.json`

### 3. Health Check
- Render will automatically check `/health` endpoint
- Service should be accessible at your Render URL

### 4. Monitoring
- Check logs in Render dashboard
- Use `/status` endpoint to check tracker status
- Use web UI to start/stop tracking

## Troubleshooting

### Common Issues:

1. **Puppeteer/Chromium Issues**
   - Ensure `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
   - Check logs for Chromium installation

2. **Port Issues**
   - Render automatically sets PORT=10000
   - Don't override this in environment variables

3. **API Rate Limits**
   - Use multiple API keys for People Data Labs
   - Adjust `API_DELAY` if needed

4. **Google Sheets Access**
   - Ensure service account has access to your sheet
   - Verify credentials.json is uploaded correctly

### Log Monitoring
```bash
# Check service logs in Render dashboard
# Or use the web UI at your-service.onrender.com
```

## Web Interface Usage

Once deployed, access your web interface at:
`https://your-service-name.onrender.com`

Available endpoints:
- `/` - Web UI dashboard
- `/health` - Health check
- `/status` - Tracker status
- `/start` - Start tracking (POST)
- `/stop` - Stop tracking (POST)

## Cost Optimization

- **Free Tier**: Render provides 750 hours/month free
- **Sleep Mode**: Service sleeps after 15 minutes of inactivity
- **Upgrade**: Consider paid plan for 24/7 operation

## Security Notes

- All environment variables are encrypted
- Use secret files for sensitive data
- Regularly rotate API keys
- Monitor access logs

## Support

If you encounter issues:
1. Check Render service logs
2. Verify all environment variables are set
3. Test API keys independently
4. Check Google Sheets permissions