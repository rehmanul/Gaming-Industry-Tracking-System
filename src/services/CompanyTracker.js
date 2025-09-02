const cron = require('node-cron');
const HiringTracker = require('./HiringTracker');
const JobPostingTracker = require('./JobPostingTracker');
const GoogleSheetsService = require('./GoogleSheetsService');
const SlackService = require('./SlackService');
const EmailService = require('./EmailService');
const logger = require('../utils/logger');

class CompanyTracker {
  constructor() {
    this.hiringTracker = new HiringTracker();
    this.jobTracker = new JobPostingTracker();
    this.sheetsService = new GoogleSheetsService();
    this.slackService = new SlackService();
    this.emailService = new EmailService();
    this.companies = [];
    this.isRunning = false;
    this.stats = {
      totalHires: 0,
      totalJobs: 0,
      lastRun: null,
      errors: 0,
      startTime: new Date().toISOString()
    };
    this.scheduledJobs = [];
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

    this.isRunning = true;

    // Send startup notification
    await this.sendStartupNotification();

    // Initial run
    logger.info('🏃‍♂️ Starting initial tracking cycle...');
    await this.runTrackingCycle();

    // Schedule regular checks every 30 minutes
    const trackingJob = cron.schedule('*/30 * * * *', async () => {
      if (this.isRunning) {
        await this.runTrackingCycle();
      }
    });
    this.scheduledJobs.push(trackingJob);

    // Reload companies every 4 hours
    const reloadJob = cron.schedule('0 */4 * * *', async () => {
      if (this.isRunning) {
        await this.loadCompanies();
      }
    });
    this.scheduledJobs.push(reloadJob);

    // Send daily summary at 9 AM
    const summaryJob = cron.schedule('0 9 * * *', async () => {
      if (this.isRunning) {
        await this.sendDailySummary();
      }
    });
    this.scheduledJobs.push(summaryJob);

    // Health check every 5 minutes
    const healthJob = cron.schedule('*/5 * * *', async () => {
      if (this.isRunning) {
        await this.performHealthCheck();
      }
    });
    this.scheduledJobs.push(healthJob);

    logger.info('⏰ Scheduled jobs started:');
    logger.info('  - Tracking cycle: Every 30 minutes');
    logger.info('  - Company reload: Every 4 hours');  
    logger.info('  - Daily summary: 9:00 AM');
    logger.info('  - Health check: Every 5 minutes');
  }

  async runTrackingCycle() {
    if (!this.isRunning) return;

    logger.info('🔄 Starting tracking cycle...');
    this.stats.lastRun = new Date().toISOString();

    const results = {
      newHires: [],
      newJobs: [],
      errors: []
    };

    // Sort companies by priority
    const priorityCompanies = this.companies.filter(c => c.priority?.toLowerCase() === 'high');
    const mediumCompanies = this.companies.filter(c => c.priority?.toLowerCase() === 'medium');
    const lowCompanies = this.companies.filter(c => c.priority?.toLowerCase() === 'low');

    const sortedCompanies = [...priorityCompanies, ...mediumCompanies, ...lowCompanies];

    logger.info(`📋 Processing ${sortedCompanies.length} companies (${priorityCompanies.length} high priority)`);

    // Process companies in order of priority
    for (let i = 0; i < sortedCompanies.length; i++) {
      const company = sortedCompanies[i];

      if (!this.isRunning) break; // Check if system was stopped

      try {
        logger.info(`🏢 [${i + 1}/${sortedCompanies.length}] Processing ${company.name} (Priority: ${company.priority})`);

        const startTime = Date.now();

        // Track new hires if enabled
        if (company.trackHiring) {
          logger.debug(`🎯 Tracking hires for ${company.name}...`);
          const newHires = await this.hiringTracker.trackCompany(company);
          if (newHires.length > 0) {
            results.newHires.push(...newHires.map(hire => ({ ...hire, companyName: company.name })));
            await this.processNewHires(company, newHires);
          }
        }

        // Track new job postings if enabled
        if (company.trackJobs) {
          logger.debug(`💼 Tracking jobs for ${company.name}...`);
          const newJobs = await this.jobTracker.trackCompany(company);
          if (newJobs.length > 0) {
            results.newJobs.push(...newJobs.map(job => ({ ...job, companyName: company.name })));
            await this.processNewJobs(company, newJobs);
          }
        }

        const elapsed = Date.now() - startTime;
        logger.debug(`⏱️ ${company.name} processed in ${elapsed}ms`);

        // Progressive delay based on priority and position in queue
        const delay = company.priority?.toLowerCase() === 'high' ? 3000 : 5000;
        await this.delay(delay);

      } catch (error) {
        logger.error(`❌ Error tracking company ${company.name}:`, error);
        results.errors.push({ 
          company: company.name, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
        this.stats.errors++;
      }
    }

    // Update statistics
    this.stats.totalHires += results.newHires.length;
    this.stats.totalJobs += results.newJobs.length;

    const summary = `✅ Cycle complete: ${results.newHires.length} new hires, ${results.newJobs.length} new jobs, ${results.errors.length} errors`;
    logger.info(summary);

    // Send cycle summary for significant updates
    if (results.newHires.length > 3 || results.newJobs.length > 5) {
      await this.sendCycleSummary(results);
    }

    return results;
  }

  async processNewHires(company, hires) {
    for (const hire of hires) {
      try {
        // Update Google Sheets
        await this.sheetsService.addHire(company, hire);

        // Send Slack notification
        await this.slackService.sendHireNotification(company, hire);

        // Send email notification for high priority companies
        if (company.priority?.toLowerCase() === 'high') {
          await this.emailService.sendHireNotification(company, hire);
        }

        await this.delay(1500); // Rate limiting

      } catch (error) {
        logger.error(`❌ Failed to process hire ${hire.name} for ${company.name}:`, error);
      }
    }
  }

  async processNewJobs(company, jobs) {
    for (const job of jobs) {
      try {
        // Update Google Sheets
        await this.sheetsService.addJob(company, job);

        // Send Slack notification
        await this.slackService.sendJobNotification(company, job);

        // Send email notification for high priority companies
        if (company.priority?.toLowerCase() === 'high') {
          await this.emailService.sendJobNotification(company, job);
        }

        await this.delay(1500); // Rate limiting

      } catch (error) {
        logger.error(`❌ Failed to process job ${job.title} for ${company.name}:`, error);
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