// ============================================================================
// E2.4.1 · CATÁLOGO ÚNICO DE CLASIFICACIÓN · 4 ejes independientes
// ============================================================================
//
// UN solo catálogo para crear, etiquetar y reclasificar un movimiento. Sustituye
// a los cinco árboles de categoría que convivían (categoryCatalog ·
// CategoriaGastoCompromiso · catalogoConceptos · tiposDeGasto* · GastoCategoria),
// a los dos vocabularios de método de pago y a los dos `MovementType`.
//
// Los cuatro ejes son INDEPENDIENTES · ninguno vive dentro de otro:
//
//   1 · NATURALEZA   ingreso | gasto | movimiento_interno
//   2 · CATEGORÍA    familia (+ subtipo OPCIONAL) · lista PLANA
//   3 · MÉTODO       cómo sale/entra el dinero
//   4 · ÁMBITO       personal | inmueble (+ inmuebleId) · se decide POR MOVIMIENTO
//
// ── Lo que este fichero NO lleva, a propósito ──────────────────────────────
//
// FISCALIDAD FUERA. Ni casilla AEAT ni deducibilidad. Son una lente que se pone
// encima leyendo (familia · contexto · ámbito) y vive en la capa fiscal, no aquí.
// Un catálogo que reordena familias no tiene por qué mover la declaración.
//
// TODO(fiscal · E2.4.1): la capa fiscal engancha aquí. Hasta que exista, un
// gasto de inmueble nace SIN casilla resuelta por el catálogo. Ver
// `docs/VERIFICACION-E2.4.1-preflight-catalogo-unico-2026-09-05.md` §nudos.
//
// ── Ámbito aplicable ───────────────────────────────────────────────────────
//
// `ambitosAplicables` de cada familia es un SUGERIDO para los selectores (no
// ofrecer «supermercado» al clasificar el gasto de un piso), NO una validación:
// el ámbito se decide por movimiento y no agrupa las familias (principio 4).
// `esClasificacionValida` no lo mira.
//
// ── Eventos ────────────────────────────────────────────────────────────────
//
// Nómina, venta, préstamo, dividendo… tienen su familia aquí para que un
// movimiento se pueda RE-etiquetar, pero esos movimientos los pone el evento o
// el módulo que los origina, no un selector. La cuota de un préstamo se
// etiqueta ENTERA como `prestamo_hipoteca`: partirla en interés/capital es cosa
// del cuadro del préstamo, fuera de aquí.
// ============================================================================

// ─── Eje 1 · NATURALEZA ─────────────────────────────────────────────────────

/**
 * `movimiento_interno` es movimiento de caja REAL (mueve el saldo de la cuenta)
 * pero NEUTRO en patrimonio: cuenta para el saldo, NO cuenta en «cuánto gané /
 * cuánto gasté».
 */
export type Naturaleza = 'ingreso' | 'gasto' | 'movimiento_interno';

export const NATURALEZAS: readonly Naturaleza[] = ['ingreso', 'gasto', 'movimiento_interno'];

export const LABEL_NATURALEZA: Readonly<Record<Naturaleza, string>> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  movimiento_interno: 'Movimiento interno',
};

// ─── Eje 3 · MÉTODO DE PAGO ─────────────────────────────────────────────────

/**
 * Cómo sale o entra el dinero · NO qué se pagó (docs/VOCABULARIO-dinero.md §2).
 *
 * Un solo vocabulario: retira `MetodoDePago` (Domiciliado/TPV/…) y
 * `MetodoPagoCompromiso` (domiciliacion/tarjeta/…) y la tabla que los traducía.
 */
export type MetodoPago =
  | 'transferencia'
  | 'bizum'
  | 'domiciliacion'
  | 'tarjeta'
  | 'efectivo'
  | 'cheque'
  | 'cargo_abono_banco';

export const METODOS_PAGO: readonly MetodoPago[] = [
  'transferencia',
  'bizum',
  'domiciliacion',
  'tarjeta',
  'efectivo',
  'cheque',
  'cargo_abono_banco',
];

/** El nombre que ve el usuario · una sola forma en toda la aplicación. */
export const LABEL_METODO: Readonly<Record<MetodoPago, string>> = {
  transferencia: 'Transferencia',
  bizum: 'Bizum',
  domiciliacion: 'Domiciliación',
  tarjeta: 'Tarjeta',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  cargo_abono_banco: 'Cargo / abono del banco',
};

export function esMetodoPago(v: unknown): v is MetodoPago {
  return typeof v === 'string' && (METODOS_PAGO as readonly string[]).includes(v);
}

export function labelMetodo(m: MetodoPago): string {
  return LABEL_METODO[m];
}

// ─── Eje 4 · ÁMBITO ─────────────────────────────────────────────────────────

/** Minúsculas · un solo casing. Retira `'PERSONAL' | 'INMUEBLE'`. */
export type Ambito = 'personal' | 'inmueble';

export const AMBITOS: readonly Ambito[] = ['personal', 'inmueble'];

/** Dónde tiene sentido ofrecer una familia · sugerido para selectores. */
export type AmbitoAplicable = Ambito | 'ambos';

export function esAmbito(v: unknown): v is Ambito {
  return v === 'personal' || v === 'inmueble';
}

// ─── Eje 2 · CATEGORÍA · familia + subtipo opcional ─────────────────────────

export type FamiliaIngresoId =
  | 'nomina'
  | 'pension'
  | 'autonomo'
  | 'alquiler'
  | 'rendimiento'
  | 'venta'
  | 'otros_ingresos';

export type FamiliaGastoId =
  | 'comunidad'
  | 'suministro'
  | 'seguros_alarmas'
  | 'impuestos_tasas'
  | 'reparacion_mantenimiento'
  | 'reforma_mejora'
  | 'alquiler_renting'
  | 'gestion'
  | 'limpieza'
  | 'mobiliario_enseres'
  | 'prestamo_hipoteca'
  | 'supermercado'
  | 'ocio'
  | 'transporte'
  | 'cuidado_personal'
  | 'suscripciones'
  | 'educacion_formacion'
  | 'comisiones_bancarias'
  | 'multas'
  | 'compra_online'
  | 'otros';

export type FamiliaInternaId = 'traspaso' | 'aportacion' | 'disposicion_prestamo' | 'fianza';

export type FamiliaId = FamiliaIngresoId | FamiliaGastoId | FamiliaInternaId;

export interface Subtipo {
  id: string;
  label: string;
}

export interface Familia {
  id: FamiliaId;
  naturaleza: Naturaleza;
  label: string;
  /** Vacío = la familia no tiene segundo nivel. Cuando lo hay, sigue siendo OPCIONAL. */
  subtipos: readonly Subtipo[];
  ambitosAplicables: AmbitoAplicable;
  /** Nota corta para el selector. */
  descripcion?: string;
}

const sub = (id: string, label: string): Subtipo => ({ id, label });

/**
 * EL ÁRBOL · definición exacta de `ATLAS-CATALOGO-clasificacion-DEFINITIVO.md`
 * (Jose · E2.4.1). Lista plana: el orden es el de presentación.
 */
export const FAMILIAS: readonly Familia[] = [
  // ── NATURALEZA = INGRESO · 7 familias ────────────────────────────────────
  { id: 'nomina', naturaleza: 'ingreso', label: 'Nómina', subtipos: [], ambitosAplicables: 'personal' },
  { id: 'pension', naturaleza: 'ingreso', label: 'Pensión', subtipos: [], ambitosAplicables: 'personal' },
  { id: 'autonomo', naturaleza: 'ingreso', label: 'Autónomo', subtipos: [], ambitosAplicables: 'personal' },
  {
    id: 'alquiler',
    naturaleza: 'ingreso',
    label: 'Alquiler',
    subtipos: [],
    ambitosAplicables: 'inmueble',
    descripcion: 'El tipo (larga · corta · habitación · turístico) vive en el CONTRATO',
  },
  {
    id: 'rendimiento',
    naturaleza: 'ingreso',
    label: 'Rendimiento',
    subtipos: [
      sub('interes', 'Interés'),
      sub('dividendo', 'Dividendo'),
      sub('rendimiento_inversion', 'Rendimiento de inversión'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'venta',
    naturaleza: 'ingreso',
    label: 'Venta',
    // Subtipo = tipos de activo de `inversiones` + inmueble.
    subtipos: [
      sub('inmueble', 'Inmueble'),
      sub('acciones', 'Acciones'),
      sub('fondos', 'Fondos'),
      sub('criptomonedas', 'Criptomonedas'),
    ],
    ambitosAplicables: 'ambos',
  },
  { id: 'otros_ingresos', naturaleza: 'ingreso', label: 'Otros ingresos', subtipos: [], ambitosAplicables: 'ambos' },

  // ── NATURALEZA = GASTO · 21 familias · lista plana ────────────────────────
  {
    id: 'comunidad',
    naturaleza: 'gasto',
    label: 'Comunidad',
    subtipos: [sub('cuota_mensual', 'Cuota mensual'), sub('derrama', 'Derrama'), sub('otros', 'Otros')],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'suministro',
    naturaleza: 'gasto',
    label: 'Suministro',
    subtipos: [
      sub('luz', 'Luz'),
      sub('agua', 'Agua'),
      sub('gas', 'Gas'),
      sub('internet', 'Internet'),
      sub('telefonia', 'Telefonía'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'seguros_alarmas',
    naturaleza: 'gasto',
    label: 'Seguros y alarmas',
    subtipos: [
      sub('hogar', 'Hogar'),
      sub('vida', 'Vida'),
      sub('decesos', 'Decesos'),
      sub('vehiculo', 'Vehículo'),
      sub('salud', 'Salud'),
      sub('impago', 'Impago'),
      sub('alarma', 'Alarma'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'impuestos_tasas',
    naturaleza: 'gasto',
    label: 'Impuestos y tasas',
    subtipos: [
      sub('ibi', 'IBI'),
      sub('basuras', 'Basuras'),
      sub('circulacion', 'Circulación'),
      sub('licencia_turistica', 'Licencia turística'),
      sub('otros_tributos', 'Otros tributos'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'reparacion_mantenimiento',
    naturaleza: 'gasto',
    label: 'Reparación y mantenimiento',
    subtipos: [
      sub('caldera', 'Caldera'),
      sub('electrodomesticos', 'Electrodomésticos'),
      sub('vehiculo', 'Vehículo'),
      sub('itv', 'ITV'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'reforma_mejora',
    naturaleza: 'gasto',
    label: 'Reforma y mejora',
    subtipos: [],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'alquiler_renting',
    naturaleza: 'gasto',
    label: 'Alquiler y renting',
    subtipos: [sub('vivienda', 'Vivienda'), sub('vehiculo', 'Vehículo')],
    ambitosAplicables: 'personal',
  },
  {
    id: 'gestion',
    naturaleza: 'gasto',
    label: 'Gestión',
    subtipos: [
      sub('gestoria', 'Gestoría'),
      sub('asesoria', 'Asesoría'),
      sub('abogado', 'Abogado'),
      sub('comision_plataformas', 'Comisión de plataformas'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'limpieza',
    naturaleza: 'gasto',
    label: 'Limpieza',
    subtipos: [
      sub('zonas_comunes', 'Zonas comunes'),
      sub('integral', 'Integral'),
      sub('por_estancia', 'Por estancia'),
      sub('lavanderia', 'Lavandería'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'mobiliario_enseres',
    naturaleza: 'gasto',
    label: 'Mobiliario y enseres',
    subtipos: [
      sub('muebles', 'Muebles'),
      sub('ropa_cama_enseres', 'Ropa de cama y enseres'),
      sub('electrodomesticos', 'Electrodomésticos'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'prestamo_hipoteca',
    naturaleza: 'gasto',
    label: 'Préstamo / hipoteca',
    subtipos: [],
    ambitosAplicables: 'ambos',
    descripcion: 'El cargo ENTERO · interés y capital los da el cuadro del préstamo',
  },
  { id: 'supermercado', naturaleza: 'gasto', label: 'Supermercado', subtipos: [], ambitosAplicables: 'personal' },
  {
    id: 'ocio',
    naturaleza: 'gasto',
    label: 'Ocio',
    subtipos: [
      sub('viajes', 'Viajes'),
      sub('restaurante', 'Restaurante'),
      sub('cine_planes', 'Cine y planes'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'personal',
  },
  {
    id: 'transporte',
    naturaleza: 'gasto',
    label: 'Transporte',
    subtipos: [
      sub('combustible', 'Combustible'),
      sub('parking', 'Parking'),
      sub('peajes', 'Peajes'),
      sub('transporte_publico', 'Transporte público'),
      sub('taxi_vtc', 'Taxi / VTC'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'personal',
  },
  {
    id: 'cuidado_personal',
    naturaleza: 'gasto',
    label: 'Cuidado personal',
    subtipos: [
      sub('ropa', 'Ropa'),
      sub('calzado', 'Calzado'),
      sub('peluqueria', 'Peluquería'),
      sub('farmacia', 'Farmacia'),
      sub('medico', 'Médico'),
    ],
    ambitosAplicables: 'personal',
  },
  {
    id: 'suscripciones',
    naturaleza: 'gasto',
    label: 'Suscripciones',
    subtipos: [
      sub('streaming', 'Streaming'),
      sub('musica', 'Música'),
      sub('software', 'Software'),
      sub('cloud', 'Cloud'),
      sub('prensa', 'Prensa'),
      sub('gimnasio', 'Gimnasio'),
      sub('ong', 'ONG'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'personal',
  },
  {
    id: 'educacion_formacion',
    naturaleza: 'gasto',
    label: 'Educación y formación',
    subtipos: [
      sub('colegio', 'Colegio'),
      sub('universidad', 'Universidad'),
      sub('cursos', 'Cursos'),
      sub('formacion_profesional', 'Formación profesional'),
      sub('otros', 'Otros'),
    ],
    ambitosAplicables: 'personal',
  },
  {
    id: 'comisiones_bancarias',
    naturaleza: 'gasto',
    label: 'Comisiones bancarias',
    subtipos: [sub('mantenimiento', 'Mantenimiento'), sub('transferencia', 'Transferencia'), sub('otros', 'Otros')],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'multas',
    naturaleza: 'gasto',
    label: 'Multas',
    subtipos: [sub('trafico', 'Tráfico'), sub('otras', 'Otras')],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'compra_online',
    naturaleza: 'gasto',
    label: 'Compra online',
    subtipos: [],
    ambitosAplicables: 'personal',
    descripcion: 'Bazares opacos · Amazon · Shein · AliExpress',
  },
  { id: 'otros', naturaleza: 'gasto', label: 'Otros', subtipos: [], ambitosAplicables: 'ambos', descripcion: 'Cajón' },

  // ── NATURALEZA = MOVIMIENTO INTERNO · 4 familias ──────────────────────────
  {
    id: 'traspaso',
    naturaleza: 'movimiento_interno',
    label: 'Traspaso',
    subtipos: [
      sub('a_otra_cuenta', 'A otra cuenta'),
      sub('a_tarjeta', 'A tarjeta'),
      sub('a_efectivo', 'A efectivo'),
      sub('a_ahorro', 'A ahorro'),
    ],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'aportacion',
    naturaleza: 'movimiento_interno',
    label: 'Aportación',
    subtipos: [sub('plan_pensiones', 'Plan de pensiones'), sub('inversion', 'Inversión'), sub('fondo', 'Fondo')],
    ambitosAplicables: 'personal',
  },
  {
    id: 'disposicion_prestamo',
    naturaleza: 'movimiento_interno',
    label: 'Disposición de préstamo',
    subtipos: [],
    ambitosAplicables: 'ambos',
  },
  {
    id: 'fianza',
    naturaleza: 'movimiento_interno',
    label: 'Fianza',
    subtipos: [sub('entra', 'Entra'), sub('custodia', 'Custodia'), sub('devuelve', 'Devuelve')],
    ambitosAplicables: 'inmueble',
  },
];

const POR_ID: ReadonlyMap<FamiliaId, Familia> = new Map(FAMILIAS.map((f) => [f.id, f]));

// ─── Consulta ───────────────────────────────────────────────────────────────

export function familiaPorId(id: string | null | undefined): Familia | undefined {
  return id ? POR_ID.get(id as FamiliaId) : undefined;
}

export function esFamiliaId(v: unknown): v is FamiliaId {
  return typeof v === 'string' && POR_ID.has(v as FamiliaId);
}

/** Las familias de una naturaleza, en orden de presentación. */
export function familiasDe(naturaleza: Naturaleza): Familia[] {
  return FAMILIAS.filter((f) => f.naturaleza === naturaleza);
}

/**
 * Las familias que tiene sentido OFRECER en un ámbito · filtro de selector.
 * Es un sugerido: una clasificación fuera de aquí sigue siendo válida.
 */
export function familiasSugeridas(naturaleza: Naturaleza, ambito: Ambito): Familia[] {
  return familiasDe(naturaleza).filter(
    (f) => f.ambitosAplicables === 'ambos' || f.ambitosAplicables === ambito,
  );
}

export function subtiposDe(familia: FamiliaId): readonly Subtipo[] {
  return POR_ID.get(familia)?.subtipos ?? [];
}

export function naturalezaDe(familia: FamiliaId): Naturaleza | undefined {
  return POR_ID.get(familia)?.naturaleza;
}

export function labelFamilia(familia: FamiliaId): string {
  return POR_ID.get(familia)?.label ?? familia;
}

export function labelSubtipo(familia: FamiliaId, subtipo: string | null | undefined): string | undefined {
  if (!subtipo) return undefined;
  return subtiposDe(familia).find((s) => s.id === subtipo)?.label;
}

/** «Suministro · Luz» · lo que enseña una fila. */
export function labelClasificacion(familia: FamiliaId, subtipo?: string | null): string {
  const s = labelSubtipo(familia, subtipo);
  return s ? `${labelFamilia(familia)} · ${s}` : labelFamilia(familia);
}

// ─── La clasificación de un movimiento · los 4 ejes juntos ──────────────────

/**
 * Lo que un movimiento lleva encima. `familia`/`subtipo` pueden faltar (sin
 * clasificar): la naturaleza y el ámbito no. `metodoPago` falta cuando no se
 * sabe (una línea del extracto que el importador no reconoce).
 */
export interface Clasificacion {
  naturaleza: Naturaleza;
  familia?: FamiliaId;
  subtipo?: string;
  metodoPago?: MetodoPago;
  ambito: Ambito;
  inmuebleId?: number;
}

export type MotivoInvalida =
  | 'naturaleza_desconocida'
  | 'familia_desconocida'
  | 'familia_de_otra_naturaleza'
  | 'subtipo_sin_familia'
  | 'subtipo_desconocido'
  | 'metodo_desconocido'
  | 'ambito_desconocido'
  | 'inmueble_sin_ambito_inmueble'
  | 'ambito_inmueble_sin_inmueble';

/**
 * Coherencia entre ejes · lo ÚNICO que se exige:
 *   - la familia pertenece a la naturaleza dicha
 *   - el subtipo, si viene, es de esa familia
 *   - ámbito `inmueble` ⇔ `inmuebleId`
 *
 * NO mira `ambitosAplicables` (es sugerido · principio 4).
 */
export function motivosInvalidos(c: Clasificacion): MotivoInvalida[] {
  const out: MotivoInvalida[] = [];
  if (!NATURALEZAS.includes(c.naturaleza)) out.push('naturaleza_desconocida');
  if (!esAmbito(c.ambito)) out.push('ambito_desconocido');
  if (c.metodoPago !== undefined && !esMetodoPago(c.metodoPago)) out.push('metodo_desconocido');

  if (c.familia !== undefined) {
    const f = familiaPorId(c.familia);
    if (!f) out.push('familia_desconocida');
    else {
      if (f.naturaleza !== c.naturaleza) out.push('familia_de_otra_naturaleza');
      if (c.subtipo !== undefined && !f.subtipos.some((s) => s.id === c.subtipo)) out.push('subtipo_desconocido');
    }
  } else if (c.subtipo !== undefined) {
    out.push('subtipo_sin_familia');
  }

  if (c.ambito === 'inmueble' && c.inmuebleId == null) out.push('ambito_inmueble_sin_inmueble');
  if (c.ambito === 'personal' && c.inmuebleId != null) out.push('inmueble_sin_ambito_inmueble');
  return out;
}

export function esClasificacionValida(c: Clasificacion): boolean {
  return motivosInvalidos(c).length === 0;
}

/**
 * Re-etiquetar: cambia familia/subtipo y, si la familia es de otra naturaleza,
 * la naturaleza la sigue. Devuelve una clasificación nueva, no muta.
 */
export function reclasificar(
  c: Clasificacion,
  cambio: { familia?: FamiliaId; subtipo?: string | null },
): Clasificacion {
  const familia = cambio.familia ?? c.familia;
  const naturaleza = familia ? (naturalezaDe(familia) ?? c.naturaleza) : c.naturaleza;
  const subtipo =
    cambio.subtipo === null ? undefined : (cambio.subtipo ?? (cambio.familia && cambio.familia !== c.familia ? undefined : c.subtipo));
  return { ...c, naturaleza, familia, subtipo };
}

/** Lo que NO cuenta en «cuánto gané / cuánto gasté» · pero SÍ en el saldo. */
export function esMovimientoInterno(c: Pick<Clasificacion, 'naturaleza'>): boolean {
  return c.naturaleza === 'movimiento_interno';
}

/**
 * Naturaleza que le toca a un importe cuando nadie ha dicho otra cosa · el
 * signo manda. Un traspaso o una fianza no salen de aquí: los pone quien sabe
 * que lo son.
 */
export function naturalezaPorSigno(importe: number): Exclude<Naturaleza, 'movimiento_interno'> {
  return importe >= 0 ? 'ingreso' : 'gasto';
}
