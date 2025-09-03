const winston = require('winston');
const EventEmitter = require('events');

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      apiCalls: 0,
      successRate: 0,
      avgResponseTime: 0,
      errorCount: 0,
      lastHealthCheck: null
    };
    this.alerts = [];
    this.thresholds = {
      errorRate: 0.05, // 5%
      responseTime: 5000, // 5s
      apiCallsPerHour: 1000
    };
  }

  recordMetric(type, value, metadata = {}) {
    const timestamp = new Date();
    
    switch(type) {
      case 'api_call':
        this.metrics.apiCalls++;
        this.metrics.avgResponseTime = (this.metrics.avgResponseTime + value) / 2;
        break;
      case 'error':
        this.metrics.errorCount++;
        this.checkThresholds();
        break;
      case 'success':
        this.updateSuccessRate();
        break;
    }

    this.emit('metric_recorded', { type, value, timestamp, metadata });
  }

  checkThresholds() {
    const errorRate = this.metrics.errorCount / this.metrics.apiCalls;
    
    if (errorRate > this.thresholds.errorRate) {
      this.createAlert('HIGH_ERROR_RATE', `Error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    if (this.metrics.avgResponseTime > this.thresholds.responseTime) {
      this.createAlert('SLOW_RESPONSE', `Avg response: ${this.metrics.avgResponseTime}ms`);
    }
  }

  createAlert(type, message) {
    const alert = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type)
    };
    
    this.alerts.push(alert);
    this.emit('alert_created', alert);
    
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }

  getAlertSeverity(type) {
    const severityMap = {
      'HIGH_ERROR_RATE': 'critical',
      'SLOW_RESPONSE': 'warning',
      'API_LIMIT': 'critical',
      'SERVICE_DOWN': 'critical'
    };
    return severityMap[type] || 'info';
  }

  async sendCriticalAlert(alert) {
    // Integration with Slack/Email for critical alerts
    console.log(`🚨 CRITICAL ALERT: ${alert.message}`);
  }

  getHealthStatus() {
    const errorRate = this.metrics.errorCount / Math.max(this.metrics.apiCalls, 1);
    
    return {
      status: errorRate < 0.01 ? 'healthy' : errorRate < 0.05 ? 'degraded' : 'unhealthy',
      metrics: this.metrics,
      alerts: this.alerts.slice(-10),
      timestamp: new Date()
    };
  }

  updateSuccessRate() {
    const total = this.metrics.apiCalls;
    const errors = this.metrics.errorCount;
    this.metrics.successRate = ((total - errors) / total * 100).toFixed(2);
  }
}

module.exports = MonitoringService;