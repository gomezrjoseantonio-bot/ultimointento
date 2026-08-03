// Los dos vocabularios del método de pago · docs/VOCABULARIO-dinero.md §2.
//
// Lo que vigila: que la traducción entre `MetodoPagoCompromiso` y
// `MetodoDePago` esté COMPLETA y sea reversible. El `switch` que había antes se
// dejaba `bizum` sin caso: un recurrente por Bizum llegaba a la previsión sin
// método de pago, y luego no había con qué reconocerlo en el extracto. Un
// `switch` incompleto no avisa.

import {
  metodoDeCompromiso,
  metodoDeMovimiento,
  nombreDelMetodo,
} from '../metodoDePago';
import type { MetodoDePago } from '../db';
import type { MetodoPagoCompromiso } from '../../types/compromisosRecurrentes';

const DE_COMPROMISO: MetodoPagoCompromiso[] = [
  'domiciliacion',
  'transferencia',
  'tarjeta',
  'efectivo',
  'bizum',
];

const DE_MOVIMIENTO: MetodoDePago[] = [
  'Domiciliado',
  'Transferencia',
  'TPV',
  'Efectivo',
  'Bizum',
];

describe('la traducción está completa', () => {
  it.each(DE_COMPROMISO)('%s tiene nombre de movimiento', (metodo) => {
    expect(metodoDeMovimiento(metodo)).toBeTruthy();
  });

  it.each(DE_MOVIMIENTO)('%s tiene nombre de recurrente', (metodo) => {
    expect(metodoDeCompromiso(metodo)).toBeTruthy();
  });

  // El caso que se caía: `bizum` no estaba en el `switch` y devolvía undefined.
  it('el Bizum también se traduce · era el que faltaba', () => {
    expect(metodoDeMovimiento('bizum')).toBe('Bizum');
  });

  it('la tarjeta se llama TPV en un movimiento', () => {
    expect(metodoDeMovimiento('tarjeta')).toBe('TPV');
  });
});

describe('ida y vuelta', () => {
  it.each(DE_COMPROMISO)('%s vuelve a ser él mismo', (metodo) => {
    expect(metodoDeCompromiso(metodoDeMovimiento(metodo))).toBe(metodo);
  });

  it.each(DE_MOVIMIENTO)('%s vuelve a ser él mismo', (metodo) => {
    expect(metodoDeMovimiento(metodoDeCompromiso(metodo))).toBe(metodo);
  });
});

describe('cómo se le enseña al usuario', () => {
  // Un solo nombre por método · dos pantallas no pueden llamarlo distinto.
  it('los dos vocabularios enseñan lo mismo', () => {
    expect(nombreDelMetodo('tarjeta')).toBe('Tarjeta');
    expect(nombreDelMetodo('TPV')).toBe('Tarjeta');
    expect(nombreDelMetodo('domiciliacion')).toBe('Domiciliación');
    expect(nombreDelMetodo('Domiciliado')).toBe('Domiciliación');
  });

  it.each(DE_COMPROMISO)('%s tiene un nombre legible', (metodo) => {
    expect(nombreDelMetodo(metodo)).toMatch(/^[A-ZÁ-Ú]/);
  });
});
