const logger = require('../utils/logger');

/**
 * Enhanced caching service for improved performance
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time to live for cache entries
    this.defaultTTL = 30 * 60 * 1000; // 30 minutes default
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Set cache entry with optional TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttl);
    
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get cache entry if not expired
   */
  get(key) {
    const expiry = this.ttl.get(key);
    
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    
    const value = this.cache.get(key);
    logger.debug(`Cache HIT: ${key}`);
    return value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const expiry = this.ttl.get(key);
    
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return false;
    }
    
    return this.cache.has(key);
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
    logger.debug(`Cache DELETE: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.ttl.clear();
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: ${cleaned} expired entries removed`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  estimateMemoryUsage() {
    let size = 0;
    
    for (const [key, value] of this.cache.entries()) {
      size += JSON.stringify(key).length;
      size += JSON.stringify(value).length;
    }
    
    return `${(size / 1024).toFixed(2)} KB`;
  }

  /**
   * Cached function wrapper
   */
  cached(key, fn, ttl = this.defaultTTL) {
    return async (...args) => {
      const cacheKey = `${key}:${JSON.stringify(args)}`;
      
      // Check cache first
      const cached = this.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute function and cache result
      try {
        const result = await fn(...args);
        this.set(cacheKey, result, ttl);
        return result;
      } catch (error) {
        logger.error(`Cached function error for ${key}:`, error);
        throw error;
      }
    };
  }
}

module.exports = CacheService;