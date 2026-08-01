// FASE 0 · diagnóstico de previsiones duplicadas.
//
// No borra: cuenta y explica cuánto distorsionan el cierre. El plan pide
// reportar antes de tocar nada, y para eso hace falta que las cifras sean
// exactas — un informe que exagera lleva a borrar de más.

import { analizarDuplicados, claveDuplicado, resumirInforme } from '../duplicadosPrevisionService';
import type { TreasuryEvent } from '../db';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-10',
    description: 'Recibo luz',
    sourceType: 'gasto_recurrente',
    sourceId: 55,
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('qué cuenta como duplicado', () => {
  it('mismo origen, mes, cuenta e importe · es la misma previsión repetida', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 })]);

    expect(inf.grupos).toHaveLength(1);
    expect(inf.grupos[0].copias).toBe(2);
    expect(inf.copiasSobrantes).toBe(1);
  });

  it('distinto IMPORTE no es duplicado · puede ser una cuota partida o un ajuste', () => {
    // Meterlos en el mismo saco daría falsos positivos justo en el informe que
    // decide qué se borra.
    const inf = analizarDuplicados([ev({ id: 1, amount: 100 }), ev({ id: 2, amount: 120 })]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('distinto mes no es duplicado · un recurrente se repite todos los meses', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, predictedDate: '2026-08-10' }),
      ev({ id: 2, predictedDate: '2026-09-10' }),
    ]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('distinta cuenta no es duplicado', () => {
    const inf = analizarDuplicados([ev({ id: 1, accountId: 1 }), ev({ id: 2, accountId: 2 })]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('sin origen NO se cuenta · un alta a mano repetida es decisión del usuario', () => {
    const manual = ev({ sourceType: 'manual', sourceId: undefined });
    expect(claveDuplicado(manual)).toBeNull();

    const inf = analizarDuplicados([{ ...manual, id: 1 }, { ...manual, id: 2 }]);
    expect(inf.grupos).toHaveLength(0);
  });
});

describe('cuánto distorsionan', () => {
  it('tres copias de un gasto de 100 sobran 200, en negativo', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 }), ev({ id: 3 })]);

    expect(inf.grupos[0].copias).toBe(3);
    expect(inf.grupos[0].distorsion).toBe(-200);
    expect(inf.distorsionTotal).toBe(-200);
  });

  it('un ingreso duplicado distorsiona en positivo', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, type: 'income', amount: 475 }),
      ev({ id: 2, type: 'income', amount: 475 }),
    ]);
    expect(inf.grupos[0].distorsion).toBe(475);
  });

  it('ordena por lo que más daño hace, no por número de copias', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, sourceId: 1, amount: 10 }),
      ev({ id: 2, sourceId: 1, amount: 10 }),
      ev({ id: 3, sourceId: 1, amount: 10 }),
      ev({ id: 4, sourceId: 2, amount: 900 }),
      ev({ id: 5, sourceId: 2, amount: 900 }),
    ]);

    // 3 copias de 10 sobran 20; 2 copias de 900 sobran 900. Manda el importe.
    expect(inf.grupos[0].sourceId).toBe('2');
  });
});

describe('qué se puede limpiar y qué no', () => {
  it('solo sobran predicted · se limpian todas menos una', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 }), ev({ id: 3 })]);
    expect(inf.limpiablesPredicted).toBe(2);
    expect(inf.paraRevisionManual).toHaveLength(0);
  });

  it('si una copia está confirmada, esa se queda y las predicted se van', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, status: 'executed' }),
      ev({ id: 2 }),
      ev({ id: 3 }),
    ]);
    // Las dos predicted son limpiables; la ejecutada no se toca.
    expect(inf.limpiablesPredicted).toBe(2);
  });

  it('DOS copias ya confirmadas van a revisión manual · pueden ser cargos reales', () => {
    // El banco puede haber cobrado dos veces de verdad. Borrarlo sería inventar
    // que no pasó.
    const inf = analizarDuplicados([
      ev({ id: 1, status: 'executed' }),
      ev({ id: 2, status: 'executed' }),
    ]);

    expect(inf.paraRevisionManual).toHaveLength(1);
    expect(inf.limpiablesPredicted).toBe(0);
  });

  it('una descartada no cuenta como limpiable ni bloquea', () => {
    const inf = analizarDuplicados([ev({ id: 1, descartado: true }), ev({ id: 2 })]);
    expect(inf.grupos[0].estados).toContain('descartado');
  });
});

describe('el informe que se copia y se pega', () => {
  it('dice el total, lo que sobra y cuánto distorsiona', () => {
    const texto = resumirInforme(analizarDuplicados([ev({ id: 1 }), ev({ id: 2 })]));

    expect(texto).toContain('Previsiones en total: 2');
    expect(texto).toContain('Copias de más: 1');
    expect(texto).toContain('-100.00 €');
  });

  it('señala qué ORIGEN duplica más · es lo que apunta al generador culpable', () => {
    const texto = resumirInforme(
      analizarDuplicados([
        ev({ id: 1, sourceType: 'contrato', sourceId: 7 }),
        ev({ id: 2, sourceType: 'contrato', sourceId: 7 }),
        ev({ id: 3, sourceType: 'contrato', sourceId: 8, amount: 50 }),
        ev({ id: 4, sourceType: 'contrato', sourceId: 8, amount: 50 }),
        ev({ id: 5, sourceType: 'prestamo', sourceId: 9, amount: 70 }),
        ev({ id: 6, sourceType: 'prestamo', sourceId: 9, amount: 70 }),
      ])
    );

    expect(texto).toContain('Copias de más por origen');
    expect(texto).toContain('contrato: 2');
    expect(texto).toContain('prestamo: 1');
  });

  it('sin duplicados lo dice sin alarmar', () => {
    const texto = resumirInforme(analizarDuplicados([ev({ id: 1 })]));
    expect(texto).toContain('Grupos duplicados: 0');
    expect(texto).toContain('Copias de más: 0');
  });
});
