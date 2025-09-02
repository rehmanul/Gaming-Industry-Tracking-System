require('dotenv').config();
const CompanyTracker = require('./services/CompanyTracker');
const logger = require('./utils/logger');

async function main() {
  const tracker = new CompanyTracker();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await tracker.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await tracker.cleanup();
    process.exit(0);
  });

  try {
    // Initialize and start the tracking system
    await tracker.initialize();
    await tracker.start();

    logger.info('🎮 Gaming Company Tracking System is running. Press Ctrl+C to stop.');

    // Keep the process alive with health checks
    setInterval(() => {
      logger.debug('💓 System health check - running');
    }, 300000); // Every 5 minutes

  } catch (error) {
    logger.error('❌ Failed to start company tracking system:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

main();