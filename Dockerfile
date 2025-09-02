# Use Node 20 LTS slim image (matches engines.node requirement)
FROM node:20-bullseye-slim

# Set working directory
WORKDIR /app

# Install dependencies needed for Puppeteer / Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libxrandr2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    wget \
    curl \
    ca-certificates \
    git \
 && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (omit dev for production)
RUN npm ci --omit=dev && npm cache clean --force

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Add non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs && chown -R nodejs:nodejs /app

# Copy source code
COPY src/ ./src/

# Use non-root user
USER nodejs

# Expose web UI port
EXPOSE 3000

# Default command (can be overridden in Render)
CMD ["npm", "start"]
