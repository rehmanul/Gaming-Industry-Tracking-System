class IntelligenceService {
  constructor() {
    this.jobPatterns = new Map();
    this.hiringTrends = new Map();
    this.companyInsights = new Map();
  }

  analyzeJobPosting(job) {
    const analysis = {
      urgency: this.calculateUrgency(job),
      skillDemand: this.extractSkills(job.description),
      salaryRange: this.estimateSalary(job),
      competitionLevel: this.assessCompetition(job),
      growthIndicator: this.isGrowthRole(job)
    };

    this.updatePatterns(job, analysis);
    return analysis;
  }

  calculateUrgency(job) {
    const urgencyKeywords = ['urgent', 'immediate', 'asap', 'start immediately'];
    const description = job.description?.toLowerCase() || '';
    
    let score = 0;
    urgencyKeywords.forEach(keyword => {
      if (description.includes(keyword)) score += 25;
    });

    // Recent posting = higher urgency
    const daysSincePosted = (Date.now() - new Date(job.datePosted)) / (1000 * 60 * 60 * 24);
    if (daysSincePosted < 3) score += 20;

    return Math.min(score, 100);
  }

  extractSkills(description) {
    const techSkills = [
      'javascript', 'python', 'react', 'node.js', 'aws', 'docker', 
      'kubernetes', 'mongodb', 'postgresql', 'redis', 'unity', 'unreal'
    ];
    
    const found = [];
    const text = description?.toLowerCase() || '';
    
    techSkills.forEach(skill => {
      if (text.includes(skill)) {
        found.push(skill);
      }
    });

    return found;
  }

  estimateSalary(job) {
    const title = job.title?.toLowerCase() || '';
    const location = job.location?.toLowerCase() || '';
    
    // Basic salary estimation based on role and location
    const baseSalaries = {
      'senior': 80000,
      'lead': 100000,
      'principal': 120000,
      'director': 150000,
      'developer': 60000,
      'engineer': 70000
    };

    let estimate = 50000; // base
    
    Object.entries(baseSalaries).forEach(([level, salary]) => {
      if (title.includes(level)) {
        estimate = Math.max(estimate, salary);
      }
    });

    // Location multiplier
    if (location.includes('london') || location.includes('san francisco')) {
      estimate *= 1.3;
    }

    return {
      min: Math.round(estimate * 0.8),
      max: Math.round(estimate * 1.2),
      currency: 'USD'
    };
  }

  assessCompetition(job) {
    // Simple competition assessment
    const easyApply = job.description?.includes('easy apply') || false;
    const remote = job.location?.toLowerCase().includes('remote') || false;
    
    let competition = 'medium';
    
    if (easyApply && remote) competition = 'high';
    else if (!easyApply && !remote) competition = 'low';
    
    return competition;
  }

  isGrowthRole(job) {
    const growthKeywords = ['expansion', 'new team', 'scaling', 'growth', 'startup'];
    const description = job.description?.toLowerCase() || '';
    
    return growthKeywords.some(keyword => description.includes(keyword));
  }

  updatePatterns(job, analysis) {
    const company = job.company;
    
    if (!this.companyInsights.has(company)) {
      this.companyInsights.set(company, {
        totalJobs: 0,
        avgUrgency: 0,
        topSkills: new Map(),
        hiringVelocity: 0
      });
    }

    const insights = this.companyInsights.get(company);
    insights.totalJobs++;
    insights.avgUrgency = (insights.avgUrgency + analysis.urgency) / 2;
    
    analysis.skillDemand.forEach(skill => {
      insights.topSkills.set(skill, (insights.topSkills.get(skill) || 0) + 1);
    });
  }

  generateInsights() {
    const insights = {
      topGrowthCompanies: this.getTopGrowthCompanies(),
      hottestSkills: this.getHottestSkills(),
      marketTrends: this.getMarketTrends(),
      recommendations: this.getRecommendations()
    };

    return insights;
  }

  getTopGrowthCompanies() {
    return Array.from(this.companyInsights.entries())
      .filter(([_, data]) => data.totalJobs > 5)
      .sort((a, b) => b[1].totalJobs - a[1].totalJobs)
      .slice(0, 5)
      .map(([company, data]) => ({
        company,
        jobCount: data.totalJobs,
        avgUrgency: Math.round(data.avgUrgency)
      }));
  }

  getHottestSkills() {
    const allSkills = new Map();
    
    this.companyInsights.forEach(insights => {
      insights.topSkills.forEach((count, skill) => {
        allSkills.set(skill, (allSkills.get(skill) || 0) + count);
      });
    });

    return Array.from(allSkills.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, demand: count }));
  }

  getMarketTrends() {
    const totalCompanies = this.companyInsights.size;
    const activelyHiring = Array.from(this.companyInsights.values())
      .filter(data => data.totalJobs > 3).length;

    return {
      marketActivity: Math.round((activelyHiring / totalCompanies) * 100),
      avgJobsPerCompany: Math.round(
        Array.from(this.companyInsights.values())
          .reduce((sum, data) => sum + data.totalJobs, 0) / totalCompanies
      )
    };
  }

  getRecommendations() {
    const trends = this.getMarketTrends();
    const recommendations = [];

    if (trends.marketActivity > 70) {
      recommendations.push('High market activity - great time for job seekers');
    }

    if (trends.avgJobsPerCompany > 10) {
      recommendations.push('Companies are scaling rapidly - focus on growth companies');
    }

    return recommendations;
  }
}

module.exports = IntelligenceService;