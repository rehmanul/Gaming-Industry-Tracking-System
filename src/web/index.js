require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const logger = require('../utils/logger');
const CompanyTracker = require('../services/CompanyTracker');
const setupAnalyticsRoutes = require('./routes/analytics');
const security = require('../middleware/security');
const errorHandler = require('../utils/errorHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

let tracker;
let clients = [];

// Security middleware
app.use(security.getSecurityHeaders());
app.use(security.getCorsConfig());
app.use(security.rateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
wss.on('connection', (ws) => {
  clients.push(ws);
  logger.info('🔗 Web client connected');
  
  // Send initial data
  if (tracker) {
    ws.send(JSON.stringify({
      type: 'stats',
      data: tracker.getStats()
    }));
    
    ws.send(JSON.stringify({
      type: 'companies',
      data: tracker.companies
    }));
  }
  
  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    logger.info('❌ Web client disconnected');
  });
});

// Broadcast to all clients with error handling
function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(data));
      } catch (error) {
        logger.warn(`⚠️ Failed to send message to client: ${error.message}`);
      }
    }
  });
}

// API Routes with authentication
app.use('/api', security.apiKeyAuth);

// Analytics routes
app.use('/api/analytics', (req, res, next) => {
  if (tracker) {
    const analyticsRouter = setupAnalyticsRoutes(tracker.getServices());
    analyticsRouter(req, res, next);
  } else {
    res.status(503).json({ error: 'Tracker not initialized' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'control-room.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/control', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'control-room.html'));
});

app.get('/legacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', async (req, res) => {
  try {
    const healthStatus = healthMonitor ? await healthMonitor.performHealthCheck() : { status: 'unknown' };
    res.json({ 
      ...healthStatus,
      companies: tracker ? tracker.companies.length : 0,
      stats: tracker ? tracker.getAdvancedStats() : {}
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.post('/api/force-tracking', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    if (tracker.isTracking) {
      return res.status(400).json({ error: 'Tracking already in progress' });
    }
    
    broadcast({ type: 'trackingStart' });
    const results = await tracker.runTrackingCycle();
    
    broadcast({ 
      type: 'trackingComplete', 
      data: { hires: results?.newHires?.length || 0, jobs: results?.newJobs?.length || 0 }
    });
    
    res.json({ success: true, results });
  } catch (error) {
    logger.error('❌ Force tracking failed:', error);
    broadcast({ type: 'trackingError', data: { error: error.message } });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reload-companies', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    await tracker.loadCompanies();
    
    broadcast({ 
      type: 'companies', 
      data: tracker.companies 
    });
    
    res.json({ success: true, count: tracker.companies.length });
  } catch (error) {
    logger.error('❌ Reload companies failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test-notifications', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    // Send test hire notification
    const testHire = {
      name: 'John Doe',
      title: 'Senior Game Developer',
      location: 'Malta',
      skills: ['JavaScript', 'Unity', 'C#'],
      experience: 5,
      source: 'Test Data'
    };
    
    const testCompany = {
      name: 'Test Gaming Company',
      priority: 'High',
      industry: 'Gaming'
    };
    
    await tracker.slackService.sendHireNotification(testCompany, testHire);
    
    broadcast({ 
      type: 'newHire', 
      data: { ...testHire, company: testCompany.name }
    });
    
    res.json({ success: true, message: 'Test notifications sent' });
  } catch (error) {
    logger.error('❌ Test notifications failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export-data', security.requireAuth, (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    const data = {
      companies: tracker.companies || [],
      stats: tracker.getStats() || {},
      exportTime: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=gaming-tracker-data.json');
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('❌ Export failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hires', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    const hires = await tracker.sheetsService.getHires();
    res.json({ success: true, data: hires });
  } catch (error) {
    logger.error('❌ Failed to fetch hires:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    const jobs = await tracker.sheetsService.getJobs();
    res.json({ success: true, data: jobs });
  } catch (error) {
    logger.error('❌ Failed to fetch jobs:', error);
    res.status(500).json({ error: error.message });
  }
});



app.post('/api/reset-and-track', security.requireAuth, async (req, res) => {
  try {
    if (!tracker) {
      return res.status(400).json({ error: 'Tracker not initialized' });
    }
    
    broadcast({ type: 'resetStart' });
    
    // Complete fresh start
    await tracker.sheetsService.completeReset();
    
    // Historical tracking from August 1st, 2025
    const results = await tracker.runHistoricalTracking('2025-08-01');
    
    broadcast({ 
      type: 'resetComplete', 
      data: { hires: results?.newHires?.length || 0, jobs: results?.newJobs?.length || 0 }
    });
    
    res.json({ success: true, message: 'Fresh tracking completed', results });
  } catch (error) {
    logger.error('❌ Reset and tracking failed:', error);
    broadcast({ type: 'resetError', data: { error: error.message } });
    res.status(500).json({ error: error.message });
  }
});

// Initialize tracker with Phase 3 services
async function initializeTracker() {
  try {
    tracker = new CompanyTracker();
    
    await tracker.initialize();
    await tracker.start();
    
    // Override processNewHires to broadcast to web clients
    const originalProcessNewHires = tracker.processNewHires.bind(tracker);
    tracker.processNewHires = async (company, hires) => {
      await originalProcessNewHires(company, hires);
      hires.forEach(hire => {
        broadcast({ 
          type: 'newHire', 
          data: { ...hire, company: company.name }
        });
      });
    };
    
    // Override processNewJobs to broadcast to web clients
    const originalProcessNewJobs = tracker.processNewJobs.bind(tracker);
    tracker.processNewJobs = async (company, jobs) => {
      await originalProcessNewJobs(company, jobs);
      jobs.forEach(job => {
        broadcast({ 
          type: 'newJob', 
          data: { ...job, company: company.name }
        });
      });
    };
    
    logger.info('🎮 Gaming Industry Tracker initialized with Phase 3 services');
    
    // Setup monitoring alerts
    const services = tracker.getServices();
    services.monitoring.on('alert_created', (alert) => {
      broadcast({ type: 'alert', data: alert });
    });
  } catch (error) {
    logger.error('❌ Failed to initialize tracker:', error);
  }
}

// Start server
server.listen(PORT, () => {
  logger.info(`🌐 Gaming Industry Tracker Web Interface: http://localhost:${PORT}`);
  initializeTracker();
});

module.exports = { app, server, tracker };