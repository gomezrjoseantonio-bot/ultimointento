// Test file to demonstrate FEIN precision hardening
// This test shows how the enhanced system extracts fields from realistic Spanish FEIN text

import { normalizeFeinFromDocAI } from '../normalize-docai';

describe('FEIN Precision Hardening Demo', () => {
  it('should extract comprehensive loan information from Spanish FEIN text', () => {
    const sampleFeinText = `
FICHA EUROPEA DE INFORMACIÓN NORMALIZADA SOBRE EL CRÉDITO (FEIN)

INFORMACIÓN SOBRE EL PRESTAMISTA
Banco Santander S.A.

INFORMACIÓN SOBRE EL CRÉDITO
Capital solicitado: 250.000,00 €
Plazo: 25 años
TIN: 3,25 %
TAE: 3,41 %
Cuota mensual aproximada: 1.263,45 €

CARACTERÍSTICAS DEL CRÉDITO
Tipo de interés: Variable
Índice de referencia: EURIBOR 12 meses
Diferencial: +1,50 %
Sistema de amortización: Francés

CUENTA DE CARGO
IBAN: ES12 0049 1234 1234 1234 5678

CONDICIONES PARA BONIFICACIÓN
- Domiciliación de nómina: -0,25 %
- Domiciliación de recibos: -0,15 %
- Seguro hogar: -0,10 %

OTROS GASTOS
Valor de tasación: 1.200,00 €
Gastos de notaría: 600,00 €
`;

    // Process with no DocAI entities to test pure precision hardening
    const result = normalizeFeinFromDocAI({
      entities: [],
      text: sampleFeinText
    });

    // Verify capital inicial extraction (excluding tasación value)
    expect(result.fields.capital_inicial).toBe('250.000,00 €');
    expect(result.byField.capital_inicial?.source).toBe('regex:capital');

    // Verify plazo conversion from años to meses
    expect(result.fields.plazoMeses).toBe(300); // 25 * 12
    expect(result.byField.plazoMeses?.source).toBe('regex:plazo_anos'); // Fix typo: anos not años

    // Verify Spanish percentage format parsing
    expect(result.fields.tin).toBe('3,25 %');
    expect(result.fields.tae).toBe('3,41 %');

    // Verify cuota extraction
    expect(result.fields.cuota).toBe('1263,45 €');

    // Verify variable loan type detection
    expect(result.fields.tipo).toBe('VARIABLE');
    expect(result.fields.indice).toBe('EURIBOR_12M');
    expect(result.fields.diferencial).toBe('+1,50 %');

    // Verify amortization system normalization
    expect(result.fields.sistemaAmortizacion).toBe('FRANCES');

    // Verify IBAN formatting
    expect(result.fields.cuentaCargo).toBe('ES12 0049 1234 1234 1234 5678');

    // Verify bonifications detection
    expect(result.fields.bonificaciones).toBeDefined();
    expect(result.fields.bonificaciones?.length).toBeGreaterThan(0);

    // Verify high confidence for text-based extraction
    expect(result.confidenceGlobal).toBeGreaterThan(0.65);

    // Log the results for verification
    console.log('\n=== FEIN Precision Hardening Results ===');
    console.log('Extracted Fields:', JSON.stringify(result.fields, null, 2));
    console.log(`Global Confidence: ${(result.confidenceGlobal * 100).toFixed(1)}%`);
    console.log('Pending Fields:', result.pending);
  });

  it('should handle exclusions correctly (avoid tasación values for capital)', () => {
    const textWithTasacion = `
INFORMACIÓN SOBRE EL CRÉDITO
Capital del préstamo: 200.000,00 €
Valor de tasación: 250.000,00 €
TIN: 2,95 %
`;

    const result = normalizeFeinFromDocAI({
      entities: [],
      text: textWithTasacion
    });

    // Should extract the loan capital, not the tasación value
    expect(result.fields.capital_inicial).toBe('200.000,00 €');
    expect(result.fields.tin).toBe('2,95 %');
  });

  it('should apply coherence validations (TAE >= TIN)', () => {
    const textWithRates = `
TIN: 3,25 %
TAE: 3,41 %
`;

    const result = normalizeFeinFromDocAI({
      entities: [],
      text: textWithRates
    });

    expect(result.fields.tin).toBe('3,25 %');
    expect(result.fields.tae).toBe('3,41 %');
    
    // Both should have good confidence since TAE > TIN (coherent)
    expect(result.byField.tin?.confidence).toBeGreaterThan(0.6);
    expect(result.byField.tae?.confidence).toBeGreaterThan(0.6);
  });
});