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
  await db.clear('accounts');
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

describe('presupuestoAnualService · el ancla y la ventana temporal (secciones 1.1–1.4 / 2)', () => {
  beforeEach(reset);

  it('modo rodante · 12 columnas consecutivas desde el mes en curso; la escalera NACE en el saldo observado', async () => {
    const db = await initDB();
    const iso = new Date().toISOString();
    // El saldo observado del usuario = 10.000 €, dado de alta HOY (el ancla).
    await db.add('accounts', {
      id: 1, iban: 'ES0000000000000000000000', status: 'ACTIVE', activa: true,
      openingBalance: 10000, openingBalanceDate: iso, createdAt: iso, updatedAt: iso,
    } as any);

    const { buildPresupuestoAnual } = await import('../presupuestoAnualService');
    const p = await buildPresupuestoAnual(new Date().getFullYear(), 'rodante');

    // Doce meses · consecutivos · cruzan el cambio de año (sección 2).
    expect(p.columnas.length).toBe(12);
    for (let k = 1; k < 12; k++) {
      const prev = p.columnas[k - 1].year * 12 + p.columnas[k - 1].mesIndex;
      expect(p.columnas[k].year * 12 + p.columnas[k].mesIndex - prev).toBe(1);
    }
    // La primera columna es el mes en curso (sección 1.4).
    expect(p.columnas[0].espacio).toBe('curso');
    // Criterio 1 · el saldo del mes del ancla = el saldo real de las cuentas.
    expect(p.saldoPartida).toBe(10000);
    // La escalera NACE ahí: saldo[0] = saldo observado (no suma el flujo del mes · 1.4).
    expect(p.saldoFinMes[0].previsto).toBe(10000);
    // Criterio 2 · de ahí en adelante la escalera cuadra.
    let acc = p.saldoPartida;
    for (let k = 1; k < 12; k++) {
      acc = Math.round((acc + p.teQueda[k].previsto) * 100) / 100;
      expect(Math.round(p.saldoFinMes[k].previsto)).toBe(Math.round(acc));
    }
    // Criterio 11 · la columna se llama «Total 12 meses», no «Año».
    expect(p.totalLabel).toBe('Total 12 meses');
  });

  it('modo natural · un año POSTERIOR al ancla se pinta entero (enero–diciembre) y sí suma el flujo de enero', async () => {
    const { buildPresupuestoAnual } = await import('../presupuestoAnualService');
    const future = new Date().getFullYear() + 3; // > año del ancla (hoy)
    const p = await buildPresupuestoAnual(future, 'natural');

    // Sin recorte: 12 columnas arrancando en enero.
    expect(p.columnas.length).toBe(12);
    expect(p.columnas[0].mesIndex).toBe(0);
    expect(p.totalLabel).toBe('Año');
    // En un año posterior al ancla la escalera arranca del arrastre a 1-ene y SÍ
    // suma el flujo de enero (a diferencia del mes del ancla).
    expect(Math.round(p.saldoFinMes[0].previsto)).toBe(Math.round(p.saldoPartida + p.teQueda[0].previsto));
  });

  it('un movimiento POSTERIOR al ancla, al puntearlo, no cambia el total del saldo (criterio 5)', async () => {
    const db = await initDB();
    const iso = new Date().toISOString();
    await db.add('accounts', {
      id: 1, iban: 'ES0000000000000000000000', status: 'ACTIVE', activa: true,
      openingBalance: 5000, openingBalanceDate: iso, createdAt: iso, updatedAt: iso,
    } as any);
    const { buildPresupuestoAnual } = await import('../presupuestoAnualService');

    // El saldo (stock) sale SOLO del previsto: puntear o no un movimiento no lo
    // mueve (el real de la escalera es siempre null · lo lleva Tesorería).
    const p = await buildPresupuestoAnual(new Date().getFullYear(), 'rodante');
    expect(p.saldoFinMes.every((c) => c.real === null)).toBe(true);
  });
});
