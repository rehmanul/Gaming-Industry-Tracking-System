#!/usr/bin/env node

require('dotenv').config();
const CompanyTracker = require('./services/CompanyTracker');
const logger = require('./utils/logger');
const security = require('./middleware/security');

async function main() {
  try {
    logger.info('🚀 Starting Enhanced Gaming Industry Tracker...');

    // Initialize rate limiting
    const RateLimiter = require('./services/RateLimiter');
    const rateLimiter = new RateLimiter();

    // Configure rate limits
    rateLimiter.configure('people_data_labs', { delay: 1000, requests: 100, window: 60000 });
    rateLimiter.configure('google_sheets', { delay: 500, requests: 300, window: 60000 });
    rateLimiter.configure('web_scraping', { delay: 2000, requests: 30, window: 60000 });
    rateLimiter.configure('slack_api', { delay: 1000, requests: 50, window: 60000 });

    logger.info('🛡️ Rate limiting configured for all services');

    // Initialize analytics service
    const AnalyticsService = require('./services/AnalyticsService');
    const analytics = new AnalyticsService();

    logger.info('📊 Analytics service initialized');

    // Initialize and start the tracker
    const tracker = new CompanyTracker();

    // Set analytics service
    tracker.setAnalyticsService(analytics);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await tracker.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await tracker.cleanup();
      process.exit(0);
    });

    // Start the tracking system
    await tracker.start();

    logger.info('✅ Gaming Industry Tracker started successfully');
    logger.info('🎮 Monitoring gaming companies for new hires and job postings');

  } catch (error) {
    logger.error('❌ Failed to start enhanced tracking system:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logger.error('💥 Fatal error:', security.sanitizeLog(error.message || error));
  process.exit(1);
});
