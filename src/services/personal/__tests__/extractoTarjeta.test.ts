// El parser del extracto de tarjeta (Carrefour) · líneas reales del PDF de Jose.
// Solo las compras (empiezan por fecha); cabeceras, totales y pie caen solos.

import { parsearLineasCarrefour, importeEspañol } from '../extractoTarjeta';

describe('importe español a número', () => {
  it('con miles y decimales', () => {
    expect(importeEspañol('1.667,13')).toBe(1667.13);
  });
  it('sin miles', () => {
    expect(importeEspañol('20,89')).toBe(20.89);
  });
});

describe('parsear el detalle del extracto', () => {
  // Copiadas del PDF real (reconstruidas por línea).
  const LINEAS = [
    'Detalle de tus operaciones a Contado Fin de Mes',
    '20/06/2026 UBER1892231HELP help.uber.com NL 20,89 €',
    '23/06/2026 ANTH1892231CLAU SAN FRANCISCO US 108,90 €',
    '03/07/2026 MERCADONA ONLINE 122,36 €',
    '04/07/2026 EXPENDEDURIA 6 POZUELO 53,50 €',
    'Total compras realizadas a Contado Fin de Mes 31/07/2026 1.667,13 €',
    '6377- 0/0',
  ];

  it('saca una compra por línea de detalle', () => {
    const compras = parsearLineasCarrefour(LINEAS);
    expect(compras).toHaveLength(4);
  });

  it('cada compra lleva fecha ISO, concepto literal e importe positivo', () => {
    const [uber] = parsearLineasCarrefour(LINEAS);
    expect(uber).toEqual({
      fecha: '2026-06-20',
      concepto: 'UBER1892231HELP help.uber.com NL',
      importe: 20.89,
    });
  });

  it('la del tabaco (EXPENDEDURIA) sale con su importe', () => {
    const tabaco = parsearLineasCarrefour(LINEAS).find((c) => c.concepto.startsWith('EXPENDEDURIA'));
    expect(tabaco?.importe).toBe(53.5);
  });

  it('la línea de TOTAL no es una compra · empieza por "Total", no por fecha', () => {
    const compras = parsearLineasCarrefour(LINEAS);
    expect(compras.some((c) => c.importe === 1667.13)).toBe(false);
  });

  it('la cabecera y el pie no cuelan', () => {
    expect(parsearLineasCarrefour(['Detalle de tus operaciones', '6377- 0/0', ''])).toEqual([]);
  });

  it('una compra del próximo recibo también se lee', () => {
    const [c] = parsearLineasCarrefour(['20/07/2026 SIMYO\\POZUELO DE AL\\ 7,50 €']);
    expect(c).toMatchObject({ fecha: '2026-07-20', importe: 7.5 });
  });

  it('una devolución (importe negativo) se lee con su signo', () => {
    const [c] = parsearLineasCarrefour(['15/07/2026 DEVOLUCION MERCADONA -12,50 €']);
    expect(c.importe).toBe(-12.5);
  });
});
