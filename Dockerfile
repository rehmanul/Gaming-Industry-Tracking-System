# Use official Node 18 slim image
FROM node:18-bullseye-slim

# System dependencies for Puppeteer & Chromium
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
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    wget \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create logs folder
RUN mkdir -p logs && chmod 755 logs

# Add non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs && chown -R nodejs:nodejs /app
USER nodejs

# Copy source code
COPY src/ ./src/

# Expose port (Render will override with $PORT)
EXPOSE 3000

# Start the app
CMD ["node", "src/index.js"]
