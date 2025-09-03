const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const security = require('../middleware/security');

class OnboardingTracker {
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async trackNewOnboarding(company) {
    try {
      const sources = await Promise.allSettled([
        this.trackLinkedInAnnouncements(company),
        this.trackCompanyNewsPages(company),
        this.trackSocialMediaPosts(company)
      ]);

      const allOnboarding = [];
      sources.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allOnboarding.push(...result.value);
        }
      });

      const existingOnboarding = await this.sheetsService?.getExistingHires(company, 7) ?? [];
      const newOnboarding = this.filterDuplicates(allOnboarding, existingOnboarding);

      if (newOnboarding.length > 0) {
        logger.info(`🎯 Found ${newOnboarding.length} new onboarding announcements for ${security.sanitizeLog(company.name)}`);
      }

      return newOnboarding;
    } catch (error) {
      logger.error(`❌ Onboarding tracking failed for ${security.sanitizeLog(company.name)}:`, error);
      return [];
    }
  }

  async trackLinkedInAnnouncements(company) {
    if (!company.linkedinUrl) return [];

    await this.initializeBrowser();
    const page = await this.browser.newPage();

    try {
      const postsUrl = `${company.linkedinUrl}/posts/`;
      await page.goto(postsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      await page.waitForSelector('.feed-shared-update-v2', { timeout: 5000 }).catch(() => {});

      const content = await page.content();
      const $ = cheerio.load(content);

      const announcements = [];
      $('.feed-shared-update-v2').each((i, element) => {
        const $post = $(element);
        const text = $post.find('.feed-shared-text').text().toLowerCase();
        
        // Look for onboarding keywords
        const onboardingKeywords = [
          'welcome', 'joined', 'new team member', 'excited to announce',
          'pleased to welcome', 'joining our team', 'new hire', 'onboard'
        ];

        if (onboardingKeywords.some(keyword => text.includes(keyword))) {
          const announcement = this.extractOnboardingInfo($post, company);
          if (announcement) announcements.push(announcement);
        }
      });

      return announcements;
    } catch (error) {
      logger.debug(`LinkedIn announcement tracking failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
      return [];
    } finally {
      await page.close();
    }
  }

  async trackCompanyNewsPages(company) {
    if (!company.careersPageUrl && !company.domainOrLinkedin) return [];

    await this.initializeBrowser();
    const page = await this.browser.newPage();

    try {
      // Try common news/press release URLs
      const newsUrls = this.generateNewsUrls(company);
      const announcements = [];

      for (const url of newsUrls.slice(0, 2)) { // Limit to 2 URLs
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          
          const content = await page.content();
          const $ = cheerio.load(content);

          // Look for recent news about new hires
          $('article, .news-item, .press-release, .blog-post').each((i, element) => {
            const $item = $(element);
            const title = $item.find('h1, h2, h3').first().text();
            const text = $item.text().toLowerCase();

            if (this.containsOnboardingKeywords(text) && this.isRecent($item)) {
              const announcement = {
                title: title.trim(),
                source: 'Company News',
                url: url,
                timestamp: new Date().toISOString(),
                content: text.substring(0, 500)
              };
              announcements.push(announcement);
            }
          });
        } catch (error) {
          logger.debug(`News page ${url} failed: ${error.message}`);
        }
      }

      return announcements;
    } catch (error) {
      logger.debug(`Company news tracking failed for ${security.sanitizeLog(company.name)}: ${error.message}`);
      return [];
    } finally {
      await page.close();
    }
  }

  async trackSocialMediaPosts(company) {
    // This would integrate with Twitter/X API, Facebook API, etc.
    // For now, return empty array as social media APIs require special authentication
    return [];
  }

  extractOnboardingInfo($post, company) {
    try {
      const text = $post.text();
      const nameMatch = text.match(/welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      const titleMatch = text.match(/as\s+([^.!]+)/i);

      return {
        name: nameMatch ? nameMatch[1] : 'Name not specified',
        title: titleMatch ? titleMatch[1].trim() : 'Position not specified',
        source: 'LinkedIn Announcement',
        company: company.name,
        timestamp: new Date().toISOString(),
        content: text.substring(0, 300)
      };
    } catch (error) {
      return null;
    }
  }

  generateNewsUrls(company) {
    const baseUrl = company.domainOrLinkedin?.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!baseUrl || baseUrl.includes('linkedin.com')) return [];

    return [
      `https://${baseUrl}/news`,
      `https://${baseUrl}/press-releases`,
      `https://${baseUrl}/blog`,
      `https://www.${baseUrl}/news`,
      `https://www.${baseUrl}/press-releases`
    ];
  }

  containsOnboardingKeywords(text) {
    const keywords = [
      'welcome', 'joined', 'new team member', 'excited to announce',
      'pleased to welcome', 'joining our team', 'new hire', 'onboard',
      'appointment', 'promoted', 'new role', 'leadership team'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  isRecent($element) {
    const dateText = $element.find('time, .date, .published').first().text();
    if (!dateText) return true; // Assume recent if no date

    const date = new Date(dateText);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  }

  filterDuplicates(newItems, existingItems) {
    const existingSet = new Set(
      existingItems.map(item => `${item.name}-${item.title}`.toLowerCase())
    );

    return newItems.filter(item => {
      const key = `${item.name}-${item.title}`.toLowerCase();
      return !existingSet.has(key);
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = OnboardingTracker;