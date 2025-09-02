#!/usr/bin/env node

/**
 * Generate comprehensive analytics report
 */

const AnalyticsService = require('../src/services/AnalyticsService');

async function generateReport() {
  console.log('📊 Gaming Industry Tracker - Analytics Report\n');
  
  const analytics = new AnalyticsService();
  
  // Generate reports for different timeframes
  const timeframes = ['1h', '6h', '24h', '7d', '30d'];
  
  for (const timeframe of timeframes) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📈 ${timeframe.toUpperCase()} ANALYTICS REPORT`);
    console.log(`${'='.repeat(50)}\n`);
    
    const report = analytics.getAnalytics(timeframe);
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log(`  • Total Hires: ${report.summary.totalHires}`);
    console.log(`  • Total Jobs: ${report.summary.totalJobs}`);
    console.log(`  • Total Errors: ${report.summary.totalErrors}`);
    console.log(`  • Active Companies: ${report.summary.activeCompanies}`);
    
    // Top Companies
    if (report.topCompanies.length > 0) {
      console.log('\n🏢 TOP COMPANIES:');
      report.topCompanies.slice(0, 5).forEach((company, index) => {
        console.log(`  ${index + 1}. ${company.company}: ${company.total} activities (${company.hires} hires, ${company.jobs} jobs)`);
      });
    }
    
    // Departments
    if (report.departments.length > 0) {
      console.log('\n🎯 TOP DEPARTMENTS:');
      report.departments.slice(0, 5).forEach((dept, index) => {
        console.log(`  ${index + 1}. ${dept.department}: ${dept.count} activities`);
      });
    }
    
    // Performance
    if (report.performance.totalOperations > 0) {
      console.log('\n⚡ PERFORMANCE:');
      console.log(`  • Average Duration: ${report.performance.avgDuration}ms`);
      console.log(`  • Success Rate: ${report.performance.successRate}%`);
      console.log(`  • Total Operations: ${report.performance.totalOperations}`);
    }
    
    // Errors
    if (report.errors.total > 0) {
      console.log('\n❌ ERRORS:');
      console.log(`  • Total Errors: ${report.errors.total}`);
      if (report.errors.byType.length > 0) {
        console.log('  • By Type:');
        report.errors.byType.forEach(error => {
          console.log(`    - ${error.type}: ${error.count}`);
        });
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Analytics report completed');
  console.log('💡 Use --export flag to save detailed report to file');
}

// Check for export flag
if (process.argv.includes('--export')) {
  const analytics = new AnalyticsService();
  analytics.exportData('json').then(filepath => {
    console.log(`📁 Detailed report exported to: ${filepath}`);
  }).catch(error => {
    console.error('❌ Export failed:', error.message);
  });
} else {
  generateReport().catch(error => {
    console.error('❌ Report generation failed:', error.message);
    process.exit(1);
  });
}