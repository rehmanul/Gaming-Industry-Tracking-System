class ControlRoom {
    constructor() {
        this.API_KEY = 'gaming-tracker-secure-key-2024';
        this.ws = null;
        this.charts = {};
        this.currentSection = 'overview';
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupWebSocket();
        this.initCharts();
        await this.loadInitialData();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('🔗 WebSocket connected');
            this.updateSystemStatus('Connected', 'success');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.updateSystemStatus('Disconnected', 'error');
            setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateSystemStatus('Error', 'error');
        };
    }

    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'stats':
                this.updateMetrics(data.data);
                break;
            case 'newHire':
                this.addAlert(`New hire: ${data.data.name} at ${data.data.company}`, 'info');
                break;
            case 'newJob':
                this.addAlert(`New job: ${data.data.title} at ${data.data.company}`, 'info');
                break;
            case 'alert':
                this.addAlert(data.data.message, data.data.severity);
                break;
            case 'trackingStart':
                this.addAlert('Tracking cycle started', 'info');
                break;
            case 'trackingComplete':
                this.addAlert(`Tracking complete: ${data.data.hires} hires, ${data.data.jobs} jobs`, 'success');
                break;
        }
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        this.currentSection = section;
        this.loadSectionData(section);
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    initCharts() {
        // Job Trends Chart
        const jobCtx = document.getElementById('jobTrendsChart');
        if (jobCtx) {
            this.charts.jobTrends = new Chart(jobCtx, {
                type: 'line',
                data: {
                    labels: this.getLast7Days(),
                    datasets: [{
                        label: 'New Jobs',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }

        // Companies Chart
        const compCtx = document.getElementById('companiesChart');
        if (compCtx) {
            this.charts.companies = new Chart(compCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Loading...'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#334155']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }

        // Skills Chart
        const skillsCtx = document.getElementById('skillsChart');
        if (skillsCtx) {
            this.charts.skills = new Chart(skillsCtx, {
                type: 'bar',
                data: {
                    labels: ['JavaScript', 'Unity', 'C#', 'Python', 'React'],
                    datasets: [{
                        label: 'Demand',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: '#3b82f6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }

        // Performance Chart
        const perfCtx = document.getElementById('performanceChart');
        if (perfCtx) {
            this.charts.performance = new Chart(perfCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { color: '#334155' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadDashboardData(),
                this.loadAnalyticsData(),
                this.loadCompaniesData(),
                this.loadPerformanceData()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.addAlert('Failed to load dashboard data', 'error');
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/analytics/dashboard', {
                headers: { 'X-API-Key': this.API_KEY }
            });
            
            if (!response.ok) throw new Error('Dashboard data unavailable');
            
            const data = await response.json();
            this.updateMetrics(data.metrics);
            this.updateCharts(data.charts);
            this.updateInsights(data.insights);
            this.updateAlerts(data.alerts);
            
        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    }

    async loadAnalyticsData() {
        try {
            const response = await fetch('/api/analytics/performance', {
                headers: { 'X-API-Key': this.API_KEY }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateAnalytics(data);
            }
        } catch (error) {
            console.error('Analytics load error:', error);
        }
    }

    async loadCompaniesData() {
        try {
            const response = await fetch('/api/companies', {
                headers: { 'X-API-Key': this.API_KEY }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateCompaniesGrid(data.companies || []);
            }
        } catch (error) {
            console.error('Companies load error:', error);
        }
    }

    async loadPerformanceData() {
        try {
            const response = await fetch('/api/health/detailed', {
                headers: { 'X-API-Key': this.API_KEY }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updatePerformanceMetrics(data);
            }
        } catch (error) {
            console.error('Performance load error:', error);
        }
    }

    updateMetrics(metrics) {
        if (!metrics) return;
        
        document.getElementById('totalJobs').textContent = metrics.totalJobs || 0;
        document.getElementById('totalHires').textContent = metrics.newHires || 0;
        document.getElementById('successRate').textContent = (metrics.successRate || 0) + '%';
        document.getElementById('activeCompanies').textContent = metrics.companiesTracked || 0;
        
        if (metrics.lastUpdate) {
            document.getElementById('uptime').textContent = this.formatUptime(metrics.lastUpdate);
        }
    }

    updateCharts(chartData) {
        if (!chartData) return;
        
        if (chartData.jobTrends && this.charts.jobTrends) {
            this.charts.jobTrends.data.datasets[0].data = chartData.jobTrends;
            this.charts.jobTrends.update();
        }
        
        if (chartData.companies && this.charts.companies) {
            this.charts.companies.data.labels = chartData.companies.labels;
            this.charts.companies.data.datasets[0].data = chartData.companies.values;
            this.charts.companies.data.datasets[0].backgroundColor = this.generateColors(chartData.companies.labels.length);
            this.charts.companies.update();
        }
    }

    updateAnalytics(data) {
        if (data.monitoring) {
            const marketActivity = Math.round(Math.random() * 100); // Placeholder
            document.getElementById('marketActivity').textContent = marketActivity + '%';
        }
        
        if (data.cache) {
            document.getElementById('cacheHitRate').textContent = data.cache.hitRate + '%';
        }
    }

    updateCompaniesGrid(companies) {
        const grid = document.getElementById('companiesGrid');
        if (!grid) return;
        
        grid.innerHTML = companies.map(company => `
            <div class="company-card">
                <h4>${company.name}</h4>
                <div class="company-status">
                    <span class="status-badge ${this.getCompanyStatusClass(company)}">
                        ${this.getCompanyStatus(company)}
                    </span>
                    <span style="color: #94a3b8; font-size: 0.8rem;">
                        Jobs: ${company.jobCount || 0} | Hires: ${company.hireCount || 0}
                    </span>
                </div>
            </div>
        `).join('');
    }

    updatePerformanceMetrics(data) {
        if (data.cache) {
            document.getElementById('cacheHitRate').textContent = data.cache.hitRate + '%';
        }
        
        if (this.charts.performance && data.system) {
            const now = new Date().toLocaleTimeString();
            const responseTime = Math.random() * 1000 + 200; // Placeholder
            
            this.charts.performance.data.labels.push(now);
            this.charts.performance.data.datasets[0].data.push(responseTime);
            
            if (this.charts.performance.data.labels.length > 20) {
                this.charts.performance.data.labels.shift();
                this.charts.performance.data.datasets[0].data.shift();
            }
            
            this.charts.performance.update();
        }
    }

    updateInsights(insights) {
        if (!insights) return;
        
        const growthEl = document.getElementById('growthCompanies');
        if (growthEl && insights.length > 0) {
            const marketInsight = insights.find(i => i.type === 'companies');
            if (marketInsight) {
                growthEl.textContent = marketInsight.description;
            }
        }
    }

    updateAlerts(alerts) {
        const container = document.getElementById('alertsContainer');
        if (!container || !alerts) return;
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.severity}">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">
                    ${this.getAlertIcon(alert.severity)} ${alert.message}
                </div>
                <div style="font-size: 0.8rem; color: #94a3b8;">
                    ${new Date(alert.timestamp).toLocaleString()}
                </div>
            </div>
        `).join('');
    }

    addAlert(message, severity = 'info') {
        const container = document.getElementById('alertsContainer');
        if (!container) return;
        
        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ${severity}`;
        alertEl.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem;">
                ${this.getAlertIcon(severity)} ${message}
            </div>
            <div style="font-size: 0.8rem; color: #94a3b8;">
                ${new Date().toLocaleString()}
            </div>
        `;
        
        container.insertBefore(alertEl, container.firstChild);
        
        // Keep only last 10 alerts
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    updateSystemStatus(status, type) {
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) {
            statusEl.textContent = `System ${status}`;
            
            const indicator = statusEl.parentElement.querySelector('.status-dot');
            if (indicator) {
                indicator.style.background = type === 'success' ? '#22c55e' : 
                                           type === 'error' ? '#ef4444' : '#f59e0b';
            }
        }
    }

    getCompanyStatusClass(company) {
        if (company.lastUpdated) {
            const lastUpdate = new Date(company.lastUpdated);
            const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
            
            if (hoursSince < 2) return 'status-active';
            if (hoursSince < 24) return 'status-tracking';
        }
        return 'status-error';
    }

    getCompanyStatus(company) {
        const statusClass = this.getCompanyStatusClass(company);
        switch(statusClass) {
            case 'status-active': return 'Active';
            case 'status-tracking': return 'Tracking';
            default: return 'Inactive';
        }
    }

    getAlertIcon(severity) {
        const icons = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌'
        };
        return icons[severity] || 'ℹ️';
    }

    generateColors(count) {
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
        return Array.from({length: count}, (_, i) => colors[i % colors.length]);
    }

    getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        }
        return days;
    }

    formatUptime(timestamp) {
        const diff = Date.now() - new Date(timestamp).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    loadSectionData(section) {
        switch(section) {
            case 'analytics':
                this.loadAnalyticsData();
                break;
            case 'companies':
                this.loadCompaniesData();
                break;
            case 'performance':
                this.loadPerformanceData();
                break;
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadSectionData(this.currentSection);
        }, 30000); // Refresh every 30 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Global functions for control buttons
async function forceTracking() {
    try {
        const response = await fetch('/api/force-tracking', {
            method: 'POST',
            headers: { 'X-API-Key': 'gaming-tracker-secure-key-2024' }
        });
        
        if (response.ok) {
            controlRoom.addAlert('Tracking cycle initiated', 'info');
        } else {
            throw new Error('Failed to start tracking');
        }
    } catch (error) {
        controlRoom.addAlert('Failed to start tracking: ' + error.message, 'error');
    }
}

async function reloadCompanies() {
    try {
        const response = await fetch('/api/reload-companies', {
            method: 'POST',
            headers: { 'X-API-Key': 'gaming-tracker-secure-key-2024' }
        });
        
        if (response.ok) {
            const data = await response.json();
            controlRoom.addAlert(`Reloaded ${data.count} companies`, 'success');
            controlRoom.loadCompaniesData();
        } else {
            throw new Error('Failed to reload companies');
        }
    } catch (error) {
        controlRoom.addAlert('Failed to reload companies: ' + error.message, 'error');
    }
}

async function testNotifications() {
    try {
        const response = await fetch('/api/test-notifications', {
            method: 'POST',
            headers: { 'X-API-Key': 'gaming-tracker-secure-key-2024' }
        });
        
        if (response.ok) {
            controlRoom.addAlert('Test notifications sent', 'success');
        } else {
            throw new Error('Failed to send test notifications');
        }
    } catch (error) {
        controlRoom.addAlert('Failed to send notifications: ' + error.message, 'error');
    }
}

function emergencyStop() {
    if (confirm('Are you sure you want to stop all tracking operations?')) {
        controlRoom.addAlert('Emergency stop activated', 'warning');
        // Implementation would depend on backend API
    }
}

function refreshCompanies() {
    controlRoom.loadCompaniesData();
    controlRoom.addAlert('Companies data refreshed', 'info');
}

// Initialize Control Room
let controlRoom;
document.addEventListener('DOMContentLoaded', () => {
    controlRoom = new ControlRoom();
});