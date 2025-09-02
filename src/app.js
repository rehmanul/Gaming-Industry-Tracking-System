require('dotenv').config();
const CompanyTracker = require('./services/CompanyTracker');
const CacheService = require('./services/CacheService');
const RateLimiter = require('./services/RateLimiter');
const AnalyticsService = require('./services/AnalyticsService');
const logger = require('./utils/logger');

// Global services
const cache = new CacheService();
const rateLimiter = new RateLimiter();
const analytics = new AnalyticsService();

async function main() {
  logger.info('🚀 Starting Enhanced Gaming Industry Tracker...');
  
  // Initialize services
  setupRateLimiting();
  setupAnalytics();
  
  const tracker = new CompanyTracker();
  
  // Inject enhanced services
  tracker.cache = cache;
  tracker.rateLimiter = rateLimiter;
  tracker.analytics = analytics;

  // Enhanced graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      // Stop tracker
      await tracker.cleanup();
      
      // Export analytics before shutdown
      if (analytics.metrics.hires.length > 0 || analytics.metrics.jobs.length > 0) {
        logger.info('📊 Exporting analytics data before shutdown...');
        await analytics.exportData('json');
      }
      
      // Clear cache
      cache.clear();
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  try {
    // Initialize and start the tracking system
    const startTime = Date.now();
    
    await tracker.initialize();
    await tracker.start();
    
    const initTime = Date.now() - startTime;
    analytics.recordPerformance('system_startup', initTime, true, {
      companies: tracker.companies?.length || 0
    });

    logger.info('🎮 Enhanced Gaming Company Tracking System is running!');
    logger.info(`⚡ Startup completed in ${initTime}ms`);
    logger.info('📊 Analytics and caching enabled');
    logger.info('🛡️ Rate limiting configured');
    logger.info('💡 Press Ctrl+C to stop.');

    // Enhanced health checks with analytics
    setInterval(async () => {
      try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        // Record system health metrics
        analytics.recordPerformance('health_check', 0, true, {
          memory: memUsage,
          uptime,
          cacheSize: cache.getStats().size,
          companiesLoaded: tracker.companies?.length || 0
        });
        
        logger.debug(`💓 System health - Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, Uptime: ${Math.floor(uptime / 60)}m`);
        
        // Cleanup old data every hour
        if (Math.floor(uptime) % 3600 === 0) {
          cache.cleanup();
          analytics.cleanup();
          rateLimiter.cleanup();
        }
        
      } catch (error) {
        logger.error('❌ Health check error:', error);
        analytics.recordError(null, error, { context: 'health_check' });
      }
    }, 300000); // Every 5 minutes

    // Daily analytics export
    setInterval(async () => {
      try {
        logger.info('📊 Generating daily analytics export...');
        await analytics.exportData('json');
        logger.info('✅ Daily analytics exported successfully');
      } catch (error) {
        logger.error('❌ Daily export failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Every 24 hours

  } catch (error) {
    logger.error('❌ Failed to start enhanced tracking system:', error);
    analytics.recordError(null, error, { context: 'system_startup' });
    process.exit(1);
  }
}

function setupRateLimiting() {
  // Configure rate limits for different services
  rateLimiter.configure('people_data_labs', {
    requests: 100,
    window: 60000, // 1 minute
    delay: 1000     // 1 second between requests
  });
  
  rateLimiter.configure('google_sheets', {
    requests: 300,
    window: 60000,
    delay: 500
  });
  
  rateLimiter.configure('web_scraping', {
    requests: 30,
    window: 60000,
    delay: 2000
  });
  
  rateLimiter.configure('slack_api', {
    requests: 50,
    window: 60000,
    delay: 1000
  });
  
  logger.info('🛡️ Rate limiting configured for all services');
}

function setupAnalytics() {
  // Analytics is ready to use
  logger.info('📊 Analytics service initialized');
}

// Enhanced error handling with analytics
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  
  if (analytics) {
    analytics.recordError(null, new Error(reason), { 
      context: 'unhandled_rejection',
      promise: promise.toString()
    });
  }
  
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', error);
  
  if (analytics) {
    analytics.recordError(null, error, { context: 'uncaught_exception' });
  }
  
  process.exit(1);
});

main();