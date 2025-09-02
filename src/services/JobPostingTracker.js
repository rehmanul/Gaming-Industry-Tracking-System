const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

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
      await this.initializeBrowser();
      const since = this.lastChecked.get(company.id) || Date.now() - (48 * 60 * 60 * 1000);

      let newJobs = [];

      // Scrape company careers page
      if (company.careersPageUrl) {
        const careerJobs = await this.scrapeCompanyCareersPage(company);
        newJobs.push(...careerJobs);
      }

      // LinkedIn company jobs (if LinkedIn URL available)
      if (company.linkedinUrl && company.linkedinSlug) {
        const linkedinJobs = await this.scrapeLinkedInJobs(company);
        newJobs.push(...linkedinJobs);
      }

      // Filter for new jobs and remove duplicates
      const existingJobs = await this.sheetsService?.getExistingJobs(company, 30) || [];
      const filteredJobs = this.filterDuplicateJobs(newJobs, existingJobs);

      this.lastChecked.set(company.id, Date.now());

      if (filteredJobs.length > 0) {
        logger.info(`💼 Found ${filteredJobs.length} new jobs for ${company.name}`);
      }

      return filteredJobs;

    } catch (error) {
      logger.error(`❌ Error tracking jobs for ${company.name}:`, error);
      return [];
    }
  }

  async scrapeCompanyCareersPage(company) {
    if (!company.careersPageUrl) return [];

    const page = await this.browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });

      logger.debug(`🔍 Scraping careers page: ${company.careersPageUrl}`);

      await page.goto(company.careersPageUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for dynamic content to load
      await page.waitForTimeout(3000);

      const content = await page.content();
      const $ = cheerio.load(content);

      // Company-specific selectors based on gaming industry
      const jobs = await this.extractJobsWithCompanySpecificLogic($, company);

      return jobs;

    } catch (error) {
      logger.error(`❌ Careers page scraping error for ${company.name}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  async extractJobsWithCompanySpecificLogic($, company) {
    const jobs = [];

    // Gaming industry company selectors
    const companySelectors = {
      'bet365': {
        jobSelector: '.job-result, .vacancy, .position',
        titleSelector: '.job-title, h2, h3',
        locationSelector: '.location, .job-location',
        linkSelector: 'a',
        baseUrl: 'https://www.bet365.com'
      },
      'Catena Media': {
        jobSelector: '.posting',
        titleSelector: '.posting-name',
        locationSelector: '.sort-by-location',
        linkSelector: 'a',
        baseUrl: 'https://jobs.lever.co'
      },
      'Gaming Innovation Group': {
        jobSelector: '.pinpoint-job-item, .job-item',
        titleSelector: '.job-title, h3',
        locationSelector: '.job-location, .location',
        linkSelector: 'a'
      },
      'Playtech': {
        jobSelector: '.job-item, .career-opportunity, .position',
        titleSelector: 'h2, h3, .job-title',
        locationSelector: '.location, .job-location',
        linkSelector: 'a'
      },
      'Entain': {
        jobSelector: '.job-tile, .job-item, .vacancy',
        titleSelector: '.job-title, h3, .title',
        locationSelector: '.job-location, .location',
        linkSelector: 'a'
      },
      'Evolution Gaming': {
        jobSelector: '.job-listing, .position, .vacancy',
        titleSelector: '.job-title, h2, h3',
        locationSelector: '.location, .office',
        linkSelector: 'a'
      }
    };

    // Get company-specific selectors or use generic gaming industry selectors
    const selectors = companySelectors[company.name] || {
      jobSelector: '.job, .position, .vacancy, .career-opportunity, .job-listing, .job-item, .job-card, [data-testid*="job"], .posting',
      titleSelector: 'h1, h2, h3, .title, .job-title, .position-title, .posting-name',
      locationSelector: '.location, .job-location, .office, .workplace, .sort-by-location',
      linkSelector: 'a'
    };

    $(selectors.jobSelector).each((i, element) => {
      try {
        const $el = $(element);
        const title = $el.find(selectors.titleSelector).first().text().trim();
        const location = $el.find(selectors.locationSelector).first().text().trim();
        const linkEl = $el.find(selectors.linkSelector).first();
        let url = linkEl.attr('href');

        if (!title) return;

        // Handle relative URLs
        if (url) {
          if (!url.startsWith('http')) {
            if (selectors.baseUrl) {
              url = selectors.baseUrl + url;
            } else {
              try {
                const base = new URL(company.careersPageUrl);
                url = new URL(url, base.origin).toString();
              } catch (e) {
                url = company.careersPageUrl + url;
              }
            }
          }
        }

        // Extract additional job details
        const department = $el.find('.department, .team, .division, .category').first().text().trim();
        const employmentType = $el.find('.employment-type, .job-type, .type, .contract-type').first().text().trim();
        const datePosted = $el.find('.date, .posted, time, .job-date').first().text().trim();

        // Gaming industry job filtering
        const gamingKeywords = [
          'developer', 'engineer', 'manager', 'analyst', 'designer',
          'product', 'marketing', 'sales', 'operations', 'hr', 'human resources',
          'finance', 'legal', 'compliance', 'data', 'security', 'devops',
          'game', 'gaming', 'casino', 'betting', 'poker', 'sports betting',
          'customer', 'support', 'qa', 'quality assurance', 'backend', 'frontend'
        ];

        const titleLower = title.toLowerCase();
        const isRelevant = gamingKeywords.some(keyword => titleLower.includes(keyword));

        if (!isRelevant) return; // Skip irrelevant jobs

        const job = {
          title,
          location: location || 'Not specified',
          url: url || company.careersPageUrl,
          postedDate: this.parseJobDate(datePosted),
          source: 'Company Careers Page',
          department: department || '',
          employmentType: employmentType || '',
          timestamp: new Date().toISOString()
        };

        jobs.push(job);

      } catch (error) {
        logger.debug(`⚠️ Error parsing job element for ${company.name}:`, error.message);
      }
    });

    logger.debug(`📊 Extracted ${jobs.length} relevant jobs from ${company.name} careers page`);
    return jobs;
  }

  async scrapeLinkedInJobs(company) {
    if (!company.linkedinSlug) return [];

    const page = await this.browser.newPage();

    try {
      const searchUrl = `https://www.linkedin.com/company/${company.linkedinSlug}/jobs/`;

      logger.debug(`🔗 Scraping LinkedIn jobs: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(3000);

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

      logger.debug(`📊 Extracted ${jobs.length} jobs from ${company.name} LinkedIn`);
      return jobs;

    } catch (error) {
      logger.error(`❌ LinkedIn scraping error for ${company.name}:`, error);
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
      const days = parseInt(dayMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    }

    const weekMatch = text.match(/(\d+)\s*week/);
    if (weekMatch) {
      const weeks = parseInt(weekMatch[1]);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const hourMatch = text.match(/(\d+)\s*hour/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
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