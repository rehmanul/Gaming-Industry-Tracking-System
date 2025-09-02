module.exports = {
  apps: [{
    name: 'gaming-company-tracker',
    script: 'src/app.js',

    // PM2 options
    instances: 1,
    exec_mode: 'fork',

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Logging
    log_file: 'logs/pm2.log',
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-error.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // Restart options
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',

    // Auto restart
    autorestart: true,

    // Cron restart (optional - restart daily at 3 AM)
    cron_restart: '0 3 * * *',

    // Kill timeout
    kill_timeout: 3000,

    // Wait ready
    wait_ready: true,
    listen_timeout: 8000
  }]
};