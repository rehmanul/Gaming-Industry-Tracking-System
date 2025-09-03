#!/bin/bash

# Gaming Industry Tracker - Digital Ocean Deployment Script
# Optimized for Ubuntu 20.04+ droplets

set -e

echo "🚀 Gaming Industry Tracker - Digital Ocean Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="gaming-tracker"
APP_DIR="/opt/gaming-tracker"
SERVICE_USER="tracker"
NODE_VERSION="18"
PORT="3000"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_status "Starting deployment process..."

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y curl wget git nginx ufw fail2ban htop

# Install Node.js
print_status "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

# Verify installations
node_version=$(node --version)
npm_version=$(npm --version)
print_success "Node.js ${node_version} and npm ${npm_version} installed"

# Create service user
print_status "Creating service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home-dir $APP_DIR --create-home $SERVICE_USER
    print_success "User $SERVICE_USER created"
else
    print_warning "User $SERVICE_USER already exists"
fi

# Create application directory
print_status "Setting up application directory..."
mkdir -p $APP_DIR
chown $SERVICE_USER:$SERVICE_USER $APP_DIR

# Clone or update repository
print_status "Cloning application repository..."
if [ -d "$APP_DIR/.git" ]; then
    print_status "Repository exists, pulling latest changes..."
    cd $APP_DIR
    sudo -u $SERVICE_USER git pull origin main
else
    print_status "Cloning fresh repository..."
    sudo -u $SERVICE_USER git clone https://github.com/rehmanul/Gaming-Industry-Tracking-System.git $APP_DIR
fi

cd $APP_DIR

# Install dependencies
print_status "Installing application dependencies..."
sudo -u $SERVICE_USER npm install --production

# Install PM2 globally
print_status "Installing PM2 process manager..."
npm install -g pm2

# Create environment file template
print_status "Creating environment configuration..."
cat > $APP_DIR/.env << EOF
# Gaming Industry Tracker Configuration
NODE_ENV=production
PORT=$PORT

# People Data Labs API
PEOPLE_DATA_LABS_API_KEY_1=your_api_key_here
PEOPLE_DATA_LABS_API_KEY_2=your_backup_api_key_here

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials.json
GOOGLE_SHEET_ID=your_sheet_id_here

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C1234567890

# Email Configuration (Optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Security
API_KEY=gaming-tracker-secure-key-2024

# Cron Schedules
TRACKING_CRON=*/30 * * * *
RELOAD_CRON=0 */4 * * *
SUMMARY_CRON=0 9 * * *
HEALTH_CRON=*/5 * * * *

# Performance Settings
LOG_LEVEL=info
CACHE_TTL=300000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF

chown $SERVICE_USER:$SERVICE_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Create PM2 ecosystem file
print_status "Creating PM2 configuration..."
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'src/web/index.js',
    cwd: '$APP_DIR',
    user: '$SERVICE_USER',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    log_file: '$APP_DIR/logs/combined.log',
    out_file: '$APP_DIR/logs/out.log',
    error_file: '$APP_DIR/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

chown $SERVICE_USER:$SERVICE_USER $APP_DIR/ecosystem.config.js

# Create logs directory
print_status "Creating logs directory..."
mkdir -p $APP_DIR/logs
chown $SERVICE_USER:$SERVICE_USER $APP_DIR/logs

# Configure Nginx
print_status "Configuring Nginx reverse proxy..."
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t
if [ $? -eq 0 ]; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration is invalid"
    exit 1
fi

# Configure firewall
print_status "Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow $PORT

# Configure fail2ban
print_status "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

# Start services
print_status "Starting services..."
systemctl restart nginx
systemctl enable nginx
systemctl restart fail2ban
systemctl enable fail2ban

# Start application with PM2
print_status "Starting application..."
cd $APP_DIR
sudo -u $SERVICE_USER pm2 start ecosystem.config.js
sudo -u $SERVICE_USER pm2 save
sudo -u $SERVICE_USER pm2 startup

# Create systemd service for PM2
env_path=$(sudo -u $SERVICE_USER pm2 startup | grep "sudo env" | cut -d'"' -f2)
if [ ! -z "$env_path" ]; then
    eval $env_path
fi

# Health check
print_status "Performing health check..."
sleep 10

if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
    print_success "Application is running and healthy!"
else
    print_warning "Application may not be fully ready yet. Check logs with: pm2 logs $APP_NAME"
fi

# Create maintenance scripts
print_status "Creating maintenance scripts..."

# Backup script
cat > /usr/local/bin/gaming-tracker-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/gaming-tracker"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/gaming-tracker-$DATE.tar.gz -C /opt gaming-tracker --exclude=node_modules --exclude=logs
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
echo "Backup completed: gaming-tracker-$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/gaming-tracker-backup

# Update script
cat > /usr/local/bin/gaming-tracker-update << 'EOF'
#!/bin/bash
cd /opt/gaming-tracker
sudo -u tracker git pull origin main
sudo -u tracker npm install --production
sudo -u tracker pm2 restart gaming-tracker
echo "Application updated and restarted"
EOF

chmod +x /usr/local/bin/gaming-tracker-update

# Setup cron for backups
echo "0 2 * * * root /usr/local/bin/gaming-tracker-backup" >> /etc/crontab

print_success "Deployment completed successfully!"
echo ""
echo "🎮 Gaming Industry Tracker is now running!"
echo "=================================================="
echo "📍 Application URL: http://$(curl -s ifconfig.me):$PORT"
echo "🔧 Control Room: http://$(curl -s ifconfig.me):$PORT/control"
echo "📊 Dashboard: http://$(curl -s ifconfig.me):$PORT/dashboard"
echo ""
echo "📋 Management Commands:"
echo "  • View logs: pm2 logs $APP_NAME"
echo "  • Restart app: pm2 restart $APP_NAME"
echo "  • Update app: /usr/local/bin/gaming-tracker-update"
echo "  • Backup app: /usr/local/bin/gaming-tracker-backup"
echo ""
echo "⚙️  Next Steps:"
echo "  1. Edit /opt/gaming-tracker/.env with your API keys"
echo "  2. Upload Google Sheets credentials to /opt/gaming-tracker/credentials.json"
echo "  3. Restart the application: pm2 restart $APP_NAME"
echo "  4. Configure SSL certificate (recommended)"
echo ""
print_warning "Remember to secure your environment variables and API keys!"
echo "=================================================="