// ============================================================================
// El catálogo OPEX de un inmueble se calcula UNA sola vez · FASE 2 #4
// ============================================================================
//
// Había dos caminos que respondían a la misma pregunta —«¿qué gastos le
// sugiero a este inmueble?»— y no coincidían:
//
//   · la ficha del inmueble leía la MODALIDAD DEL CONTRATO → 16 conceptos
//   · el modal de siembra leía el MODO DE EXPLOTACIÓN      →  7 conceptos
//
// El modo había perdido el subtipo por el camino (`explotacionDesdeLegacy`
// solo mira `corta_estancia`, así que una media estancia cae a `completo`), y
// con él se iban diez gastos deducibles, cinco de ellos sin aparecer siquiera
// en la lista de disponibles.
//
// Estos tests fijan que los dos caminos son el mismo camino.
// ============================================================================

import {
  catalogoDelInmueble,
  contratoVigenteEn,
  formaDeUnidad,
  subtipoDelInmueble,
  catalogoSugeridoPorModalidad,
  type ContratoParaCatalogo,
} from '../../wizards/utils/catalogoModalidadInmueble';

const HOY = new Date('2026-08-26T00:00:00Z');

const contrato = (over: Partial<ContratoParaCatalogo> = {}): ContratoParaCatalogo => ({
  modalidad: 'larga_estancia',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  ...over,
});

const claves = (refs: Array<{ tipoId: string; subtipoId: string }>): string[] =>
  refs.map((r) => `${r.tipoId}:${r.subtipoId}`);

// ─── contratoVigenteEn ───────────────────────────────────────────────────────

describe('contratoVigenteEn', () => {
  it('dentro de sus fechas está vigente · los dos extremos incluidos', () => {
    expect(contratoVigenteEn(contrato({ fechaInicio: '2026-08-26', fechaFin: '2026-08-26' }), HOY)).toBe(true);
    expect(contratoVigenteEn(contrato({ fechaInicio: '2026-01-01', fechaFin: '2026-08-26' }), HOY)).toBe(true);
    expect(contratoVigenteEn(contrato({ fechaInicio: '2026-08-26', fechaFin: '2026-12-31' }), HOY)).toBe(true);
  });

  it('fuera de sus fechas no lo está', () => {
    expect(contratoVigenteEn(contrato({ fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }), HOY)).toBe(false);
    expect(contratoVigenteEn(contrato({ fechaInicio: '2027-01-01', fechaFin: '2027-12-31' }), HOY)).toBe(false);
  });

  it('sin fechas o con fechas ilegibles, no', () => {
    expect(contratoVigenteEn(contrato({ fechaInicio: undefined }), HOY)).toBe(false);
    expect(contratoVigenteEn(contrato({ fechaFin: undefined }), HOY)).toBe(false);
    expect(contratoVigenteEn(contrato({ fechaInicio: 'ayer' }), HOY)).toBe(false);
  });
});

// ─── subtipoDelInmueble ──────────────────────────────────────────────────────

describe('subtipoDelInmueble', () => {
  it('manda el contrato vigente', () => {
    const contratos = [
      contrato({ modalidad: 'larga_estancia', fechaInicio: '2020-01-01', fechaFin: '2021-12-31' }),
      contrato({ modalidad: 'media_estancia' }),
    ];
    expect(subtipoDelInmueble(contratos, HOY)).toBe('media_estancia');
  });

  it('sin vigente, el primero que haya · un inmueble entre inquilinos conserva su tipo', () => {
    const contratos = [
      contrato({ modalidad: 'corta_estancia', fechaInicio: '2025-01-01', fechaFin: '2025-06-30' }),
    ];
    expect(subtipoDelInmueble(contratos, HOY)).toBe('corta_estancia');
  });

  // Un contrato vigente SIN modalidad deja el subtipo en undefined aunque haya
  // otro anterior que sí la lleve. No es un descuido de este helper: es lo que
  // hace hoy la ficha del inmueble, y el objetivo de esta tarea es que los dos
  // caminos coincidan, no cambiar lo que ya decidía el que estaba bien. Que un
  // contrato pueda guardarse sin modalidad es otra conversación.
  it('un vigente sin modalidad deja el subtipo en blanco · como en la ficha', () => {
    const contratos = [
      contrato({ modalidad: undefined }),
      contrato({ modalidad: 'corta_estancia', fechaInicio: '2024-01-01', fechaFin: '2024-12-31' }),
    ];
    expect(subtipoDelInmueble(contratos, HOY)).toBeUndefined();
  });

  it('sin contratos, no hay subtipo que leer', () => {
    expect(subtipoDelInmueble([], HOY)).toBeUndefined();
  });
});

// ─── formaDeUnidad ───────────────────────────────────────────────────────────

describe('formaDeUnidad · los dos vocabularios de forma dicen lo mismo', () => {
  it('el de la explotación', () => {
    expect(formaDeUnidad('habitaciones')).toBe('habitacion');
    expect(formaDeUnidad('completo')).toBe('vivienda');
    expect(formaDeUnidad('turistico')).toBe('vivienda');
  });

  it('el legacy de Property', () => {
    expect(formaDeUnidad('por_habitaciones')).toBe('habitacion');
    expect(formaDeUnidad('piso_completo')).toBe('vivienda');
  });

  it('sin dato, vivienda', () => {
    expect(formaDeUnidad(undefined)).toBe('vivienda');
  });
});

// ─── el catálogo, que es lo que importa ──────────────────────────────────────

describe('catalogoDelInmueble · el subtipo sale del contrato, no del modo', () => {
  it('MEDIA estancia recupera sus 16 conceptos · el modo decía «completo» y eran 7', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'media_estancia' })], 'completo', HOY);
    expect(cat.precargados).toHaveLength(16);
  });

  it('CORTA estancia, igual', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'corta_estancia' })], 'completo', HOY);
    expect(cat.precargados).toHaveLength(16);
  });

  it('los cinco que no aparecían ni entre los disponibles vuelven a estar', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'media_estancia' })], 'completo', HOY);
    const dentro = claves(cat.precargados);
    expect(dentro).toEqual(
      expect.arrayContaining([
        'servicios:limpieza_por_estancia',
        'servicios:lavanderia',
        'gestion:comision_plataformas',
        'servicios:consumibles_bienvenida',
        'tributos:licencia_turistica',
      ]),
    );
  });

  it('y el seguro de impago deja de sugerirse donde no hay impago posible', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'media_estancia' })], 'completo', HOY);
    expect(claves(cat.precargados)).not.toContain('seguros:impago');
  });

  it('la LARGA estancia no cambia · 7 en vivienda completa', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'larga_estancia' })], 'completo', HOY);
    expect(cat.precargados).toHaveLength(7);
    expect(claves(cat.precargados)).toContain('seguros:impago');
  });

  it('la LARGA por habitaciones tampoco · 13', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'larga_estancia' })], 'habitaciones', HOY);
    expect(cat.precargados).toHaveLength(13);
  });

  it('sin contratos todavía, el modo sigue siendo la única pista', () => {
    expect(catalogoDelInmueble([], 'completo', HOY).precargados).toHaveLength(7);
    expect(catalogoDelInmueble([], 'habitaciones', HOY).precargados).toHaveLength(13);
    expect(catalogoDelInmueble([], 'turistico', HOY).precargados).toHaveLength(16);
  });

  it('el contrato manda sobre el modo cuando discrepan · el modo no sabe de subtipos', () => {
    // Un inmueble marcado «turístico» cuyo contrato vivo es de larga estancia:
    // el papel que decide es el contrato.
    const cat = catalogoDelInmueble([contrato({ modalidad: 'larga_estancia' })], 'turistico', HOY);
    expect(cat.precargados).toHaveLength(7);
  });
});

// ─── la razón de ser: un solo camino ────────────────────────────────────────

describe('los dos caminos dan el mismo catálogo', () => {
  // La ficha del inmueble (DetallePage) y el modal de siembra preguntan lo
  // mismo con los datos que cada uno tiene a mano. Antes divergían para
  // media/corta estancia; ahora los dos pasan por `catalogoDelInmueble`.
  const casos: Array<{
    nombre: string;
    modalidad: 'larga_estancia' | 'media_estancia' | 'corta_estancia';
    modoExplotacion: 'piso_completo' | 'por_habitaciones';
    modoExplotacionAlquiler: 'completo' | 'habitaciones' | 'turistico';
  }> = [
    { nombre: 'larga · piso completo', modalidad: 'larga_estancia', modoExplotacion: 'piso_completo', modoExplotacionAlquiler: 'completo' },
    { nombre: 'larga · por habitaciones', modalidad: 'larga_estancia', modoExplotacion: 'por_habitaciones', modoExplotacionAlquiler: 'habitaciones' },
    { nombre: 'media · piso completo', modalidad: 'media_estancia', modoExplotacion: 'piso_completo', modoExplotacionAlquiler: 'completo' },
    { nombre: 'corta · piso completo', modalidad: 'corta_estancia', modoExplotacion: 'piso_completo', modoExplotacionAlquiler: 'turistico' },
  ];

  it.each(casos)('$nombre', ({ modalidad, modoExplotacion, modoExplotacionAlquiler }) => {
    const contratos = [contrato({ modalidad })];

    // Vía ficha del inmueble · lee el legacy `Property.modoExplotacion`.
    const porLaFicha = catalogoDelInmueble(contratos, modoExplotacion, HOY);

    // Vía siembra · lee `ExplotacionAlquiler.modo`.
    const porLaSiembra = catalogoDelInmueble(contratos, modoExplotacionAlquiler, HOY);

    expect(claves(porLaSiembra.precargados)).toEqual(claves(porLaFicha.precargados));
  });

  it('y coinciden con lo que devuelve el catálogo llamado a pelo', () => {
    const cat = catalogoDelInmueble([contrato({ modalidad: 'media_estancia' })], 'completo', HOY);
    expect(claves(cat.precargados)).toEqual(
      claves(catalogoSugeridoPorModalidad('media_estancia', 'vivienda').precargados),
    );
  });
});
