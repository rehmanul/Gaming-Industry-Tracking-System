class DataEnhancer {
  static enhanceHireData(hire) {
    if (!hire || typeof hire !== 'object') {
      throw new Error('Invalid hire data provided');
    }
    return {
      name: hire.name || 'Name not disclosed in profile',
      title: hire.title || 'Position title not specified',
      startDate: hire.startDate || 'Start date not mentioned',
      location: this.enhanceLocation(hire.location),
      linkedinUrl: hire.linkedinUrl || 'LinkedIn profile not available',
      experience: this.enhanceExperience(hire.experience),
      skills: this.enhanceSkills(hire.skills),
      source: hire.source || 'People Data Labs API',
      salary: hire.salary || 'Salary not disclosed'
    };
  }

  static enhanceJobData(job) {
    if (!job || typeof job !== 'object') {
      throw new Error('Invalid job data provided');
    }
    return {
      title: job.title || 'Job title not specified in posting',
      location: this.enhanceLocation(job.location),
      postedDate: job.postedDate || 'Posted date not available',
      url: job.url || 'Direct job URL not accessible',
      source: job.source || 'Career Page Scraping',
      department: job.department || 'Department not specified',
      employmentType: job.employmentType || 'Employment type not mentioned',
      salary: job.salary || 'Salary not disclosed',
      requirements: job.requirements || 'Requirements not listed in posting',
      benefits: job.benefits || 'Benefits not mentioned in posting'
    };
  }

  static enhanceLocation(location) {
    if (!location || location.trim() === '') {
      return 'Location not specified in profile';
    }
    
    // Clean and standardize location
    const cleaned = location.trim();
    
    // Common location mappings
    const locationMappings = {
      'remote': 'Remote Work',
      'wfh': 'Work From Home',
      'hybrid': 'Hybrid Work Model',
      'onsite': 'On-site Work'
    };
    
    const lowerLocation = cleaned.toLowerCase();
    return locationMappings[lowerLocation] || cleaned;
  }

  static enhanceExperience(experience) {
    if (!experience || experience === 0 || experience === '0') {
      return 'Experience level not disclosed';
    }
    
    if (typeof experience === 'number') {
      if (experience === 1) return '1 year';
      return `${experience} years`;
    }
    
    return experience;
  }

  static enhanceSkills(skills) {
    if (!skills || (Array.isArray(skills) && skills.length === 0)) {
      return 'Skills not listed in profile';
    }
    
    if (Array.isArray(skills)) {
      return skills.filter(skill => skill && skill.trim()).join(', ') || 'Skills not listed in profile';
    }
    
    return skills;
  }

  static validateData(data, type) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided');
    }
    
    if (!['hire', 'job'].includes(type)) {
      throw new Error('Invalid type provided');
    }
    const issues = [];
    
    if (type === 'hire') {
      if (!data.name || data.name.includes('not disclosed')) {
        issues.push('Name missing from profile');
      }
      if (!data.title || data.title.includes('not specified')) {
        issues.push('Job title not available');
      }
      if (!data.location || data.location.includes('not specified')) {
        issues.push('Location information missing');
      }
    }
    
    if (type === 'job') {
      if (!data.title || data.title.includes('not specified')) {
        issues.push('Job title missing from posting');
      }
      if (!data.url || data.url.includes('not accessible')) {
        issues.push('Job URL not available');
      }
      if (!data.location || data.location.includes('not defined')) {
        issues.push('Location not specified in posting');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      completeness: this.calculateCompleteness(data, type)
    };
  }

  static calculateCompleteness(data, type) {
    const requiredFields = type === 'hire' 
      ? ['name', 'title', 'location', 'experience', 'skills']
      : ['title', 'location', 'url', 'department', 'employmentType'];
    
    const filledFields = requiredFields.filter(field => {
      const value = data[field];
      return value && !value.toString().includes('not') && !value.toString().includes('missing');
    });
    
    return Math.round((filledFields.length / requiredFields.length) * 100);
  }

  static calculateCompleteness(data, type) {
    const requiredFields = type === 'hire' 
      ? ['name', 'title', 'location', 'experience', 'skills']
      : ['title', 'location', 'url', 'department', 'employmentType'];
    
    const filledFields = requiredFields.filter(field => {
      const value = data[field];
      return value && !value.toString().includes('not') && !value.toString().includes('missing');
    });
    
    return Math.round((filledFields.length / requiredFields.length) * 100);
  }
}

module.exports = DataEnhancer;