/**
 * Lo que rodea al cuadro · carencia técnica y previsiones de tesorería.
 *
 * El cuadro en sí ya no se genera aquí — vive en `prestamos/cuadro`, que es el
 * único motor, y su calibración contra la carta del Santander está en el test
 * de allí. Aquí queda lo que sigue siendo de este fichero.
 */

import {
  detectarCarenciaTecnica,
  calcularInteresesCarenciaTecnica,
  generarTreasuryEventDescriptors,
} from '../prestamoCalculatorService';
import type { Prestamo } from '../../types/prestamos';

const santander = {
  id: 'p1',
  nombre: 'Santander preconcedido',
  principalInicial: 78500,
  plazoMesesTotal: 96,
  fechaFirma: '2026-05-12',
  fechaPrimerCargo: '2026-07-01',
  diaCargoMes: 1,
  tipo: 'FIJO',
  tipoNominalAnualFijo: 4.99,
  esquemaPrimerRecibo: 'NORMAL',
  carenciaTecnica: { dias: 20, fechaLiquidacion: '2026-06-01', intereses: 214.64 },
} as unknown as Prestamo;

describe('la carencia técnica', () => {
  it('son los 20 días entre la firma y el primer mes de cobro', () => {
    const c = detectarCarenciaTecnica('2026-05-12', 1);

    expect(c.existe).toBe(true);
    expect(c.dias).toBe(20);
    expect(c.fechaLiquidacion).toBe('2026-06-01');
  });

  it('devengan 214,64 €', () => {
    expect(calcularInteresesCarenciaTecnica(78500, 0.0499, 20, 'ACT/365')).toBeCloseTo(214.64, 2);
  });

  // Firmar el mismo día en que se cobra no deja días sueltos que liquidar.
  it('firmando el día de cobro no hay ninguna', () => {
    const c = detectarCarenciaTecnica('2026-05-01', 1);

    expect(c.existe).toBe(false);
    expect(c.dias).toBe(0);
    expect(c.fechaLiquidacion).toBeNull();
  });

  it('cero días no devengan nada', () => {
    expect(calcularInteresesCarenciaTecnica(78500, 0.0499, 0, 'ACT/365')).toBe(0);
  });
});

// Las previsiones salen del cuadro del motor ÚNICO. Antes esta función
// generaba uno propio, con el TIN que le pasara el caller: era el tercer cuadro
// de la casa, y de él salía lo que después se cuadraba contra el banco.
describe('los cargos previstos', () => {
  const eventos = () => generarTreasuryEventDescriptors(santander, 1);

  it('un ingreso de disposición, la carencia y las 96 cuotas', () => {
    expect(eventos()).toHaveLength(98);
  });

  it('la disposición entra el día de la firma', () => {
    const [primero] = eventos();

    expect(primero.tipo).toBe('ingreso');
    expect(primero.fecha).toBe('2026-05-12');
    expect(primero.importe).toBeCloseTo(78500, 2);
  });

  it('la carencia técnica va marcada y aparte', () => {
    const carencia = eventos()[1];

    expect(carencia.esCarenciaTecnica).toBe(true);
    expect(carencia.fecha).toBe('2026-06-01');
    expect(carencia.importe).toBeCloseTo(214.64, 2);
  });

  it('las cuotas llevan su número y su desglose', () => {
    const cuota1 = eventos()[2];

    expect(cuota1.numeroCuota).toBe(1);
    expect(cuota1.fecha).toBe('2026-07-01');
    expect(cuota1.importe).toBeCloseTo(993.43, 2);
    expect(cuota1.desglose?.capital).toBeCloseTo(667, 2);
    expect(cuota1.desglose?.intereses).toBeCloseTo(326.43, 2);
  });

  it('la última es la 96 y cae en junio de 2034', () => {
    const ultima = eventos()[97];

    expect(ultima.numeroCuota).toBe(96);
    expect(ultima.fecha).toBe('2034-06-01');
  });

  // Sin carencia técnica guardada no se emite su cargo · el préstamo nunca la
  // tuvo y aparecería un gasto que nadie va a pagar.
  it('sin carencia técnica son 97 · disposición y 96 cuotas', () => {
    const sinCarencia = { ...santander, carenciaTecnica: null } as unknown as Prestamo;
    const r = generarTreasuryEventDescriptors(sinCarencia, 1);

    expect(r).toHaveLength(97);
    expect(r.some((d) => d.esCarenciaTecnica)).toBe(false);
  });
});
