// ============================================================================
// Los días arrendados de un año · unión de intervalos · DEDUC Parte A
// ============================================================================
//
// `getRentalDaysForYear` tomaba el MÁXIMO de los solapes de contrato con el
// año, no su unión. Un piso alquilado de febrero a junio y otra vez de
// septiembre a diciembre daba 150 días —el tramo mayor— cuando estuvo
// arrendado 272. Con eso se calcula la amortización (que salía corta) y, por
// resta, la imputación de renta (que salía larga).
//
// La unión ya estaba escrita para la venta (`calcularDiasArrendadoAno`); lo
// que faltaba era que la usaran los dos lados.
// ============================================================================

import { diasArrendadosEnAno, type ContratoConFechas } from '../diasArrendados';
import { FECHA_FIN_INDEFINIDO } from '../db/types-alquiler';

const c = (fechaInicio: string, fechaFin?: string): ContratoConFechas => ({ fechaInicio, fechaFin });

describe('diasArrendadosEnAno · la unión de los intervalos', () => {
  it('CONSECUTIVOS · feb-jun + sep-dic suman · el hueco de julio y agosto no cuenta', () => {
    const dias = diasArrendadosEnAno([c('2025-02-01', '2025-06-30'), c('2025-09-01', '2025-12-31')], 2025);
    // 150 (feb-jun) + 122 (sep-dic) = 272 · el máximo daba 150
    expect(dias).toBe(272);
  });

  it('SIMULTÁNEOS · dos habitaciones a la vez cuentan una vez, no dos', () => {
    const unaSola = diasArrendadosEnAno([c('2025-03-01', '2025-06-30')], 2025);
    const dosALaVez = diasArrendadosEnAno(
      [c('2025-03-01', '2025-06-30'), c('2025-03-01', '2025-06-30')],
      2025,
    );
    expect(dosALaVez).toBe(unaSola);
    expect(dosALaVez).toBe(122);
  });

  it('SOLAPE PARCIAL · lo común no se duplica', () => {
    // mar-jun (122) + may-ago (123) · unión mar-ago = 184
    const dias = diasArrendadosEnAno([c('2025-03-01', '2025-06-30'), c('2025-05-01', '2025-08-31')], 2025);
    expect(dias).toBe(184);
  });

  it('ADYACENTES · el 30 de junio y el 1 de julio no dejan hueco', () => {
    const dias = diasArrendadosEnAno([c('2025-01-01', '2025-06-30'), c('2025-07-01', '2025-12-31')], 2025);
    expect(dias).toBe(365);
  });

  it('LARGA todo el año · 365 · y 366 en bisiesto', () => {
    expect(diasArrendadosEnAno([c('2025-01-01', '2025-12-31')], 2025)).toBe(365);
    expect(diasArrendadosEnAno([c('2024-01-01', '2024-12-31')], 2024)).toBe(366);
  });

  it('se recorta al año · un contrato que lo desborda por los dos lados da el año entero', () => {
    expect(diasArrendadosEnAno([c('2024-06-01', '2026-06-30')], 2025)).toBe(365);
  });

  it('FECHA_FIN_INDEFINIDO cubre hasta el 31 de diciembre, no hasta 2099', () => {
    const dias = diasArrendadosEnAno([c('2025-03-01', FECHA_FIN_INDEFINIDO)], 2025);
    expect(dias).toBe(306); // del 1 de marzo al 31 de diciembre
  });

  it('sin fecha de fin, igual · sigue vivo a 31 de diciembre', () => {
    expect(diasArrendadosEnAno([c('2025-03-01')], 2025)).toBe(306);
  });

  it('un contrato de otro año no aporta días', () => {
    expect(diasArrendadosEnAno([c('2023-01-01', '2023-12-31')], 2025)).toBe(0);
    expect(diasArrendadosEnAno([], 2025)).toBe(0);
  });

  it('un solo día cuenta como un día · los dos extremos se incluyen', () => {
    expect(diasArrendadosEnAno([c('2025-05-10', '2025-05-10')], 2025)).toBe(1);
  });

  it('fechas ilegibles o al revés se ignoran sin romper', () => {
    expect(diasArrendadosEnAno([c('ayer', 'mañana')], 2025)).toBe(0);
    expect(diasArrendadosEnAno([c('2025-06-30', '2025-01-01')], 2025)).toBe(0);
    expect(diasArrendadosEnAno([c('2025-06-30', '2025-01-01'), c('2025-03-01', '2025-06-30')], 2025)).toBe(122);
  });

  it('acepta el espejo legacy `startDate` / `endDate`', () => {
    expect(diasArrendadosEnAno([{ startDate: '2025-03-01', endDate: '2025-06-30' }], 2025)).toBe(122);
  });

  // ── el corte por fecha de venta ────────────────────────────────────────────

  describe('con fecha de corte (venta)', () => {
    it('el año de la venta se cuenta solo hasta la fecha', () => {
      expect(diasArrendadosEnAno([c('2025-01-01', '2025-12-31')], 2025, '2025-06-30')).toBe(181);
    });

    it('una venta posterior al año no recorta nada', () => {
      expect(diasArrendadosEnAno([c('2025-01-01', '2025-12-31')], 2025, '2026-03-15')).toBe(365);
    });

    it('una venta anterior al año deja el año a cero', () => {
      expect(diasArrendadosEnAno([c('2025-01-01', '2025-12-31')], 2025, '2024-06-30')).toBe(0);
    });

    it('una fecha de corte ilegible se ignora · cuenta el año entero', () => {
      expect(diasArrendadosEnAno([c('2025-01-01', '2025-12-31')], 2025, 'no-es-una-fecha')).toBe(365);
    });
  });
});
