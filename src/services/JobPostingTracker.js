const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const logger = require('../utils/logger');
const security = require('../middleware/security');

class JobPostingTracker {
  constructor() {
    this.browser = null;
    this.lastChecked = new Map();
    this.sheetsService = null;
  }

  setGoogleSheetsService(sheetsService) {
    this.sheetsService = sheetsService;
  }

  async initializeBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });
      logger.info('🌐 Browser initialized for job scraping');
    }
  }

  async trackCompany(company) {
    if (!company.trackJobs) {
      return [];
    }

    try {
      // Skip companies with known issues
      const problematicDomains = ['netent.com', 'evolution.com'];
      if (company.careersPageUrl && problematicDomains.some(domain => company.careersPageUrl.includes(domain))) {
        logger.debug(`Skipping problematic domain for ${security.sanitizeLog(company.name)}`);
        return [];
      }

      await this.initializeBrowser();
      const newJobs = [];

      if (company.careersPageUrl) {
        try {
          const careerJobs = await Promise.race([
            this.scrapeCompanyCareersPage(company),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 45000))
          ]);
          newJobs.push(...careerJobs);
        } catch (error) {
          logger.debug(`Career page scraping failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
        }
      }

      if (company.linkedinUrl && company.linkedinSlug) {
        try {
          const linkedinJobs = await Promise.race([
            this.scrapeLinkedInJobs(company),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
          ]);
          newJobs.push(...linkedinJobs);
        } catch (error) {
          logger.debug(`LinkedIn scraping failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
        }
      }

      const existingJobs = await this.sheetsService?.getExistingJobs(company, 30) ?? [];
      const filteredJobs = this.filterDuplicateJobs(newJobs, existingJobs);

      this.lastChecked.set(company.id, Date.now());

      if (filteredJobs.length > 0) {
        logger.info(`💼 Found ${filteredJobs.length} new jobs for ${security.sanitizeLog(company.name)}`);
      }

      return filteredJobs;

    } catch (error) {
      logger.debug(`Error tracking jobs for ${security.sanitizeLog(company.name)}: ${error.message}`);
      return [];
    }
  }

  async searchHistoricalJobs(company, startDate) {
    try {
      logger.info(`📅 Searching historical jobs for ${security.sanitizeLog(company.name)} from ${startDate}`);
      
      await this.initializeBrowser();
      const jobs = [];

      if (company.careersPageUrl) {
        const careerJobs = await this.scrapeCompanyCareersPage(company);
        jobs.push(...careerJobs);
      }

      if (company.linkedinUrl && company.linkedinSlug) {
        const linkedinJobs = await this.scrapeLinkedInJobs(company);
        jobs.push(...linkedinJobs);
      }

      // Filter jobs posted since start date
      const startDateTime = new Date(startDate).getTime();
      const historicalJobs = jobs.filter(job => {
        if (!job.postedDate) return true;
        const jobDate = new Date(job.postedDate).getTime();
        return jobDate >= startDateTime;
      });

      logger.info(`📅 Found ${historicalJobs.length} historical jobs for ${security.sanitizeLog(company.name)}`);
      return historicalJobs;

    } catch (error) {
      logger.error(`❌ Historical job search failed for ${security.sanitizeLog(company.name)}:`, error);
      return [];
    }
  }

  async scrapeCompanyCareersPage(company) {
    if (!company.careersPageUrl) return [];

    logger.debug(`🔍 Scraping careers page: ${security.sanitizeLog(company.careersPageUrl)}`);
    
    // Strategy 1: Try Puppeteer with enhanced selectors
    try {
      const puppeteerJobs = await this.scrapeWithPuppeteer(company.careersPageUrl, company);
      if (puppeteerJobs.length > 0) {
        logger.info(`✅ Found ${puppeteerJobs.length} jobs using Puppeteer for ${security.sanitizeLog(company.name)}`);
        return puppeteerJobs;
      }
    } catch (error) {
      logger.debug(`Puppeteer failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
    }

    // Strategy 2: Try requests with enhanced parsing
    try {
      const requestJobs = await this.scrapeWithRequests(company.careersPageUrl, company);
      if (requestJobs.length > 0) {
        logger.info(`✅ Found ${requestJobs.length} jobs using requests for ${security.sanitizeLog(company.name)}`);
        return requestJobs;
      }
    } catch (error) {
      logger.debug(`Requests failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
    }

    logger.debug(`No jobs found for ${security.sanitizeLog(company.name)} using any strategy`);
    return [];
  }

  async scrapeWithPuppeteer(careersUrl, company) {
    const page = await this.browser.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(careersUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      // Wait for content and scroll
      await page.waitForTimeout(3000);
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);

      // Enhanced job extraction
      const jobs = await page.evaluate((companyName) => {
        const jobKeywords = [
          'engineer', 'developer', 'manager', 'analyst', 'specialist',
          'coordinator', 'director', 'lead', 'senior', 'junior', 'intern',
          'architect', 'consultant', 'designer', 'scientist', 'officer'
        ];
        
        const skipKeywords = [
          'apply', 'view all', 'see more', 'load more', 'home', 'about',
          'contact', 'privacy', 'terms', 'cookie', 'back to', 'return to'
        ];
        
        const foundJobs = [];
        const seenTitles = new Set();
        
        // Strategy 1: Look for job links
        const links = Array.from(document.querySelectorAll('a'));
        
        for (const link of links) {
          const text = link.textContent.trim();
          const href = link.href || window.location.href;
          
          if (text.length >= 10 && text.length <= 150 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip)) &&
              !seenTitles.has(text.toLowerCase())) {
            
            seenTitles.add(text.toLowerCase());
            foundJobs.push({
              title: text,
              url: href,
              location: 'Remote',
              department: 'General',
              source: 'career_page'
            });
            
            if (foundJobs.length >= 30) break;
          }
        }
        
        // Strategy 2: Look for job containers
        const jobContainers = document.querySelectorAll(
          '.job, .position, .vacancy, .career, .opening, .role, ' +
          '[class*="job"], [class*="position"], [class*="career"], ' +
          '[data-testid*="job"], .posting, .opportunity'
        );
        
        for (const container of jobContainers) {
          const titleElement = container.querySelector('h1, h2, h3, h4, a, .title, .job-title');
          if (titleElement) {
            const title = titleElement.textContent.trim();
            const link = container.querySelector('a') || titleElement;
            const url = link.href || window.location.href;
            
            if (title.length >= 10 && title.length <= 150 &&
                jobKeywords.some(kw => title.toLowerCase().includes(kw)) &&
                !skipKeywords.some(skip => title.toLowerCase().includes(skip)) &&
                !seenTitles.has(title.toLowerCase())) {
              
              seenTitles.add(title.toLowerCase());
              foundJobs.push({
                title: title,
                url: url,
                location: 'Remote',
                department: 'General',
                source: 'career_page'
              });
              
              if (foundJobs.length >= 30) break;
            }
          }
        }
        
        return foundJobs;
      }, company.name);

      return jobs.map(job => ({
        title: job.title,
        location: job.location,
        url: job.url,
        postedDate: new Date().toISOString().split('T')[0],
        source: 'Company Careers Page',
        department: job.department,
        employmentType: 'Full-time',
        timestamp: new Date().toISOString()
      }));
      
    } finally {
      await page.close();
    }
  }

  async scrapeWithRequests(careersUrl, company) {
    
    try {
      const response = await axios.get(careersUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      const jobs = [];
      const seenTitles = new Set();
      
      const jobKeywords = [
        'engineer', 'developer', 'manager', 'analyst', 'specialist',
        'coordinator', 'director', 'lead', 'senior', 'junior', 'intern'
      ];
      
      const skipKeywords = [
        'apply', 'view all', 'see more', 'home', 'about', 'contact',
        'privacy', 'terms', 'cookie', 'back to', 'return to'
      ];
      
      // Enhanced job detection
      $('a, h1, h2, h3, h4, .job-title, .position-title, .title').each((i, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (text.length >= 10 && text.length <= 150 &&
            jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
            !skipKeywords.some(skip => text.toLowerCase().includes(skip)) &&
            !seenTitles.has(text.toLowerCase())) {
          
          seenTitles.add(text.toLowerCase());
          
          let url = careersUrl;
          if (element.name === 'a') {
            url = $el.attr('href') || careersUrl;
            if (!url.startsWith('http')) {
              const baseUrl = new URL(careersUrl);
              url = new URL(url, baseUrl.origin).toString();
            }
          }
          
          jobs.push({
            title: text,
            location: 'Remote',
            url: url,
            postedDate: new Date().toISOString().split('T')[0],
            source: 'Company Careers Page',
            department: 'General',
            employmentType: 'Full-time',
            timestamp: new Date().toISOString()
          });
          
          if (jobs.length >= 25) return false;
        }
      });
      
      return jobs;
      
    } catch (error) {
      throw error;
    }
  }



  async scrapeLinkedInJobs(company) {
    if (!company.linkedinSlug) return [];

    const page = await this.browser.newPage();

    try {
      const searchUrl = `https://www.linkedin.com/company/${company.linkedinSlug}/jobs/`;

      logger.debug(`🔗 Scraping LinkedIn jobs: ${security.sanitizeLog(searchUrl)}`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for dynamic content to load
      try {
        await page.waitForSelector('.job-search-card, .jobs-search-results__list-item, .job-card-container', { timeout: 3000 });
      } catch (e) {
        logger.debug(`No LinkedIn job selector found on ${security.sanitizeLog(company.name)} page, proceeding anyway.`);
      }

      const content = await page.content();
      const $ = cheerio.load(content);

      const jobs = [];
      $('.job-search-card, .jobs-search-results__list-item, .job-card-container').each((i, element) => {
        const job = this.extractLinkedInJobData($, element);
        if (job) {
          job.source = 'LinkedIn';
          jobs.push(job);
        }
      });

      logger.debug(`📊 Extracted ${jobs.length} jobs from ${security.sanitizeLog(company.name)} LinkedIn`);
      return jobs;

    } catch (error) {
      logger.error(`❌ LinkedIn scraping error for ${security.sanitizeLog(company.name)}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  extractLinkedInJobData($, element) {
    try {
      const $el = $(element);
      const title = $el.find('.job-search-card__title, .job-title, .job-card-list__title').first().text().trim();
      const location = $el.find('.job-search-card__location, .job-location, .job-card-container__metadata-item').first().text().trim();
      const url = $el.find('a').first().attr('href');
      const timeAgo = $el.find('time').first().attr('datetime') ||
                     $el.find('.job-search-card__listdate, .job-card-container__listed-status').first().text().trim();

      if (!title) return null;

      // Gaming industry relevance check
      const titleLower = title.toLowerCase();
      const gamingKeywords = [
        'developer', 'engineer', 'manager', 'analyst', 'designer',
        'product', 'marketing', 'sales', 'operations', 'hr',
        'finance', 'legal', 'compliance', 'data', 'security',
        'game', 'gaming', 'casino', 'betting', 'poker'
      ];

      const isRelevant = gamingKeywords.some(keyword => titleLower.includes(keyword));
      if (!isRelevant) return null;

      return {
        title,
        location: location || 'Not specified',
        url: url?.startsWith('http') ? url : `https://linkedin.com${url}`,
        postedDate: this.parseRelativeDate(timeAgo),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  parseJobDate(dateText) {
    if (!dateText) return new Date().toISOString();

    // Try to parse absolute dates first
    const absoluteDate = new Date(dateText);
    if (!isNaN(absoluteDate.getTime())) {
      return absoluteDate.toISOString();
    }

    return this.parseRelativeDate(dateText);
  }

  parseRelativeDate(dateText) {
    if (!dateText) return new Date().toISOString();

    const now = new Date();
    const text = dateText.toLowerCase();

    if (text.includes('today') || text.includes('0 day')) {
      return now.toISOString();
    }

    const dayMatch = text.match(/(\d+)\s*day/);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    }

    const weekMatch = text.match(/(\d+)\s*week/);
    if (weekMatch) {
      const weeks = parseInt(weekMatch[1], 10);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const hourMatch = text.match(/(\d+)\s*hour/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1], 10);
      return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
    }

    return now.toISOString();
  }

  filterDuplicateJobs(newJobs, existingJobs) {
    const existingSet = new Set(
      existingJobs.map(job => `${job.title}-${job.location}`.toLowerCase())
    );

    return newJobs.filter(job => {
      const key = `${job.title}-${job.location}`.toLowerCase();
      return !existingSet.has(key);
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('🌐 Browser cleanup completed');
    }
  }
}

module.exports = JobPostingTracker;
