import {
  addMonthsISO,
  calcularCuadroPrestamo,
  cobroPrevistoDelMes,
  estadoPrestamoA,
  diaCobroDesde,
  mesesCobroDesde,
  PERIODO_MESES,
  primerCobroPorDefecto,
  toDateInput,
} from '../prestamoCalendario';

describe('prestamoCalendario', () => {
  describe('addMonthsISO', () => {
    it('suma meses manteniendo el día', () => {
      expect(addMonthsISO('2026-08-07', 1)).toBe('2026-09-07');
      expect(addMonthsISO('2026-08-07', 12)).toBe('2027-08-07');
    });

    it('resta meses con valores negativos', () => {
      expect(addMonthsISO('2026-09-07', -1)).toBe('2026-08-07');
      expect(addMonthsISO('2026-01-15', -3)).toBe('2025-10-15');
    });

    it('recorta el día al último del mes destino', () => {
      expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
      expect(addMonthsISO('2026-03-31', -1)).toBe('2026-02-28');
    });

    it('devuelve cadena vacía sin fecha', () => {
      expect(addMonthsISO('', 1)).toBe('');
    });
  });

  describe('mesesCobroDesde', () => {
    it('mensual · los doce meses', () => {
      expect(mesesCobroDesde('2026-03-10', 'mensual')).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    });

    it('trimestral · avanza de tres en tres desde el primer cobro', () => {
      expect(mesesCobroDesde('2026-03-10', 'trimestral')).toEqual([3, 6, 9, 12]);
      expect(mesesCobroDesde('2026-01-10', 'trimestral')).toEqual([1, 4, 7, 10]);
    });

    it('semestral y anual', () => {
      expect(mesesCobroDesde('2026-05-01', 'semestral')).toEqual([5, 11]);
      expect(mesesCobroDesde('2026-05-01', 'anual')).toEqual([5]);
    });

    it('devuelve vacío con fecha inválida', () => {
      expect(mesesCobroDesde('', 'mensual')).toEqual([]);
    });
  });

  describe('diaCobroDesde', () => {
    it('extrae el día del mes', () => {
      expect(diaCobroDesde('2026-03-28')).toBe(28);
    });

    it('devuelve undefined con fecha inválida', () => {
      expect(diaCobroDesde('')).toBeUndefined();
    });
  });

  describe('primerCobroPorDefecto', () => {
    it('propone la firma + un periodo en modalidades periódicas', () => {
      expect(primerCobroPorDefecto('2026-08-07', 'mensual', false, 60)).toBe('2026-09-07');
      expect(primerCobroPorDefecto('2026-08-07', 'trimestral', false, 60)).toBe('2026-11-07');
    });

    it('propone el vencimiento en la modalidad bullet', () => {
      expect(primerCobroPorDefecto('2026-08-07', 'mensual', true, 24)).toBe('2028-08-07');
    });

    it('devuelve cadena vacía sin fecha de firma', () => {
      expect(primerCobroPorDefecto('', 'mensual', false, 12)).toBe('');
    });
  });

  describe('inicio del devengo', () => {
    it('retrocede un periodo desde el primer cobro · el generador emite el pago en la fecha elegida', () => {
      const primerCobro = '2026-11-07';
      const inicioDevengo = addMonthsISO(primerCobro, -PERIODO_MESES.trimestral);
      expect(inicioDevengo).toBe('2026-08-07');
      expect(addMonthsISO(inicioDevengo, PERIODO_MESES.trimestral)).toBe(primerCobro);
    });
  });

  describe('toDateInput', () => {
    it('recorta el instante ISO a YYYY-MM-DD', () => {
      expect(toDateInput('2026-08-07T12:00:00.000Z')).toBe('2026-08-07');
      expect(toDateInput(undefined)).toBe('');
    });

    it('devuelve cadena vacía ante una fecha con formato inválido', () => {
      expect(toDateInput('foo')).toBe('');
      expect(toDateInput('07/08/2026')).toBe('');
    });
  });
});

describe('calcularCuadroPrestamo', () => {
  const base = {
    capital: 30000,
    tinAnual: 3.25,
    duracionMeses: 60,
    frecuencia: 'mensual' as const,
    primerCobro: '2025-04-01',
  };

  describe('cuota francesa (capital_e_intereses)', () => {
    const cuadro = calcularCuadroPrestamo({ ...base, modalidad: 'capital_e_intereses' })!;

    it('genera una cuota por periodo', () => {
      expect(cuadro).not.toBeNull();
      expect(cuadro.periodos).toHaveLength(60);
      expect(cuadro.amortiza).toBe(true);
    });

    it('calcula la cuota constante con la fórmula francesa', () => {
      // 30.000 € al 3,25% a 60 meses → 542,40 €/mes
      expect(cuadro.cuota).toBeCloseTo(542.4, 1);
    });

    it('deja el capital vivo a cero en la última cuota', () => {
      expect(cuadro.periodos[cuadro.periodos.length - 1].saldoPendiente).toBe(0);
    });

    it('devuelve exactamente el capital prestado sumando amortizaciones', () => {
      const amortizado = cuadro.periodos.reduce((s, p) => s + p.amortizacion, 0);
      expect(amortizado).toBeCloseTo(30000, 2);
    });

    it('reparte cada cuota entre intereses decrecientes y capital creciente', () => {
      const primera = cuadro.periodos[0];
      const ultima = cuadro.periodos[59];
      expect(primera.interes).toBeGreaterThan(ultima.interes);
      expect(primera.amortizacion).toBeLessThan(ultima.amortizacion);
      expect(primera.cuota).toBeCloseTo(ultima.cuota, 0);
    });

    it('cobra muchos menos intereses que un préstamo solo-intereses', () => {
      // Solo intereses: 30.000 × 3,25% × 5 años = 4.875 €.
      const soloIntereses = calcularCuadroPrestamo({ ...base, modalidad: 'solo_intereses' })!;
      expect(soloIntereses.totalIntereses).toBeCloseTo(4875, 0);
      expect(cuadro.totalIntereses).toBeLessThan(2600);
      expect(cuadro.totalIntereses).toBeGreaterThan(2500);
    });

    it('espacia las cuotas según la frecuencia', () => {
      expect(cuadro.periodos[0].fecha).toBe('2025-04-01');
      expect(cuadro.periodos[1].fecha).toBe('2025-05-01');
      const trimestral = calcularCuadroPrestamo({
        ...base,
        frecuencia: 'trimestral',
        modalidad: 'capital_e_intereses',
      })!;
      expect(trimestral.periodos).toHaveLength(20);
      expect(trimestral.periodos[1].fecha).toBe('2025-07-01');
    });

    it('cubre la duración completa aunque no sea múltiplo de la frecuencia', () => {
      // 10 meses en trimestral → 4 cuotas (redondear a la baja dejaría 9).
      const parcial = calcularCuadroPrestamo({
        ...base,
        duracionMeses: 10,
        frecuencia: 'trimestral',
        modalidad: 'capital_e_intereses',
      })!;
      expect(parcial.periodos).toHaveLength(4);
      expect(parcial.periodos[3].saldoPendiente).toBe(0);
    });

    it('reparte el capital a partes iguales con TIN 0', () => {
      const sinInteres = calcularCuadroPrestamo({
        ...base,
        tinAnual: 0,
        modalidad: 'capital_e_intereses',
      })!;
      expect(sinInteres.cuota).toBeCloseTo(500, 2);
      expect(sinInteres.totalIntereses).toBe(0);
    });
  });

  describe('solo_intereses', () => {
    const cuadro = calcularCuadroPrestamo({ ...base, modalidad: 'solo_intereses' })!;

    it('mantiene el capital vivo hasta la última cuota', () => {
      expect(cuadro.amortiza).toBe(false);
      expect(cuadro.periodos[0].saldoPendiente).toBe(30000);
      expect(cuadro.periodos[58].saldoPendiente).toBe(30000);
      expect(cuadro.periodos[59].saldoPendiente).toBe(0);
      expect(cuadro.periodos[59].amortizacion).toBe(30000);
    });

    it('cobra el mismo interés en todos los periodos', () => {
      expect(cuadro.periodos[0].interes).toBeCloseTo(81.25, 2);
      expect(cuadro.periodos[30].interes).toBeCloseTo(81.25, 2);
    });
  });

  describe('al_vencimiento', () => {
    it('genera una única cuota con capital e intereses', () => {
      const cuadro = calcularCuadroPrestamo({ ...base, modalidad: 'al_vencimiento' })!;
      expect(cuadro.periodos).toHaveLength(1);
      expect(cuadro.totalIntereses).toBeCloseTo(4875, 0);
      expect(cuadro.periodos[0].amortizacion).toBe(30000);
    });
  });

  it('devuelve null sin los datos mínimos', () => {
    expect(
      calcularCuadroPrestamo({ ...base, capital: 0, modalidad: 'capital_e_intereses' }),
    ).toBeNull();
    expect(
      calcularCuadroPrestamo({ ...base, duracionMeses: 0, modalidad: 'capital_e_intereses' }),
    ).toBeNull();
    expect(
      calcularCuadroPrestamo({ ...base, primerCobro: '', modalidad: 'capital_e_intereses' }),
    ).toBeNull();
  });
});

describe('estadoPrestamoA', () => {
  const cuadro = calcularCuadroPrestamo({
    capital: 30000,
    tinAnual: 3.25,
    duracionMeses: 60,
    frecuencia: 'mensual',
    modalidad: 'capital_e_intereses',
    primerCobro: '2025-04-01',
  })!;

  it('antes del primer cobro el capital sigue entero', () => {
    const estado = estadoPrestamoA(cuadro, '2025-03-31');
    expect(estado.saldoPendiente).toBe(30000);
    expect(estado.capitalAmortizado).toBe(0);
    expect(estado.cuotasPagadas).toBe(0);
    expect(estado.proximaCuota?.fecha).toBe('2025-04-01');
  });

  it('a mitad de vida el capital vivo ha bajado', () => {
    const estado = estadoPrestamoA(cuadro, '2027-10-01');
    expect(estado.cuotasPagadas).toBe(31);
    expect(estado.saldoPendiente).toBeLessThan(30000);
    expect(estado.saldoPendiente).toBeGreaterThan(0);
    expect(estado.pctAmortizado).toBeGreaterThan(0);
    expect(estado.pctAmortizado).toBeLessThan(100);
    expect(estado.capitalAmortizado + estado.saldoPendiente).toBeCloseTo(30000, 2);
  });

  it('al vencimiento no queda capital vivo', () => {
    const estado = estadoPrestamoA(cuadro, '2030-04-01');
    expect(estado.saldoPendiente).toBe(0);
    expect(estado.pctAmortizado).toBeCloseTo(100, 5);
    expect(estado.interesesAcumulados).toBeCloseTo(cuadro.totalIntereses, 2);
    expect(estado.proximaCuota).toBeNull();
  });
});

describe('cobroPrevistoDelMes', () => {
  const prestamo = (extra: Record<string, unknown> = {}) =>
    ({
      id: 1,
      nombre: 'Prestamo Creación',
      tipo: 'prestamo_p2p',
      entidad: 'Unihouser',
      valor_actual: 30000,
      total_aportado: 30000,
      aportaciones: [],
      fecha_compra: '2025-03-01T12:00:00.000Z',
      duracion_meses: 60,
      modalidad_devolucion: 'capital_e_intereses',
      frecuencia_cobro: 'mensual',
      rendimiento: {
        tasa_interes_anual: 3.25,
        frecuencia_pago: 'mensual',
        fecha_primer_cobro: '2025-04-01T12:00:00.000Z',
      },
      activo: true,
      ...extra,
    }) as never;

  it('cobra la cuota entera: intereses netos MÁS el capital devuelto', () => {
    const cobro = cobroPrevistoDelMes(prestamo(), '2025-04', 19)!;
    expect(cobro).not.toBeNull();
    // Primera cuota: 81,25 € de intereses (30.000 × 3,25% / 12) y el resto capital.
    expect(cobro.interesBruto).toBeCloseTo(81.25, 2);
    expect(cobro.retencion).toBeCloseTo(15.44, 2);
    expect(cobro.amortizacion).toBeCloseTo(461.15, 1);
    expect(cobro.incluyeCapital).toBe(true);
    // Neto = 81,25 − 15,44 + 461,15 ≈ 526,96 · muy por encima de los 65,81 €
    // que salían de contar solo los intereses.
    expect(cobro.neto).toBeCloseTo(526.96, 1);
  });

  it('usa la fecha exacta de la cuota, no un día inventado', () => {
    const cobro = cobroPrevistoDelMes(prestamo(), '2025-07', 19)!;
    expect(cobro.fecha).toBe('2025-07-01');
  });

  it('calcula los intereses sobre el capital vivo · bajan con el tiempo', () => {
    const primera = cobroPrevistoDelMes(prestamo(), '2025-04', 19)!;
    const tardia = cobroPrevistoDelMes(prestamo(), '2029-04', 19)!;
    expect(tardia.interesBruto).toBeLessThan(primera.interesBruto);
    expect(tardia.amortizacion).toBeGreaterThan(primera.amortizacion);
  });

  it('en solo-intereses no devuelve capital hasta el vencimiento', () => {
    const cobro = cobroPrevistoDelMes(
      prestamo({ modalidad_devolucion: 'solo_intereses' }),
      '2025-04',
      19,
    )!;
    expect(cobro.amortizacion).toBe(0);
    expect(cobro.incluyeCapital).toBe(false);
    expect(cobro.neto).toBeCloseTo(65.81, 2);
  });

  it('devuelve null en un mes sin cuota', () => {
    expect(cobroPrevistoDelMes(prestamo(), '2025-03', 19)).toBeNull();
    expect(cobroPrevistoDelMes(prestamo(), '2031-01', 19)).toBeNull();
  });
});
