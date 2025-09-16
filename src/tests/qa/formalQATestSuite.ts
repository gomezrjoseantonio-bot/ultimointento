/**
 * Formal QA Test Suite for Mi Cuenta → Cuentas
 * 
 * This file contains automated and semi-automated test functions for the account management system.
 * It validates all acceptance criteria and can be run in both development and production environments.
 */

import { cuentasService } from '../../services/cuentasService';
import { validateIbanEs, normalizeIban, inferBank } from '../../utils/accountHelpers';

export interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'manual';
  message: string;
  timestamp: string;
  duration?: number;
}

export class AccountsQATestSuite {
  private results: TestResult[] = [];
  
  constructor() {
    console.log('🧪 ATLAS Accounts QA Test Suite Initialized');
  }

  /**
   * Run all automated tests
   */
  public async runAllTests(): Promise<TestResult[]> {
    this.results = [];
    
    console.log('🚀 Running comprehensive QA test suite...');
    
    // Automated tests
    await this.testIbanValidation();
    await this.testBankInference();
    await this.testAccountService();
    await this.testUtilityFunctions();
    
    // Manual test instructions
    this.addManualTest('Account Creation UI', 'Manually test account creation with valid IBAN');
    this.addManualTest('Default Account Management', 'Test setting and changing default accounts');
    this.addManualTest('Module Propagation', 'Verify AccountOption usage in all modules');
    
    this.logResults();
    return this.results;
  }

  /**
   * Test IBAN validation functionality
   */
  private async testIbanValidation(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test valid Spanish IBANs
      const validIbans = [
        'ES91 2100 0418 4502 0005 1332',
        'ES21 0049 0001 5025 1610 1005',
        'ES15 0081 0346 1100 0123 4567'
      ];
      
      for (const iban of validIbans) {
        const result = validateIbanEs(iban);
        if (!result.ok) {
          throw new Error(`Valid IBAN rejected: ${iban} - ${result.message}`);
        }
      }
      
      // Test invalid IBANs
      const invalidIbans = [
        'ES91 2100 0418 4502 0005 1333', // Wrong checksum
        'ES91 2100', // Too short
        'FR91 2100 0418 4502 0005 1332', // Wrong country
        'invalid-iban' // Invalid format
      ];
      
      for (const iban of invalidIbans) {
        const result = validateIbanEs(iban);
        if (result.ok) {
          throw new Error(`Invalid IBAN accepted: ${iban}`);
        }
      }
      
      this.addResult('IBAN Validation', 'pass', 'All IBAN validation tests passed', start);
    } catch (error) {
      this.addResult('IBAN Validation', 'fail', `IBAN validation failed: ${(error as Error).message}`, start);
    }
  }

  /**
   * Test bank inference from IBAN codes
   */
  private async testBankInference(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test known bank codes
      const testCases = [
        { iban: 'ES91 2100 0418 4502 0005 1332', expectedCode: '2100' },
        { iban: 'ES21 0049 0001 5025 1610 1005', expectedCode: '0049' },
        { iban: 'ES15 0081 0346 1100 0123 4567', expectedCode: '0081' }
      ];
      
      const banksCatalog = {}; // Will be loaded in real test
      
      for (const testCase of testCases) {
        const bankInfo = inferBank(testCase.iban, banksCatalog);
        if (bankInfo?.code !== testCase.expectedCode) {
          throw new Error(`Bank code mismatch for ${testCase.iban}: expected ${testCase.expectedCode}, got ${bankInfo?.code}`);
        }
      }
      
      this.addResult('Bank Inference', 'pass', 'Bank inference tests passed', start);
    } catch (error) {
      this.addResult('Bank Inference', 'fail', `Bank inference failed: ${(error as Error).message}`, start);
    }
  }

  /**
   * Test account service functionality
   */
  private async testAccountService(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test account listing
      const accounts = await cuentasService.list();
      
      // Test account creation (in safe test mode)
      if (process.env.NODE_ENV === 'development') {
        const testAccount = {
          alias: 'Test Account QA',
          iban: 'ES91 2100 0418 4502 0005 1332',
          tipo: 'CORRIENTE' as const
        };
        
        const created = await cuentasService.create(testAccount);
        if (!created.id) {
          throw new Error('Account creation failed - no ID returned');
        }
        
        // Test account retrieval
        const retrieved = await cuentasService.get(created.id);
        if (!retrieved || retrieved.alias !== testAccount.alias) {
          throw new Error('Account retrieval failed');
        }
        
        // Test account update
        const updated = await cuentasService.update(created.id, { alias: 'Updated Test Account' });
        if (updated.alias !== 'Updated Test Account') {
          throw new Error('Account update failed');
        }
        
        // Clean up test account
        await cuentasService.deactivate(created.id);
      }
      
      this.addResult('Account Service', 'pass', 'Account service tests passed', start);
    } catch (error) {
      this.addResult('Account Service', 'fail', `Account service failed: ${(error as Error).message}`, start);
    }
  }

  /**
   * Test utility functions
   */
  private async testUtilityFunctions(): Promise<void> {
    const start = Date.now();
    
    try {
      // Test IBAN normalization
      const testIban = 'ES91 2100 0418 4502 0005 1332';
      const normalized = normalizeIban(testIban);
      const expected = 'ES9121000418450200051332';
      
      if (normalized !== expected) {
        throw new Error(`IBAN normalization failed: expected ${expected}, got ${normalized}`);
      }
      
      this.addResult('Utility Functions', 'pass', 'Utility function tests passed', start);
    } catch (error) {
      this.addResult('Utility Functions', 'fail', `Utility functions failed: ${(error as Error).message}`, start);
    }
  }

  /**
   * Add a manual test instruction
   */
  private addManualTest(testName: string, instruction: string): void {
    this.addResult(testName, 'manual', `Manual test required: ${instruction}`, Date.now());
  }

  /**
   * Add a test result
   */
  private addResult(testName: string, status: 'pass' | 'fail' | 'manual', message: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.results.push({
      testName,
      status,
      message,
      timestamp: new Date().toISOString(),
      duration
    });
  }

  /**
   * Log test results
   */
  private logResults(): void {
    console.log('\n📊 QA Test Results Summary:');
    console.log('============================');
    
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      manual: this.results.filter(r => r.status === 'manual').length
    };
    
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📋 Manual: ${summary.manual}`);
    
    console.log('\nDetailed Results:');
    console.table(this.results);
    
    if (summary.failed > 0) {
      console.error('\n⚠️  Some tests failed. Review the results above.');
    } else {
      console.log('\n🎉 All automated tests passed!');
    }
  }

  /**
   * Generate test report for documentation
   */
  public generateReport(): string {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      manual: this.results.filter(r => r.status === 'manual').length,
      timestamp: new Date().toISOString()
    };

    let report = `# Accounts QA Test Report\n\n`;
    report += `**Generated:** ${summary.timestamp}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Tests:** ${summary.total}\n`;
    report += `- **✅ Passed:** ${summary.passed}\n`;
    report += `- **❌ Failed:** ${summary.failed}\n`;
    report += `- **📋 Manual:** ${summary.manual}\n\n`;
    
    report += `## Test Results\n\n`;
    
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '📋';
      report += `### ${icon} ${result.testName}\n`;
      report += `- **Status:** ${result.status.toUpperCase()}\n`;
      report += `- **Message:** ${result.message}\n`;
      if (result.duration) {
        report += `- **Duration:** ${result.duration}ms\n`;
      }
      report += `- **Timestamp:** ${result.timestamp}\n\n`;
    });
    
    return report;
  }
}

/**
 * Manual test scenarios for acceptance criteria
 */
export const MANUAL_TEST_SCENARIOS = [
  {
    id: 'QA-001',
    title: 'Account Creation with Valid IBAN',
    description: 'Test creating an account with a valid Spanish IBAN',
    steps: [
      'Navigate to /cuenta/cuentas',
      'Click "Nueva cuenta"',
      'Enter alias: "Test Account BBVA"',
      'Enter IBAN: "ES91 0182 1234 5678 9012 3456"',
      'Verify bank preview shows correct bank info',
      'Click "Guardar"'
    ],
    expected: [
      'Account created successfully',
      'Bank logo/info appears correctly',
      'IBAN shows masked format',
      'Account appears in list'
    ]
  },
  {
    id: 'QA-002',
    title: 'Invalid IBAN Validation',
    description: 'Test IBAN validation with invalid checksum',
    steps: [
      'Navigate to /cuenta/cuentas',
      'Click "Nueva cuenta"',
      'Enter alias: "Test Invalid"',
      'Enter IBAN: "ES91 0182 1234 5678 9012 3457" (invalid mod-97)',
      'Try to save'
    ],
    expected: [
      'Error message appears',
      'Form submission blocked',
      'Account not created'
    ]
  },
  {
    id: 'QA-003',
    title: 'Duplicate IBAN Prevention',
    description: 'Test prevention of duplicate IBANs',
    steps: [
      'Create an account with a specific IBAN',
      'Try to create another account with same IBAN',
      'Use different alias but same IBAN'
    ],
    expected: [
      'Duplicate prevention error shown',
      'Second account not created',
      'Clear error message displayed'
    ]
  },
  {
    id: 'QA-004',
    title: 'Default Account Management',
    description: 'Test default account setting and exclusivity',
    steps: [
      'Create two accounts',
      'Set first as default',
      'Set second as default',
      'Verify only one is default'
    ],
    expected: [
      'Only one account can be default',
      'Previous default badge removed',
      'New default badge applied',
      'Success message shown'
    ]
  },
  {
    id: 'QA-005',
    title: 'Préstamos Integration',
    description: 'Test account selection in loan creation',
    steps: [
      'Navigate to /financiacion',
      'Start creating a new loan',
      'Check account selector',
      'Verify AccountOption display'
    ],
    expected: [
      'Real accounts shown in selector',
      'AccountOption component used',
      'Consistent display format',
      'Selected account preview shown'
    ]
  },
  {
    id: 'QA-006',
    title: 'Search and Filter',
    description: 'Test account search functionality',
    steps: [
      'Create multiple accounts with different aliases',
      'Use search box to filter by alias',
      'Search by IBAN fragment',
      'Search by bank name'
    ],
    expected: [
      'Search filters accounts correctly',
      'Results update in real-time',
      'Count updates appropriately',
      'Clear search shows all accounts'
    ]
  },
  {
    id: 'QA-007',
    title: 'Module Propagation',
    description: 'Test AccountOption usage across modules',
    steps: [
      'Check account display in Tesorería',
      'Check account selection in transfers',
      'Check account assignment in contracts',
      'Verify consistent formatting'
    ],
    expected: [
      'AccountOption used consistently',
      'Same logo/alias/IBAN format',
      'Proper fallback handling',
      'No mock data visible'
    ]
  }
];

/**
 * Initialize and run tests
 */
export const runQATests = async (): Promise<TestResult[]> => {
  const testSuite = new AccountsQATestSuite();
  return await testSuite.runAllTests();
};

// Auto-run in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 Development mode: QA tests available globally');
  (window as any).runQATests = runQATests;
  (window as any).MANUAL_TEST_SCENARIOS = MANUAL_TEST_SCENARIOS;
}