// ============================================================================
// Tests · modelo canónico de punteo (Bloque 3 · P1)
// ============================================================================

import {
  estadoDeEvento,
  estadoDeMovimiento,
  esReal,
  calcularDiscrepancia,
  UMBRAL_AUTO_ENTENDIDO,
  compararEnDia,
  agruparPorDia,
  contarEstados,
  chipsVisibles,
  filtrarPorChip,
  agruparHijas,
  type ItemPunteo,
} from '../punteoModel';

const item = (over: Partial<ItemPunteo>): ItemPunteo => ({
  key: over.key ?? `k-${Math.abs(over.importe ?? 0)}-${over.estado ?? 'previsto'}`,
  kind: 'evento',
  refId: 1,
  estado: 'previsto',
  fecha: '2026-07-31',
  concepto: 'x',
  activo: null,
  origen: 'Financiación',
  cuentaId: 1,
  importe: -100,
  ...over,
});

// ─── Derivación de estados ──────────────────────────────────────────────────

describe('punteo · derivación de estados', () => {
  test('evento predicted → previsto · confirmed (legacy) → confirmado', () => {
    expect(estadoDeEvento({ status: 'predicted' })).toBe('previsto');
    expect(estadoDeEvento({ status: 'confirmed' })).toBe('confirmado');
  });

  test('movimiento de extracto → conciliado · resto de realidad → confirmado', () => {
    expect(estadoDeMovimiento({ source: 'import' })).toBe('conciliado');
    expect(estadoDeMovimiento({ source: 'manual' })).toBe('confirmado');
    expect(estadoDeMovimiento({ source: 'inbox' as never })).toBe('confirmado');
  });

  test('real = confirmado ∨ conciliado', () => {
    expect(esReal('previsto')).toBe(false);
    expect(esReal('confirmado')).toBe(true);
    expect(esReal('conciliado')).toBe(true);
  });
});

// ─── Discrepancias ──────────────────────────────────────────────────────────

describe('punteo · discrepancias', () => {
  test('sin diferencia → null', () => {
    expect(calcularDiscrepancia(-304.25, -304.25)).toBeNull();
  });

  test('diferencia relevante → discrepancia sin revisar', () => {
    const d = calcularDiscrepancia(-304.25, -310.12);
    expect(d).not.toBeNull();
    expect(d!.delta).toBe(-5.87);
    expect(d!.revisada).toBe(false);
  });

  test('calderilla bajo el umbral → nace auto-revisada', () => {
    const d = calcularDiscrepancia(-304.25, -304.28);
    expect(d!.delta).toBe(-0.03);
    expect(d!.revisada).toBe(true);
    expect(Math.abs(d!.delta)).toBeLessThan(UMBRAL_AUTO_ENTENDIDO);
  });
});

// ─── Orden del día ──────────────────────────────────────────────────────────

describe('punteo · orden dentro del día (ingresos→gastos · |importe| desc)', () => {
  test('ingresos primero, luego gastos por magnitud', () => {
    const items = [
      item({ key: 'a', importe: -28.4 }),
      item({ key: 'b', importe: -993.43 }),
      item({ key: 'c', importe: 1340 }),
      item({ key: 'd', importe: -304.25 }),
      item({ key: 'e', importe: 350 }),
    ];
    const ordenados = items.slice().sort(compararEnDia);
    expect(ordenados.map((i) => i.key)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });

  test('estable: mismo importe desempata por key (nada salta al puntear)', () => {
    const a = item({ key: 'a', importe: -100 });
    const b = item({ key: 'b', importe: -100 });
    expect([b, a].sort(compararEnDia).map((i) => i.key)).toEqual(['a', 'b']);
  });
});

describe('punteo · agrupación por día', () => {
  test('días descendentes con totales por signo', () => {
    const dias = agruparPorDia([
      item({ key: 'a', fecha: '2026-07-25', importe: 9783.92 }),
      item({ key: 'b', fecha: '2026-07-31', importe: -993.43 }),
      item({ key: 'c', fecha: '2026-07-31', importe: 1340 }),
    ]);
    expect(dias.map((d) => d.fecha)).toEqual(['2026-07-31', '2026-07-25']);
    expect(dias[0].totalIngresos).toBe(1340);
    expect(dias[0].totalGastos).toBe(-993.43);
    expect(dias[0].items[0].key).toBe('c'); // ingreso primero
  });
});

// ─── Chips ──────────────────────────────────────────────────────────────────

describe('punteo · chips con regla ocultar-a-cero', () => {
  const items = [
    item({ key: 'p1', estado: 'previsto' }),
    item({ key: 'p2', estado: 'previsto' }),
    item({ key: 'c1', estado: 'confirmado' }),
  ];

  test('conteo por estado', () => {
    const c = contarEstados(items);
    expect(c).toEqual({ todos: 3, previstos: 2, confirmados: 1, conciliados: 0, discrepancias: 0 });
  });

  test('conciliados a 0 se oculta (usuario que nunca sube extracto)', () => {
    expect(chipsVisibles(contarEstados(items))).toEqual(['todos', 'previstos', 'confirmados']);
  });

  test('todos y previstos SIEMPRE visibles aunque estén a 0', () => {
    expect(chipsVisibles(contarEstados([]))).toEqual(['todos', 'previstos']);
  });

  test('discrepancia sin revisar activa su chip · revisada no', () => {
    const conDisc = [
      ...items,
      item({ key: 'z1', estado: 'conciliado', discrepancia: { importeConfirmado: -1, importeBanco: -2, delta: -1, revisada: false } }),
    ];
    expect(chipsVisibles(contarEstados(conDisc))).toContain('discrepancias');
    const revisada = [
      ...items,
      item({ key: 'z2', estado: 'conciliado', discrepancia: { importeConfirmado: -1, importeBanco: -2, delta: -1, revisada: true } }),
    ];
    expect(chipsVisibles(contarEstados(revisada))).not.toContain('discrepancias');
  });

  test('filtrarPorChip · previstos = cola de trabajo', () => {
    expect(filtrarPorChip(items, 'previstos').map((i) => i.key)).toEqual(['p1', 'p2']);
    expect(filtrarPorChip(items, 'todos')).toHaveLength(3);
  });
});

// ─── Madre/hijas ────────────────────────────────────────────────────────────

describe('punteo · madre/hijas (habitaciones)', () => {
  test('agrupa por grupoId con progreso · grupo de 1 no forma madre', () => {
    const grupos = agruparHijas([
      item({ key: 'h1', grupoId: 'contrato-9', estado: 'conciliado', importe: 350 }),
      item({ key: 'h2', grupoId: 'contrato-9', estado: 'previsto', importe: 325, importePrevisto: 325 }),
      item({ key: 'h3', grupoId: 'contrato-9', estado: 'previsto', importe: 340, importePrevisto: 340 }),
      item({ key: 'solo', grupoId: 'contrato-1', importe: -100 }),
      item({ key: 'sin', importe: -50 }),
    ]);
    expect(grupos.size).toBe(1);
    const g = grupos.get('contrato-9')!;
    expect(g.total).toBe(3);
    expect(g.cobradas).toBe(1);
    expect(g.importeReal).toBe(350);
    expect(g.importePrevistoTotal).toBe(1015);
    expect(g.completo).toBe(false);
  });

  test('grupo completo cuando todas las hijas son reales', () => {
    const grupos = agruparHijas([
      item({ key: 'h1', grupoId: 'g', estado: 'confirmado', importe: 350 }),
      item({ key: 'h2', grupoId: 'g', estado: 'conciliado', importe: 350 }),
    ]);
    expect(grupos.get('g')!.completo).toBe(true);
  });
});
