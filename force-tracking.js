require('dotenv').config();
const CompanyTracker = require('./src/services/CompanyTracker');
const logger = require('./src/utils/logger');

async function forceTracking() {
  try {
    logger.info('🚀 Starting FORCED tracking cycle for real data...');
    
    const tracker = new CompanyTracker();
    await tracker.initialize();
    
    // Force immediate tracking cycle
    const results = await tracker.runTrackingCycle();
    
    logger.info('📊 TRACKING RESULTS:');
    logger.info(`✅ New Hires Found: ${results.newHires.length}`);
    logger.info(`✅ New Jobs Found: ${results.newJobs.length}`);
    logger.info(`❌ Errors: ${results.errors.length}`);
    
    if (results.newHires.length > 0) {
      logger.info('🎯 NEW HIRES DETECTED:');
      results.newHires.forEach((hire, i) => {
        logger.info(`${i+1}. ${hire.name} → ${hire.title} at ${hire.companyName}`);
      });
    }
    
    if (results.newJobs.length > 0) {
      logger.info('💼 NEW JOBS DETECTED:');
      results.newJobs.forEach((job, i) => {
        logger.info(`${i+1}. ${job.title} at ${job.companyName} (${job.location})`);
      });
    }
    
    await tracker.cleanup();
    
  } catch (error) {
    logger.error('❌ Force tracking failed:', error);
  }
}

forceTracking();