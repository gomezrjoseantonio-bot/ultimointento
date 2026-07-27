// Reparto de un recibo entre varios inmuebles (§2.7) · reglas de cuadre.
import { repartoCuadra, modoDeReparto, sumaReparto } from '../RepartoEditor';
import type { RepartoInmueble } from '../../../../../../types/compromisosRecurrentes';

describe('reparto · cuadre por porcentaje', () => {
  const r: RepartoInmueble[] = [
    { inmuebleId: 1, porcentaje: 50 },
    { inmuebleId: 2, porcentaje: 50 },
  ];
  it('50 + 50 cuadra al 100 %', () => {
    expect(modoDeReparto(r)).toBe('porcentaje');
    expect(sumaReparto(r, 'porcentaje')).toBe(100);
    expect(repartoCuadra(r, 47.92)).toBe(true);
  });
  it('60 + 30 no cuadra', () => {
    expect(repartoCuadra([{ inmuebleId: 1, porcentaje: 60 }, { inmuebleId: 2, porcentaje: 30 }], 47.92)).toBe(false);
  });
});

describe('reparto · cuadre por importe', () => {
  const r: RepartoInmueble[] = [
    { inmuebleId: 1, importe: 23.96 },
    { inmuebleId: 2, importe: 23.96 },
  ];
  it('23,96 + 23,96 cuadra con 47,92 completo', () => {
    expect(modoDeReparto(r)).toBe('importe');
    expect(repartoCuadra(r, 47.92)).toBe(true);
  });
  it('no cuadra si la suma difiere del importe completo', () => {
    expect(repartoCuadra([{ inmuebleId: 1, importe: 20 }, { inmuebleId: 2, importe: 20 }], 47.92)).toBe(false);
  });
});

describe('reparto · vacío no cuadra', () => {
  it('un reparto vacío nunca cuadra', () => {
    expect(repartoCuadra([], 100)).toBe(false);
  });
});
