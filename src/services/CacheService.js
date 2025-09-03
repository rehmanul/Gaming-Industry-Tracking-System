class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time to live
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(key, value, ttlMs = 300000) { // 5 min default
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, value);
    this.ttl.set(key, expiry);
    this.stats.sets++;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    const expiry = this.ttl.get(key);
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.ttl.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return this.cache.get(key);
  }

  has(key) {
    return this.cache.has(key) && Date.now() <= this.ttl.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.ttl.delete(key);
      }
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0,
      size: this.cache.size
    };
  }

  // Specialized caching methods
  cacheJobData(companyId, jobs) {
    this.set(`jobs:${companyId}`, jobs, 10 * 60 * 1000); // 10 min
  }

  getCachedJobs(companyId) {
    return this.get(`jobs:${companyId}`);
  }

  cacheHireData(companyId, hires) {
    this.set(`hires:${companyId}`, hires, 30 * 60 * 1000); // 30 min
  }

  getCachedHires(companyId) {
    return this.get(`hires:${companyId}`);
  }

  cacheAnalytics(data) {
    this.set('analytics:dashboard', data, 2 * 60 * 1000); // 2 min
  }

  getCachedAnalytics() {
    return this.get('analytics:dashboard');
  }
}

module.exports = CacheService;