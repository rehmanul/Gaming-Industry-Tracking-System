const winston = require('winston');

class AlertService {
  constructor(slackService, emailService) {
    this.slack = slackService;
    this.email = emailService;
    this.alertHistory = [];
    this.suppressionRules = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/alerts.log' })
      ]
    });
  }

  async sendAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}`;
    
    // Check suppression rules
    if (this.isSuppressed(alertKey)) {
      this.logger.debug(`Alert suppressed: ${alertKey}`);
      return;
    }

    try {
      // Send to appropriate channels based on severity
      if (alert.severity === 'critical') {
        await Promise.all([
          this.sendSlackAlert(alert),
          this.sendEmailAlert(alert)
        ]);
      } else if (alert.severity === 'warning') {
        await this.sendSlackAlert(alert);
      }

      // Record alert
      this.alertHistory.push({
        ...alert,
        sentAt: new Date(),
        channels: this.getChannelsForSeverity(alert.severity)
      });

      // Apply suppression
      this.applySuppression(alertKey, alert.severity);

      this.logger.info(`Alert sent: ${alert.type} - ${alert.message}`);

    } catch (error) {
      this.logger.error(`Failed to send alert: ${error.message}`);
    }
  }

  async sendSlackAlert(alert) {
    const emoji = this.getEmojiForSeverity(alert.severity);
    const color = this.getColorForSeverity(alert.severity);
    
    const message = {
      text: `${emoji} ${alert.type.toUpperCase()}`,
      attachments: [{
        color,
        fields: [
          { title: 'Message', value: alert.message, short: false },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Time', value: new Date().toISOString(), short: true }
        ]
      }]
    };

    await this.slack.sendMessage(message);
  }

  async sendEmailAlert(alert) {
    const subject = `[${alert.severity.toUpperCase()}] Gaming Tracker Alert: ${alert.type}`;
    const body = `
Alert Details:
- Type: ${alert.type}
- Severity: ${alert.severity}
- Message: ${alert.message}
- Time: ${new Date().toISOString()}

This is an automated alert from the Gaming Industry Tracker system.
    `;

    await this.email.sendAlert(subject, body);
  }

  isSuppressed(alertKey) {
    const suppression = this.suppressionRules.get(alertKey);
    if (!suppression) return false;
    
    return Date.now() < suppression.until;
  }

  applySuppression(alertKey, severity) {
    const suppressionTime = this.getSuppressionTime(severity);
    this.suppressionRules.set(alertKey, {
      until: Date.now() + suppressionTime
    });
  }

  getSuppressionTime(severity) {
    const times = {
      'critical': 15 * 60 * 1000, // 15 minutes
      'warning': 30 * 60 * 1000,  // 30 minutes
      'info': 60 * 60 * 1000      // 1 hour
    };
    return times[severity] || times.info;
  }

  getEmojiForSeverity(severity) {
    const emojis = {
      'critical': '🚨',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    return emojis[severity] || '📢';
  }

  getColorForSeverity(severity) {
    const colors = {
      'critical': 'danger',
      'warning': 'warning',
      'info': 'good'
    };
    return colors[severity] || 'good';
  }

  getChannelsForSeverity(severity) {
    if (severity === 'critical') return ['slack', 'email'];
    if (severity === 'warning') return ['slack'];
    return ['log'];
  }

  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  clearSuppressions() {
    this.suppressionRules.clear();
    this.logger.info('Alert suppressions cleared');
  }
}

module.exports = AlertService;