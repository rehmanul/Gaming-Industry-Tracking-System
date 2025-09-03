const express = require('express');
const AnalyticsAPI = require('../../api/analytics');

function setupAnalyticsRoutes(services) {
  const router = express.Router();
  const analyticsAPI = new AnalyticsAPI(services);
  
  return analyticsAPI.setupRoutes();
}

module.exports = setupAnalyticsRoutes;