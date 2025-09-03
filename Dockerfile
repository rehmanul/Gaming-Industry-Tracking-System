# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nextjs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown nextjs:nodejs logs

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
        if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }).on('error', () => process.exit(1));"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/web/index.js"]