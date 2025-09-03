#!/usr/bin/env node

/**
 * Environment Configuration Test Script
 * Tests all required environment variables and service connections
 */

import dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';
import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  log(colors.cyan, `\n🔍 ${message}`);
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

async function testEnvironmentVariables() {
  logHeader('Testing Environment Variables');

  const requiredVars = [
    'PEOPLE_DATA_LABS_API_KEY_1',
    'GOOGLE_SHEETS_CREDENTIALS_PATH',
    'GOOGLE_SHEET_ID',
    'SLACK_BOT_TOKEN',
    'SLACK_CHANNEL_ID'
  ];

  const optionalVars = [
    'PEOPLE_DATA_LABS_API_KEY_2',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_RECIPIENTS'
  ];

  let allRequired = true;

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      logSuccess(`${varName}: Configured`);
    } else {
      logError(`${varName}: Missing (Required)`);
      allRequired = false;
    }
  }

  for (const varName of optionalVars) {
    if (process.env[varName]) {
      logSuccess(`${varName}: Configured`);
    } else {
      logWarning(`${varName}: Not configured (Optional)`);
    }
  }

  return allRequired;
}

async function testGoogleSheetsConnection() {
  logHeader('Testing Google Sheets Connection');

  try {
    const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsPath || !spreadsheetId) {
      logError('Google Sheets credentials or Sheet ID missing');
      return false;
    }

    if (!fs.existsSync(credentialsPath)) {
      logError(`Credentials file not found: ${credentialsPath}`);
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Test connection by getting spreadsheet info
    await sheets.spreadsheets.get({ spreadsheetId });

    logSuccess('Google Sheets connection successful');
    return true;

  } catch (error) {
    logError(`Google Sheets connection failed: ${error.message}`);
    return false;
  }
}

async function testSlackConnection() {
  logHeader('Testing Slack Connection');

  try {
    const token = process.env.SLACK_BOT_TOKEN;
    const channelId = process.env.SLACK_CHANNEL_ID;

    if (!token || !channelId) {
      logError('Slack token or channel ID missing');
      return false;
    }

    const client = new WebClient(token);

    // Test authentication
    const auth = await client.auth.test();
    logSuccess(`Slack authenticated as: ${auth.user}`);

    // Test channel access
    await client.conversations.info({ channel: channelId });
    logSuccess('Slack channel access verified');

    return true;

  } catch (error) {
    logError(`Slack connection failed: ${error.message}`);
    return false;
  }
}

async function testPeopleDataLabsConnection() {
  logHeader('Testing People Data Labs Connection');

  try {
    const apiKey = process.env.PEOPLE_DATA_LABS_API_KEY_1;

    if (!apiKey) {
      logError('People Data Labs API key missing');
      return false;
    }

    // Test with a simple search (should return no results but test connectivity)
    const response = await axios.post('https://api.peopledatalabs.com/v5/person/search',
      {
        query: { term: { 'job_company_name': 'nonexistentcompany12345' } },
        size: 1,
        dataset: 'person'
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.status === 200) {
      logSuccess('People Data Labs API connection successful');
      return true;
    }

  } catch (error) {
    if (error.response?.status === 401) {
      logError('People Data Labs API key invalid');
    } else if (error.response?.status === 429) {
      logWarning('People Data Labs rate limit hit (but API is working)');
      return true;
    } else {
      logError(`People Data Labs connection failed: ${error.message}`);
    }
    return false;
  }
}

async function testFileStructure() {
  logHeader('Testing File Structure');

  const requiredFiles = [
    'src/app.js',
    'src/services/CompanyTracker.js',
    'src/services/HiringTracker.js',
    'src/services/JobPostingTracker.js',
    'src/services/GoogleSheetsService.js',
    'src/services/SlackService.js',
    'src/utils/logger.js',
    'package.json'
  ];

  let allFilesExist = true;

  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      logSuccess(`File exists: ${file}`);
    } else {
      logError(`File missing: ${file}`);
      allFilesExist = false;
    }
  }

  return allFilesExist;
}

async function testNodeModules() {
  logHeader('Testing Dependencies');

  try {
    // Test core dependencies
    const dependencies = [
      '@slack/web-api',
      'googleapis',
      'axios',
      'puppeteer',
      'winston'
    ];

    for (const dep of dependencies) {
      try {
        await import(dep);
        logSuccess(`Dependency available: ${dep}`);
      } catch (error) {
        logError(`Dependency missing: ${dep}`);
        return false;
      }
    }

    return true;

  } catch (error) {
    logError(`Dependencies test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  log(colors.magenta, '🎮 Gaming Industry Tracker - Environment Test Suite');
  log(colors.magenta, '=' .repeat(60));

  const results = {
    envVars: await testEnvironmentVariables(),
    files: await testFileStructure(),
    nodeModules: await testNodeModules(),
    googleSheets: await testGoogleSheetsConnection(),
    slack: await testSlackConnection(),
    pdl: await testPeopleDataLabsConnection()
  };

  log(colors.cyan, '\n📊 Test Results Summary');
  log(colors.cyan, '=' .repeat(30));

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? colors.green + 'PASS' : colors.red + 'FAIL';
    log(status, `${test}: ${passed ? '✅' : '❌'}`);
  });

  log(colors.magenta, `\n🎯 Overall Score: ${passed}/${total} tests passed`);

  if (passed === total) {
    log(colors.green, '\n🎉 All tests passed! Your tracker is ready to run.');
    log(colors.blue, 'Run the following commands to start:');
    log(colors.blue, '  npm run dev    # Development mode');
    log(colors.blue, '  npm start      # Production mode');
  } else {
    log(colors.yellow, '\n⚠️  Some tests failed. Please fix the issues above before running the tracker.');
    log(colors.blue, 'Common fixes:');
    log(colors.blue, '  - Set up missing environment variables in .env');
    log(colors.blue, '  - Download Google credentials.json');
    log(colors.blue, '  - Configure Slack bot and get tokens');
    log(colors.blue, '  - Get People Data Labs API key');
  }

  return passed === total;
}

// Run the test suite
runAllTests().catch(error => {
  log(colors.red, `\n💥 Test suite failed with error: ${error.message}`);
  process.exit(1);
});
