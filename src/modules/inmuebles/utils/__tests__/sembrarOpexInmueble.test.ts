// R4 · helpers del semillado de OPEX · puros, sobre el catálogo real.

import {
  refDeCompromiso,
  etiquetaConcepto,
  periodicidadPorDefecto,
  patronDePeriodicidad,
  construirSkeletonOpex,
} from '../sembrarOpexInmueble';
import { catalogoSugeridoPorModalidad } from '../../wizards/utils/catalogoModalidadInmueble';

describe('refDeCompromiso', () => {
  it('extrae la ref de catálogo del compromiso', () => {
    expect(refDeCompromiso({ familia: 'impuestos_tasas', subtipo: 'ibi' })).toEqual({
      tipoId: 'impuestos_tasas',
      subtipoId: 'ibi',
    });
  });
  it('sin subtipo la ref lleva subtipo vacío · null si falta la familia', () => {
    expect(refDeCompromiso({ familia: 'comunidad', subtipo: undefined })).toEqual({ tipoId: 'comunidad', subtipoId: '' });
    expect(refDeCompromiso({ familia: undefined, subtipo: 'ibi' })).toBeNull();
  });
});

describe('etiquetaConcepto', () => {
  it('devuelve la etiqueta del catálogo', () => {
    expect(etiquetaConcepto({ tipoId: 'impuestos_tasas', subtipoId: 'ibi' })).toBe('Impuestos y tasas · IBI');
    expect(etiquetaConcepto({ tipoId: 'comunidad', subtipoId: '' })).toBe('Comunidad');
  });
});

describe('periodicidadPorDefecto', () => {
  it('lo anual es anual, el resto mensual', () => {
    expect(periodicidadPorDefecto({ tipoId: 'impuestos_tasas', subtipoId: 'ibi' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'impuestos_tasas', subtipoId: 'basuras' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'seguros_alarmas', subtipoId: 'hogar' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'seguros_alarmas', subtipoId: 'alarma' })).toBe('mensual');
    expect(periodicidadPorDefecto({ tipoId: 'comunidad', subtipoId: 'cuota_mensual' })).toBe('mensual');
    expect(periodicidadPorDefecto({ tipoId: 'suministro', subtipoId: 'luz' })).toBe('mensual');
  });
});

describe('patronDePeriodicidad', () => {
  it('cada periodicidad da su patrón', () => {
    expect(patronDePeriodicidad('mensual')).toEqual({ tipo: 'mensualDiaFijo', dia: 1 });
    expect(patronDePeriodicidad('trimestral')).toEqual({ tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: 1, dia: 1 });
    expect(patronDePeriodicidad('anual')).toEqual({ tipo: 'anualMesesConcretos', mesesPago: [1], diaPago: 1 });
  });
});

describe('construirSkeletonOpex', () => {
  const base = { inmuebleId: 7, cuentaCargo: 3, periodicidad: 'mensual' as const, fechaInicio: '2026-08-20' };

  it('nace activo con importe > 0 y de ámbito inmueble', () => {
    const s = construirSkeletonOpex({ tipoId: 'comunidad', subtipoId: 'cuota_mensual' }, { ...base, importe: 60 });
    expect(s.ambito).toBe('inmueble');
    expect(s.inmuebleId).toBe(7);
    expect(s.cuentaCargo).toBe(3);
    expect(s.estado).toBe('activo');
    expect(s.importe).toEqual({ modo: 'fijo', importe: 60 });
    expect(s.patron).toEqual({ tipo: 'mensualDiaFijo', dia: 1 });
    expect(s.familia).toBe('comunidad');
    expect(s.subtipo).toBe('cuota_mensual');
    expect(s.alias).toBe('Comunidad · Cuota mensual');
    expect(s.fechaInicio).toBe('2026-08-20');
  });

  it('nace preparado sin importe (no genera previsión)', () => {
    const s = construirSkeletonOpex({ tipoId: 'impuestos_tasas', subtipoId: 'ibi' }, { ...base, importe: 0 });
    expect(s.estado).toBe('preparado');
    expect(s.importe).toEqual({ modo: 'fijo', importe: 0 });
  });

  // Dedup correcto: el compromiso que nace de un concepto sugerido debe volver a
  // dar la MISMA ref de catálogo (familia/subtipo), o `restarYaDados` no lo
  // filtraría y re-sembrar duplicaría. Se comprueba sobre TODOS los precargados.
  it('round-trip: cada precargado vuelve a su propia ref (dedup seguro)', () => {
    const modalidades = [
      catalogoSugeridoPorModalidad('larga_estancia', 'vivienda'),
      catalogoSugeridoPorModalidad('larga_estancia', 'habitacion'),
      catalogoSugeridoPorModalidad('media_estancia', 'vivienda'),
    ];
    for (const cat of modalidades) {
      for (const ref of cat.precargados) {
        const s = construirSkeletonOpex(ref, { ...base, importe: 10 });
        expect(refDeCompromiso(s)).toEqual(ref);
      }
    }
  });
});
