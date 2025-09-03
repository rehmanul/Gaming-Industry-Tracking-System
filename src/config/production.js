module.exports = {
  security: {
    enableCSRF: true,
    enableRateLimit: true,
    rateLimitWindow: 15 * 60 * 1000,
    rateLimitMax: 100,
    enableHelmet: true,
    enableCORS: true,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
    apiKey: process.env.API_KEY || 'change-this-in-production'
  },

  performance: {
    enableCompression: true,
    enableCaching: true,
    cacheMaxAge: 300,
    maxConcurrentRequests: 3,
    requestTimeout: 30000,
    enableSlowDown: true
  },

  monitoring: {
    enableHealthChecks: true,
    healthCheckInterval: 5 * 60 * 1000,
    metricsRetention: 24 * 60 * 60 * 1000,
    alertThresholds: {
      maxMemoryMB: 1024,
      maxErrorRate: 0.1,
      maxResponseTime: 30000,
      minSuccessRate: 0.8
    }
  },

  logging: {
    level: 'info',
    enableFileLogging: true,
    maxFileSize: '20m',
    maxFiles: '14d',
    enableConsoleLogging: false
  }
};