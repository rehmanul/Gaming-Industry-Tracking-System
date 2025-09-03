const cron = require('node-cron');
const HiringTracker = require('./HiringTracker');
const JobPostingTracker = require('./JobPostingTracker');
const OnboardingTracker = require('./OnboardingTracker');
const GoogleSheetsService = require('./GoogleSheetsService');
const SlackService = require('./SlackService');
const EmailService = require('./EmailService');
const DataEnhancer = require('../utils/dataEnhancer');
const logger = require('../utils/logger');
const security = require('../middleware/security');
const MonitoringService = require('./MonitoringService');
const IntelligenceService = require('./IntelligenceService');
const CacheService = require('./CacheService');

class CompanyTracker {
  constructor() {
    this.hiringTracker = new HiringTracker();
    this.jobTracker = new JobPostingTracker();
    this.onboardingTracker = new OnboardingTracker();
    this.sheetsService = new GoogleSheetsService();
    this.slackService = new SlackService();
    this.emailService = new EmailService();
    this.monitoring = new MonitoringService();
    this.intelligence = new IntelligenceService();
    this.cache = new CacheService();
    this.companies = [];
    this.isRunning = false;
    this.isTracking = false;
    this.stats = {
      totalHires: 0,
      totalJobs: 0,
      lastRun: null,
      errors: 0,
      startTime: new Date().toISOString()
    };
    this.scheduledJobs = [];
    this.setupMonitoring();
  }

  setupMonitoring() {
    this.monitoring.on('alert_created', (alert) => {
      logger.warn(`🚨 Alert: ${alert.message}`);
      if (alert.severity === 'critical') {
        this.slackService.sendSystemNotification('Critical Alert', alert.message, 'error');
      }
    });
  }

  setAnalyticsService(analyticsService) {
    this.analyticsService = analyticsService;
  }

  getServices() {
    return {
      monitoring: this.monitoring,
      intelligence: this.intelligence,
      cache: this.cache,
      companyTracker: this
    };
  }

  getCompanies() {
    return this.companies;
  }

  isValidCronExpression(expression) {
    if (!expression || typeof expression !== 'string') {
      return false;
    }

    // Basic cron expression validation (supports standard and additional formats)
    const cronPattern = /^(?:\*(?:\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?(?:,\d+(?:-\d+)?(?:\/\d+)?)*)(?:\s+(?:\*(?:\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?(?:,\d+(?:-\d+)?(?:\/\d+)?)*)){4,5}\s*$/;
    return cronPattern.test(expression.trim());
  }

  async initialize() {
    logger.info('🚀 Initializing Gaming Company Tracking System...');

    try {
      // Initialize all services
      await this.sheetsService.initialize();
      await this.slackService.initialize();
      await this.emailService.initialize();

      // Inject dependencies
      this.hiringTracker.setGoogleSheetsService(this.sheetsService);
      this.jobTracker.setGoogleSheetsService(this.sheetsService);
      this.onboardingTracker.setGoogleSheetsService(this.sheetsService);

      // Load companies from Google Sheets
      await this.loadCompanies();

      const hiringCompanies = this.companies.filter(c => c.trackHiring).length;
      const jobCompanies = this.companies.filter(c => c.trackJobs).length;

      logger.info(`🎮 Loaded ${this.companies.length} gaming companies for tracking`);
      logger.info(`📊 - ${hiringCompanies} companies tracking hires`);
      logger.info(`💼 - ${jobCompanies} companies tracking jobs`);

    } catch (error) {
      logger.error('❌ Failed to initialize tracking system:', error);
      throw error;
    }
  }

  async loadCompanies() {
    try {
      this.companies = await this.sheetsService.getCompanies();
      logger.info(`🔄 Reloaded ${this.companies.length} companies`);
    } catch (error) {
      logger.error('❌ Failed to load companies:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ System already running');
      return;
    }

    // Initialize first
    await this.initialize();
    
    this.isRunning = true;

    // Send startup notification
    await this.sendStartupNotification();

    // Initial run
    logger.info('🏃‍♂️ Starting initial tracking cycle...');
    await this.runTrackingCycle();

    try {
      // Define cron expressions with validation
      const cronExpressions = {
        tracking: process.env.TRACKING_CRON || '*/30 * * * *',
        reload: process.env.RELOAD_CRON || '0 */4 * * *',
        summary: process.env.SUMMARY_CRON || '0 9 * * *',
        health: process.env.HEALTH_CRON || '*/5 * * * *'
      };

      // Validate cron expressions
      for (const [name, expression] of Object.entries(cronExpressions)) {
        if (!expression || typeof expression !== 'string') {
          throw new Error(`Invalid cron expression for ${name}: ${expression}`);
        }
        if (!this.isValidCronExpression(expression)) {
          throw new Error(`Invalid cron format for ${name}: ${expression}`);
        }
      }

      // Schedule regular checks every 30 minutes
      const trackingJob = cron.schedule(cronExpressions.tracking, async () => {
        if (this.isRunning) {
          await this.runTrackingCycle();
        }
      });
      this.scheduledJobs.push(trackingJob);

      // Reload companies every 4 hours
      const reloadJob = cron.schedule(cronExpressions.reload, async () => {
        if (this.isRunning) {
          await this.loadCompanies();
        }
      });
      this.scheduledJobs.push(reloadJob);

      // Send daily summary at 9 AM
      const summaryJob = cron.schedule(cronExpressions.summary, async () => {
        if (this.isRunning) {
          await this.sendDailySummary();
        }
      });
      this.scheduledJobs.push(summaryJob);

      // Health check every 5 minutes
      const healthJob = cron.schedule(cronExpressions.health, async () => {
        if (this.isRunning) {
          await this.performHealthCheck();
        }
      });
      this.scheduledJobs.push(healthJob);

      logger.info('⏰ Scheduled jobs started:');
      logger.info(`  - Tracking cycle: ${cronExpressions.tracking}`);
      logger.info(`  - Company reload: ${cronExpressions.reload}`);
      logger.info(`  - Daily summary: ${cronExpressions.summary}`);
      logger.info(`  - Health check: ${cronExpressions.health}`);

    } catch (error) {
      logger.error('❌ Failed to start scheduled jobs:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async runTrackingCycle() {
    if (this.isTracking) {
      logger.warn('⚠️ Tracking already in progress');
      return { newHires: [], newJobs: [], errors: [] };
    }

    this.isTracking = true;
    logger.info('🔄 Starting tracking cycle...');
    this.stats.lastRun = new Date().toISOString();

    const results = {
      newHires: [],
      newJobs: [],
      errors: []
    };

    try {
      if (this.companies.length === 0) {
        logger.warn('⚠️ No companies loaded for tracking');
        return results;
      }

      const sortedCompanies = this.companies.filter(c => c.trackHiring || c.trackJobs);
      logger.info(`📋 Processing ${sortedCompanies.length} companies`);

      for (let i = 0; i < sortedCompanies.length; i++) {
        const company = sortedCompanies[i];

        try {
          logger.info(`🏢 [${i + 1}/${sortedCompanies.length}] Processing ${security.sanitizeLog(company.name)}`);

          if (company.trackHiring) {
            const newHires = await this.hiringTracker.trackCompany(company);
            if (newHires.length > 0) {
              results.newHires.push(...newHires.map(hire => ({ ...hire, companyName: company.name })));
              await this.processNewHires(company, newHires);
            }
            
            // Track onboarding announcements
            const onboardingAnnouncements = await this.onboardingTracker.trackNewOnboarding(company);
            if (onboardingAnnouncements.length > 0) {
              results.newHires.push(...onboardingAnnouncements.map(hire => ({ ...hire, companyName: company.name })));
              await this.processNewHires(company, onboardingAnnouncements);
            }
          }

          if (company.trackJobs) {
            const newJobs = await this.jobTracker.trackCompany(company);
            if (newJobs.length > 0) {
              results.newJobs.push(...newJobs.map(job => ({ ...job, companyName: company.name })));
              await this.processNewJobs(company, newJobs);
            }
          }

          await this.delay(3000);

        } catch (error) {
          logger.error(`❌ Error tracking company ${security.sanitizeLog(company.name)}:`, error);
          results.errors.push({
            company: company.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          this.stats.errors++;
        }
      }

      this.stats.totalHires += results.newHires.length;
      this.stats.totalJobs += results.newJobs.length;

      logger.info(`✅ Cycle complete: ${results.newHires.length} new hires, ${results.newJobs.length} new jobs, ${results.errors.length} errors`);

    } finally {
      this.isTracking = false;
    }

    return results;
  }

  async runHistoricalTracking(startDate) {
    this.isTracking = true;
    logger.info(`📅 Starting historical tracking from ${startDate}`);

    const results = {
      newHires: [],
      newJobs: [],
      errors: []
    };

    try {
      const sortedCompanies = this.companies.filter(c => c.trackHiring || c.trackJobs);
      
      for (let i = 0; i < sortedCompanies.length; i++) {
        const company = sortedCompanies[i];
        logger.info(`🏢 [${i + 1}/${sortedCompanies.length}] Historical tracking for ${security.sanitizeLog(company.name)}`);

        try {
          if (company.trackHiring) {
            const hires = await this.hiringTracker.searchHistoricalHires(company, startDate);
            if (hires.length > 0) {
              results.newHires.push(...hires);
              await this.processNewHires(company, hires);
            }
          }

          if (company.trackJobs) {
            const jobs = await this.jobTracker.searchHistoricalJobs(company, startDate);
            if (jobs.length > 0) {
              results.newJobs.push(...jobs);
              await this.processNewJobs(company, jobs);
            }
          }

          await this.delay(5000);
        } catch (error) {
          logger.error(`❌ Historical tracking error for ${security.sanitizeLog(company.name)}:`, error);
          results.errors.push({ company: company.name, error: error.message });
        }
      }

      logger.info(`✅ Historical tracking complete: ${results.newHires.length} hires, ${results.newJobs.length} jobs`);
    } finally {
      this.isTracking = false;
    }

    return results;
  }

  async processNewHires(company, hires) {
    for (const hire of hires) {
      try {
        // Enhance hire data with meaningful fallbacks
        const enhancedHire = DataEnhancer.enhanceHireData(hire);
        const validation = DataEnhancer.validateData(enhancedHire, 'hire');
        
        logger.info(`📊 Hire data completeness: ${validation.completeness}% for ${enhancedHire.name}`);
        if (validation.issues.length > 0) {
          logger.warn(`⚠️ Data issues: ${validation.issues.join(', ')}`);
        }

        // Update Google Sheets with enhanced data
        await this.sheetsService.addHire(company, enhancedHire);

        // Send Slack notification
        await this.slackService.sendHireNotification(company, enhancedHire);

        // Send email notification for high priority companies
        if (company.priority?.toLowerCase() === 'high') {
          await this.emailService.sendHireNotification(company, enhancedHire);
        }

        await this.delay(1500); // Rate limiting

      } catch (error) {
        logger.error(`❌ Failed to process hire ${security.sanitizeLog(hire.name || 'Unknown')} for ${security.sanitizeLog(company.name)}:`, error);
      }
    }
  }

  async processNewJobs(company, jobs) {
    for (const job of jobs) {
      try {
        // Enhance job data with meaningful fallbacks
        const enhancedJob = DataEnhancer.enhanceJobData(job);
        const validation = DataEnhancer.validateData(enhancedJob, 'job');
        
        logger.info(`📊 Job data completeness: ${validation.completeness}% for ${enhancedJob.title}`);
        if (validation.issues.length > 0) {
          logger.warn(`⚠️ Data issues: ${validation.issues.join(', ')}`);
        }

        // Update Google Sheets with enhanced data
        await this.sheetsService.addJob(company, enhancedJob);

        // Send Slack notification
        await this.slackService.sendJobNotification(company, enhancedJob);

        // Send email notification for high priority companies
        if (company.priority?.toLowerCase() === 'high') {
          await this.emailService.sendJobNotification(company, enhancedJob);
        }

        await this.delay(1500); // Rate limiting

      } catch (error) {
        logger.error(`❌ Failed to process job ${security.sanitizeLog(job.title || 'Unknown')} for ${security.sanitizeLog(company.name)}:`, error);
      }
    }
  }

  async sendStartupNotification() {
    const highPriorityCount = this.companies.filter(c => c.priority?.toLowerCase() === 'high').length;
    const hiringCount = this.companies.filter(c => c.trackHiring).length;
    const jobsCount = this.companies.filter(c => c.trackJobs).length;

    const message = `🎮 *Gaming Company Tracking System Started*\n\n` +
      `📊 **System Configuration:**\n` +
      `• Total Companies: ${this.companies.length}\n` +
      `• High Priority: ${highPriorityCount}\n` +
      `• Tracking Hiring: ${hiringCount}\n` +
      `• Tracking Jobs: ${jobsCount}\n\n` +
      `⏰ **Schedule:**\n` +
      `• Checks every 30 minutes\n` +
      `• Company reload every 4 hours\n` +
      `• Daily summaries at 9 AM\n\n` +
      `🚀 System is now monitoring gaming industry companies for new hires and job postings.`;

    await this.slackService.sendSystemNotification('System Startup', message, 'success');
  }

  async sendCycleSummary(results) {
    const message = `📈 **Tracking Cycle Summary**\n\n` +
      `🎯 **New Hires Found:** ${results.newHires.length}\n` +
      `💼 **New Jobs Found:** ${results.newJobs.length}\n` +
      `❌ **Errors:** ${results.errors.length}\n\n` +
      `📊 **Session Totals:**\n` +
      `• Total Hires: ${this.stats.totalHires}\n` +
      `• Total Jobs: ${this.stats.totalJobs}\n` +
      `• Total Errors: ${this.stats.errors}\n\n` +
      `⏰ Next cycle in 30 minutes`;

    await this.slackService.sendSystemNotification('Cycle Summary', message);

    // Send bulk summary if there are many findings
    if (results.newHires.length > 0 || results.newJobs.length > 0) {
      await this.slackService.sendBulkSummary(results.newHires, results.newJobs);
    }
  }

  async sendDailySummary() {
    const uptime = Math.floor((Date.now() - new Date(this.stats.startTime).getTime()) / (1000 * 60 * 60));

    const message = `📅 **Daily Summary - Gaming Industry Tracking**\n\n` +
      `📊 **System Status:** ✅ Running (${uptime}h uptime)\n` +
      `🏢 **Companies Monitored:** ${this.companies.length}\n` +
      `🕐 **Last Cycle:** ${this.stats.lastRun ? new Date(this.stats.lastRun).toLocaleString() : 'N/A'}\n\n` +
      `🎯 **Today's Results:**\n` +
      `• Hires Tracked: ${this.stats.totalHires}\n` +
      `• Jobs Tracked: ${this.stats.totalJobs}\n` +
      `• Errors: ${this.stats.errors}\n\n` +
      `💡 System continues monitoring every 30 minutes`;

    await this.slackService.sendSystemNotification('Daily Summary', message);
    await this.emailService.sendDailySummary(this.stats, this.companies.length);
  }

  async performHealthCheck() {
    const errors = [];

    // Check if we have companies loaded
    if (this.companies.length === 0) {
      errors.push('No companies loaded');
    }

    // Check last run time
    if (this.stats.lastRun) {
      const timeSinceLastRun = Date.now() - new Date(this.stats.lastRun).getTime();
      if (timeSinceLastRun > 45 * 60 * 1000) { // More than 45 minutes
        errors.push('Last run was more than 45 minutes ago');
      }
    }

    if (errors.length > 0) {
      const message = `⚠️ **Health Check Issues:**\n${errors.map(e => `• ${e}`).join('\n')}`;
      await this.slackService.sendSystemNotification('Health Check Warning', message, 'warning');
    }

    logger.debug(`💓 Health check completed - ${errors.length} issues found`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    logger.info('🛑 Stopping company tracking system...');
    this.isRunning = false;

    // Stop all scheduled jobs
    this.scheduledJobs.forEach(job => job.destroy());
    this.scheduledJobs = [];

    logger.info('✅ Company tracking system stopped');
  }

  async cleanup() {
    this.stop();
    await this.jobTracker.cleanup();
    await this.onboardingTracker.cleanup();
    logger.info('🧹 Cleanup completed');
  }

  getStats() {
    return {
      ...this.stats,
      companiesLoaded: this.companies.length,
      isRunning: this.isRunning,
      uptime: Math.floor((Date.now() - new Date(this.stats.startTime).getTime()) / 1000)
    };
  }
}

module.exports = CompanyTracker;
