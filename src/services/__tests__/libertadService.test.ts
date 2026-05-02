import { proyectarRentaPasivaLibertad } from '../libertadService';
import type { DatosRealesLibertad, LibertadConfig, SupuestosLibertad } from '../../types/libertad';
import { STANDARD_LIBERTAD_CONFIG, SUPUESTOS_NEUTROS_LIBERTAD } from '../../types/libertad';

function datosBase(
  rentaPasivaActualMensual: number,
  gastosVidaMensual: number,
  hitos: DatosRealesLibertad['hitos'] = [],
): DatosRealesLibertad {
  return {
    rentaPasivaActualMensual,
    gastosVidaMensual,
    hitos,
    mesReferencia: '2026-01',
  };
}

describe('proyectarRentaPasivaLibertad', () => {
  describe('Test 1 · STANDARD config · sin hitos · sin supuestos · no alcanza libertad', () => {
    it('no cruza cuando renta es muy inferior a gastos', () => {
      const resultado = proyectarRentaPasivaLibertad(
        datosBase(1000, 4000),
        SUPUESTOS_NEUTROS_LIBERTAD,
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.cruceLibertad).toBeNull();
      expect(resultado.pctCoberturaActual).toBeCloseTo(25, 1);
      expect(resultado.faltaMensualActual).toBe(3000);
      expect(resultado.serie.length).toBe(300); // 25 años × 12
      expect(resultado.faltanTexto).toBeNull();
    });
  });

  describe('Test 2 · ya cubierto desde mes 1', () => {
    it('detecta cruce en el mes de referencia cuando renta supera gastos', () => {
      const resultado = proyectarRentaPasivaLibertad(
        datosBase(5000, 4000),
        SUPUESTOS_NEUTROS_LIBERTAD,
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.cruceLibertad).not.toBeNull();
      expect(resultado.cruceLibertad!.isoYM).toBe('2026-01');
      expect(resultado.pctCoberturaActual).toBeCloseTo(125, 1);
      expect(resultado.faltaMensualActual).toBe(0);
      expect(resultado.serie[0].cubierto).toBe(true);
    });
  });

  describe('Test 3 · cruce con hito de compra', () => {
    it('detecta cruce poco después del mes del hito', () => {
      const resultado = proyectarRentaPasivaLibertad(
        datosBase(2000, 4000, [
          {
            id: 'h1',
            fecha: '2027-01-15',
            tipo: 'compra',
            impactoMensual: 2500,
          },
        ]),
        SUPUESTOS_NEUTROS_LIBERTAD,
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.cruceLibertad).not.toBeNull();
      const cruce = resultado.cruceLibertad!;
      // Hito aplica en 2027-01 → renta pasa a 4500 ≥ 4000 → cruce en 2027-01
      expect(cruce.anio).toBe(2027);
      expect(cruce.mes).toBe(1);
    });
  });

  describe('Test 4 · cruce por subida anual de rentas (interés compuesto)', () => {
    it('alcanza libertad gracias al crecimiento compuesto de rentas', () => {
      const resultado = proyectarRentaPasivaLibertad(
        datosBase(3000, 4000),
        { inflacionAnualPct: 0, subidaAnualRentasPct: 5 },
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.cruceLibertad).not.toBeNull();

      // Verifica serie monotónica creciente en renta (sin hitos)
      for (let i = 1; i < resultado.serie.length; i++) {
        expect(resultado.serie[i].rentaPasiva).toBeGreaterThanOrEqual(
          resultado.serie[i - 1].rentaPasiva,
        );
      }

      // Gastos constantes (0% inflación)
      const primerGasto = resultado.serie[0].gastosVida;
      for (const punto of resultado.serie) {
        expect(punto.gastosVida).toBeCloseTo(primerGasto, 1);
      }
    });
  });

  describe('Test 5 · validación de config no implementada', () => {
    it('lanza error si alcanceRentaPasiva no es alquiler-neto', () => {
      const configNoImpl: LibertadConfig = {
        ...STANDARD_LIBERTAD_CONFIG,
        alcanceRentaPasiva: 'alquiler-neto-mas-cupon',
      };

      expect(() =>
        proyectarRentaPasivaLibertad(datosBase(1000, 2000), SUPUESTOS_NEUTROS_LIBERTAD, configNoImpl),
      ).toThrow("T27.4.1 solo soporta alcanceRentaPasiva='alquiler-neto'");
    });

    it('lanza error si reglaCruce no es simple', () => {
      const configNoImpl: LibertadConfig = {
        ...STANDARD_LIBERTAD_CONFIG,
        reglaCruce: 'sostenido',
      };

      expect(() =>
        proyectarRentaPasivaLibertad(datosBase(1000, 2000), SUPUESTOS_NEUTROS_LIBERTAD, configNoImpl),
      ).toThrow("T27.4.1 solo soporta reglaCruce='simple'");
    });
  });

  describe('Test 6 · horizonte personalizado', () => {
    it('genera serie de 144 puntos con horizonte de 12 años', () => {
      const config: LibertadConfig = {
        ...STANDARD_LIBERTAD_CONFIG,
        horizonteAnios: 12,
      };

      const resultado = proyectarRentaPasivaLibertad(
        datosBase(1000, 4000),
        SUPUESTOS_NEUTROS_LIBERTAD,
        config,
      );

      expect(resultado.serie.length).toBe(144); // 12 × 12
    });
  });

  describe('Casos borde', () => {
    it('faltanTexto muestra solo meses cuando cruce es en menos de un año', () => {
      const supuestos: SupuestosLibertad = {
        inflacionAnualPct: 0,
        subidaAnualRentasPct: 50,
      };

      const resultado = proyectarRentaPasivaLibertad(
        datosBase(3500, 4000),
        supuestos,
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.cruceLibertad).not.toBeNull();
      if (resultado.cruceLibertad!.anio === 2026) {
        expect(resultado.faltanTexto).toMatch(/mes(es)?$/);
      }
    });

    it('gastosVida 0 no divide por cero', () => {
      const resultado = proyectarRentaPasivaLibertad(
        datosBase(1000, 0),
        SUPUESTOS_NEUTROS_LIBERTAD,
        STANDARD_LIBERTAD_CONFIG,
      );

      expect(resultado.pctCoberturaActual).toBe(0);
      expect(resultado.faltaMensualActual).toBe(0);
    });
  });
});
