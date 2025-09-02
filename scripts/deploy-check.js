#!/usr/bin/env node

/**
 * Deployment verification script for Render
 * Checks if all required dependencies and configurations are present
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Gaming Industry Tracker - Deployment Check\n');

const checks = [];
let hasErrors = false;

// Check if required files exist
const requiredFiles = [
  'package.json',
  'Dockerfile', 
  'render.yaml',
  'src/app.js',
  'src/web/index.js',
  'src/services/CompanyTracker.js'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checks.push(`✅ ${file} exists`);
  } else {
    checks.push(`❌ ${file} missing`);
    hasErrors = true;
  }
});

// Check package.json dependencies
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = [
    'express',
    'body-parser', 
    'dotenv',
    'puppeteer',
    'winston',
    'node-cron',
    'axios'
  ];
  
  requiredDeps.forEach(dep => {
    if (pkg.dependencies[dep]) {
      checks.push(`✅ Dependency: ${dep}`);
    } else {
      checks.push(`❌ Missing dependency: ${dep}`);
      hasErrors = true;
    }
  });
  
  // Check scripts
  if (pkg.scripts.web) {
    checks.push(`✅ Web script defined`);
  } else {
    checks.push(`❌ Missing 'web' script in package.json`);
    hasErrors = true;
  }
  
} catch (error) {
  checks.push(`❌ Error reading package.json: ${error.message}`);
  hasErrors = true;
}

// Check Dockerfile
try {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
  
  if (dockerfile.includes('PUPPETEER_EXECUTABLE_PATH')) {
    checks.push(`✅ Dockerfile has Puppeteer config`);
  } else {
    checks.push(`⚠️ Dockerfile missing Puppeteer config`);
  }
  
  if (dockerfile.includes('chromium')) {
    checks.push(`✅ Dockerfile installs Chromium`);
  } else {
    checks.push(`❌ Dockerfile missing Chromium installation`);
    hasErrors = true;
  }
  
} catch (error) {
  checks.push(`❌ Error reading Dockerfile: ${error.message}`);
  hasErrors = true;
}

// Check render.yaml
try {
  const renderConfig = fs.readFileSync('render.yaml', 'utf8');
  
  if (renderConfig.includes('healthCheckPath')) {
    checks.push(`✅ Render config has health check`);
  } else {
    checks.push(`⚠️ Render config missing health check path`);
  }
  
  if (renderConfig.includes('PORT')) {
    checks.push(`✅ Render config sets PORT`);
  } else {
    checks.push(`❌ Render config missing PORT variable`);
    hasErrors = true;
  }
  
} catch (error) {
  checks.push(`❌ Error reading render.yaml: ${error.message}`);
  hasErrors = true;
}

// Print results
console.log('📋 Deployment Check Results:\n');
checks.forEach(check => console.log(check));

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('❌ DEPLOYMENT NOT READY - Fix errors above');
  process.exit(1);
} else {
  console.log('✅ DEPLOYMENT READY - All checks passed!');
  console.log('\n📝 Next steps:');
  console.log('1. Push code to GitHub');
  console.log('2. Connect repository to Render');
  console.log('3. Set environment variables in Render dashboard');
  console.log('4. Deploy and monitor logs');
  process.exit(0);
}