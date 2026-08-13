import {
  parseAmount,
  toIsoDate,
  detectConceptoId,
  classifyDocumentFromOCR,
  applyClassificationMetadata,
  conceptosInmueblePorFamilia,
  elegirCompromiso,
  withConcepto,
  type CompromisoLike,
} from '../documentAutoClassifyService';

const docWith = (data: Record<string, unknown>, filename = 'factura.pdf'): any => ({
  id: 1,
  filename,
  metadata: { ocr: { status: 'completed', data } },
});

describe('parseAmount', () => {
  it('parses plain numbers and Spanish strings', () => {
    expect(parseAmount(37.67)).toBe(37.67);
    expect(parseAmount('31,13 €')).toBe(31.13);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('abc')).toBeUndefined();
    expect(parseAmount('')).toBeUndefined();
  });
});

describe('toIsoDate', () => {
  it('normalizes dates', () => {
    expect(toIsoDate('11/08/2026')).toBe('2026-08-11');
    expect(toIsoDate('2026-08-11')).toBe('2026-08-11');
  });
});

describe('detectConceptoId', () => {
  it('detects electricity by provider (VISALIA)', () => {
    expect(detectConceptoId(docWith({ proveedor: 'Doméstica Gas y Electricidad S.L.U. (VISALIA)', tipo_gasto: 'electricidad' }))).toBe('luz');
  });
  it('detects IBI, comunidad, seguro, gestoría, agua, caldera by keyword', () => {
    expect(detectConceptoId(docWith({ proveedor: 'Ayuntamiento de Oviedo — IBI 2026' }))).toBe('ibi');
    expect(detectConceptoId(docWith({ proveedor: 'Comunidad de Propietarios C/ Uría' }))).toBe('comunidad_ordinaria');
    expect(detectConceptoId(docWith({ proveedor: 'MAPFRE Seguros del Hogar' }))).toBe('seguro_hogar');
    expect(detectConceptoId(docWith({ proveedor: 'Gestoría Pérez SL' }))).toBe('gestoria');
    expect(detectConceptoId(docWith({ proveedor: 'Aqualia Gestión Integral del Agua' }))).toBe('agua');
    expect(detectConceptoId(docWith({ proveedor: 'Reparación de caldera Junkers' }))).toBe('mantenimiento_caldera');
  });
  it('refines telecom to internet when fibra is present', () => {
    expect(detectConceptoId(docWith({ proveedor: 'Movistar' }))).toBe('telefonia');
    expect(detectConceptoId(docWith({ proveedor: 'Movistar Fibra 600', tipo_gasto: 'telecomunicaciones' }))).toBe('internet');
  });
  it('falls back to tipo_gasto when no provider keyword matches', () => {
    expect(detectConceptoId(docWith({ proveedor: 'Proveedor Genérico', tipo_gasto: 'agua' }))).toBe('agua');
  });
  it('returns undefined when nothing is confident', () => {
    expect(detectConceptoId(docWith({ proveedor: 'XYZ', tipo_gasto: 'otros' }))).toBeUndefined();
  });
});

describe('classifyDocumentFromOCR', () => {
  it('classifies the VISALIA electricity invoice to concepto luz', () => {
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
    expect(c.conceptoId).toBe('luz');
    expect(c.familia).toBe('suministros');
    expect(c.label).toBe('Luz');
    expect(c.total).toBe(37.67);
    expect(c.base).toBe(31.13);
    expect(c.ejercicio).toBe(2026);
    expect(c.numeroFactura).toBe('DM260536286');
  });
});

describe('applyClassificationMetadata', () => {
  it('writes concepto/tipo/carpeta/financialData without assigning a property', () => {
    const doc = docWith({ proveedor: 'MAPFRE', tipo_gasto: 'seguros', importe_total: '120,00' });
    const out = applyClassificationMetadata(doc, classifyDocumentFromOCR(doc));
    expect(out.metadata.concepto).toBe('seguro_hogar');
    expect(out.metadata.categoria).toBe('Seguro hogar');
    expect(out.metadata.tipo).toBe('Factura');
    expect(out.metadata.financialData?.amount).toBe(120);
    expect(out.metadata.entityType).toBeUndefined();
    expect(out.metadata.entityId).toBeUndefined();
  });
});

describe('elegirCompromiso (match a un gasto previsto)', () => {
  const compromisos: CompromisoLike[] = [
    { id: 1, concepto: 'luz', cups: 'ES0026000000024563MV', numeroContrato: '1006826478', proveedor: { nombre: 'VISALIA', nif: 'B99340564' }, inmuebleId: 3 },
    { id: 2, concepto: 'agua', proveedor: { nombre: 'Aqualia', nif: 'A26019992' }, inmuebleId: 3 },
    { id: 3, concepto: 'seguro_hogar', proveedor: { nombre: 'Mapfre', nif: 'A28141935' }, inmuebleId: 5 },
    { id: 4, concepto: 'seguro_hogar', proveedor: { nombre: 'Mapfre', nif: 'A28141935' }, inmuebleId: 7 },
  ];

  it('matches by CUPS first (strongest signal)', () => {
    const r = elegirCompromiso(compromisos, { cups: 'ES 0026 0000 0002 4563 MV', nif: 'X0000000X' });
    expect(r?.compromiso.id).toBe(1);
    expect(r?.matchedBy).toBe('cups');
  });
  it('matches by contract number when no CUPS', () => {
    const r = elegirCompromiso(compromisos, { numeroContrato: '1006826478' });
    expect(r?.compromiso.id).toBe(1);
    expect(r?.matchedBy).toBe('numeroContrato');
  });
  it('matches by NIF only when it is unique', () => {
    expect(elegirCompromiso(compromisos, { nif: 'A26019992' })?.compromiso.id).toBe(2);
    // Mapfre points to two inmuebles → NIF is not conclusive
    expect(elegirCompromiso(compromisos, { nif: 'A28141935' })).toBeNull();
  });
  it('returns null when nothing matches', () => {
    expect(elegirCompromiso(compromisos, { cups: 'ESXXXX', nif: 'Z9999999Z' })).toBeNull();
    expect(elegirCompromiso(compromisos, {})).toBeNull();
  });
});

describe('withConcepto', () => {
  it('overrides the concepto keeping OCR amounts', () => {
    const base = classifyDocumentFromOCR(docWith({ proveedor: 'Genérico', importe_total: '90,00' }));
    const out = withConcepto(base, 'ibi');
    expect(out.conceptoId).toBe('ibi');
    expect(out.familia).toBe('tributos');
    expect(out.label).toBe('IBI');
    expect(out.total).toBe(90);
  });
});

describe('conceptosInmueblePorFamilia', () => {
  it('groups only inmueble-deductible concepts by family', () => {
    const groups = conceptosInmueblePorFamilia();
    const familias = groups.map((g) => g.familia);
    expect(familias).toContain('suministros');
    expect(familias).toContain('tributos');
    expect(familias).toContain('seguros');
    // Personal-only families (e.g. suscripciones) have no inmueble projection
    expect(familias).not.toContain('suscripciones');
    const suministros = groups.find((g) => g.familia === 'suministros');
    expect(suministros?.conceptos.some((c) => c.id === 'luz')).toBe(true);
  });
});
