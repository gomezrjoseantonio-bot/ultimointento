// PRUEBA · mes cerrado (marzo 2026) · previsto vs real vs desviación.
// El "real" se calcula con el CÓDIGO REAL del Bloque B (comparativaService.getActualData),
// que cruza el enlace previsión↔movimiento. El "previsto" se suma de los treasuryEvents
// del mes (lo que el plan preveía). Escenario de un mes ya cerrado sembrado en la BD.
import { initDB } from '../../../../../services/db';
import { comparativaService } from './comparativaService';

const MAR = 2; // índice de marzo (0=ene)

type Ev = { id: number; type: 'income' | 'expense' | 'financing'; amount: number; actualAmount: number; mid: number; desc: string };
// amount = previsto (con signo) · actualAmount = real (magnitud) · mid = movimiento vinculado
const EVENTOS: Ev[] = [
  { id: 1, type: 'income',    amount:  850, actualAmount: 850,  mid: 1, desc: 'Renta Buigas 15' },
  { id: 2, type: 'income',    amount:  450, actualAmount: 430,  mid: 2, desc: 'Renta Tenderina 64 (inquilino pagó 20 menos)' },
  { id: 3, type: 'financing', amount: -3445, actualAmount: 3445, mid: 3, desc: 'Cuota préstamos' },
  { id: 4, type: 'expense',   amount: -312, actualAmount: 312,  mid: 4, desc: 'Comunidad' },
  { id: 5, type: 'expense',   amount: -40,  actualAmount: 40,   mid: 5, desc: 'Compromiso personal · gimnasio' },
];
// Movimiento conciliado NO planificado (sin evento) — gasto imprevisto.
const IMPREVISTO = { id: 6, amount: -85, desc: 'Gasolina (no planificado)' };

describe('PRUEBA · marzo 2026 cerrado · previsto vs real', () => {
  beforeEach(async () => {
    const db = await initDB();
    for (const s of ['treasuryEvents', 'movements'] as const) {
      const tx = db.transaction(s, 'readwrite'); await tx.objectStore(s).clear(); await tx.done;
    }
  });

  it('da tres cifras coherentes y no cero', async () => {
    const db = await initDB();
    for (const e of EVENTOS) {
      await db.put('treasuryEvents', {
        id: e.id, type: e.type, amount: e.amount, predictedDate: '2026-03-10T00:00:00.000Z',
        año: 2026, mes: 3, status: 'executed', actualAmount: e.actualAmount,
        executedMovementId: e.mid, movementId: e.mid, description: e.desc,
        sourceType: 'contrato', createdAt: '', updatedAt: '',
      } as never);
      await db.put('movements', {
        id: e.mid, accountId: 1, date: '2026-03-12', amount: e.type === 'income' ? e.actualAmount : -e.actualAmount,
        description: e.desc, unifiedStatus: 'conciliado', status: 'conciliado', source: 'import',
        category: { tipo: e.type === 'income' ? 'Ingresos' : 'Gastos' }, createdAt: '', updatedAt: '',
      } as never);
    }
    await db.put('movements', {
      id: IMPREVISTO.id, accountId: 1, date: '2026-03-20', amount: IMPREVISTO.amount,
      description: IMPREVISTO.desc, unifiedStatus: 'conciliado', status: 'conciliado', source: 'import',
      category: { tipo: 'Gastos' }, createdAt: '', updatedAt: '',
    } as never);

    // PREVISTO del mes = suma de los eventos previstos (lo que el plan esperaba para marzo).
    const previsto = EVENTOS.reduce((s, e) => s + e.amount, 0);
    // REAL del mes = código real del Bloque B (cruza el enlace).
    const real: number[] = await (comparativaService as unknown as {
      getActualData: (p: { year: number; scope: 'consolidado' }) => Promise<number[]>;
    }).getActualData({ year: 2026, scope: 'consolidado' });
    const realMar = real[MAR];
    const desviacion = realMar - previsto;

    // eslint-disable-next-line no-console
    console.log('\n================ MARZO 2026 · MES CERRADO ================');
    console.log('  Qué se preveía (previsto neto) :  ' + previsto.toLocaleString('es-ES') + ' €');
    console.log('  Qué pasó de verdad (real neto) :  ' + realMar.toLocaleString('es-ES') + ' €');
    console.log('  Desviación (real − previsto)   :  ' + desviacion.toLocaleString('es-ES') + ' €');
    console.log('  ---------------------------------------------------------');
    console.log('  · el real sale del getActualData del Bloque B (cruza el enlace)');
    console.log('  · Tenderina cobrada 20 € de menos + 85 € imprevisto = −105 € desviación');
    console.log('=========================================================\n');

    expect(realMar).not.toBe(0);          // el "real" NO es cero → las tuberías conducen
    expect(realMar).toBe(-2602);          // 850+430−3445−312−40−85
    expect(previsto).toBe(-2497);         // 850+450−3445−312−40
    expect(desviacion).toBe(-105);        // cuadra: −20 (Tenderina) −85 (imprevisto)
  });
});
