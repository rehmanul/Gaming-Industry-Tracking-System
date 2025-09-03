// Enhanced UI Functions
function setButtonLoading(buttonElement, loading) {
    if (loading) {
        buttonElement.disabled = true;
        buttonElement.classList.add('loading');
    } else {
        buttonElement.disabled = false;
        buttonElement.classList.remove('loading');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function showTrackingStatus(message) {
    const status = document.getElementById('trackingStatus');
    const messageEl = document.getElementById('trackingMessage');
    messageEl.textContent = message;
    status.classList.add('active');
}

function hideTrackingStatus() {
    document.getElementById('trackingStatus').classList.remove('active');
}

function showTrackingIndicator() {
    document.getElementById('trackingIndicator').classList.add('active');
}

function hideTrackingIndicator() {
    document.getElementById('trackingIndicator').classList.remove('active');
}

// API Configuration
const API_KEY = 'gaming-tracker-secure-key-2024';
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
});

// Enhanced Button Functions
function forceTracking() {
    const btn = event.target;
    setButtonLoading(btn, true);
    showTrackingStatus('Running tracking cycle...');
    showTrackingIndicator();
    
    fetch('/api/force-tracking', { 
        method: 'POST',
        headers: getHeaders()
    })
        .then(response => response.json())
        .then(data => {
            setButtonLoading(btn, false);
            hideTrackingStatus();
            hideTrackingIndicator();
            if (data.success) {
                showNotification('Tracking cycle completed!');
                addActivity('🚀 Manual tracking cycle completed', 'system');
            } else {
                showNotification('Tracking failed: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            setButtonLoading(btn, false);
            hideTrackingStatus();
            hideTrackingIndicator();
            showNotification('Tracking failed: ' + error.message, 'error');
        });
}

function reloadCompanies() {
    const btn = event.target;
    setButtonLoading(btn, true);
    
    fetch('/api/reload-companies', { 
        method: 'POST',
        headers: getHeaders()
    })
        .then(response => response.json())
        .then(data => {
            setButtonLoading(btn, false);
            if (data.success) {
                showNotification(`Reloaded ${data.count} companies`);
                addActivity('🔄 Companies reloaded', 'system');
            } else {
                showNotification('Reload failed: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            setButtonLoading(btn, false);
            showNotification('Reload failed: ' + error.message, 'error');
        });
}

function testNotifications() {
    const btn = event.target;
    setButtonLoading(btn, true);
    
    fetch('/api/test-notifications', { 
        method: 'POST',
        headers: getHeaders()
    })
        .then(response => response.json())
        .then(data => {
            setButtonLoading(btn, false);
            if (data.success) {
                showNotification('Test notifications sent!');
                addActivity('🔔 Test notifications sent', 'system');
            } else {
                showNotification('Test failed: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            setButtonLoading(btn, false);
            showNotification('Test failed: ' + error.message, 'error');
        });
}

function exportData() {
    window.open('/api/export-data?apiKey=' + API_KEY, '_blank');
    showNotification('Data export started');
    addActivity('📥 Data export initiated', 'system');
}

function resetAndTrack() {
    if (!confirm('This will backup existing data and start fresh tracking. Continue?')) return;
    
    const btn = event.target;
    setButtonLoading(btn, true);
    showTrackingStatus('Backing up data and starting fresh tracking...');
    showTrackingIndicator();
    
    fetch('/api/reset-and-track', { 
        method: 'POST',
        headers: getHeaders()
    })
        .then(response => response.json())
        .then(data => {
            setButtonLoading(btn, false);
            hideTrackingStatus();
            hideTrackingIndicator();
            if (data.success) {
                showNotification('Reset and tracking completed!');
                addActivity('✨ Fresh tracking completed', 'system');
                if (document.getElementById('hiresTab').classList.contains('active')) loadHires();
                if (document.getElementById('jobsTab').classList.contains('active')) loadJobs();
            } else {
                showNotification('Reset failed: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            setButtonLoading(btn, false);
            hideTrackingStatus();
            hideTrackingIndicator();
            showNotification('Reset failed: ' + error.message, 'error');
        });
}