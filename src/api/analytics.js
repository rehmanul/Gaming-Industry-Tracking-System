const express = require('express');
const router = express.Router();

class AnalyticsAPI {
  constructor(services) {
    this.monitoring = services.monitoring;
    this.intelligence = services.intelligence;
    this.cache = services.cache;
    this.companyTracker = services.companyTracker;
  }

  setupRoutes() {
    router.get('/dashboard', async (req, res) => {
      try {
        let data = this.cache.getCachedAnalytics();
        
        if (!data) {
          const [metrics, insights, alerts] = await Promise.all([
            this.getMetrics(),
            this.getInsights(),
            this.getAlerts()
          ]);

          data = {
            metrics,
            insights,
            alerts,
            charts: await this.getChartData(),
            timestamp: new Date()
          };

          this.cache.cacheAnalytics(data);
        }

        res.json(data);
      } catch (error) {
        this.monitoring.recordMetric('error', 1, { endpoint: '/dashboard' });
        res.status(500).json({ error: 'Analytics unavailable' });
      }
    });

    router.get('/export', async (req, res) => {
      try {
        const data = await this.exportData();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
        res.send(data);
      } catch (error) {
        res.status(500).json({ error: 'Export failed' });
      }
    });

    router.get('/performance', async (req, res) => {
      const stats = {
        monitoring: this.monitoring.getHealthStatus(),
        cache: this.cache.getStats(),
        system: process.memoryUsage()
      };
      res.json(stats);
    });

    return router;
  }

  async getMetrics() {
    const companies = await this.companyTracker.getCompanies();
    const totalJobs = companies.reduce((sum, c) => sum + (c.jobCount || 0), 0);
    const totalHires = companies.reduce((sum, c) => sum + (c.hireCount || 0), 0);
    
    return {
      totalJobs,
      newHires: totalHires,
      successRate: this.monitoring.metrics.successRate,
      systemHealth: this.getSystemHealth(),
      companiesTracked: companies.length,
      lastUpdate: new Date()
    };
  }

  async getInsights() {
    const insights = this.intelligence.generateInsights();
    return [
      {
        title: 'Market Activity',
        description: `${insights.marketTrends.marketActivity}% of companies actively hiring`,
        type: 'trend'
      },
      {
        title: 'Top Growth Companies',
        description: insights.topGrowthCompanies.slice(0, 3).map(c => c.company).join(', '),
        type: 'companies'
      },
      {
        title: 'Hot Skills',
        description: insights.hottestSkills.slice(0, 5).map(s => s.skill).join(', '),
        type: 'skills'
      }
    ];
  }

  async getAlerts() {
    const health = this.monitoring.getHealthStatus();
    const alerts = [...health.alerts];

    const cacheStats = this.cache.getStats();
    if (parseFloat(cacheStats.hitRate) < 80) {
      alerts.push({
        severity: 'warning',
        message: `Low cache hit rate: ${cacheStats.hitRate}%`,
        timestamp: new Date()
      });
    }

    return alerts.slice(-5);
  }

  async getChartData() {
    const companies = await this.companyTracker.getCompanies();
    
    return {
      jobTrends: this.generateJobTrends(),
      companies: {
        labels: companies.slice(0, 5).map(c => c.name),
        values: companies.slice(0, 5).map(c => c.jobCount || 0)
      }
    };
  }

  generateJobTrends() {
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      trends.push(Math.floor(Math.random() * 30) + 10);
    }
    return trends;
  }

  getSystemHealth() {
    const health = this.monitoring.getHealthStatus();
    return health.status;
  }

  async exportData() {
    const companies = await this.companyTracker.getCompanies();
    const csv = ['Company,Jobs,Hires,Last Updated'];
    
    companies.forEach(company => {
      csv.push(`${company.name},${company.jobCount || 0},${company.hireCount || 0},${company.lastUpdated || 'Never'}`);
    });

    return csv.join('\n');
  }
}

module.exports = AnalyticsAPI;