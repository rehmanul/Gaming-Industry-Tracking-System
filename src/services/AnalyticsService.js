const logger = require('../utils/logger');
const security = require('../middleware/security');
const fs = require('fs').promises;
const path = require('path');

/**
 * Advanced analytics and reporting service
 */
class AnalyticsService {
  constructor() {
    this.metrics = {
      hires: [],
      jobs: [],
      companies: new Map(),
      errors: [],
      performance: []
    };

    this.dataDir = path.join(__dirname, '../../data');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Record a new hire
   */
  recordHire(company, hire) {
    const record = {
      timestamp: new Date().toISOString(),
      company: company.name,
      companyDomain: company.domain,
      priority: company.priority,
      hire: {
        name: hire.name,
        title: hire.title,
        department: hire.department,
        location: hire.location,
        startDate: hire.startDate
      }
    };

    this.metrics.hires.push(record);
    this.updateCompanyStats(company.name, 'hires');

    logger.debug(`Analytics: Recorded hire ${security.sanitizeLog(hire.name)} at ${security.sanitizeLog(company.name)}`);
  }

  /**
   * Record a new job posting
   */
  recordJob(company, job) {
    const record = {
      timestamp: new Date().toISOString(),
      company: company.name,
      companyDomain: company.domain,
      priority: company.priority,
      job: {
        title: job.title,
        department: job.department,
        location: job.location,
        type: job.type,
        salary: job.salary,
        postedDate: job.postedDate
      }
    };

    this.metrics.jobs.push(record);
    this.updateCompanyStats(company.name, 'jobs');

    logger.debug(`Analytics: Recorded job ${security.sanitizeLog(job.title)} at ${security.sanitizeLog(company.name)}`);
  }

  /**
   * Record an error
   */
  recordError(company, error, context = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      company: company?.name || 'Unknown',
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      },
      context
    };

    this.metrics.errors.push(record);
    this.updateCompanyStats(company?.name || 'Unknown', 'errors');

    const sanitizedName = security.sanitizeLog(company?.name || 'Unknown');
    logger.debug(`Analytics: Recorded error for ${sanitizedName}`);
  }

  /**
   * Record performance metrics
   */
  recordPerformance(operation, duration, success = true, metadata = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      metadata
    };

    this.metrics.performance.push(record);

    // Keep only last 1000 performance records
    if (this.metrics.performance.length > 1000) {
      this.metrics.performance = this.metrics.performance.slice(-1000);
    }
  }

  /**
   * Update company statistics
   */
  updateCompanyStats(companyName, type) {
    if (!this.metrics.companies.has(companyName)) {
      this.metrics.companies.set(companyName, {
        hires: 0,
        jobs: 0,
        errors: 0,
        lastActivity: null
      });
    }

    const stats = this.metrics.companies.get(companyName);
    stats[type]++;
    stats.lastActivity = new Date().toISOString();
  }

  /**
   * Get comprehensive analytics report
   */
  getAnalytics(timeframe = '24h') {
    const now = new Date();
    const cutoff = this.getTimeframeCutoff(timeframe);

    const filteredHires = this.metrics.hires.filter(h => new Date(h.timestamp) >= cutoff);
    const filteredJobs = this.metrics.jobs.filter(j => new Date(j.timestamp) >= cutoff);
    const filteredErrors = this.metrics.errors.filter(e => new Date(e.timestamp) >= cutoff);

    return {
      timeframe,
      period: {
        start: cutoff.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalHires: filteredHires.length,
        totalJobs: filteredJobs.length,
        totalErrors: filteredErrors.length,
        activeCompanies: [...new Set([...filteredHires.map(h => h.company), ...filteredJobs.map(j => j.company)])].length
      },
      trends: this.calculateTrends(filteredHires, filteredJobs, timeframe),
      topCompanies: this.getTopCompanies(filteredHires, filteredJobs),
      departments: this.getDepartmentBreakdown(filteredHires, filteredJobs),
      locations: this.getLocationBreakdown(filteredHires, filteredJobs),
      performance: this.getPerformanceMetrics(timeframe),
      errors: this.getErrorAnalysis(filteredErrors)
    };
  }

  /**
   * Calculate trends over time
   */
  calculateTrends(hires, jobs, timeframe) {
    const buckets = this.createTimeBuckets(timeframe);

    // Group data by time buckets
    hires.forEach(hire => {
      const bucket = this.getBucketForTimestamp(hire.timestamp, buckets);
      if (bucket) bucket.hires++;
    });

    jobs.forEach(job => {
      const bucket = this.getBucketForTimestamp(job.timestamp, buckets);
      if (bucket) bucket.jobs++;
    });

    return buckets.map(bucket => ({
      period: bucket.label,
      hires: bucket.hires,
      jobs: bucket.jobs,
      timestamp: bucket.start
    }));
  }

  /**
   * Get top performing companies
   */
  getTopCompanies(hires, jobs, limit = 10) {
    const companyStats = new Map();

    [...hires, ...jobs].forEach(item => {
      if (!companyStats.has(item.company)) {
        companyStats.set(item.company, { hires: 0, jobs: 0, total: 0 });
      }

      const stats = companyStats.get(item.company);
      if (item.hire) stats.hires++;
      if (item.job) stats.jobs++;
      stats.total++;
    });

    return Array.from(companyStats.entries())
      .map(([company, stats]) => ({ company, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  /**
   * Get department breakdown
   */
  getDepartmentBreakdown(hires, jobs) {
    const departments = new Map();

    [...hires, ...jobs].forEach(item => {
      const dept = (item.hire?.department || item.job?.department || 'Unknown').toLowerCase();
      departments.set(dept, (departments.get(dept) || 0) + 1);
    });

    return Array.from(departments.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get location breakdown
   */
  getLocationBreakdown(hires, jobs) {
    const locations = new Map();

    [...hires, ...jobs].forEach(item => {
      const loc = (item.hire?.location || item.job?.location || 'Unknown').toLowerCase();
      locations.set(loc, (locations.get(loc) || 0) + 1);
    });

    return Array.from(locations.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeframe) {
    const cutoff = this.getTimeframeCutoff(timeframe);
    const filtered = this.metrics.performance.filter(p => new Date(p.timestamp) >= cutoff);

    if (filtered.length === 0) {
      return { avgDuration: 0, successRate: 0, totalOperations: 0 };
    }

    const avgDuration = filtered.reduce((sum, p) => sum + p.duration, 0) / filtered.length;
    const successRate = filtered.filter(p => p.success).length / filtered.length;

    return {
      avgDuration: Math.round(avgDuration),
      successRate: Math.round(successRate * 100),
      totalOperations: filtered.length,
      operations: this.groupOperations(filtered)
    };
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis(errors) {
    const errorTypes = new Map();
    const errorCompanies = new Map();

    errors.forEach(error => {
      const type = error.error.type;
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);

      const company = error.company;
      errorCompanies.set(company, (errorCompanies.get(company) || 0) + 1);
    });

    return {
      total: errors.length,
      byType: Array.from(errorTypes.entries()).map(([type, count]) => ({ type, count })),
      byCompany: Array.from(errorCompanies.entries()).map(([company, count]) => ({ company, count })),
      recent: errors.slice(-5).map(e => ({
        timestamp: e.timestamp,
        company: e.company,
        message: e.error.message
      }))
    };
  }

  /**
   * Helper methods
   */
  getTimeframeCutoff(timeframe) {
    const now = new Date();

    switch (timeframe) {
    case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
    case '6h': return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  createTimeBuckets(timeframe) {
    const now = new Date();
    const buckets = [];
    const cutoff = this.getTimeframeCutoff(timeframe);
    
    const totalTime = now.getTime() - cutoff.getTime();
    const bucketCount = Math.min(24, Math.max(6, Math.floor(totalTime / (60 * 60 * 1000))));
    const bucketSize = totalTime / bucketCount;

    for (let i = 0; i < bucketCount; i++) {
      const start = new Date(cutoff.getTime() + (i * bucketSize));
      buckets.push({
        start: start.getTime(),
        label: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        hires: 0,
        jobs: 0
      });
    }
    
    return buckets;
  }
  
  getBucketForTimestamp(timestamp, buckets) {
    const time = new Date(timestamp).getTime();
    return buckets.find(bucket => time >= bucket.start && time < bucket.start + (buckets[1]?.start - buckets[0]?.start || 3600000));
  }

  groupOperations(operations) {
    const grouped = new Map();
    operations.forEach(op => {
      const key = security.sanitizeLog(op.operation);
      if (!grouped.has(key)) {
        grouped.set(key, { count: 0, avgDuration: 0, successRate: 0 });
      }
      const stats = grouped.get(key);
      stats.count++;
      stats.avgDuration = Math.round((stats.avgDuration * (stats.count - 1) + op.duration) / stats.count);
      stats.successRate = Math.round(operations.filter(o => o.operation === op.operation && o.success).length / operations.filter(o => o.operation === op.operation).length * 100);
    });
    return Array.from(grouped.entries()).map(([op, stats]) => ({ operation: op, ...stats }));
  }
}

module.exports = AnalyticsService;
