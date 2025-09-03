#!/usr/bin/env node

const axios = require('axios');
const { performance } = require('perf_hooks');

class PerformanceTest {
  constructor() {
    this.baseURL = process.env.TEST_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_KEY || 'gaming-tracker-secure-key-2024';
    this.results = [];
  }

  async runTests() {
    console.log('🚀 Starting Performance Tests\n');
    
    const tests = [
      { name: 'Health Check', endpoint: '/health', method: 'GET' },
      { name: 'Analytics Dashboard', endpoint: '/api/analytics/dashboard', method: 'GET' },
      { name: 'Performance Metrics', endpoint: '/api/analytics/performance', method: 'GET' },
      { name: 'Export Data', endpoint: '/api/analytics/export', method: 'GET' },
      { name: 'Detailed Health', endpoint: '/api/health/detailed', method: 'GET' }
    ];

    for (const test of tests) {
      await this.runTest(test);
      await this.delay(1000); // 1 second between tests
    }

    this.generateReport();
  }

  async runTest(test) {
    console.log(`Testing: ${test.name}`);
    
    const iterations = 10;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        
        const response = await axios({
          method: test.method,
          url: `${this.baseURL}${test.endpoint}`,
          headers: {
            'X-API-Key': this.apiKey
          },
          timeout: 10000
        });

        const end = performance.now();
        const duration = end - start;

        results.push({
          iteration: i + 1,
          duration,
          status: response.status,
          success: response.status < 400
        });

        process.stdout.write('.');
      } catch (error) {
        results.push({
          iteration: i + 1,
          duration: 10000,
          status: error.response?.status || 0,
          success: false,
          error: error.message
        });
        process.stdout.write('x');
      }
    }

    console.log(''); // New line

    const testResult = this.analyzeResults(test.name, results);
    this.results.push(testResult);
    
    console.log(`  Avg: ${testResult.avgDuration}ms | Success: ${testResult.successRate}%\n`);
  }

  analyzeResults(testName, results) {
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration);
    
    return {
      testName,
      totalRequests: results.length,
      successfulRequests: successful.length,
      successRate: ((successful.length / results.length) * 100).toFixed(1),
      avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      minDuration: durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
      maxDuration: durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
      p95Duration: durations.length > 0 ? Math.round(this.percentile(durations, 95)) : 0,
      errors: results.filter(r => !r.success).length
    };
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  generateReport() {
    console.log('📊 Performance Test Results');
    console.log('='.repeat(80));
    
    this.results.forEach(result => {
      console.log(`\n${result.testName}:`);
      console.log(`  Requests: ${result.totalRequests} | Success Rate: ${result.successRate}%`);
      console.log(`  Avg Response: ${result.avgDuration}ms`);
      console.log(`  Min/Max: ${result.minDuration}ms / ${result.maxDuration}ms`);
      console.log(`  95th Percentile: ${result.p95Duration}ms`);
      
      if (result.errors > 0) {
        console.log(`  ❌ Errors: ${result.errors}`);
      }
    });

    console.log('\n📈 Summary:');
    const overallSuccess = this.results.reduce((sum, r) => sum + parseFloat(r.successRate), 0) / this.results.length;
    const overallAvg = this.results.reduce((sum, r) => sum + r.avgDuration, 0) / this.results.length;
    
    console.log(`  Overall Success Rate: ${overallSuccess.toFixed(1)}%`);
    console.log(`  Overall Avg Response: ${Math.round(overallAvg)}ms`);
    
    // Performance grades
    console.log('\n🎯 Performance Grades:');
    this.results.forEach(result => {
      const grade = this.getPerformanceGrade(result);
      console.log(`  ${result.testName}: ${grade}`);
    });

    // Recommendations
    console.log('\n💡 Recommendations:');
    this.generateRecommendations();
  }

  getPerformanceGrade(result) {
    if (result.successRate < 95) return '❌ F (Low Success Rate)';
    if (result.avgDuration > 5000) return '❌ F (Too Slow)';
    if (result.avgDuration > 2000) return '🟡 C (Acceptable)';
    if (result.avgDuration > 1000) return '🟢 B (Good)';
    return '🟢 A (Excellent)';
  }

  generateRecommendations() {
    const slowTests = this.results.filter(r => r.avgDuration > 2000);
    const errorTests = this.results.filter(r => parseFloat(r.successRate) < 95);

    if (slowTests.length > 0) {
      console.log(`  • Optimize slow endpoints: ${slowTests.map(t => t.testName).join(', ')}`);
    }

    if (errorTests.length > 0) {
      console.log(`  • Fix error-prone endpoints: ${errorTests.map(t => t.testName).join(', ')}`);
    }

    const avgResponse = this.results.reduce((sum, r) => sum + r.avgDuration, 0) / this.results.length;
    if (avgResponse > 1500) {
      console.log('  • Consider implementing caching for frequently accessed data');
    }

    if (avgResponse > 3000) {
      console.log('  • Review database queries and API call efficiency');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests
const tester = new PerformanceTest();
tester.runTests().catch(console.error);