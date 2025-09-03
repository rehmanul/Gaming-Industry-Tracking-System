const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const validator = require('validator');

class SecurityMiddleware {
    constructor() {
        this.rateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return validator.escape(input);
    }

    sanitizeLog(message) {
        if (typeof message !== 'string') return message;
        return message.replace(/[\r\n\t]/g, ' ').substring(0, 1000);
    }

    requireAuth(req, res, next) {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        if (!process.env.API_KEY) {
      throw new Error('API_KEY environment variable is required');
    }
    const validApiKey = process.env.API_KEY;
        
        if (!apiKey || apiKey !== validApiKey) {
            return res.status(401).json({ error: 'Unauthorized access' });
        }
        next();
    }

    getSecurityHeaders() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }

    getCorsConfig() {
        return cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
        });
    }
}

module.exports = new SecurityMiddleware();