module.exports = {
  apps: [{
    name: 'gaming-industry-tracker',
    script: './src/web/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Performance settings
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto restart settings
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    
    // Restart settings
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Advanced settings
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 8000,
    
    // Cron restart (daily at 3 AM)
    cron_restart: '0 3 * * *',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Cluster settings (if needed)
    instance_var: 'INSTANCE_ID',
    
    // Source map support
    source_map_support: true,
    
    // Graceful shutdown
    shutdown_with_message: true,
    
    // Error handling
    autorestart: true,
    
    // Monitoring
    pmx: true,
    
    // Custom environment variables for production
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
      ENABLE_HEALTH_CHECKS: 'true',
      ENABLE_METRICS: 'true',
      ENABLE_CIRCUIT_BREAKER: 'true'
    }
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/gaming-industry-tracker.git',
      path: '/var/www/gaming-industry-tracker',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};