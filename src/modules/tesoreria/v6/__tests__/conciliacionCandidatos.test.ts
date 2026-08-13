import { candidatosDeLinea, hayCuadreClaro } from '../conciliacionCandidatos';
import type { TreasuryEvent } from '../../../services/db';

const ev = (over: Partial<TreasuryEvent> & { id: number }): TreasuryEvent =>
  ({
    accountId: 1,
    type: 'expense',
    amount: 48,
    predictedDate: '2026-08-01',
    description: 'Curenergía · Gas · Tenderina 64 4DR',
    providerName: 'Curenergía',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

// Un recurrente proyecta una previsión por mes · el desplegable las mostraba
// todas. Aquí se colapsan a UNA.
describe('candidatosDeLinea · una entrada por serie', () => {
  it('colapsa las instancias mensuales de un mismo recurrente y deja la más cercana', () => {
    const meses = ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map(
      (predictedDate, i) => ev({ id: i + 1, predictedDate }),
    );
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, meses);

    expect(cand).toHaveLength(1);
    expect(cand[0].fecha).toBe('2026-08-01'); // la de agosto, la del mes del cargo
    expect(cand[0].exacto).toBe(true);
  });

  it('series distintas NO se colapsan', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [
      ev({ id: 1, providerName: 'Curenergía', amount: 48 }),
      ev({ id: 2, providerName: 'Visalia', amount: 32.6, description: 'Visalia · Luz' }),
    ]);
    expect(cand).toHaveLength(2);
  });
});

describe('candidatosDeLinea · orden por cercanía', () => {
  it('lo que cuadra de importe va primero', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [
      ev({ id: 1, providerName: 'Visalia', amount: 32.6, description: 'Visalia' }),
      ev({ id: 2, providerName: 'Curenergía', amount: 48, description: 'Curenergía' }),
    ]);
    expect(cand[0].id).toBe(2);
    expect(cand[0].exacto).toBe(true);
    expect(cand[1].exacto).toBe(false);
  });

  it('respeta el signo · a un cargo no le ofrece ingresos', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [
      ev({ id: 1, type: 'income', amount: 48, description: 'Renta' }),
    ]);
    expect(cand).toHaveLength(0);
  });

  it('fuera de la ventana de fechas no entra', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [
      ev({ id: 1, predictedDate: '2026-01-01' }),
    ]);
    expect(cand).toHaveLength(0);
  });

  it('recorta a `max` series', () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      ev({ id: i + 1, providerName: `Proveedor ${i}`, amount: 10 + i, description: `P${i}` }),
    );
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, muchos, { max: 4 });
    expect(cand).toHaveLength(4);
  });
});

describe('hayCuadreClaro', () => {
  it('un único candidato exacto y cercano es cuadre claro', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [ev({ id: 1 })]);
    expect(hayCuadreClaro(cand)).toBe(true);
  });

  it('sin candidato exacto NO hay cuadre · la acción por defecto es crear', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -38 }, [
      ev({ id: 1, amount: 48 }),
    ]);
    expect(hayCuadreClaro(cand)).toBe(false);
  });

  it('dos candidatos exactos NO es cuadre claro · lo decide el usuario', () => {
    const cand = candidatosDeLinea({ fecha: '2026-08-02', importe: -48 }, [
      ev({ id: 1, providerName: 'Curenergía', description: 'A' }),
      ev({ id: 2, providerName: 'Iberdrola', description: 'B' }),
    ]);
    expect(hayCuadreClaro(cand)).toBe(false);
  });
});
