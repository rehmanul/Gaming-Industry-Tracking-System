const { WebClient } = require('@slack/web-api');
const logger = require('../utils/logger');

class SlackService {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channelId = process.env.SLACK_CHANNEL_ID;
  }

  async initialize() {
    try {
      const authTest = await this.client.auth.test();
      logger.info(`💬 Slack service initialized. Bot: ${authTest.user}`);

      // Test channel access
      await this.client.conversations.info({ channel: this.channelId });
      logger.info(`🎯 Connected to Slack channel: ${this.channelId}`);

    } catch (error) {
      logger.error('❌ Failed to initialize Slack:', error);
      throw error;
    }
  }

  async sendHireNotification(company, hire) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎯 New Gaming Industry Hire Detected"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Company:*\n${company.name}`
          },
          {
            type: "mrkdwn",
            text: `*New Hire:*\n${hire.name}`
          },
          {
            type: "mrkdwn",
            text: `*Position:*\n${hire.title}`
          },
          {
            type: "mrkdwn",
            text: `*Location:*\n${hire.location}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Skills:* ${hire.skills.join(', ') || 'N/A'}\n*Experience:* ${hire.experience} previous positions\n*Industry:* ${company.industry || 'Gaming'}\n*Company Size:* ${company.companySize || 'Unknown'}\n*Priority:* ${company.priority}`
        }
      }
    ];

    if (hire.linkedinUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View LinkedIn Profile"
            },
            url: hire.linkedinUrl,
            style: "primary"
          }
        ]
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Priority: ${company.priority} | Source: ${hire.source} | Detected: ${new Date().toLocaleString()}`
        }
      ]
    });

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: blocks,
        text: `🎯 New hire: ${hire.name} joined ${company.name} as ${hire.title}`
      });

      logger.info(`📤 Sent hire notification for ${hire.name} at ${company.name}`);
    } catch (error) {
      logger.error('❌ Failed to send hire notification:', error);
    }
  }

  async sendJobNotification(company, job) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "💼 New Gaming Industry Job Opening"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Company:*\n${company.name}`
          },
          {
            type: "mrkdwn",
            text: `*Position:*\n${job.title}`
          },
          {
            type: "mrkdwn",
            text: `*Location:*\n${job.location}`
          },
          {
            type: "mrkdwn",
            text: `*Department:*\n${job.department || 'General'}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Employment Type:* ${job.employmentType || 'Not specified'}\n*Posted:* ${new Date(job.postedDate).toLocaleDateString()}\n*Source:* ${job.source}\n*Industry:* ${company.industry || 'Gaming'}\n*Priority:* ${company.priority}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Job Posting"
            },
            url: job.url,
            style: "primary"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Priority: ${company.priority} | Company Size: ${company.companySize} | Detected: ${new Date().toLocaleString()}`
          }
        ]
      }
    ];

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: blocks,
        text: `💼 New job: ${job.title} at ${company.name} in ${job.location}`
      });

      logger.info(`📤 Sent job notification for ${job.title} at ${company.name}`);
    } catch (error) {
      logger.error('❌ Failed to send job notification:', error);
    }
  }

  async sendSystemNotification(title, message, type = 'info') {
    const emoji = {
      'info': '🤖',
      'success': '✅',
      'warning': '⚠️',
      'error': '🚨'
    };

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji[type]} ${title}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Gaming Company Tracker | ${new Date().toLocaleString()}`
          }
        ]
      }
    ];

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: blocks,
        text: `System: ${title}`
      });

      logger.info(`📤 Sent system notification: ${title}`);
    } catch (error) {
      logger.error('❌ Failed to send system notification:', error);
    }
  }

  async sendBulkSummary(hires, jobs) {
    if (hires.length === 0 && jobs.length === 0) return;

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Gaming Industry Tracking Summary"
        }
      }
    ];

    if (hires.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 New Hires Found: ${hires.length}*`
        }
      });

      const hiresText = hires.slice(0, 5).map(hire => 
        `• ${hire.name} → ${hire.title} at ${hire.companyMatched}`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: hiresText + (hires.length > 5 ? `\n_...and ${hires.length - 5} more_` : '')
        }
      });
    }

    if (jobs.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💼 New Job Openings: ${jobs.length}*`
        }
      });

      const jobsText = jobs.slice(0, 5).map(job => 
        `• ${job.title} at ${job.company || 'Unknown'} (${job.location})`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: jobsText + (jobs.length > 5 ? `\n_...and ${jobs.length - 5} more_` : '')
        }
      });
    }

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: blocks,
        text: `Summary: ${hires.length} new hires, ${jobs.length} new jobs`
      });

      logger.info(`📤 Sent bulk summary: ${hires.length} hires, ${jobs.length} jobs`);
    } catch (error) {
      logger.error('❌ Failed to send bulk summary:', error);
    }
  }
}

module.exports = SlackService;