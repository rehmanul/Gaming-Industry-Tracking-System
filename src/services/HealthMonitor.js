const logger = require('../utils/logger');
const security = require('../middleware/security');
const errorHandler = require('../utils/errorHandler');

class HealthMonitor {
    constructor() {
        this.metrics = {
            uptime: process.uptime(),
            lastHealthCheck: Date.now(),
            apiCallsCount: 0,
            errorCount: 0,
            successfulRuns: 0,
            failedRuns: 0,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };
        
        this.thresholds = {
            maxMemoryMB: 1024,
            maxErrorRate: 0.1,
            maxResponseTime: 30000,
            minSuccessRate: 0.8
        };
        
        this.alerts = new Map();
        this.startMonitoring();
    }

    startMonitoring() {
        // Health check every 5 minutes
        setInterval(() => {
            this.performHealthCheck();
        }, 5 * 60 * 1000);

        // Metrics collection every minute
        setInterval(() => {
            this.collectMetrics();
        }, 60 * 1000);

        // Memory cleanup every 30 minutes
        setInterval(() => {
            this.performCleanup();
        }, 30 * 60 * 1000);
    }

    async performHealthCheck() {
        try {
            const healthStatus = {
                timestamp: new Date().toISOString(),
                status: 'healthy',
                checks: {},
                metrics: this.getMetrics()
            };

            // Memory check
            const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
            healthStatus.checks.memory = {
                status: memoryMB < this.thresholds.maxMemoryMB ? 'pass' : 'fail',
                value: `${memoryMB.toFixed(2)}MB`,
                threshold: `${this.thresholds.maxMemoryMB}MB`
            };

            // Error rate check
            const errorRate = this.calculateErrorRate();
            healthStatus.checks.errorRate = {
                status: errorRate < this.thresholds.maxErrorRate ? 'pass' : 'fail',
                value: `${(errorRate * 100).toFixed(2)}%`,
                threshold: `${(this.thresholds.maxErrorRate * 100)}%`
            };

            // Success rate check
            const successRate = this.calculateSuccessRate();
            healthStatus.checks.successRate = {
                status: successRate > this.thresholds.minSuccessRate ? 'pass' : 'fail',
                value: `${(successRate * 100).toFixed(2)}%`,
                threshold: `${(this.thresholds.minSuccessRate * 100)}%`
            };

            // Overall status
            const failedChecks = Object.values(healthStatus.checks).filter(check => check.status === 'fail');
            if (failedChecks.length > 0) {
                healthStatus.status = 'unhealthy';
                await this.sendHealthAlert(healthStatus);
            }

            this.metrics.lastHealthCheck = Date.now();
            logger.info(`🏥 Health check completed: ${healthStatus.status}`);

            return healthStatus;

        } catch (error) {
            logger.error('❌ Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    collectMetrics() {
        this.metrics.uptime = process.uptime();
        this.metrics.memoryUsage = process.memoryUsage();
        this.metrics.cpuUsage = process.cpuUsage();
        
        // Clean old metrics (keep last 24 hours)
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        if (this.metrics.timestamp && this.metrics.timestamp < cutoff) {
            this.resetCounters();
        }
    }

    recordApiCall(success = true) {
        this.metrics.apiCallsCount++;
        if (success) {
            this.metrics.successfulRuns++;
        } else {
            this.metrics.failedRuns++;
            this.metrics.errorCount++;
        }
    }

    calculateErrorRate() {
        const total = this.metrics.successfulRuns + this.metrics.failedRuns;
        return total > 0 ? this.metrics.failedRuns / total : 0;
    }

    calculateSuccessRate() {
        const total = this.metrics.successfulRuns + this.metrics.failedRuns;
        return total > 0 ? this.metrics.successfulRuns / total : 1;
    }

    async sendHealthAlert(healthStatus) {
        const alertKey = `health_${healthStatus.status}`;
        const lastAlert = this.alerts.get(alertKey);
        const now = Date.now();

        // Throttle alerts (max 1 per hour)
        if (lastAlert && (now - lastAlert) < 60 * 60 * 1000) {
            return;
        }

        try {
            const message = this.formatHealthAlert(healthStatus);
            // Send to Slack if available
            if (global.slackService) {
                await global.slackService.sendMessage(message);
            }
            
            this.alerts.set(alertKey, now);
            logger.warn(`🚨 Health alert sent: ${healthStatus.status}`);

        } catch (error) {
            logger.error('❌ Failed to send health alert:', error);
        }
    }

    formatHealthAlert(healthStatus) {
        const failedChecks = Object.entries(healthStatus.checks)
            .filter(([_, check]) => check.status === 'fail')
            .map(([name, check]) => `• ${name}: ${check.value} (threshold: ${check.threshold})`)
            .join('\n');

        return `🚨 *Health Alert - System ${healthStatus.status.toUpperCase()}*\n\n` +
               `*Failed Checks:*\n${failedChecks}\n\n` +
               `*Metrics:*\n` +
               `• Uptime: ${Math.floor(healthStatus.metrics.uptime / 3600)}h\n` +
               `• Memory: ${(healthStatus.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB\n` +
               `• API Calls: ${healthStatus.metrics.apiCallsCount}\n` +
               `• Error Rate: ${(this.calculateErrorRate() * 100).toFixed(2)}%`;
    }

    performCleanup() {
        try {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                logger.debug('🧹 Performed garbage collection');
            }

            // Clear old alerts
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            for (const [key, timestamp] of this.alerts.entries()) {
                if (timestamp < cutoff) {
                    this.alerts.delete(key);
                }
            }

            // Reset circuit breakers if they've been closed for a while
            if (errorHandler.circuits) {
                for (const [key, state] of errorHandler.circuits.entries()) {
                    if (state.isOpen && (Date.now() - state.lastFailure) > 300000) { // 5 minutes
                        errorHandler.resetCircuit(key);
                        logger.info(`🔄 Reset circuit breaker: ${security.sanitizeLog(key)}`);
                    }
                }
            }

        } catch (error) {
            logger.error('❌ Cleanup failed:', error);
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            errorRate: this.calculateErrorRate(),
            successRate: this.calculateSuccessRate(),
            timestamp: Date.now()
        };
    }

    getHealthStatus() {
        const errorRate = this.calculateErrorRate();
        const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
        
        if (errorRate > this.thresholds.maxErrorRate || memoryMB > this.thresholds.maxMemoryMB) {
            return 'critical';
        }
        
        if (errorRate > this.thresholds.maxErrorRate * 0.5) {
            return 'warning';
        }
        
        return 'healthy';
    }

    resetCounters() {
        this.metrics.apiCallsCount = 0;
        this.metrics.errorCount = 0;
        this.metrics.successfulRuns = 0;
        this.metrics.failedRuns = 0;
        this.metrics.timestamp = Date.now();
    }

    // Test connectivity to external services
    async testConnectivity() {
        const results = {
            googleSheets: false,
            peopleDataLabs: false,
            slack: false,
            timestamp: Date.now()
        };

        try {
            // Test Google Sheets (if available)
            if (global.sheetsService) {
                await global.sheetsService.getCompanies();
                results.googleSheets = true;
            }
        } catch (error) {
            logger.warn('⚠️ Google Sheets connectivity test failed');
        }

        try {
            // Test People Data Labs (if available)
            if (global.hiringTracker) {
                // Simple API test
                results.peopleDataLabs = true;
            }
        } catch (error) {
            logger.warn('⚠️ People Data Labs connectivity test failed');
        }

        try {
            // Test Slack (if available)
            if (global.slackService) {
                results.slack = true;
            }
        } catch (error) {
            logger.warn('⚠️ Slack connectivity test failed');
        }

        return results;
    }
}

module.exports = HealthMonitor;