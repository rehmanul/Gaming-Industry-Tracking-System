const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const CompanyTracker = require('../services/CompanyTracker');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced tracker management
let trackerProcess = null;
let trackerInstance = null;
let systemStats = {
  totalHires: 0,
  totalJobs: 0,
  companiesLoaded: 0,
  errors: 0,
  uptime: 0,
  startTime: null
};

// Initialize tracker instance for direct access
async function initializeTracker() {
  try {
    trackerInstance = new CompanyTracker();
    await trackerInstance.initialize();
    systemStats.companiesLoaded = trackerInstance.companies?.length || 0;
    logger.info('🎮 Tracker instance initialized for web interface');
  } catch (error) {
    logger.error('❌ Failed to initialize tracker instance:', error);
    throw error;
  }
}

// Start the tracker
app.post('/start', async (req, res) => {
  try {
    if (trackerProcess) {
      return res.json({ status: 'running', message: 'Tracker already running' });
    }

    // Start tracker process
    trackerProcess = spawn('node', ['app.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    trackerProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      logger.info(`[TRACKER] ${message}`);
      
      // Parse stats from tracker output
      if (message.includes('new hires') || message.includes('new jobs')) {
        updateStatsFromLog(message);
      }
    });

    trackerProcess.stderr.on('data', (data) => {
      logger.error(`[TRACKER] ${data.toString()}`);
      systemStats.errors++;
    });

    trackerProcess.on('close', (code) => {
      logger.info(`Tracker exited with code ${code}`);
      trackerProcess = null;
      systemStats.startTime = null;
    });

    systemStats.startTime = new Date();
    systemStats.errors = 0;
    
    res.json({ 
      status: 'started', 
      message: 'Tracker started successfully',
      timestamp: systemStats.startTime
    });
  } catch (error) {
    logger.error('❌ Failed to start tracker:', error);
    res.status(500).json({ error: 'Failed to start tracker', details: error.message });
  }
});

// Stop the tracker
app.post('/stop', (req, res) => {
  try {
    if (!trackerProcess) {
      return res.json({ status: 'not running', message: 'Tracker not running' });
    }

    trackerProcess.kill('SIGTERM');
    trackerProcess = null;
    systemStats.startTime = null;
    
    res.json({ 
      status: 'stopped', 
      message: 'Tracker stopped successfully',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('❌ Failed to stop tracker:', error);
    res.status(500).json({ error: 'Failed to stop tracker', details: error.message });
  }
});

// Enhanced status endpoint
app.get('/status', (req, res) => {
  const isRunning = trackerProcess !== null;
  const uptime = systemStats.startTime ? 
    Math.floor((Date.now() - systemStats.startTime.getTime()) / 1000) : 0;
  
  res.json({ 
    status: isRunning ? 'running' : 'stopped',
    uptime,
    startTime: systemStats.startTime,
    processId: trackerProcess?.pid || null
  });
});

// System statistics endpoint
app.get('/stats', (req, res) => {
  const uptime = systemStats.startTime ? 
    Math.floor((Date.now() - systemStats.startTime.getTime()) / 1000) : 0;
  
  res.json({
    ...systemStats,
    uptime,
    isRunning: trackerProcess !== null,
    lastUpdated: new Date().toISOString()
  });
});

// Companies endpoint
app.get('/companies', async (req, res) => {
  try {
    if (trackerInstance && trackerInstance.companies) {
      res.json({
        companies: trackerInstance.companies,
        count: trackerInstance.companies.length,
        lastUpdated: new Date().toISOString()
      });
    } else {
      // Try to load companies directly
      const GoogleSheetsService = require('../services/GoogleSheetsService');
      const sheetsService = new GoogleSheetsService();
      await sheetsService.initialize();
      const companies = await sheetsService.getCompanies();
      
      res.json({
        companies: companies || [],
        count: companies?.length || 0,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('❌ Failed to load companies:', error);
    res.status(500).json({
      error: 'Failed to load companies',
      details: error.message,
      lastUpdated: new Date().toISOString()
    });
  }
});

// System logs endpoint
app.get('/logs', (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../logs/combined.log');
    if (fs.existsSync(logFile)) {
      const logs = fs.readFileSync(logFile, 'utf8')
        .split('\n')
        .filter(line => line.trim())
        .slice(-50) // Last 50 lines
        .map(line => {
          try {
            const parsed = JSON.parse(line);
            return {
              timestamp: parsed.timestamp,
              level: parsed.level,
              message: parsed.message
            };
          } catch {
            return {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line
            };
          }
        });
      
      res.json({ logs, count: logs.length });
    } else {
      res.json({ logs: [], count: 0 });
    }
  } catch (error) {
    res.json({ logs: [], count: 0, error: error.message });
  }
});

// Manual trigger endpoint
app.post('/trigger', async (req, res) => {
  try {
    if (!trackerInstance) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    // Trigger a manual tracking cycle
    const results = await trackerInstance.runTrackingCycle();
    
    res.json({
      success: true,
      message: 'Manual tracking cycle completed',
      results: {
        newHires: results.newHires?.length || 0,
        newJobs: results.newJobs?.length || 0,
        errors: results.errors?.length || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Manual trigger failed:', error);
    res.status(500).json({ error: 'Manual trigger failed', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    tracker: {
      running: trackerProcess !== null,
      companies: systemStats.companiesLoaded
    }
  };
  
  res.json(health);
});

// Helper function to update stats from log messages
function updateStatsFromLog(message) {
  const hiresMatch = message.match(/(\d+) new hires/);
  const jobsMatch = message.match(/(\d+) new jobs/);
  
  if (hiresMatch) {
    systemStats.totalHires += parseInt(hiresMatch[1]);
  }
  
  if (jobsMatch) {
    systemStats.totalJobs += parseInt(jobsMatch[1]);
  }
}

// Initialize tracker on startup
initializeTracker();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🌐 Gaming Tracker Web UI running on port ${PORT}`);
  logger.info(`🔗 Health check available at http://localhost:${PORT}/health`);
  logger.info(`📊 Dashboard available at http://localhost:${PORT}`);
});
