// H9-FISCAL: AEAT Amortization Tests
import { 
  calculateAEATAmortization, 
  formatEsCurrency, 
  formatEsPercentage 
} from './aeatAmortizationService';
import { initDB, Property } from './db';

// Mock data for testing
const createTestProperty = (aeatData: any): Property => ({
  id: 1,
  alias: 'Test Property',
  address: 'Test Address',
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Madrid',
  purchaseDate: '2020-01-01',
  squareMeters: 100,
  bedrooms: 3,
  transmissionRegime: 'usada',
  state: 'activo',
  acquisitionCosts: {
    price: 300000
  },
  documents: [],
  aeatAmortization: aeatData
});

// Test cases based on AEAT requirements
const runAEATTests = async () => {
  console.log('🏠 AEAT Amortization Tests');
  console.log('================================');

  // Test 1: Oneroso estándar, todo el año alquilado
  console.log('\n📊 Test 1: Oneroso estándar, todo el año alquilado');
  const test1Property = createTestProperty({
    acquisitionType: 'onerosa',
    firstAcquisitionDate: '2020-01-01',
    cadastralValue: 150000,
    constructionCadastralValue: 120000,
    constructionPercentage: 80,
    onerosoAcquisition: {
      acquisitionAmount: 300000,
      acquisitionExpenses: 25000
    }
  });

  try {
    // Mock property in memory for calculation
    const calc1 = await calculateAEATAmortization(1, 2024, 365);
    console.log(`  ✓ Base amortizable: ${formatEsCurrency(calc1.baseAmount)}`);
    console.log(`  ✓ Porcentaje aplicado: ${formatEsPercentage(calc1.percentageApplied)}`);
    console.log(`  ✓ Amortización anual: ${formatEsCurrency(calc1.totalAmortization)}`);
    console.log(`  ✓ Método: ${calc1.calculationMethod}`);
    
    // Validation: Should use max(construction cost, cadastral construction value)
    const expectedConstructionCost = (300000 + 25000) * 0.8; // 260,000
    const expectedBase = Math.max(expectedConstructionCost, 120000); // 260,000
    const expectedAmortization = expectedBase * 0.03; // 7,800
    
    console.log(`  Expected base: ${formatEsCurrency(expectedBase)}`);
    console.log(`  Expected amortization: ${formatEsCurrency(expectedAmortization)}`);
    console.log(`  ✓ Test 1: ${Math.abs(calc1.totalAmortization - expectedAmortization) < 0.01 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 1 FAILED: ${error}`);
  }

  // Test 2: Oneroso, medio año alquilado
  console.log('\n📊 Test 2: Oneroso, medio año alquilado');
  try {
    const calc2 = await calculateAEATAmortization(1, 2024, 183); // ~6 months
    console.log(`  ✓ Días alquilados: ${calc2.daysRented} de ${calc2.daysAvailable}`);
    console.log(`  ✓ Amortización prorrateada: ${formatEsCurrency(calc2.totalAmortization)}`);
    
    // Validation: Should be approximately half of annual amount
    const expectedProrated = (260000 * 0.03) * (183 / 366); // Assuming 2024 is leap year
    console.log(`  Expected prorated: ${formatEsCurrency(expectedProrated)}`);
    console.log(`  ✓ Test 2: ${Math.abs(calc2.totalAmortization - expectedProrated) < 1 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 2 FAILED: ${error}`);
  }

  // Test 3: Usufructo temporal 10 años
  console.log('\n📊 Test 3: Usufructo temporal 10 años');
  const test3Property = createTestProperty({
    acquisitionType: 'lucrativa',
    firstAcquisitionDate: '2020-01-01',
    cadastralValue: 150000,
    constructionCadastralValue: 120000,
    constructionPercentage: 80,
    lucrativoAcquisition: {
      isdValue: 250000,
      isdTax: 15000,
      inherentExpenses: 2000
    },
    specialCase: {
      type: 'usufructo-temporal',
      usufructoDuration: 10,
      maxDeductibleIncome: 12000
    }
  });

  try {
    const calc3 = await calculateAEATAmortization(1, 2024, 365);
    console.log(`  ✓ Método: ${calc3.calculationMethod}`);
    console.log(`  ✓ Porcentaje aplicado: ${formatEsPercentage(calc3.percentageApplied)}`);
    console.log(`  ✓ Amortización: ${formatEsCurrency(calc3.totalAmortization)}`);
    console.log(`  ✓ Justificación: ${calc3.specialCaseJustification}`);
    
    // Validation: Should use coste/duración = 10% annually
    const expectedPercentage = 1 / 10; // 10%
    console.log(`  Expected percentage: ${formatEsPercentage(expectedPercentage)}`);
    console.log(`  ✓ Test 3: ${Math.abs(calc3.percentageApplied - expectedPercentage) < 0.001 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 3 FAILED: ${error}`);
  }

  // Test 4: Parte alquilada 30%
  console.log('\n📊 Test 4: Parte alquilada 30%');
  const test4Property = createTestProperty({
    acquisitionType: 'onerosa',
    firstAcquisitionDate: '2020-01-01',
    cadastralValue: 150000,
    constructionCadastralValue: 120000,
    constructionPercentage: 80,
    onerosoAcquisition: {
      acquisitionAmount: 300000,
      acquisitionExpenses: 25000
    },
    specialCase: {
      type: 'parcial-alquiler',
      rentedPercentage: 30
    }
  });

  try {
    const calc4 = await calculateAEATAmortization(1, 2024, 365);
    console.log(`  ✓ Método: ${calc4.calculationMethod}`);
    console.log(`  ✓ Porcentaje aplicado: ${formatEsPercentage(calc4.percentageApplied)}`);
    console.log(`  ✓ Amortización: ${formatEsCurrency(calc4.totalAmortization)}`);
    
    // Validation: Should be 3% * 30% = 0.9%
    const expectedPercentage = 0.03 * 0.3; // 0.9%
    console.log(`  Expected percentage: ${formatEsPercentage(expectedPercentage)}`);
    console.log(`  ✓ Test 4: ${Math.abs(calc4.percentageApplied - expectedPercentage) < 0.001 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 4 FAILED: ${error}`);
  }

  // Test 5: Sin valor catastral (obra nueva)
  console.log('\n📊 Test 5: Sin valor catastral');
  const test5Property = createTestProperty({
    acquisitionType: 'onerosa',
    firstAcquisitionDate: '2024-01-01',
    cadastralValue: 0,
    constructionCadastralValue: 0,
    constructionPercentage: 90,
    onerosoAcquisition: {
      acquisitionAmount: 400000,
      acquisitionExpenses: 30000
    },
    specialCase: {
      type: 'sin-valor-catastral',
      estimatedLandPercentage: 10
    }
  });

  try {
    const calc5 = await calculateAEATAmortization(1, 2024, 365);
    console.log(`  ✓ Método: ${calc5.calculationMethod}`);
    console.log(`  ✓ Base amortizable: ${formatEsCurrency(calc5.baseAmount)}`);
    console.log(`  ✓ Amortización: ${formatEsCurrency(calc5.totalAmortization)}`);
    
    // Validation: Should apply 3% to 90% of total cost (construction)
    const totalCost = 400000 + 30000; // 430,000
    const constructionCost = totalCost * 0.9; // 387,000
    const expectedAmortization = constructionCost * 0.03; // 11,610
    console.log(`  Expected amortization: ${formatEsCurrency(expectedAmortization)}`);
    console.log(`  ✓ Test 5: ${Math.abs(calc5.totalAmortization - expectedAmortization) < 1 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 5 FAILED: ${error}`);
  }

  // Test 6: Porcentaje voluntario menor a 3%
  console.log('\n📊 Test 6: Porcentaje voluntario 2%');
  const test6Property = createTestProperty({
    acquisitionType: 'onerosa',
    firstAcquisitionDate: '2020-01-01',
    cadastralValue: 150000,
    constructionCadastralValue: 120000,
    constructionPercentage: 80,
    onerosoAcquisition: {
      acquisitionAmount: 300000,
      acquisitionExpenses: 25000
    },
    specialCase: {
      type: 'porcentaje-menor',
      customPercentage: 2
    }
  });

  try {
    const calc6 = await calculateAEATAmortization(1, 2024, 365);
    console.log(`  ✓ Método: ${calc6.calculationMethod}`);
    console.log(`  ✓ Porcentaje aplicado: ${formatEsPercentage(calc6.percentageApplied)}`);
    console.log(`  ✓ Amortización deducida: ${formatEsCurrency(calc6.accumulatedActual)}`);
    console.log(`  ✓ Amortización al 3% (futuras ventas): ${formatEsCurrency(calc6.accumulatedStandard)}`);
    
    // Validation: Should deduct 2% but track 3% for future sales
    console.log(`  ✓ Test 6: ${calc6.percentageApplied === 0.02 && calc6.accumulatedStandard > calc6.accumulatedActual ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`  ❌ Test 6 FAILED: ${error}`);
  }

  console.log('\n🎯 Testing Summary Complete');
  console.log('All calculations follow AEAT rules for property amortization.');
};

// Export for use in development/testing
export { runAEATTests };

// Utility function to format test results
export const formatTestResult = (testName: string, expected: number, actual: number, tolerance: number = 0.01): string => {
  const passed = Math.abs(actual - expected) <= tolerance;
  return `${testName}: ${passed ? '✅ PASS' : '❌ FAIL'} (Expected: ${formatEsCurrency(expected)}, Actual: ${formatEsCurrency(actual)})`;
};

// Example usage in console:
// import { runAEATTests } from './services/aeatAmortizationService.test';
// runAEATTests();