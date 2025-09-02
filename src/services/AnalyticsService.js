const logger = require('../utils/logger');
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
    
    logger.debug(`Analytics: Recorded hire ${hire.name} at ${company.name}`);
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
    
    logger.debug(`Analytics: Recorded job ${job.title} at ${company.name}`);
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
    
    logger.debug(`Analytics: Recorded error for ${company?.name || 'Unknown'}`);
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
      metadata\n    };\n    \n    this.metrics.performance.push(record);\n    \n    // Keep only last 1000 performance records\n    if (this.metrics.performance.length > 1000) {\n      this.metrics.performance = this.metrics.performance.slice(-1000);\n    }\n  }\n\n  /**\n   * Update company statistics\n   */\n  updateCompanyStats(companyName, type) {\n    if (!this.metrics.companies.has(companyName)) {\n      this.metrics.companies.set(companyName, {\n        hires: 0,\n        jobs: 0,\n        errors: 0,\n        lastActivity: null\n      });\n    }\n    \n    const stats = this.metrics.companies.get(companyName);\n    stats[type]++;\n    stats.lastActivity = new Date().toISOString();\n  }\n\n  /**\n   * Get comprehensive analytics report\n   */\n  getAnalytics(timeframe = '24h') {\n    const now = new Date();\n    const cutoff = this.getTimeframeCutoff(timeframe);\n    \n    const filteredHires = this.metrics.hires.filter(h => new Date(h.timestamp) >= cutoff);\n    const filteredJobs = this.metrics.jobs.filter(j => new Date(j.timestamp) >= cutoff);\n    const filteredErrors = this.metrics.errors.filter(e => new Date(e.timestamp) >= cutoff);\n    \n    return {\n      timeframe,\n      period: {\n        start: cutoff.toISOString(),\n        end: now.toISOString()\n      },\n      summary: {\n        totalHires: filteredHires.length,\n        totalJobs: filteredJobs.length,\n        totalErrors: filteredErrors.length,\n        activeCompanies: new Set([...filteredHires.map(h => h.company), ...filteredJobs.map(j => j.company)]).size\n      },\n      trends: this.calculateTrends(filteredHires, filteredJobs, timeframe),\n      topCompanies: this.getTopCompanies(filteredHires, filteredJobs),\n      departments: this.getDepartmentBreakdown(filteredHires, filteredJobs),\n      locations: this.getLocationBreakdown(filteredHires, filteredJobs),\n      performance: this.getPerformanceMetrics(timeframe),\n      errors: this.getErrorAnalysis(filteredErrors)\n    };\n  }\n\n  /**\n   * Calculate trends over time\n   */\n  calculateTrends(hires, jobs, timeframe) {\n    const buckets = this.createTimeBuckets(timeframe);\n    \n    // Group data by time buckets\n    hires.forEach(hire => {\n      const bucket = this.getBucketForTimestamp(hire.timestamp, buckets);\n      if (bucket) bucket.hires++;\n    });\n    \n    jobs.forEach(job => {\n      const bucket = this.getBucketForTimestamp(job.timestamp, buckets);\n      if (bucket) bucket.jobs++;\n    });\n    \n    return buckets.map(bucket => ({\n      period: bucket.label,\n      hires: bucket.hires,\n      jobs: bucket.jobs,\n      timestamp: bucket.start\n    }));\n  }\n\n  /**\n   * Get top performing companies\n   */\n  getTopCompanies(hires, jobs, limit = 10) {\n    const companyStats = new Map();\n    \n    [...hires, ...jobs].forEach(item => {\n      if (!companyStats.has(item.company)) {\n        companyStats.set(item.company, { hires: 0, jobs: 0, total: 0 });\n      }\n      \n      const stats = companyStats.get(item.company);\n      if (item.hire) stats.hires++;\n      if (item.job) stats.jobs++;\n      stats.total++;\n    });\n    \n    return Array.from(companyStats.entries())\n      .map(([company, stats]) => ({ company, ...stats }))\n      .sort((a, b) => b.total - a.total)\n      .slice(0, limit);\n  }\n\n  /**\n   * Get department breakdown\n   */\n  getDepartmentBreakdown(hires, jobs) {\n    const departments = new Map();\n    \n    [...hires, ...jobs].forEach(item => {\n      const dept = (item.hire?.department || item.job?.department || 'Unknown').toLowerCase();\n      departments.set(dept, (departments.get(dept) || 0) + 1);\n    });\n    \n    return Array.from(departments.entries())\n      .map(([department, count]) => ({ department, count }))\n      .sort((a, b) => b.count - a.count);\n  }\n\n  /**\n   * Get location breakdown\n   */\n  getLocationBreakdown(hires, jobs) {\n    const locations = new Map();\n    \n    [...hires, ...jobs].forEach(item => {\n      const loc = (item.hire?.location || item.job?.location || 'Unknown').toLowerCase();\n      locations.set(loc, (locations.get(loc) || 0) + 1);\n    });\n    \n    return Array.from(locations.entries())\n      .map(([location, count]) => ({ location, count }))\n      .sort((a, b) => b.count - a.count);\n  }\n\n  /**\n   * Get performance metrics\n   */\n  getPerformanceMetrics(timeframe) {\n    const cutoff = this.getTimeframeCutoff(timeframe);\n    const filtered = this.metrics.performance.filter(p => new Date(p.timestamp) >= cutoff);\n    \n    if (filtered.length === 0) {\n      return { avgDuration: 0, successRate: 0, totalOperations: 0 };\n    }\n    \n    const avgDuration = filtered.reduce((sum, p) => sum + p.duration, 0) / filtered.length;\n    const successRate = filtered.filter(p => p.success).length / filtered.length;\n    \n    return {\n      avgDuration: Math.round(avgDuration),\n      successRate: Math.round(successRate * 100),\n      totalOperations: filtered.length,\n      operations: this.groupOperations(filtered)\n    };\n  }\n\n  /**\n   * Get error analysis\n   */\n  getErrorAnalysis(errors) {\n    const errorTypes = new Map();\n    const errorCompanies = new Map();\n    \n    errors.forEach(error => {\n      const type = error.error.type;\n      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);\n      \n      const company = error.company;\n      errorCompanies.set(company, (errorCompanies.get(company) || 0) + 1);\n    });\n    \n    return {\n      total: errors.length,\n      byType: Array.from(errorTypes.entries()).map(([type, count]) => ({ type, count })),\n      byCompany: Array.from(errorCompanies.entries()).map(([company, count]) => ({ company, count })),\n      recent: errors.slice(-5).map(e => ({\n        timestamp: e.timestamp,\n        company: e.company,\n        message: e.error.message\n      }))\n    };\n  }\n\n  /**\n   * Helper methods\n   */\n  getTimeframeCutoff(timeframe) {\n    const now = new Date();\n    \n    switch (timeframe) {\n      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);\n      case '6h': return new Date(now.getTime() - 6 * 60 * 60 * 1000);\n      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);\n      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);\n      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);\n      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);\n    }\n  }\n\n  createTimeBuckets(timeframe) {\n    const now = new Date();\n    const buckets = [];\n    \n    let bucketSize, bucketCount, labelFormat;\n    \n    switch (timeframe) {\n      case '1h':\n        bucketSize = 5 * 60 * 1000; // 5 minutes\n        bucketCount = 12;\n        labelFormat = 'HH:mm';\n        break;\n      case '6h':\n        bucketSize = 30 * 60 * 1000; // 30 minutes\n        bucketCount = 12;\n        labelFormat = 'HH:mm';\n        break;\n      case '24h':\n        bucketSize = 2 * 60 * 60 * 1000; // 2 hours\n        bucketCount = 12;\n        labelFormat = 'HH:mm';\n        break;\n      case '7d':\n        bucketSize = 24 * 60 * 60 * 1000; // 1 day\n        bucketCount = 7;\n        labelFormat = 'MM/DD';\n        break;\n      default:\n        bucketSize = 2 * 60 * 60 * 1000; // 2 hours\n        bucketCount = 12;\n        labelFormat = 'HH:mm';\n    }\n    \n    for (let i = bucketCount - 1; i >= 0; i--) {\n      const start = new Date(now.getTime() - (i + 1) * bucketSize);\n      const end = new Date(now.getTime() - i * bucketSize);\n      \n      buckets.push({\n        start,\n        end,\n        label: start.toLocaleTimeString('en-US', { \n          hour12: false,\n          ...(labelFormat === 'HH:mm' ? { hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' })\n        }),\n        hires: 0,\n        jobs: 0\n      });\n    }\n    \n    return buckets;\n  }\n\n  getBucketForTimestamp(timestamp, buckets) {\n    const date = new Date(timestamp);\n    return buckets.find(bucket => date >= bucket.start && date < bucket.end);\n  }\n\n  groupOperations(performance) {\n    const operations = new Map();\n    \n    performance.forEach(p => {\n      if (!operations.has(p.operation)) {\n        operations.set(p.operation, { count: 0, avgDuration: 0, successRate: 0 });\n      }\n      \n      const op = operations.get(p.operation);\n      op.count++;\n      op.avgDuration = (op.avgDuration * (op.count - 1) + p.duration) / op.count;\n      op.successRate = performance.filter(perf => perf.operation === p.operation && perf.success).length / \n                      performance.filter(perf => perf.operation === p.operation).length;\n    });\n    \n    return Array.from(operations.entries()).map(([operation, stats]) => ({\n      operation,\n      ...stats,\n      avgDuration: Math.round(stats.avgDuration),\n      successRate: Math.round(stats.successRate * 100)\n    }));\n  }\n\n  /**\n   * Export analytics data\n   */\n  async exportData(format = 'json') {\n    const data = {\n      exported: new Date().toISOString(),\n      metrics: {\n        hires: this.metrics.hires,\n        jobs: this.metrics.jobs,\n        companies: Object.fromEntries(this.metrics.companies),\n        errors: this.metrics.errors,\n        performance: this.metrics.performance\n      },\n      analytics: this.getAnalytics('30d')\n    };\n    \n    const filename = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;\n    const filepath = path.join(this.dataDir, filename);\n    \n    try {\n      if (format === 'json') {\n        await fs.writeFile(filepath, JSON.stringify(data, null, 2));\n      } else if (format === 'csv') {\n        // Convert to CSV format\n        const csv = this.convertToCSV(data);\n        await fs.writeFile(filepath, csv);\n      }\n      \n      logger.info(`Analytics data exported to ${filepath}`);\n      return filepath;\n    } catch (error) {\n      logger.error('Failed to export analytics data:', error);\n      throw error;\n    }\n  }\n\n  convertToCSV(data) {\n    // Simple CSV conversion for hires and jobs\n    const lines = ['Type,Timestamp,Company,Title,Department,Location'];\n    \n    data.metrics.hires.forEach(hire => {\n      lines.push(`Hire,${hire.timestamp},${hire.company},${hire.hire.title || ''},${hire.hire.department || ''},${hire.hire.location || ''}`);\n    });\n    \n    data.metrics.jobs.forEach(job => {\n      lines.push(`Job,${job.timestamp},${job.company},${job.job.title || ''},${job.job.department || ''},${job.job.location || ''}`);\n    });\n    \n    return lines.join('\\n');\n  }\n\n  /**\n   * Clear old data\n   */\n  cleanup(retentionDays = 30) {\n    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);\n    \n    const originalHires = this.metrics.hires.length;\n    const originalJobs = this.metrics.jobs.length;\n    const originalErrors = this.metrics.errors.length;\n    \n    this.metrics.hires = this.metrics.hires.filter(h => new Date(h.timestamp) >= cutoff);\n    this.metrics.jobs = this.metrics.jobs.filter(j => new Date(j.timestamp) >= cutoff);\n    this.metrics.errors = this.metrics.errors.filter(e => new Date(e.timestamp) >= cutoff);\n    \n    const cleaned = (originalHires - this.metrics.hires.length) + \n                   (originalJobs - this.metrics.jobs.length) + \n                   (originalErrors - this.metrics.errors.length);\n    \n    if (cleaned > 0) {\n      logger.info(`Analytics cleanup: ${cleaned} old records removed (retention: ${retentionDays} days)`);\n    }\n  }\n}\n\nmodule.exports = AnalyticsService;