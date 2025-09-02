const logger = require('../utils/logger');

/**
 * Advanced rate limiting service
 */
class RateLimiter {
  constructor() {
    this.limits = new Map();
    this.queues = new Map();
    this.defaultConfig = {
      requests: 10,
      window: 60000, // 1 minute
      delay: 1000    // 1 second between requests
    };
  }

  /**
   * Configure rate limit for a service
   */
  configure(service, config) {
    this.limits.set(service, { ...this.defaultConfig, ...config });
    this.queues.set(service, []);
    
    logger.info(`Rate limiter configured for ${service}:`, this.limits.get(service));
  }

  /**
   * Check if request is allowed
   */
  isAllowed(service, identifier = 'default') {
    const config = this.limits.get(service) || this.defaultConfig;
    const key = `${service}:${identifier}`;
    const now = Date.now();
    
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }
    
    const queue = this.queues.get(key);
    
    // Remove old requests outside the window
    while (queue.length > 0 && now - queue[0] > config.window) {
      queue.shift();
    }
    
    // Check if under limit
    if (queue.length < config.requests) {
      queue.push(now);
      return true;
    }
    
    return false;
  }

  /**
   * Wait for rate limit to allow request
   */
  async waitForSlot(service, identifier = 'default') {
    const config = this.limits.get(service) || this.defaultConfig;
    
    while (!this.isAllowed(service, identifier)) {
      logger.debug(`Rate limit hit for ${service}:${identifier}, waiting...`);
      await this.delay(config.delay);
    }
  }

  /**
   * Execute function with rate limiting
   */
  async execute(service, fn, identifier = 'default') {
    await this.waitForSlot(service, identifier);
    
    try {
      const result = await fn();
      
      // Add delay after successful execution
      const config = this.limits.get(service) || this.defaultConfig;
      if (config.delay > 0) {
        await this.delay(config.delay);
      }
      
      return result;
    } catch (error) {
      logger.error(`Rate limited execution failed for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit status
   */
  getStatus(service, identifier = 'default') {
    const config = this.limits.get(service) || this.defaultConfig;
    const key = `${service}:${identifier}`;
    const queue = this.queues.get(key) || [];
    const now = Date.now();
    
    // Count recent requests
    const recentRequests = queue.filter(time => now - time <= config.window).length;
    
    return {
      service,
      identifier,
      requests: recentRequests,
      limit: config.requests,
      window: config.window,
      remaining: Math.max(0, config.requests - recentRequests),
      resetTime: queue.length > 0 ? queue[0] + config.window : now
    };
  }

  /**
   * Reset rate limits for a service
   */
  reset(service, identifier = null) {
    if (identifier) {
      const key = `${service}:${identifier}`;
      this.queues.set(key, []);
      logger.info(`Rate limit reset for ${key}`);
    } else {
      // Reset all identifiers for the service
      for (const [key] of this.queues.entries()) {
        if (key.startsWith(`${service}:`)) {
          this.queues.set(key, []);
        }
      }
      logger.info(`Rate limits reset for all ${service} identifiers`);
    }
  }

  /**
   * Get all rate limit statuses
   */
  getAllStatuses() {
    const statuses = {};
    
    for (const [service] of this.limits.entries()) {
      statuses[service] = {};
      
      for (const [key] of this.queues.entries()) {
        if (key.startsWith(`${service}:`)) {
          const identifier = key.split(':')[1];
          statuses[service][identifier] = this.getStatus(service, identifier);
        }
      }
    }
    
    return statuses;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, queue] of this.queues.entries()) {
      const service = key.split(':')[0];
      const config = this.limits.get(service) || this.defaultConfig;
      
      const originalLength = queue.length;
      while (queue.length > 0 && now - queue[0] > config.window) {
        queue.shift();
      }
      
      cleaned += originalLength - queue.length;
    }
    
    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: ${cleaned} old entries removed`);
    }
  }
}

module.exports = RateLimiter;