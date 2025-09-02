const { google } = require('googleapis');
const logger = require('../utils/logger');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
  }

  async initialize() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth });

      // Test connection and create necessary sheets if they don't exist
      await this.ensureSheetsExist();
      logger.info('📊 Google Sheets service initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Google Sheets:', error);
      throw error;
    }
  }

  async ensureSheetsExist() {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);

      // Create missing sheets
      const requiredSheets = ['Hires', 'Jobs'];
      for (const sheetName of requiredSheets) {
        if (!existingSheets.includes(sheetName)) {
          await this.createSheet(sheetName);
        }
      }

      // Set up headers if sheets are empty
      await this.setupSheetHeaders();

    } catch (error) {
      logger.error('❌ Error ensuring sheets exist:', error);
    }
  }

  async createSheet(title) {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: { title }
            }
          }]
        }
      });
      logger.info(`📋 Created sheet: ${title}`);
    } catch (error) {
      logger.error(`❌ Failed to create sheet ${title}:`, error);
    }
  }

  async setupSheetHeaders() {
    // Setup Hires sheet headers
    const hiresHeaders = [
      'Timestamp', 'Company Name', 'Employee Name', 'Job Title', 'Start Date',
      'Location', 'LinkedIn URL', 'Experience Level', 'Skills', 'Source', 'Status'
    ];

    // Setup Jobs sheet headers  
    const jobsHeaders = [
      'Timestamp', 'Company Name', 'Job Title', 'Location', 'Posted Date',
      'Job URL', 'Source', 'Department', 'Employment Type', 'Status'
    ];

    try {
      // Check if headers already exist
      const hiresResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Hires!A1:K1'
      });

      if (!hiresResponse.data.values || hiresResponse.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Hires!A1:K1',
          valueInputOption: 'USER_ENTERED',
          resource: { values: [hiresHeaders] }
        });
        logger.info('📋 Setup Hires sheet headers');
      }

      const jobsResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Jobs!A1:J1'
      });

      if (!jobsResponse.data.values || jobsResponse.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Jobs!A1:J1',
          valueInputOption: 'USER_ENTERED',
          resource: { values: [jobsHeaders] }
        });
        logger.info('📋 Setup Jobs sheet headers');
      }

    } catch (error) {
      logger.error('❌ Error setting up sheet headers:', error);
    }
  }

  async getCompanies() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A2:I1000', // Reading from main sheet
      });

      const rows = response.data.values || [];
      const companies = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // Skip empty rows

        const company = {
          id: i + 2, // Row number
          name: row[0]?.trim(),
          website: row[1]?.trim(),
          careersPageUrl: row[2]?.trim(),
          domainOrLinkedin: row[3]?.trim(),
          industry: row[4]?.trim() || 'Gaming',
          companySize: row[5]?.trim() || 'Unknown',
          priority: row[6]?.trim() || 'Medium',
          trackHiring: row[7]?.trim().toUpperCase() === 'TRUE',
          trackJobs: row[8]?.trim().toUpperCase() === 'TRUE'
        };

        // Parse LinkedIn URL and extract company ID if possible
        if (company.domainOrLinkedin?.includes('linkedin.com/company/')) {
          company.linkedinUrl = company.domainOrLinkedin;
          const match = company.domainOrLinkedin.match(/linkedin\.com\/company\/([^\/\?]+)/);
          company.linkedinSlug = match ? match[1] : null;
        }

        // Only add companies that should be tracked
        if (company.name && (company.trackHiring || company.trackJobs)) {
          companies.push(company);
        }
      }

      logger.info(`🎮 Loaded ${companies.length} gaming companies for tracking`);
      return companies;

    } catch (error) {
      logger.error('❌ Failed to get companies from sheet:', error);
      throw error;
    }
  }

  async addHire(company, hire) {
    try {
      const values = [[
        new Date().toISOString(),
        company.name,
        hire.name,
        hire.title,
        hire.startDate,
        hire.location,
        hire.linkedinUrl || '',
        hire.experience || 0,
        hire.skills.join(', '),
        hire.source || 'People Data Labs',
        'New'
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Hires!A:K',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      logger.info(`👤 Added new hire: ${hire.name} at ${company.name}`);

    } catch (error) {
      logger.error('❌ Failed to add hire to sheet:', error);
      throw error;
    }
  }

  async addJob(company, job) {
    try {
      const values = [[
        new Date().toISOString(),
        company.name,
        job.title,
        job.location,
        job.postedDate,
        job.url,
        job.source,
        job.department || '',
        job.employmentType || '',
        'New'
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Jobs!A:J',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      logger.info(`💼 Added new job: ${job.title} at ${company.name}`);

    } catch (error) {
      logger.error('❌ Failed to add job to sheet:', error);
      throw error;
    }
  }

  async getExistingHires(company, days = 30) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Hires!A:K'
      });

      const rows = response.data.values || [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return rows.slice(1) // Skip header
        .filter(row => row[1] === company.name) // Filter by company
        .filter(row => new Date(row[0]) > cutoffDate) // Filter by date
        .map(row => ({
          name: row[2],
          title: row[3],
          startDate: row[4]
        }));

    } catch (error) {
      logger.error('❌ Failed to get existing hires:', error);
      return [];
    }
  }

  async getExistingJobs(company, days = 30) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Jobs!A:J'
      });

      const rows = response.data.values || [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return rows.slice(1) // Skip header
        .filter(row => row[1] === company.name) // Filter by company
        .filter(row => new Date(row[0]) > cutoffDate) // Filter by date
        .map(row => ({
          title: row[2],
          location: row[3],
          url: row[5]
        }));

    } catch (error) {
      logger.error('❌ Failed to get existing jobs:', error);
      return [];
    }
  }
}

module.exports = GoogleSheetsService;