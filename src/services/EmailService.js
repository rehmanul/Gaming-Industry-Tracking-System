const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.recipients = process.env.EMAIL_RECIPIENTS ? 
      process.env.EMAIL_RECIPIENTS.split(',').map(email => email.trim()) : [];
  }

  async initialize() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      logger.warn('⚠️ Email configuration not provided, email notifications disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await this.transporter.verify();
      logger.info('📧 Email service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize email service:', error);
      throw error;
    }
  }

  async sendHireNotification(company, hire) {
    if (!this.transporter) return;

    const subject = `🎯 Gaming Industry Hire: ${hire.name} joined ${company.name}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">🎯 New Gaming Industry Hire</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Detected: ${new Date().toLocaleString()}</p>
        </div>
        <div style="background: white; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Company</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${company.name}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">New Hire</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${hire.name}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Position</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${hire.title}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Location</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${hire.location}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Skills</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${hire.skills.join(', ') || 'N/A'}</td>
            </tr>
          </table>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0; color: #1565c0;">Company Details</h4>
            <p style="margin: 5px 0;"><strong>Industry:</strong> ${company.industry || 'Gaming'}</p>
            <p style="margin: 5px 0;"><strong>Company Size:</strong> ${company.companySize || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Priority Level:</strong> ${company.priority}</p>
            <p style="margin: 5px 0;"><strong>Experience Level:</strong> ${hire.experience} previous positions</p>
          </div>

          ${hire.linkedinUrl ? `
          <div style="text-align: center; margin-top: 20px;">
            <a href="${hire.linkedinUrl}" style="background: #0077b5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">View LinkedIn Profile</a>
          </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            Gaming Company Tracker | Source: ${hire.source} | Priority: ${company.priority}
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: this.recipients,
      subject,
      html
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Sent hire email for ${hire.name} at ${company.name}`);
    } catch (error) {
      logger.error('❌ Failed to send hire email:', error);
    }
  }

  async sendJobNotification(company, job) {
    if (!this.transporter) return;

    const subject = `💼 Gaming Industry Job: ${job.title} at ${company.name}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">💼 New Gaming Industry Job</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Detected: ${new Date().toLocaleString()}</p>
        </div>
        <div style="background: white; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Company</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${company.name}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Position</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${job.title}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Location</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${job.location}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Department</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${job.department || 'General'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Employment Type</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${job.employmentType || 'Not specified'}</td>
            </tr>
          </table>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">Company Information</h4>
            <p style="margin: 5px 0;"><strong>Industry:</strong> ${company.industry || 'Gaming'}</p>
            <p style="margin: 5px 0;"><strong>Company Size:</strong> ${company.companySize || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Priority Level:</strong> ${company.priority}</p>
            <p style="margin: 5px 0;"><strong>Source:</strong> ${job.source}</p>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <a href="${job.url}" style="background: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Job Posting</a>
          </div>

          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            Gaming Company Tracker | Source: ${job.source} | Priority: ${company.priority}
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: this.recipients,
      subject,
      html
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Sent job email for ${job.title} at ${company.name}`);
    } catch (error) {
      logger.error('❌ Failed to send job email:', error);
    }
  }

  async sendDailySummary(stats, totalCompanies) {
    if (!this.transporter) return;

    const subject = `📊 Daily Gaming Industry Tracking Summary`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">📊 Daily Gaming Industry Summary</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString()}</p>
        </div>
        <div style="background: white; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 32px;">${stats.totalHires}</h3>
              <p style="margin: 0; color: #1976d2; font-weight: bold;">Hires Tracked</p>
            </div>
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 32px;">${stats.totalJobs}</h3>
              <p style="margin: 0; color: #388e3c; font-weight: bold;">Jobs Tracked</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Companies Monitored</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${totalCompanies}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Last Run</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${stats.lastRun ? new Date(stats.lastRun).toLocaleString() : 'N/A'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Total Errors</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${stats.errors}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">System Status</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;"><span style="color: #28a745;">✅ Running</span></td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d; margin: 0;">
            Gaming Company Tracker | Automated daily summary
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: this.recipients,
      subject,
      html
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('📧 Sent daily summary email');
    } catch (error) {
      logger.error('❌ Failed to send daily summary email:', error);
    }
  }
}

module.exports = EmailService;