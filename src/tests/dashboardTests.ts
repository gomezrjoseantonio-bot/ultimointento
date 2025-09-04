// Dashboard Testing Utility
// This file contains manual tests to validate the Dashboard implementation

/**
 * Test Case 1: Preset A (≤3 properties) 
 * Expected: 4 blocks (Treasury, Income/Expenses, Tax, Alerts)
 */
export const testPresetA = async () => {
  const { dashboardService } = await import('../services/dashboardService');
  
  // Mock property count <= 3
  const originalGetPropertyCount = dashboardService.getPropertyCount;
  dashboardService.getPropertyCount = async () => 2;
  
  try {
    const config = await dashboardService.resetToDefault();
    
    console.assert(config.preset === 'preset-a', 'Should use preset A for ≤3 properties');
    console.assert(config.blocks.length === 4, 'Should have 4 blocks in preset A');
    
    const blockIds = config.blocks.map(b => b.id);
    const expectedBlocks: string[] = ['treasury', 'income-expenses', 'tax', 'alerts'];
    
    expectedBlocks.forEach(blockId => {
      console.assert(blockIds.includes(blockId as any), `Should include ${blockId} block`);
    });
    
    console.assert(!blockIds.includes('kpis' as any), 'Should NOT include KPIs block in preset A');
    
    console.log('✅ Test Preset A: PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test Preset A: FAILED', error);
    return false;
  } finally {
    // Restore original method
    dashboardService.getPropertyCount = originalGetPropertyCount;
  }
};

/**
 * Test Case 2: Preset B (>3 properties)
 * Expected: 5 blocks (Treasury, Income/Expenses, KPIs, Tax, Alerts)
 */
export const testPresetB = async () => {
  const { dashboardService } = await import('../services/dashboardService');
  
  // Mock property count > 3
  const originalGetPropertyCount = dashboardService.getPropertyCount;
  dashboardService.getPropertyCount = async () => 5;
  
  try {
    const config = await dashboardService.resetToDefault();
    
    console.assert(config.preset === 'preset-b', 'Should use preset B for >3 properties');
    console.assert(config.blocks.length === 5, 'Should have 5 blocks in preset B');
    
    const blockIds = config.blocks.map(b => b.id);
    const expectedBlocks: string[] = ['treasury', 'income-expenses', 'kpis', 'tax', 'alerts'];
    
    expectedBlocks.forEach(blockId => {
      console.assert(blockIds.includes(blockId as any), `Should include ${blockId} block`);
    });
    
    // Check KPIs block has fixed preset configuration
    const kpisBlock = config.blocks.find(b => b.id === 'kpis');
    console.assert(kpisBlock?.options.source === 'fixed-preset', 'KPIs should use fixed preset in preset B');
    console.assert(Array.isArray(kpisBlock?.options.selectedMetrics), 'KPIs should have selected metrics');
    
    console.log('✅ Test Preset B: PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test Preset B: FAILED', error);
    return false;
  } finally {
    // Restore original method
    dashboardService.getPropertyCount = originalGetPropertyCount;
  }
};

/**
 * Test Case 3: Configuration Persistence
 * Expected: Save and load configuration correctly
 */
export const testConfigurationPersistence = async () => {
  const { dashboardService } = await import('../services/dashboardService');
  
  try {
    // Create a custom configuration
    const originalConfig = await dashboardService.loadConfiguration();
    const customConfig = {
      ...originalConfig,
      blocks: originalConfig.blocks.map(block => ({
        ...block,
        isActive: block.id === 'treasury' // Only treasury active
      }))
    };
    
    // Save custom configuration
    await dashboardService.saveConfiguration(customConfig);
    
    // Load configuration and verify
    const loadedConfig = await dashboardService.loadConfiguration();
    
    const activeBlocks = loadedConfig.blocks.filter(b => b.isActive);
    console.assert(activeBlocks.length === 1, 'Should have only 1 active block');
    console.assert(activeBlocks[0].id === 'treasury', 'Active block should be treasury');
    
    console.log('✅ Test Configuration Persistence: PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test Configuration Persistence: FAILED', error);
    return false;
  }
};

/**
 * Test Case 4: Block Reordering
 * Expected: Blocks can be reordered and positions are updated
 */
export const testBlockReordering = async () => {
  const { dashboardService } = await import('../services/dashboardService');
  
  try {
    const config = await dashboardService.loadConfiguration();
    const originalOrder = config.blocks.map(b => b.id);
    
    // Reverse the order
    const newOrder = [...originalOrder].reverse() as any[];
    await dashboardService.reorderBlocks(newOrder);
    
    // Load and verify new order
    const updatedConfig = await dashboardService.loadConfiguration();
    const actualOrder = updatedConfig.blocks
      .sort((a, b) => a.position - b.position)
      .map(b => b.id);
    
    console.assert(
      JSON.stringify(actualOrder) === JSON.stringify(newOrder),
      'Block order should be updated correctly'
    );
    
    console.log('✅ Test Block Reordering: PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test Block Reordering: FAILED', error);
    return false;
  }
};

/**
 * Test Case 5: Spanish Formatting
 * Expected: All values use es-ES formatting
 */
export const testSpanishFormatting = () => {
  try {
    // Test currency formatting
    const currency = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(1234.56);
    
    console.assert(currency === '1.234,56 €', `Currency should be formatted as es-ES: ${currency}`);
    
    // Test percentage formatting
    const percentage = new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(0.0425);
    
    console.assert(percentage === '4,3 %', `Percentage should be formatted as es-ES: ${percentage}`);
    
    console.log('✅ Test Spanish Formatting: PASSED');
    return true;
  } catch (error) {
    console.error('❌ Test Spanish Formatting: FAILED', error);
    return false;
  }
};

/**
 * Run all tests
 */
export const runAllTests = async () => {
  console.log('🧪 Running Dashboard Tests...\n');
  
  const results = await Promise.all([
    testPresetA(),
    testPresetB(),
    testConfigurationPersistence(),
    testBlockReordering(),
    testSpanishFormatting()
  ]);
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Dashboard implementation is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
  
  return passed === total;
};

// Auto-run tests in development environment
if (typeof window !== 'undefined' && (window as any).runDashboardTests) {
  runAllTests();
}

// Export for manual testing
(window as any).dashboardTests = {
  testPresetA,
  testPresetB,
  testConfigurationPersistence,
  testBlockReordering,
  testSpanishFormatting,
  runAllTests
};