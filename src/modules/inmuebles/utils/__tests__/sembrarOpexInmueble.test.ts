// R4 · helpers del semillado de OPEX · puros, sobre el catálogo real.

import {
  argsCatalogoDeModo,
  refDeCompromiso,
  etiquetaConcepto,
  periodicidadPorDefecto,
  patronDePeriodicidad,
  construirSkeletonOpex,
} from '../sembrarOpexInmueble';
import { catalogoSugeridoPorModalidad } from '../../wizards/utils/catalogoModalidadInmueble';

describe('argsCatalogoDeModo', () => {
  it('mapea el modo de explotación al catálogo correcto', () => {
    expect(argsCatalogoDeModo('completo')).toEqual({ modalidad: 'larga_estancia', unidadTipo: 'vivienda' });
    expect(argsCatalogoDeModo('habitaciones')).toEqual({ modalidad: 'larga_estancia', unidadTipo: 'habitacion' });
    expect(argsCatalogoDeModo('turistico')).toEqual({ modalidad: 'temporada', unidadTipo: 'vivienda' });
  });
});

describe('refDeCompromiso', () => {
  it('extrae la ref de catálogo del compromiso', () => {
    expect(refDeCompromiso({ tipoFamilia: 'tributos', subtipo: 'ibi' })).toEqual({
      tipoId: 'tributos',
      subtipoId: 'ibi',
    });
  });
  it('null si falta la familia o el subtipo', () => {
    expect(refDeCompromiso({ tipoFamilia: 'tributos', subtipo: undefined })).toBeNull();
    expect(refDeCompromiso({ tipoFamilia: undefined, subtipo: 'ibi' })).toBeNull();
  });
});

describe('etiquetaConcepto', () => {
  it('devuelve la etiqueta del catálogo', () => {
    expect(etiquetaConcepto({ tipoId: 'tributos', subtipoId: 'ibi' })).toBe('IBI');
  });
});

describe('periodicidadPorDefecto', () => {
  it('lo anual es anual, el resto mensual', () => {
    expect(periodicidadPorDefecto({ tipoId: 'tributos', subtipoId: 'ibi' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'tributos', subtipoId: 'tasa_basuras' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'seguros', subtipoId: 'hogar' })).toBe('anual');
    expect(periodicidadPorDefecto({ tipoId: 'comunidad', subtipoId: 'cuota_ordinaria' })).toBe('mensual');
    expect(periodicidadPorDefecto({ tipoId: 'suministros', subtipoId: 'luz' })).toBe('mensual');
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
    const s = construirSkeletonOpex({ tipoId: 'comunidad', subtipoId: 'cuota_ordinaria' }, { ...base, importe: 60 });
    expect(s.ambito).toBe('inmueble');
    expect(s.inmuebleId).toBe(7);
    expect(s.cuentaCargo).toBe(3);
    expect(s.estado).toBe('activo');
    expect(s.importe).toEqual({ modo: 'fijo', importe: 60 });
    expect(s.patron).toEqual({ tipo: 'mensualDiaFijo', dia: 1 });
    expect(s.categoria).toContain('inmueble');
    expect(s.fechaInicio).toBe('2026-08-20');
  });

  it('nace preparado sin importe (no genera previsión)', () => {
    const s = construirSkeletonOpex({ tipoId: 'tributos', subtipoId: 'ibi' }, { ...base, importe: 0 });
    expect(s.estado).toBe('preparado');
    expect(s.importe).toEqual({ modo: 'fijo', importe: 0 });
  });

  // Dedup correcto: el compromiso que nace de un concepto sugerido debe volver a
  // dar la MISMA ref de catálogo (tipoFamilia/subtipo), o `restarYaDados` no lo
  // filtraría y re-sembrar duplicaría. Se comprueba sobre TODOS los precargados.
  it('round-trip: cada precargado vuelve a su propia ref (dedup seguro)', () => {
    const modalidades = [
      catalogoSugeridoPorModalidad('larga_estancia', 'vivienda'),
      catalogoSugeridoPorModalidad('larga_estancia', 'habitacion'),
      catalogoSugeridoPorModalidad('temporada', 'vivienda'),
    ];
    for (const cat of modalidades) {
      for (const ref of cat.precargados) {
        const s = construirSkeletonOpex(ref, { ...base, importe: 10 });
        expect({ tipoId: s.tipoFamilia, subtipoId: s.subtipo }).toEqual(ref);
      }
    }
  });
});
