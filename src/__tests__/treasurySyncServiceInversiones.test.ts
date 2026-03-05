/**
 * Tests for treasurySyncService – inversiones section (Bloques ①②③④)
 *
 * Covered behaviors:
 * 1. Past-date guard: no events are generated when fecha_compra < today
 * 2. Empty-meses_cobro guard: non-monthly frequency with no meses_cobro → no rendimiento/dividend events
 * 3. Deduplication: isDuplicate uses sourceType+sourceId+monthPrefix (index-based, no full-table scan)
 * 4. Aportaciones puntuales use aportacion.id as sourceId (not pos.id)
 * 5. Deposito vencimiento: block 3a skipped when plan_liquidacion is activo+vencimiento
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.join(
  __dirname,
  '../modules/horizon/tesoreria/services/treasurySyncService.ts',
);
const source = fs.readFileSync(SERVICE_PATH, 'utf8');

// ─── 1. Past-date guard ──────────────────────────────────────────────────────

describe('treasurySyncService – past-date guard', () => {
  it('compares fechaCompraDateOnly >= today before inserting inversion_compra event', () => {
    // The normalized date variable must be compared against today
    expect(source).toContain('fechaCompraDateOnly >= today');
  });

  it('compares fechaRend >= today before inserting inversion_rendimiento event', () => {
    expect(source).toContain('fechaRend >= today');
  });

  it('compares fechaLiq >= today before inserting inversion_liquidacion event', () => {
    expect(source).toContain('fechaLiq >= today');
  });

  it('normalizes fecha_compra to date-only before comparison', () => {
    // Must call split('T')[0] on the raw value before comparing
    expect(source).toContain("fechaCompra.split('T')[0]");
    expect(source).toContain('fechaCompraDateOnly');
  });
});

// ─── 2. Empty-meses_cobro guard ──────────────────────────────────────────────

describe('treasurySyncService – empty meses_cobro guard', () => {
  it('falls back to empty array (not ALL_MONTHS) for rendimientos when meses_cobro absent on non-monthly frequency', () => {
    // The rendimiento meses_cobro resolution must use `? ... : []` (empty fallback),
    // NOT fall through to ALL_MONTHS when frequency is non-monthly.
    const rendimientoBlock = source.slice(
      source.indexOf('// ── Bloque ② VIDA'),
      source.indexOf('// ── Bloque ③ LIQUIDACIÓN'),
    );
    // When frecuencia_pago !== 'mensual', the fallback must be []
    expect(rendimientoBlock).toContain(': []');
    // ALL_MONTHS must only be used for the 'mensual' branch
    const mensualBranch = rendimientoBlock.indexOf("frecuencia_pago === 'mensual'");
    const emptyFallback = rendimientoBlock.indexOf(': []');
    expect(mensualBranch).toBeLessThan(emptyFallback);
  });

  it('falls back to empty array for plan_aportaciones when meses absent on non-monthly frequency', () => {
    const planApBlock = source.slice(
      source.indexOf('// 1c. Plan de aportaciones periódicas'),
      source.indexOf('// ── Bloque ② VIDA'),
    );
    expect(planApBlock).toContain(': []');
    const mensualBranch = planApBlock.indexOf("frecuencia === 'mensual'");
    const emptyFallback = planApBlock.indexOf(': []');
    expect(mensualBranch).toBeLessThan(emptyFallback);
  });
});

// ─── 3. Deduplication uses isDuplicate helper (index-based) ──────────────────

describe('treasurySyncService – deduplication', () => {
  it('uses isDuplicate helper for inversion_compra deduplication (not a full-table scan)', () => {
    // isDuplicate uses getAllFromIndex (indexed lookup), not getAll + .some()
    expect(source).toContain("isDuplicate('inversion_compra', pos.id)");
    // The isDuplicate implementation must use getAllFromIndex
    expect(source).toContain("db.getAllFromIndex('treasuryEvents', 'sourceId'");
  });

  it('uses isDuplicate helper for inversion_rendimiento deduplication', () => {
    expect(source).toContain("isDuplicate('inversion_rendimiento', pos.id)");
  });

  it('uses isDuplicate helper for inversion_liquidacion deduplication', () => {
    expect(source).toContain("isDuplicate('inversion_liquidacion', pos.id)");
  });

  it('uses isDuplicate helper for inversion_aportacion deduplication (not getAll scan)', () => {
    expect(source).toContain("isDuplicate('inversion_aportacion', aportacion.id)");
    // The old full-table scan (getAll + description match) must have been removed
    // from the aportaciones puntuales block. Use a regex that is whitespace-tolerant.
    const aportacionBlock = source.slice(
      source.indexOf('// 1b. Aportaciones puntuales futuras'),
      source.indexOf('// 1c. Plan de aportaciones periódicas'),
    );
    expect(aportacionBlock).not.toMatch(/db\.getAll\(['"]treasuryEvents['"]\)/);
  });
});

// ─── 4. Aportaciones puntuales use aportacion.id as sourceId ─────────────────

describe('treasurySyncService – aportaciones puntuales sourceId', () => {
  it('stores sourceId = aportacion.id (not pos.id) for individual contributions', () => {
    const aportacionBlock = source.slice(
      source.indexOf('// 1b. Aportaciones puntuales futuras'),
      source.indexOf('// 1c. Plan de aportaciones periódicas'),
    );
    expect(aportacionBlock).toContain('sourceId: aportacion.id');
    expect(aportacionBlock).not.toContain('sourceId: pos.id');
  });

  it('guards on aportacion.id != null before processing (not pos.id)', () => {
    const aportacionBlock = source.slice(
      source.indexOf('// 1b. Aportaciones puntuales futuras'),
      source.indexOf('// 1c. Plan de aportaciones periódicas'),
    );
    expect(aportacionBlock).toContain('aportacion.id != null');
  });
});

// ─── 5. Deposito vencimiento deduplication (no double event) ─────────────────

describe('treasurySyncService – deposito vencimiento deduplication', () => {
  it('skips block 3a when plan_liquidacion has tipo_liquidacion=vencimiento and is activo', () => {
    const liquidacionBlock = source.slice(
      source.indexOf('// ── Bloque ③ LIQUIDACIÓN'),
      source.indexOf('// ── Bloque ④ FISCALIDAD IRPF'),
    );
    // hasVencimientoPlan guard must exist
    expect(liquidacionBlock).toContain('hasVencimientoPlan');
    expect(liquidacionBlock).toContain("tipo_liquidacion === 'vencimiento'");
    expect(liquidacionBlock).toContain('!hasVencimientoPlan');
  });

  it('block 3b (plan_liquidacion) uses isDuplicate rather than a description-based full-table scan', () => {
    const liquidacionBlock = source.slice(
      source.indexOf('// 3b. Plan de liquidación'),
      source.indexOf('// ── Bloque ④ FISCALIDAD IRPF'),
    );
    expect(liquidacionBlock).toContain("isDuplicate('inversion_liquidacion', pos.id)");
    // The old description-based full-table scan should not exist in this block
    expect(liquidacionBlock).not.toContain("db.getAll('treasuryEvents')).some(");
  });
});

// ─── 6. Treasury regressions requested by product feedback ──────────────────

describe('treasurySyncService – treasury detail regressions', () => {
  it('creates autónomo expenses as separated partidas instead of one aggregated event', () => {
    expect(source).toContain("sourceType: 'autonomo_gasto'");
    expect(source).toContain("sourceType: 'autonomo_cuota'");
    expect(source).not.toContain("sourceType: 'autonomo' as const");
  });

  it('resolves credit-card receipt bank account through resolveAccountId', () => {
    expect(source).toContain('accountId: resolveAccountId(chargeAccountId)');
  });

  it('uses property literal helper to include address when alias is missing', () => {
    expect(source).toContain('function getPropertyLiteral');
    expect(source).toContain('property.address?.trim()');
  });
});
