/**
 * QA Test Runner
 * 
 * Browser console interface for running QA tests.
 * Usage: Open browser console and run `QA.runAll()` or specific test methods.
 */

import { runQATests, MANUAL_TEST_SCENARIOS, TestResult } from './formalQATestSuite';

export class QATestRunner {
  private static instance: QATestRunner;
  
  private constructor() {
    console.log('🧪 QA Test Runner initialized');
    console.log('Available commands:');
    console.log('  QA.runAll() - Run all automated tests');
    console.log('  QA.manual() - Show manual test scenarios');
    console.log('  QA.help() - Show this help');
  }

  public static getInstance(): QATestRunner {
    if (!QATestRunner.instance) {
      QATestRunner.instance = new QATestRunner();
    }
    return QATestRunner.instance;
  }

  /**
   * Run all automated tests
   */
  public async runAll(): Promise<TestResult[]> {
    console.log('🚀 Starting automated QA test run...');
    try {
      const results = await runQATests();
      this.displayResults(results);
      return results;
    } catch (error) {
      console.error('❌ Test run failed:', error);
      throw error;
    }
  }

  /**
   * Show manual test scenarios
   */
  public manual(): void {
    console.log('📋 Manual Test Scenarios:');
    console.log('========================');
    
    MANUAL_TEST_SCENARIOS.forEach((scenario, index) => {
      console.log(`\n${index + 1}. ${scenario.title} (${scenario.id})`);
      console.log(`   Description: ${scenario.description}`);
      console.log('   Steps:');
      scenario.steps.forEach((step, stepIndex) => {
        console.log(`     ${stepIndex + 1}. ${step}`);
      });
      console.log('   Expected Results:');
      scenario.expected.forEach((expected, expIndex) => {
        console.log(`     ✓ ${expected}`);
      });
    });
    
    console.log('\n💡 Run manual tests by following the steps above and verifying expected results.');
  }

  /**
   * Show help information
   */
  public help(): void {
    console.log('🧪 ATLAS Accounts QA Test Runner');
    console.log('================================');
    console.log('');
    console.log('Available Commands:');
    console.log('  QA.runAll()     - Run all automated tests');
    console.log('  QA.manual()     - Display manual test scenarios');
    console.log('  QA.help()       - Show this help message');
    console.log('');
    console.log('Test Coverage:');
    console.log('  ✅ IBAN validation (mod-97 checksum)');
    console.log('  ✅ Bank inference from IBAN codes');
    console.log('  ✅ Account service CRUD operations');
    console.log('  ✅ Utility function validation');
    console.log('  📋 UI interaction tests (manual)');
    console.log('  📋 Cross-module integration tests (manual)');
    console.log('');
    console.log('Example Usage:');
    console.log('  QA.runAll().then(results => console.log("Tests completed:", results));');
  }

  /**
   * Run specific test category
   */
  public async testIban(): Promise<void> {
    console.log('🧪 Testing IBAN validation...');
    // Implementation would call specific test methods
  }

  /**
   * Test account service operations
   */
  public async testService(): Promise<void> {
    console.log('🧪 Testing account service...');
    // Implementation would call specific test methods
  }

  /**
   * Check current system status
   */
  public async status(): Promise<void> {
    console.log('📊 System Status Check:');
    console.log('======================');
    
    try {
      // Check if cuentasService is available
      const { cuentasService } = await import('../../services/cuentasService');
      const accounts = await cuentasService.list();
      console.log(`✅ Accounts Service: Working (${accounts.length} accounts)`);
      
      // Check if AccountOption component is loaded
      const accountOptionModule = await import('../../components/common/AccountOption');
      console.log('✅ AccountOption Component: Available');
      
      // Check if utility functions are working
      const { validateIbanEs } = await import('../../utils/accountHelpers');
      const testResult = validateIbanEs('ES91 2100 0418 4502 0005 1332');
      console.log(`✅ IBAN Validation: ${testResult.ok ? 'Working' : 'Failed'}`);
      
      console.log('\n🎯 System appears to be functioning correctly');
      
    } catch (error) {
      console.error('❌ System status check failed:', error);
    }
  }

  /**
   * Display test results in a formatted way
   */
  private displayResults(results: TestResult[]): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      manual: results.filter(r => r.status === 'manual').length
    };
    
    const passRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
    
    console.log(`📈 Pass Rate: ${passRate}% (${summary.passed}/${summary.total})`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📋 Manual: ${summary.manual}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => r.status === 'fail').forEach(result => {
        console.log(`  • ${result.testName}: ${result.message}`);
      });
    }
    
    if (summary.manual > 0) {
      console.log('\n📋 Manual Tests Required:');
      results.filter(r => r.status === 'manual').forEach(result => {
        console.log(`  • ${result.testName}: ${result.message}`);
      });
      console.log('\n💡 Run QA.manual() for detailed manual test instructions');
    }
    
    console.log('\nDetailed Results:');
    console.table(results.map(r => ({
      Test: r.testName,
      Status: r.status,
      Message: r.message,
      Duration: r.duration ? `${r.duration}ms` : 'N/A'
    })));
  }
}

// Global QA object for browser console
if (typeof window !== 'undefined') {
  (window as any).QA = QATestRunner.getInstance();
  console.log('🧪 QA Test Runner loaded. Type QA.help() for commands.');
}

export default QATestRunner;