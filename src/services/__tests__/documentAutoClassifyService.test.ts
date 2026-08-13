import {
  parseAmount,
  metaForTipoGasto,
  classifyDocumentFromOCR,
  applyClassificationMetadata,
  toIsoDate,
} from '../documentAutoClassifyService';

const docWith = (data: Record<string, unknown>): any => ({
  id: 1,
  filename: 'factura.pdf',
  metadata: { ocr: { status: 'completed', data } },
});

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount(37.67)).toBe(37.67);
    expect(parseAmount(0)).toBe(0);
  });
  it('parses Spanish decimal comma', () => {
    expect(parseAmount('37,67')).toBe(37.67);
    expect(parseAmount('31,13 €')).toBe(31.13);
  });
  it('parses thousands + decimals', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });
  it('returns undefined for empty / garbage', () => {
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount(null)).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
  });
});

describe('metaForTipoGasto', () => {
  it('maps supplies to the facturas folder as recurring expense', () => {
    const m = metaForTipoGasto('electricidad');
    expect(m.carpeta).toBe('facturas');
    expect(m.tipo).toBe('Factura');
    expect(m.capex).toBe(false);
  });
  it('maps CAPEX to mejoras', () => {
    expect(metaForTipoGasto('mejora').capex).toBe(true);
    expect(metaForTipoGasto('mobiliario').carpeta).toBe('mejoras');
  });
  it('falls back to otros for unknown', () => {
    expect(metaForTipoGasto('loquesea').label).toBe('Otros');
    expect(metaForTipoGasto(undefined).label).toBe('Otros');
  });
});

describe('toIsoDate', () => {
  it('converts dd/mm/yyyy', () => {
    expect(toIsoDate('11/08/2026')).toBe('2026-08-11');
  });
  it('keeps yyyy-mm-dd', () => {
    expect(toIsoDate('2026-08-11')).toBe('2026-08-11');
  });
});

describe('classifyDocumentFromOCR', () => {
  it('extracts the VISALIA electricity invoice from the screenshots', () => {
    const c = classifyDocumentFromOCR(
      docWith({
        proveedor: 'Doméstica Gas y Electricidad S.L.U. (VISALIA)',
        tipo_gasto: 'electricidad',
        direccion: 'Calle Tenderina Baja 64 4 Izquierda, 33010, Oviedo, Asturias',
        numero_factura: 'DM260536286',
        fecha: '11/08/2026',
        base_imponible: '31,13',
        iva: '6,54',
        importe_total: '37,67',
      }),
    );
    expect(c.meta.label).toBe('Electricidad');
    expect(c.meta.capex).toBe(false);
    expect(c.total).toBe(37.67);
    expect(c.base).toBe(31.13);
    expect(c.iva).toBe(6.54);
    expect(c.ejercicio).toBe(2026);
    expect(c.numeroFactura).toBe('DM260536286');
    expect(c.direccion).toContain('Tenderina');
  });
});

describe('applyClassificationMetadata', () => {
  it('writes tipo/carpeta/categoria/financialData without touching the property link', () => {
    const doc = docWith({ proveedor: 'Iberdrola', tipo_gasto: 'electricidad', importe_total: '50,00' });
    const c = classifyDocumentFromOCR(doc);
    const out = applyClassificationMetadata(doc, c);
    expect(out.metadata.tipo).toBe('Factura');
    expect(out.metadata.carpeta).toBe('facturas');
    expect(out.metadata.categoria).toBe('Electricidad');
    expect(out.metadata.proveedor).toBe('Iberdrola');
    expect(out.metadata.financialData?.amount).toBe(50);
    // No auto-assignment as a side effect of classification
    expect(out.metadata.entityType).toBeUndefined();
    expect(out.metadata.entityId).toBeUndefined();
  });
});
