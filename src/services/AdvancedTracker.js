const CompanyTracker = require('./CompanyTracker');
const errorHandler = require('../utils/errorHandler');
const security = require('../middleware/security');
const logger = require('../utils/logger');

class AdvancedTracker extends CompanyTracker {
    constructor() {
        super();
        this.concurrentLimit = 3;
        this.backupSheetNames = new Set();
        this.failureCount = new Map();
        this.lastSuccessfulRun = null;
    }

    async initialize() {
        return await errorHandler.withRetry(async () => {
            await super.initialize();
            this.setupHealthMonitoring();
            logger.info('🚀 Advanced tracker initialized with failure prevention');
        }, 'tracker_initialization');
    }

    setupHealthMonitoring() {
        setInterval(() => {
            this.performHealthCheck();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    async performHealthCheck() {
        try {
            const now = Date.now();
            const timeSinceLastRun = this.lastSuccessfulRun ? now - this.lastSuccessfulRun : 0;
            
            if (timeSinceLastRun > 45 * 60 * 1000) { // 45 minutes
                logger.warn('⚠️ No successful tracking run in 45 minutes');
                await this.slackService?.sendMessage('🚨 Health Alert: No successful tracking in 45 minutes');
            }
            
            // Check service connectivity
            await this.checkServiceConnectivity();
            
        } catch (error) {
            logger.error(`❌ Health check failed: ${error.message}`);
        }
    }

    async checkServiceConnectivity() {
        const checks = [
            { name: 'Google Sheets', test: () => this.sheetsService.getCompanies() },
            { name: 'Slack', test: () => this.slackService.testConnection() },
            { name: 'People Data Labs', test: () => this.hiringTracker.testConnection() }
        ];

        for (const check of checks) {
            try {
                await errorHandler.withRetry(() => check.test(), `${check.name}_connectivity`);
                logger.debug(`✅ ${check.name} connectivity OK`);
            } catch (error) {
                logger.error(`❌ ${check.name} connectivity failed: ${error.message}`);
            }
        }
    }

    async runTrackingCycle() {
        if (this.isTracking) {
            logger.warn('⚠️ Tracking already in progress, skipping');
            return;
        }

        return await errorHandler.withCircuitBreaker(async () => {
            this.isTracking = true;
            const startTime = Date.now();
            
            try {
                logger.info('🔄 Starting advanced tracking cycle...');
                
                // Load companies with retry
                await errorHandler.withRetry(() => this.loadCompanies(), 'load_companies');
                
                if (!this.companies || this.companies.length === 0) {
                    throw new Error('No companies loaded for tracking');
                }

                // Process companies in batches to prevent overwhelming APIs
                const results = await this.processBatches();
                
                this.lastSuccessfulRun = Date.now();
                const duration = (Date.now() - startTime) / 1000;
                
                logger.info(`✅ Tracking cycle completed in ${duration}s`);
                return results;
                
            } finally {
                this.isTracking = false;
            }
        }, 'tracking_cycle');
    }

    async processBatches() {
        const batches = this.createBatches(this.companies, this.concurrentLimit);
        const allResults = { newHires: [], newJobs: [] };
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            logger.info(`📋 Processing batch ${i + 1}/${batches.length} (${batch.length} companies)`);
            
            const batchPromises = batch.map(company => 
                this.processCompanyWithFallback(company)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    if (result.value.newHires) allResults.newHires.push(...result.value.newHires);
                    if (result.value.newJobs) allResults.newJobs.push(...result.value.newJobs);
                } else {
                    const company = batch[index];
                    const sanitizedName = security.sanitizeLog(company.name);
                    logger.debug(`Company ${sanitizedName} processing failed: ${result.reason?.message}`);
                }
            });
            
            // Delay between batches to prevent rate limiting
            if (i < batches.length - 1) {
                await errorHandler.delay(2000);
            }
        }
        
        return allResults;
    }

    async processCompanyWithFallback(company) {
        const sanitizedName = security.sanitizeLog(company.name);
        
        try {
            return await errorHandler.withRetry(async () => {
                logger.info(`🏢 Processing ${sanitizedName}`);
                
                const results = { newHires: [], newJobs: [] };
                
                // Track hiring with fallback
                if (company.trackHiring) {
                    try {
                        const hires = await this.hiringTracker.trackCompany(company);
                        if (hires && hires.length > 0) {
                            results.newHires = hires;
                            await this.processNewHires(company, hires);
                        }
                    } catch (error) {
                        const errorInfo = errorHandler.handleApiError(error, `hiring_${sanitizedName}`);
                        if (errorInfo.shouldRetry) {
                            await errorHandler.delay(errorInfo.delay);
                            throw error; // Will be retried by withRetry
                        }
                        logger.debug(`Hiring tracking failed for ${sanitizedName}: ${error.message}`);
                    }
                }
                
                // Track jobs with fallback
                if (company.trackJobs) {
                    try {
                        const jobs = await this.jobTracker.trackCompany(company);
                        if (jobs && jobs.length > 0) {
                            results.newJobs = jobs;
                            await this.processNewJobs(company, jobs);
                        }
                    } catch (error) {
                        const errorInfo = errorHandler.handleApiError(error, `jobs_${sanitizedName}`);
                        if (errorInfo.shouldRetry) {
                            await errorHandler.delay(errorInfo.delay);
                            throw error; // Will be retried by withRetry
                        }
                        logger.debug(`Job tracking failed for ${sanitizedName}: ${error.message}`);
                    }
                }
                
                // Add delay based on priority
                const delay = this.getDelayForPriority(company.priority);
                await errorHandler.delay(delay);
                
                return results;
                
            }, `company_${sanitizedName}`);
            
        } catch (error) {
            this.recordCompanyFailure(company.name);
            throw error;
        }
    }

    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    getDelayForPriority(priority) {
        switch (priority?.toLowerCase()) {
            case 'high': return 2000;
            case 'medium': return 3000;
            case 'low': return 4000;
            default: return 3000;
        }
    }

    recordCompanyFailure(companyName) {
        const sanitizedName = security.sanitizeLog(companyName);
        const count = this.failureCount.get(sanitizedName) || 0;
        this.failureCount.set(sanitizedName, count + 1);
        
        if (count >= 3) {
            logger.warn(`⚠️ Company ${sanitizedName} has failed ${count + 1} times`);
        }
    }

    async safeBackupAndReset() {
        return await errorHandler.withRetry(async () => {
            const timestamp = new Date().toISOString().split('T')[0];
            const hiresBackupName = `Hires_Backup_${timestamp}`;
            const jobsBackupName = `Jobs_Backup_${timestamp}`;
            
            // Check if backup sheets already exist
            if (this.backupSheetNames.has(hiresBackupName)) {
                // Use timestamp with time for uniqueness
                const fullTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uniqueHiresName = `Hires_Backup_${fullTimestamp}`;
                const uniqueJobsName = `Jobs_Backup_${fullTimestamp}`;
                
                await this.sheetsService.backupAndReset(uniqueHiresName, uniqueJobsName);
                this.backupSheetNames.add(uniqueHiresName);
                this.backupSheetNames.add(uniqueJobsName);
            } else {
                await this.sheetsService.backupAndReset(hiresBackupName, jobsBackupName);
                this.backupSheetNames.add(hiresBackupName);
                this.backupSheetNames.add(jobsBackupName);
            }
            
            logger.info('📦 Safe backup and reset completed');
        }, 'backup_and_reset');
    }

    getAdvancedStats() {
        const baseStats = this.getStats();
        return {
            ...baseStats,
            lastSuccessfulRun: this.lastSuccessfulRun,
            failureCount: Object.fromEntries(this.failureCount),
            circuitBreakerStates: errorHandler.circuits ? Object.fromEntries(errorHandler.circuits) : {},
            healthStatus: this.getHealthStatus()
        };
    }

    getHealthStatus() {
        const now = Date.now();
        const timeSinceLastRun = this.lastSuccessfulRun ? now - this.lastSuccessfulRun : Infinity;
        
        if (timeSinceLastRun < 30 * 60 * 1000) return 'healthy';
        if (timeSinceLastRun < 60 * 60 * 1000) return 'warning';
        return 'critical';
    }
}

module.exports = AdvancedTracker;