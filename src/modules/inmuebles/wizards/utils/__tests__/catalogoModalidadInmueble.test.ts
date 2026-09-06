// §3.3 · mapa modalidad → catálogo. Fija las tres listas, el "vivienda completa
// SIN suministros" (criterio 1) y que TODA ref apunte a una entrada real del
// catálogo (un typo de subtipoId rompería la sugerencia en silencio).

import {
  catalogoSugeridoPorModalidad,
  catalogoKindDeModalidad,
  restarYaDados,
  refExisteEnCatalogo,
  type ConceptoInmuebleRef,
} from '../catalogoModalidadInmueble';

const has = (list: ConceptoInmuebleRef[], tipoId: string, subtipoId: string): boolean =>
  list.some((r) => r.tipoId === tipoId && r.subtipoId === subtipoId);

describe('catalogoKindDeModalidad · precedencia', () => {
  it('temporada/turístico mandan sobre unidadTipo', () => {
    expect(catalogoKindDeModalidad('media_estancia', 'vivienda')).toBe('turistico');
    expect(catalogoKindDeModalidad('corta_estancia', 'habitacion')).toBe('turistico');
  });
  it('habitacion → habitaciones · vivienda habitual → vivienda completa', () => {
    expect(catalogoKindDeModalidad('larga_estancia', 'habitacion')).toBe('habitaciones');
    expect(catalogoKindDeModalidad('larga_estancia', 'vivienda')).toBe('viviendaCompleta');
    expect(catalogoKindDeModalidad(undefined, undefined)).toBe('viviendaCompleta');
  });
});

describe('§3.3 · vivienda completa · precarga 7 SIN suministros', () => {
  const cat = catalogoSugeridoPorModalidad('larga_estancia', 'vivienda');
  it('precarga exactamente 7 conceptos', () => {
    expect(cat.precargados).toHaveLength(7);
  });
  it('los suministros NO se precargan (los paga el inquilino)', () => {
    for (const s of ['luz', 'agua', 'gas', 'internet']) {
      expect(has(cat.precargados, 'suministro', s)).toBe(false);
      expect(has(cat.disponibles, 'suministro', s)).toBe(true);
    }
  });
  it('precarga comunidad, IBI, basuras, seguro hogar, seguro impago, derramas, gestión', () => {
    expect(has(cat.precargados, 'comunidad', 'cuota_mensual')).toBe(true);
    expect(has(cat.precargados, 'impuestos_tasas', 'ibi')).toBe(true);
    expect(has(cat.precargados, 'impuestos_tasas', 'basuras')).toBe(true);
    expect(has(cat.precargados, 'seguros_alarmas', 'hogar')).toBe(true);
    expect(has(cat.precargados, 'seguros_alarmas', 'impago')).toBe(true);
    expect(has(cat.precargados, 'comunidad', 'derrama')).toBe(true);
    expect(has(cat.precargados, 'gestion', 'otros')).toBe(true);
  });
});

describe('§3.3 · habitaciones · precarga 13', () => {
  const cat = catalogoSugeridoPorModalidad('larga_estancia', 'habitacion');
  it('precarga exactamente 13 conceptos', () => {
    expect(cat.precargados).toHaveLength(13);
  });
  it('incluye suministros y limpieza de zonas comunes', () => {
    for (const s of ['luz', 'agua', 'gas', 'internet']) {
      expect(has(cat.precargados, 'suministro', s)).toBe(true);
    }
    expect(has(cat.precargados, 'limpieza', 'zonas_comunes')).toBe(true);
  });
});

describe('§3.3 · temporada/turístico · precarga 15', () => {
  // Eran 16 con el catálogo viejo: los «consumibles de bienvenida» no tienen
  // familia propia en el catálogo único y caen en gestión · otros, que ya está.
  const cat = catalogoSugeridoPorModalidad('temporada', 'vivienda');
  it('precarga exactamente 15 conceptos', () => {
    expect(cat.precargados).toHaveLength(15);
  });
  it('incluye los 4 propios de turístico', () => {
    expect(has(cat.precargados, 'limpieza', 'por_estancia')).toBe(true);
    expect(has(cat.precargados, 'limpieza', 'lavanderia')).toBe(true);
    expect(has(cat.precargados, 'gestion', 'comision_plataformas')).toBe(true);
    expect(has(cat.precargados, 'impuestos_tasas', 'licencia_turistica')).toBe(true);
  });
  it('mantiene gestión del alquiler (turístico gestionado por empresa es normal)', () => {
    expect(has(cat.precargados, 'gestion', 'otros')).toBe(true);
  });
  it('excluye impago y limpieza de zonas comunes (2 de larga duración)', () => {
    expect(has(cat.precargados, 'seguros_alarmas', 'impago')).toBe(false);
    expect(has(cat.precargados, 'limpieza', 'zonas_comunes')).toBe(false);
  });
});

describe('integridad · toda ref del mapa existe en el catálogo', () => {
  it('ninguna sugerencia apunta a un subtipo inexistente', () => {
    const kinds: Array<['larga_estancia' | 'media_estancia' | 'corta_estancia', 'vivienda' | 'habitacion']> = [
      ['larga_estancia', 'vivienda'],
      ['larga_estancia', 'habitacion'],
      ['media_estancia', 'vivienda'],
      ['corta_estancia', 'habitacion'],
    ];
    for (const [modalidad, unidad] of kinds) {
      const cat = catalogoSugeridoPorModalidad(modalidad, unidad);
      for (const ref of [...cat.precargados, ...cat.disponibles]) {
        expect(refExisteEnCatalogo(ref)).toBe(true);
      }
    }
  });
});

describe('restarYaDados · el catálogo ofrece solo lo que aún no está', () => {
  it('quita los conceptos ya dados de alta', () => {
    const cat = catalogoSugeridoPorModalidad('larga_estancia', 'vivienda');
    const yaDados: ConceptoInmuebleRef[] = [{ tipoId: 'impuestos_tasas', subtipoId: 'ibi' }];
    const restantes = restarYaDados(cat.precargados, yaDados);
    expect(has(restantes, 'impuestos_tasas', 'ibi')).toBe(false);
    expect(restantes).toHaveLength(cat.precargados.length - 1);
  });
});
