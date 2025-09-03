const { google } = require('googleapis');
const logger = require('../utils/logger');
const security = require('../middleware/security');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Debug logging
    logger.info(`Debug: GOOGLE_SHEET_ID = ${this.spreadsheetId}`);
    logger.info(`Debug: NODE_ENV = ${process.env.NODE_ENV}`);
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
      logger.info(`📋 Created sheet: ${security.sanitizeLog(title)}`);
    } catch (error) {
      logger.error(`❌ Failed to create sheet ${security.sanitizeLog(title)}:`, error);
    }
  }

  async setupSheetHeaders() {
    const hiresHeaders = [
      '📅 Date Added', '🏢 Company', '👤 Employee Name', '💼 Job Title', '📆 Start Date',
      '📍 Location', '🔗 LinkedIn Profile', '⭐ Experience (Years)', '🛠️ Skills', '📊 Data Source', '✅ Status'
    ];

    const jobsHeaders = [
      '📅 Date Found', '🏢 Company', '💼 Job Title', '📍 Location', '📆 Posted Date',
      '🔗 Job URL', '📊 Source', '🏛️ Department', '⏰ Employment Type', '✅ Status'
    ];

    try {
      await this.formatSheet('Hires', hiresHeaders);
      await this.formatSheet('Jobs', jobsHeaders);
    } catch (error) {
      logger.error('❌ Error setting up sheet headers:', error);
    }
  }

  async formatSheet(sheetName, headers) {
    try {
      // Always add/update headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [headers] }
      });

      // Format headers
      const sheetId = await this.getSheetId(sheetName);
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                    horizontalAlignment: 'CENTER'
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
              }
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: 0,
                  endIndex: 1
                },
                properties: { pixelSize: 40 },
                fields: 'pixelSize'
              }
            }
          ]
        }
      });

      logger.info(`📋 Setup ${security.sanitizeLog(sheetName)} sheet with formatted headers`);
    } catch (error) {
      logger.error(`❌ Error formatting ${security.sanitizeLog(sheetName)} sheet:`, error);
    }
  }

  async getSheetId(sheetName) {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      return sheet ? sheet.properties.sheetId : 0;
    } catch (error) {
      return 0;
    }
  }

  async getCompanies() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Company Data!A2:I1000'
      });

      const rows = response.data.values || [];
      logger.info(`🎬 Processing ${rows.length} rows with data`);
      const companies = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) {
          logger.debug(`⚠️ Row ${i+2}: Empty company name, skipping`);
          continue; // Skip empty rows
        }

        const company = {
          id: i + 2, // Row number
          name: row[0]?.trim(),
          website: row[1]?.trim(),
          careersPageUrl: row[2]?.trim(),
          domainOrLinkedin: row[3]?.trim(),
          industry: row[4]?.trim() || 'Gaming',
          companySize: row[5]?.trim() || 'Unknown',
          priority: row[6]?.trim() || 'High',
          trackHiring: row[7]?.trim().toUpperCase() === 'TRUE',
          trackJobs: row[8]?.trim().toUpperCase() === 'TRUE'
        };

        logger.debug(`Company ${i+2}: ${security.sanitizeLog(company.name)} | hiring: ${company.trackHiring} | jobs: ${company.trackJobs}`);

        // Parse LinkedIn URL and extract company ID if possible
        if (company.domainOrLinkedin?.includes('linkedin.com/company/')) {
          company.linkedinUrl = company.domainOrLinkedin;
          const match = company.domainOrLinkedin.match(/linkedin\.com\/company\/([^/?]+)/);
          company.linkedinSlug = match ? match[1] : null;
        }

        // Add all companies with names (remove tracking filter to get all 18)
        if (company.name) {
          companies.push(company);
          logger.debug(`✅ Added company: ${security.sanitizeLog(company.name)}`);
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
        new Date().toLocaleDateString(),
        company.name,
        hire.name || 'Name not disclosed in profile',
        hire.title || 'Position title not specified',
        hire.startDate || 'Start date not mentioned',
        hire.location || 'Location not specified in profile',
        hire.linkedinUrl || 'LinkedIn profile not available',
        hire.experience || 'Experience level not disclosed',
        Array.isArray(hire.skills) ? hire.skills.join(', ') : (hire.skills || 'Skills not listed in profile'),
        hire.source || 'People Data Labs API',
        hire.salary || 'Salary not disclosed',
        hire.department || 'Department not specified',
        '🆕 New'
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Hires!A:M',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      logger.info(`👤 Added new hire: ${security.sanitizeLog(hire.name || 'New hire')} at ${security.sanitizeLog(company.name)}`);

    } catch (error) {
      logger.error('❌ Failed to add hire to sheet:', error);
      throw error;
    }
  }

  async addJob(company, job) {
    try {
      const values = [[
        new Date().toLocaleDateString(),
        company.name,
        job.title || 'Job title not specified in posting',
        job.location || 'Location not defined in post',
        job.postedDate || 'Posted date not available',
        job.url || 'Direct job URL not accessible',
        job.source || 'Career Page Scraping',
        job.department || 'Department not specified',
        job.employmentType || 'Employment type not mentioned',
        job.salary || 'Salary not disclosed',
        job.requirements || 'Requirements not listed in posting',
        job.benefits || 'Benefits not mentioned in posting',
        '🆕 New'
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Jobs!A:M',
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      logger.info(`💼 Added new job: ${security.sanitizeLog(job.title || 'New job posting')} at ${security.sanitizeLog(company.name)}`);

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

  async getHires() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Hires!A:K'
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        timestamp: row[0],
        company: row[1],
        name: row[2],
        title: row[3],
        startDate: row[4],
        location: row[5],
        linkedinUrl: row[6],
        experience: row[7],
        skills: row[8],
        source: row[9],
        status: row[10]
      }));
    } catch (error) {
      logger.error('❌ Failed to get hires:', error);
      return [];
    }
  }

  async getJobs() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Jobs!A:J'
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        timestamp: row[0],
        company: row[1],
        title: row[2],
        location: row[3],
        postedDate: row[4],
        url: row[5],
        source: row[6],
        department: row[7],
        employmentType: row[8],
        status: row[9]
      }));
    } catch (error) {
      logger.error('❌ Failed to get jobs:', error);
      return [];
    }
  }

  async completeReset() {
    try {
      logger.info('🧹 Starting complete fresh reset...');
      
      // Delete all sheets except Company Data
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheetsToDelete = spreadsheet.data.sheets
        .filter(sheet => !sheet.properties.title.includes('Company Data'))
        .map(sheet => sheet.properties.sheetId);
      
      if (sheetsToDelete.length > 0) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          resource: {
            requests: sheetsToDelete.map(sheetId => ({
              deleteSheet: { sheetId }
            }))
          }
        });
      }
      
      // Create fresh sheets
      await this.createSheet('Hires');
      await this.createSheet('Jobs');
      
      // Setup detailed headers
      await this.setupDetailedHeaders();
      
      logger.info('✨ Complete fresh reset completed - ready for historical tracking');
      
    } catch (error) {
      logger.error('❌ Failed to complete reset:', error);
      throw error;
    }
  }

  async setupDetailedHeaders() {
    const hiresHeaders = [
      '📅 Date Added', '🏢 Company', '👤 Employee Name', '💼 Job Title', '📆 Start Date',
      '📍 Location', '🔗 LinkedIn Profile', '⭐ Experience (Years)', '🛠️ Skills', 
      '📊 Data Source', '💰 Salary Range', '🏛️ Department', '✅ Status'
    ];

    const jobsHeaders = [
      '📅 Date Found', '🏢 Company', '💼 Job Title', '📍 Location', '📆 Posted Date',
      '🔗 Job URL', '📊 Source', '🏛️ Department', '⏰ Employment Type', 
      '💰 Salary Range', '📝 Requirements', '🎁 Benefits', '✅ Status'
    ];

    await this.formatSheet('Hires', hiresHeaders);
    await this.formatSheet('Jobs', jobsHeaders);
  }

  async addSampleData() {
    logger.info('⚠️ Sample data functionality disabled - use real tracking instead');
    throw new Error('Sample data has been disabled. Use real tracking functionality.');
  }
}

module.exports = GoogleSheetsService;
