class PerformanceOptimizer {
  constructor() {
    this.metrics = {
      apiCalls: [],
      memoryUsage: [],
      responseTime: [],
      cacheHitRate: 0
    };
    this.optimizations = new Map();
    this.thresholds = {
      maxMemoryMB: 512,
      maxResponseTimeMs: 5000,
      minCacheHitRate: 80
    };
  }

  recordApiCall(duration, endpoint, success = true) {
    const record = {
      timestamp: Date.now(),
      duration,
      endpoint,
      success,
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    };

    this.metrics.apiCalls.push(record);
    this.metrics.responseTime.push(duration);
    this.metrics.memoryUsage.push(record.memory);

    // Keep only last 1000 records
    if (this.metrics.apiCalls.length > 1000) {
      this.metrics.apiCalls.shift();
      this.metrics.responseTime.shift();
      this.metrics.memoryUsage.shift();
    }

    this.analyzePerformance();
  }

  analyzePerformance() {
    const recentCalls = this.metrics.apiCalls.slice(-100);
    
    // Analyze response times
    const avgResponseTime = this.calculateAverage(this.metrics.responseTime.slice(-100));
    if (avgResponseTime > this.thresholds.maxResponseTimeMs) {
      this.suggestOptimization('response_time', {
        issue: 'High response times detected',
        avgTime: avgResponseTime,
        suggestion: 'Consider implementing caching or optimizing database queries'
      });
    }

    // Analyze memory usage
    const avgMemory = this.calculateAverage(this.metrics.memoryUsage.slice(-50));
    if (avgMemory > this.thresholds.maxMemoryMB) {
      this.suggestOptimization('memory', {
        issue: 'High memory usage detected',
        avgMemory: avgMemory,
        suggestion: 'Consider implementing garbage collection or reducing object retention'
      });
    }

    // Analyze error rates
    const errorRate = this.calculateErrorRate(recentCalls);
    if (errorRate > 0.05) { // 5% error rate
      this.suggestOptimization('error_rate', {
        issue: 'High error rate detected',
        errorRate: (errorRate * 100).toFixed(2) + '%',
        suggestion: 'Review error handling and implement circuit breakers'
      });
    }
  }

  calculateAverage(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  calculateErrorRate(calls) {
    if (calls.length === 0) return 0;
    const errors = calls.filter(call => !call.success).length;
    return errors / calls.length;
  }

  suggestOptimization(type, details) {
    const existing = this.optimizations.get(type);
    const now = Date.now();
    
    // Don't spam the same optimization suggestion
    if (existing && (now - existing.timestamp) < 300000) { // 5 minutes
      return;
    }

    this.optimizations.set(type, {
      ...details,
      timestamp: now,
      priority: this.calculatePriority(type, details)
    });
  }

  calculatePriority(type, details) {
    const priorities = {
      'error_rate': 'high',
      'memory': 'medium',
      'response_time': 'medium'
    };
    return priorities[type] || 'low';
  }

  getOptimizationSuggestions() {
    const suggestions = Array.from(this.optimizations.entries()).map(([type, data]) => ({
      type,
      ...data
    }));

    return suggestions.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  getPerformanceReport() {
    const recentCalls = this.metrics.apiCalls.slice(-100);
    
    return {
      summary: {
        totalCalls: this.metrics.apiCalls.length,
        avgResponseTime: this.calculateAverage(this.metrics.responseTime.slice(-100)),
        avgMemoryUsage: this.calculateAverage(this.metrics.memoryUsage.slice(-50)),
        errorRate: this.calculateErrorRate(recentCalls),
        cacheHitRate: this.metrics.cacheHitRate
      },
      trends: {
        responseTimeTrend: this.calculateTrend(this.metrics.responseTime.slice(-50)),
        memoryTrend: this.calculateTrend(this.metrics.memoryUsage.slice(-50))
      },
      optimizations: this.getOptimizationSuggestions(),
      recommendations: this.generateRecommendations()
    };
  }

  calculateTrend(data) {
    if (data.length < 10) return 'insufficient_data';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  generateRecommendations() {
    const recommendations = [];
    const report = this.getPerformanceReport();
    
    if (report.summary.avgResponseTime > 3000) {
      recommendations.push({
        type: 'performance',
        message: 'Implement response caching for frequently accessed data',
        impact: 'high'
      });
    }

    if (report.summary.errorRate > 0.03) {
      recommendations.push({
        type: 'reliability',
        message: 'Implement circuit breaker pattern for external API calls',
        impact: 'high'
      });
    }

    if (report.summary.avgMemoryUsage > 400) {
      recommendations.push({
        type: 'memory',
        message: 'Review object lifecycle and implement memory pooling',
        impact: 'medium'
      });
    }

    if (report.summary.cacheHitRate < 70) {
      recommendations.push({
        type: 'caching',
        message: 'Optimize cache strategy and increase TTL for stable data',
        impact: 'medium'
      });
    }

    return recommendations;
  }

  updateCacheHitRate(hitRate) {
    this.metrics.cacheHitRate = hitRate;
  }

  reset() {
    this.metrics = {
      apiCalls: [],
      memoryUsage: [],
      responseTime: [],
      cacheHitRate: 0
    };
    this.optimizations.clear();
  }
}

module.exports = PerformanceOptimizer;