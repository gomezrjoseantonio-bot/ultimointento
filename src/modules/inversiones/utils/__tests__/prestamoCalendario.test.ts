import {
  addMonthsISO,
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
  });
});
