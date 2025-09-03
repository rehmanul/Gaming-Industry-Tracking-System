require('dotenv').config();
const GoogleSheetsService = require('./src/services/GoogleSheetsService');
const logger = require('./src/utils/logger');

async function testSheetConnection() {
  try {
    logger.info('🧪 Testing Google Sheets connection...');
    
    const sheetsService = new GoogleSheetsService();
    await sheetsService.initialize();
    
    const companies = await sheetsService.getCompanies();
    
    logger.info(`✅ Successfully loaded ${companies.length} companies:`);
    companies.forEach((company, index) => {
      logger.info(`${index + 1}. ${company.name} - Priority: ${company.priority} - Hiring: ${company.trackHiring} - Jobs: ${company.trackJobs}`);
    });
    
    if (companies.length === 0) {
      logger.warn('⚠️ No companies found. Please check your Google Sheet format.');
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testSheetConnection();