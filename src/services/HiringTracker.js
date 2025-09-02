const axios = require('axios');
const logger = require('../utils/logger');

class HiringTracker {
  constructor() {
    this.apiKeys = [
      process.env.PEOPLE_DATA_LABS_API_KEY_1,
      process.env.PEOPLE_DATA_LABS_API_KEY_2
    ].filter(key => key); // Remove undefined keys
    this.currentKeyIndex = 0;
    this.lastChecked = new Map();
    this.sheetsService = null;
  }

  setGoogleSheetsService(sheetsService) {
    this.sheetsService = sheetsService;
  }

  getCurrentApiKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('No People Data Labs API keys configured');
    }
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  async trackCompany(company) {
    if (!company.trackHiring) {
      return [];
    }

    try {
      const since = this.lastChecked.get(company.id) || Date.now() - (48 * 60 * 60 * 1000);
      const newHires = await this.searchNewHires(company, since);

      // Filter out duplicates using existing data from sheets
      const existingHires = await this.sheetsService?.getExistingHires(company, 30) || [];
      const filteredHires = this.filterDuplicateHires(newHires, existingHires);

      this.lastChecked.set(company.id, Date.now());

      if (filteredHires.length > 0) {
        logger.info(`🎯 Found ${filteredHires.length} new hires for ${company.name}`);
      }

      return filteredHires;

    } catch (error) {
      logger.error(`❌ Error tracking hires for ${company.name}:`, error);
      return [];
    }
  }

  async searchNewHires(company, since) {
    const apiKey = this.getCurrentApiKey();
    const sinceDate = new Date(since).toISOString().split('T')[0];

    // Multiple search strategies for better coverage
    const searchStrategies = [
      {
        // Primary company name search
        query: {
          bool: {
            must: [
              { 
                bool: {
                  should: [
                    { term: { "job_company_name": company.name } },
                    { match: { "job_company_name": company.name } }
                  ]
                }
              },
              { range: { "job_start_date": { gte: sinceDate } } }
            ]
          }
        }
      }
    ];

    // Add domain-based search if available
    if (company.domainOrLinkedin && !company.domainOrLinkedin.includes('linkedin.com')) {
      const domain = company.domainOrLinkedin.replace(/^https?:\/\//, '').replace(/^www\./, '');
      searchStrategies.push({
        query: {
          bool: {
            must: [
              { wildcard: { "job_company_website": `*${domain}*` } },
              { range: { "job_start_date": { gte: sinceDate } } }
            ]
          }
        }
      });
    }

    let allResults = [];

    for (const strategy of searchStrategies) {
      try {
        const searchParams = {
          ...strategy,
          size: 25,
          dataset: "person"
        };

        logger.debug(`🔍 Searching for hires at ${company.name} since ${sinceDate}`);

        const response = await axios.post('https://api.peopledatalabs.com/v5/person/search', 
          searchParams,
          {
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        if (response.data.data) {
          allResults.push(...response.data.data);
          logger.debug(`📊 Found ${response.data.data.length} results for ${company.name}`);
        }

        // Rate limiting delay
        await this.delay(1500);

      } catch (error) {
        if (error.response?.status === 429) {
          logger.warn(`⏱️ Rate limit hit for ${company.name}, switching API key`);
          await this.delay(3000);
          continue;
        }
        logger.warn(`⚠️ Search strategy failed for ${company.name}:`, error.message);
      }
    }

    // Remove duplicates and process
    const uniqueResults = this.removeDuplicates(allResults);
    return this.processHireData(uniqueResults, company);
  }

  removeDuplicates(results) {
    const seen = new Set();
    return results.filter(person => {
      const key = `${person.full_name}-${person.job_title}-${person.job_company_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  processHireData(data, company) {
    return data
      .filter(person => person.full_name && person.job_title)
      .map(person => ({
        id: person.id,
        name: person.full_name,
        title: person.job_title,
        startDate: person.job_start_date,
        location: person.location_name || person.job_location_name || 'Remote',
        linkedinUrl: person.linkedin_url,
        experience: person.experience?.length || 0,
        skills: person.skills?.slice(0, 5) || [],
        source: 'People Data Labs',
        companyMatched: company.name,
        timestamp: new Date().toISOString()
      }))
      .filter(hire => hire.name && hire.title)
      .filter(hire => {
        // Gaming industry role filtering
        const title = hire.title.toLowerCase();
        const relevantTerms = [
          'developer', 'engineer', 'manager', 'analyst', 'designer',
          'product', 'marketing', 'sales', 'operations', 'hr',
          'finance', 'legal', 'compliance', 'data', 'security',
          'game', 'gaming', 'casino', 'betting', 'poker'
        ];
        return relevantTerms.some(term => title.includes(term));
      });
  }

  filterDuplicateHires(newHires, existingHires) {
    const existingSet = new Set(
      existingHires.map(hire => `${hire.name}-${hire.title}`.toLowerCase())
    );

    return newHires.filter(hire => {
      const key = `${hire.name}-${hire.title}`.toLowerCase();
      return !existingSet.has(key);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = HiringTracker;