# Gaming Company Tracker - Render.com Optimized Dockerfile
FROM node:20-bullseye-slim

# Set metadata
LABEL maintainer="Gaming Company Tracker"
LABEL description="Automated gaming industry tracking for Render.com"
LABEL version="1.0.0"

# Install system dependencies for Puppeteer and Render
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=10000

# Create app directory
WORKDIR /app

# Copy package files for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Create required directories with proper permissions
RUN mkdir -p logs && \
    chmod 755 logs

# Create non-root user for security
RUN groupadd -r nodejs && \
    useradd -r -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Copy application source
COPY src/ ./src/

# Switch to non-root user
USER nodejs

# Expose Render's port
EXPOSE 10000

# Health check for Render
HEALTHCHECK --interval=5m --timeout=30s --start-period=2m --retries=3 \
  CMD ["node","src/app.js"]

CMD ["node","src/app.js"]
