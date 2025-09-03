const logger = require('./logger');
const security = require('../middleware/security');

class ErrorHandler {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async withRetry(operation, context = 'operation') {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const sanitizedContext = security.sanitizeLog(context);
                logger.warn(`⚠️ ${sanitizedContext} failed (attempt ${attempt}/${this.retryAttempts}): ${security.sanitizeLog(error.message)}`);
                
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }
        
        throw lastError;
    }

    async withCircuitBreaker(operation, context = 'operation') {
        const key = `circuit_${security.sanitizeInput(context)}`;
        const now = Date.now();
        const state = this.getCircuitState(key);
        
        if (state.isOpen && now - state.lastFailure < 60000) {
            throw new Error(`Circuit breaker open for ${context}`);
        }
        
        try {
            const result = await operation();
            this.resetCircuit(key);
            return result;
        } catch (error) {
            this.recordFailure(key);
            throw error;
        }
    }

    getCircuitState(key) {
        if (!this.circuits) this.circuits = new Map();
        return this.circuits.get(key) || { failures: 0, isOpen: false, lastFailure: 0 };
    }

    recordFailure(key) {
        if (!this.circuits) this.circuits = new Map();
        const state = this.getCircuitState(key);
        state.failures++;
        state.lastFailure = Date.now();
        state.isOpen = state.failures >= 5;
        this.circuits.set(key, state);
    }

    resetCircuit(key) {
        if (!this.circuits) this.circuits = new Map();
        this.circuits.set(key, { failures: 0, isOpen: false, lastFailure: 0 });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleApiError(error, context) {
        const sanitizedContext = security.sanitizeLog(context);
        
        if (error.response?.status === 429) {
            logger.warn(`⚠️ Rate limit hit for ${sanitizedContext}`);
            return { shouldRetry: true, delay: 5000 };
        }
        
        if (error.response?.status >= 500) {
            logger.error(`❌ Server error for ${sanitizedContext}: ${security.sanitizeLog(error.message)}`);
            return { shouldRetry: true, delay: 2000 };
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
            logger.warn(`⚠️ Network error for ${sanitizedContext}: ${security.sanitizeLog(error.message)}`);
            return { shouldRetry: true, delay: 3000 };
        }
        
        logger.error(`❌ Unrecoverable error for ${sanitizedContext}: ${security.sanitizeLog(error.message)}`);
        return { shouldRetry: false };
    }

    validateInput(data, type) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data provided');
        }
        
        if (!['hire', 'job'].includes(type)) {
            throw new Error('Invalid type provided');
        }
        
        return true;
    }
}

module.exports = new ErrorHandler();