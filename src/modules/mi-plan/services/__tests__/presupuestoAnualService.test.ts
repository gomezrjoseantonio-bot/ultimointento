// PANTALLA-PRESUPUESTO · la vista del año · test del agregador de real por grupo
// (sección 4.3 · la pieza nueva). Verifica que:
//   · las previsiones ejecutadas se agrupan por bolsa/ámbito del evento,
//   · un movimiento conciliado SIN evento se clasifica por su categoría,
//   · lo no clasificable va al residuo,
//   · y la suma de (grupos + residuo) CUADRA con el neto (criterio 4).
import 'fake-indexeddb/auto';
import { initDB } from '../../../../services/db';
import { buildReal } from '../presupuestoAnualService';

const now = '2026-07-24T00:00:00.000Z';
const MAR = 2; // índice 0-based de marzo

const ev = (o: Record<string, unknown>) =>
  ({
    ambito: 'PERSONAL',
    status: 'executed',
    año: 2026,
    createdAt: now,
    updatedAt: now,
    ...o,
  }) as any;

async function reset() {
  const db = await initDB();
  await db.clear('treasuryEvents');
  await db.clear('movements');
  return db;
}

describe('presupuestoAnualService · agregador de real por grupo (sección 4.3)', () => {
  beforeEach(reset);

  it('agrupa ejecutados por bolsa/ámbito, clasifica el movimiento suelto y cuadra con el neto', async () => {
    const db = await initDB();
    // Renta (ingreso): previsto 450, real 430 (el inquilino pagó de menos).
    await db.add('treasuryEvents', ev({
      type: 'income', sourceType: 'contrato', mes: 3, amount: 450, actualAmount: 430,
      description: 'Renta Tenderina',
    }));
    // Gasto de inmueble (ámbito INMUEBLE manda sobre la bolsa · decisión 3).
    await db.add('treasuryEvents', ev({
      type: 'expense', ambito: 'INMUEBLE', mes: 3, amount: 312, description: 'Comunidad',
    }));
    // Gasto personal · bolsa necesidades → Hogar y familia.
    await db.add('treasuryEvents', ev({
      type: 'expense', bolsaPresupuesto: 'necesidades', mes: 3, amount: 3445, description: 'Vivienda',
    }));
    // Movimiento conciliado SIN evento · categoría transporte → necesidades → Hogar.
    await db.add('movements', {
      id: 991, amount: -85, date: '2026-03-14', unifiedStatus: 'conciliado',
      categoria: 'transporte', description: 'Gasolina (no planificado)',
    } as any);

    const real = await buildReal(2026);
    const m = real[MAR];

    expect(m.porGrupo.get('alquileres')).toBe(430);
    expect(m.porGrupo.get('inmuebles')).toBe(-312);
    expect(m.porGrupo.get('hogar')).toBe(-3530); // -3445 -85
    expect(m.residuo).toBe(0);

    // Reconciliación (criterio 4): Σ grupos + residuo === neto.
    const neto = Array.from(m.porGrupo.values()).reduce((s, v) => s + v, 0) + m.residuo;
    expect(neto).toBe(430 - 312 - 3530); // -3412
  });

  it('lo no clasificable (ahorro/sin categoría) va al residuo VISIBLE, no a un grupo', async () => {
    const db = await initDB();
    await db.add('treasuryEvents', ev({
      type: 'expense', bolsaPresupuesto: 'ahorroInversion', mes: 3, amount: 500, description: 'Aportación fondo',
    }));
    const real = await buildReal(2026);
    const m = real[MAR];
    expect(m.porGrupo.size).toBe(0);
    expect(m.residuo).toBe(-500);
  });

  it('una cuota con prestamoId va SOLO a Deuda (regla 2)', async () => {
    const db = await initDB();
    await db.add('treasuryEvents', ev({
      type: 'expense', ambito: 'INMUEBLE', prestamoId: '7', mes: 3, amount: 620,
      bolsaPresupuesto: 'inmueble', description: 'Cuota hipoteca',
    }));
    const real = await buildReal(2026);
    const m = real[MAR];
    expect(m.porGrupo.get('deuda')).toBe(-620);
    expect(m.porGrupo.get('inmuebles')).toBeUndefined();
  });
});

describe('presupuestoAnualService · modelo flujo/stock (correctiva · criterios 3/4)', () => {
  beforeEach(reset);

  it('Te queda = Σ grupos del mes; Saldo = escalera desde el saldo de partida; ningún cero de real inyectado', async () => {
    const { buildPresupuestoAnual } = await import('../presupuestoAnualService');
    const year = 2999; // año fijo · determinista (no depende del reloj del sistema)
    const p = await buildPresupuestoAnual(year);

    // Criterio 3 · Te queda[m] = suma firmada de los grupos de ese mes (flujo).
    for (let i = 0; i < 12; i++) {
      const sumaGrupos = p.grupos.reduce((s, g) => s + g.meses[i].previsto, 0);
      expect(Math.round(p.teQueda[i].previsto)).toBe(Math.round(sumaGrupos));
    }

    // Criterio 4 · Saldo[m] = Saldo[m-1] + Te queda[m], base = saldo de partida.
    let acc = p.saldoPartida;
    for (let i = 0; i < 12; i++) {
      acc = Math.round((acc + p.teQueda[i].previsto) * 100) / 100;
      expect(Math.round(p.saldoFinMes[i].previsto)).toBe(Math.round(acc));
    }

    // P2 · el saldo real de la tabla es de Tesorería, no del presupuesto → null.
    expect(p.saldoFinMes.every((c) => c.real === null)).toBe(true);

    // Criterio 2 · el previsto está definido en los 12 meses (número, no undefined).
    for (const g of p.grupos) {
      for (let i = 0; i < 12; i++) expect(typeof g.meses[i].previsto).toBe('number');
    }
  });
});
