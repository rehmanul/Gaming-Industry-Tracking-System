#!/usr/bin/env node

/**
 * Hybrid Job Scraper - Combines Node.js orchestration with Python scraping power
 * Uses the proven Python scraper as a subprocess for maximum reliability
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../src/utils/logger');

class HybridJobScraper {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, 'python_scraper.py');
    this.setupPythonScript();
  }

  setupPythonScript() {
    // Create Python scraper script based on your working job_tracker
    const pythonScript = `
import sys
import json
import requests
from bs4 import BeautifulSoup
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def create_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    try:
        driver = webdriver.Chrome(options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except:
        return None

def scrape_jobs(company_data):
    jobs = []
    
    # Strategy 1: Requests + BeautifulSoup
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(company_data['careersPageUrl'], headers=headers, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            job_keywords = ['engineer', 'developer', 'manager', 'analyst', 'specialist', 'coordinator', 'director', 'lead']
            skip_keywords = ['apply', 'view all', 'see more', 'home', 'about', 'contact']
            
            for link in soup.find_all('a', href=True):
                text = link.get_text().strip()
                if (10 <= len(text) <= 150 and
                    any(kw in text.lower() for kw in job_keywords) and
                    not any(skip in text.lower() for skip in skip_keywords)):
                    
                    href = link.get('href', '')
                    if not href.startswith('http'):
                        from urllib.parse import urljoin
                        href = urljoin(company_data['careersPageUrl'], href)
                    
                    jobs.append({
                        'title': text,
                        'url': href,
                        'location': 'Remote',
                        'department': 'General',
                        'source': 'career_page',
                        'confidence': 0.8
                    })
                    
                    if len(jobs) >= 25:
                        break
    except Exception as e:
        print(f"Requests strategy failed: {e}", file=sys.stderr)
    
    # Strategy 2: Selenium fallback
    if len(jobs) < 5:
        driver = create_driver()
        if driver:
            try:
                driver.get(company_data['careersPageUrl'])
                time.sleep(3)
                
                elements = driver.find_elements(By.TAG_NAME, "a")
                for element in elements[:100]:
                    try:
                        text = element.text.strip()
                        if (10 <= len(text) <= 150 and
                            any(kw in text.lower() for kw in ['engineer', 'developer', 'manager']) and
                            not any(skip in text.lower() for skip in ['apply', 'view all'])):
                            
                            href = element.get_attribute('href') or company_data['careersPageUrl']
                            jobs.append({
                                'title': text,
                                'url': href,
                                'location': 'Remote',
                                'department': 'General',
                                'source': 'selenium',
                                'confidence': 0.9
                            })
                            
                            if len(jobs) >= 25:
                                break
                    except:
                        continue
                        
            except Exception as e:
                print(f"Selenium strategy failed: {e}", file=sys.stderr)
            finally:
                driver.quit()
    
    return jobs

if __name__ == "__main__":
    try:
        company_data = json.loads(sys.argv[1])
        jobs = scrape_jobs(company_data)
        print(json.dumps(jobs))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
`;

    fs.writeFileSync(this.pythonScriptPath, pythonScript);
  }

  async scrapeCompanyJobs(company) {
    return new Promise((resolve, reject) => {
      const companyData = JSON.stringify({
        name: company.name,
        careersPageUrl: company.careersPageUrl || company.career_page
      });

      const pythonProcess = spawn('python', [this.pythonScriptPath, companyData], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const jobs = JSON.parse(stdout);
            logger.info(`✅ Python scraper found ${jobs.length} jobs for ${company.name}`);
            resolve(jobs.map(job => ({
              title: job.title,
              location: job.location,
              url: job.url,
              postedDate: new Date().toISOString().split('T')[0],
              source: 'Python Hybrid Scraper',
              department: job.department,
              employmentType: 'Full-time',
              timestamp: new Date().toISOString()
            })));
          } catch (error) {
            logger.error(`Failed to parse Python scraper output: ${error.message}`);
            resolve([]);
          }
        } else {
          logger.error(`Python scraper failed for ${company.name}: ${stderr}`);
          resolve([]);
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonProcess.kill();
        logger.warn(`Python scraper timeout for ${company.name}`);
        resolve([]);
      }, 60000);
    });
  }
}

module.exports = HybridJobScraper;