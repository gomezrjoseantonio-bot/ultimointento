// Ficha de inmueble · MODELO del formulario y mappers Property <-> modelo.
//
// El modelo es la forma que edita la UI; los mappers lo traducen a/desde el
// `Property` de la DB SIN PÉRDIDA. Aquí se corrigen tres defectos de la ficha
// vieja (informe de reescritura):
//   · "otros gastos" ya no aplasta N conceptos en uno: se preserva el desglose
//     original mientras no se edite el agregado.
//   · `añoConstrucción` y `díasArrendado` desaparecen: eran campos que se
//     enseñaban pero no se guardaban (nadie los leía / el modelo no los tiene).
//   · la financiación deja de ser dato huérfano: el modelo lleva la FK al
//     préstamo y quién manda cuando hay uno vinculado (ver `financiacion.ts`).

import type { Property, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { TipoActivo } from '../../../types/tipoActivo';
import { getCCAAFromProvince } from '../../../utils/locationUtils';

export type UsoTipo = NonNullable<Property['usoTipo']>;
export type Titularidad = 'yo' | 'pareja' | 'ambos';
export type EstadoCompra = 'usada' | 'obra-nueva';

export interface MejoraDraft {
  id?: number;
  concepto: string;
  fecha: string;
  importe: number;
  tipo: 'mejora' | 'reparacion';
  _deleted?: boolean;
}

export interface MuebleDraft {
  id?: number;
  concepto: string;
  fechaAlta: string;
  importe: number;
  _deleted?: boolean;
}

/** Un concepto de "otros gastos" de adquisición (se preserva el desglose). */
export interface OtroGasto {
  concept: string;
  amount: number;
}

export interface InmuebleFormModel {
  // 1 · tipo
  tipoActivo: TipoActivo;
  // 2 · identificación
  alias: string;
  direccion: string;
  refCatastral: string;
  // 3 · ubicación
  cp: string;
  municipality: string;
  province: string;
  ccaa: string;
  ccaaIsManual: boolean;
  // 4 · compra y coste
  fechaCompra: string;
  precioCompra: number;
  valorReferencia: number;
  valorReferenciaIsManual: boolean;
  estado: EstadoCompra;
  notaria: number;
  registro: number;
  gestoria: number;
  otros: number;
  impuestos: number;
  // 4b · estructura de compra (financiación)
  aportacionPropia: number;
  importeFinanciado: number;
  // 5 · características físicas
  m2: number;
  habitaciones: number;
  banos: number;
  esUrbana: boolean;
  certificadoEnergetico: string;
  porcentajePropiedad: number;
  titularidad: Titularidad;
  porcentajePropiedadPareja: number;
  tieneParking: boolean;
  tieneTrastero: boolean;
  // 6 · datos fiscales
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
  cadastralRevised: boolean;
  // 7 · uso
  usoTipo: UsoTipo;
  alquilerHabActivo: boolean;
  alquilerHabNum: number;
  // 8-10 · colecciones y foto
  mejorasOn: boolean;
  mejoras: MejoraDraft[];
  mueblesOn: boolean;
  muebles: MuebleDraft[];
  fotoOn: boolean;
  foto?: string;
}

/**
 * Datos que el formulario NO edita pero tiene que conservar al guardar, para no
 * pisar lo que la ficha no gestiona (documentos), no perder el desglose de
 * otros gastos, ni romper el vínculo con el préstamo.
 */
export interface InmuebleFormMeta {
  documents: number[];
  prestamoVinculadoId?: string;
  otrosOriginal: OtroGasto[];
  purchaseDateOriginal: string;
}

export function emptyModel(fallbackCCAA = ''): InmuebleFormModel {
  return {
    tipoActivo: 'piso',
    alias: '',
    direccion: '',
    refCatastral: '',
    cp: '',
    municipality: '',
    province: '',
    ccaa: fallbackCCAA,
    ccaaIsManual: false,
    fechaCompra: '',
    precioCompra: 0,
    valorReferencia: 0,
    valorReferenciaIsManual: false,
    estado: 'usada',
    notaria: 0,
    registro: 0,
    gestoria: 0,
    otros: 0,
    impuestos: 0,
    aportacionPropia: 0,
    importeFinanciado: 0,
    m2: 0,
    habitaciones: 0,
    banos: 0,
    esUrbana: true,
    certificadoEnergetico: '',
    porcentajePropiedad: 100,
    titularidad: 'yo',
    porcentajePropiedadPareja: 0,
    tieneParking: false,
    tieneTrastero: false,
    valorCatastralTotal: 0,
    valorCatastralConstruccion: 0,
    cadastralRevised: false,
    usoTipo: 'larga_estancia',
    alquilerHabActivo: false,
    alquilerHabNum: 0,
    mejorasOn: false,
    mejoras: [],
    mueblesOn: false,
    muebles: [],
    fotoOn: false,
    foto: undefined,
  };
}

export function emptyMeta(): InmuebleFormMeta {
  return { documents: [], prestamoVinculadoId: undefined, otrosOriginal: [], purchaseDateOriginal: '' };
}

// ── Visibilidad por tipo de activo (pura · la usan la UI y el mapper) ────────
export interface Visibilidad {
  isPiso: boolean;
  showHabitacionesBanos: boolean;
  showAnexos: boolean;
  showUso: boolean;
  showAlquilerHab: boolean;
}

export function visibilidad(m: Pick<InmuebleFormModel, 'tipoActivo' | 'usoTipo'>): Visibilidad {
  const isPiso = m.tipoActivo === 'piso';
  const isParkingOrTrastero = m.tipoActivo === 'parking' || m.tipoActivo === 'trastero';
  return {
    isPiso,
    showHabitacionesBanos: isPiso,
    showAnexos: isPiso,
    showUso: !isParkingOrTrastero,
    showAlquilerHab:
      isPiso &&
      (m.usoTipo === 'larga_estancia' ||
        m.usoTipo === 'temporada' ||
        m.usoTipo === 'turistico' ||
        m.usoTipo === 'mixto'),
  };
}

const sumOtros = (items: OtroGasto[]): number =>
  items.reduce((s, o) => s + (o.amount || 0), 0);

// ── DB → modelo ──────────────────────────────────────────────────────────────
export function modelFromProperty(
  prop: Property,
  mejorasDB: MejoraInmueble[],
  mueblesDB: MuebleInmueble[],
  fallbackCCAA: string,
): { model: InmuebleFormModel; meta: InmuebleFormMeta } {
  const otrosOriginal: OtroGasto[] = Array.isArray(prop.acquisitionCosts.other)
    ? prop.acquisitionCosts.other.map((o) => ({ concept: o.concept, amount: o.amount || 0 }))
    : [];
  const impuestos = prop.acquisitionCosts.itp ?? prop.acquisitionCosts.iva ?? 0;

  const ccaaResolved = prop.ccaa || fallbackCCAA;
  const inferredCCAA = prop.province ? getCCAAFromProvince(prop.province) ?? '' : '';
  const ccaaIsManual = ccaaResolved !== '' && ccaaResolved !== inferredCCAA;

  const precio = prop.acquisitionCosts.price || 0;
  const vRef = prop.valorReferencia ?? precio;
  const valorRefIsManual =
    typeof prop.valorReferencia === 'number' && Math.abs(vRef - precio) > 0.01;

  const model: InmuebleFormModel = {
    tipoActivo: prop.tipoActivo ?? 'piso',
    alias: prop.alias || '',
    direccion: prop.address || '',
    refCatastral: prop.cadastralReference || '',
    cp: prop.postalCode || '',
    municipality: prop.municipality || '',
    province: prop.province || '',
    ccaa: ccaaResolved,
    ccaaIsManual,
    fechaCompra: prop.purchaseDate || '',
    precioCompra: precio,
    valorReferencia: vRef,
    valorReferenciaIsManual: valorRefIsManual,
    estado: prop.transmissionRegime === 'obra-nueva' ? 'obra-nueva' : 'usada',
    notaria: prop.acquisitionCosts.notary || 0,
    registro: prop.acquisitionCosts.registry || 0,
    gestoria: prop.acquisitionCosts.management || 0,
    otros: sumOtros(otrosOriginal),
    impuestos,
    aportacionPropia: prop.estructuraCompra?.aportacionPropia || 0,
    importeFinanciado: prop.estructuraCompra?.importeFinanciado || 0,
    m2: prop.squareMeters || 0,
    habitaciones: prop.bedrooms || 0,
    banos: prop.bathrooms || 0,
    esUrbana: prop.esUrbana ?? true,
    certificadoEnergetico: prop.certificadoEnergetico ?? '',
    porcentajePropiedad: prop.porcentajePropiedad ?? 100,
    titularidad: prop.titularidad ?? 'yo',
    porcentajePropiedadPareja: prop.porcentajePropiedadPareja ?? 0,
    tieneParking: prop.anexos?.tieneParking ?? false,
    tieneTrastero: prop.anexos?.tieneTrastero ?? false,
    valorCatastralTotal: prop.fiscalData?.cadastralValue || 0,
    valorCatastralConstruccion: prop.fiscalData?.constructionCadastralValue || 0,
    cadastralRevised: prop.fiscalData?.cadastralRevised ?? false,
    usoTipo: prop.usoTipo ?? 'larga_estancia',
    alquilerHabActivo: prop.alquilerPorHabitaciones?.activo ?? false,
    alquilerHabNum: prop.alquilerPorHabitaciones?.numeroHabitaciones ?? 0,
    mejorasOn: mejorasDB.length > 0,
    mejoras: mejorasDB.map((m) => ({
      id: m.id,
      concepto: m.descripcion,
      fecha: m.fecha,
      importe: m.importe,
      tipo: m.tipo === 'reparacion' ? 'reparacion' : 'mejora',
    })),
    mueblesOn: mueblesDB.length > 0,
    muebles: mueblesDB.map((mu) => ({
      id: mu.id,
      concepto: mu.descripcion,
      fechaAlta: mu.fechaAlta,
      importe: mu.importe,
    })),
    fotoOn: !!prop.foto,
    foto: prop.foto,
  };

  const meta: InmuebleFormMeta = {
    documents: Array.isArray(prop.documents) ? prop.documents : [],
    prestamoVinculadoId: prop.estructuraCompra?.prestamoVinculadoId,
    otrosOriginal,
    purchaseDateOriginal: prop.purchaseDate || '',
  };

  return { model, meta };
}

const clampPct = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.min(v, 100) : 0);

// ── modelo → DB (sin pérdida) ────────────────────────────────────────────────
export function propertyFromModel(
  m: InmuebleFormModel,
  meta: InmuebleFormMeta,
): Omit<Property, 'id'> {
  const vis = visibilidad(m);

  // Otros gastos · si el agregado no cambió respecto al original, se preserva el
  // desglose (no se aplasta en un único "Otros"). Si cambió, se guarda como un
  // único concepto con el nuevo importe.
  const otrosSinCambios =
    meta.otrosOriginal.length > 0 && Math.abs(sumOtros(meta.otrosOriginal) - m.otros) < 0.005;
  const acquisitionOther: OtroGasto[] = otrosSinCambios
    ? meta.otrosOriginal
    : m.otros > 0
      ? [{ concept: 'Otros', amount: m.otros }]
      : [];

  // Estructura de compra · solo se persiste si hay aportación/financiación o FK.
  const tieneEstructura =
    m.aportacionPropia > 0 || m.importeFinanciado > 0 || !!meta.prestamoVinculadoId;

  return {
    tipoActivo: m.tipoActivo,
    foto: m.fotoOn ? m.foto : undefined,
    alias: m.alias.trim(),
    address: m.direccion.trim(),
    postalCode: m.cp,
    municipality: m.municipality.trim(),
    province: m.province.trim(),
    ccaa: m.ccaa.trim(),
    purchaseDate: m.fechaCompra,
    cadastralReference: m.refCatastral.trim() || undefined,
    squareMeters: m.m2 || 0,
    bedrooms: m.habitaciones || 0,
    bathrooms: m.banos || undefined,
    transmissionRegime: m.estado,
    state: 'activo',
    porcentajePropiedad: m.titularidad === 'pareja' ? 0 : clampPct(m.porcentajePropiedad),
    titularidad: m.titularidad,
    porcentajePropiedadPareja: m.titularidad === 'yo' ? 0 : clampPct(m.porcentajePropiedadPareja),
    esUrbana: m.esUrbana,
    certificadoEnergetico:
      (m.certificadoEnergetico as Property['certificadoEnergetico']) || undefined,
    acquisitionCosts: {
      price: m.precioCompra,
      notary: m.notaria || 0,
      registry: m.registro || 0,
      management: m.gestoria || 0,
      other: acquisitionOther,
      ...(m.estado === 'usada' ? { itp: m.impuestos || 0 } : { iva: m.impuestos || 0 }),
    },
    ...(tieneEstructura
      ? {
          estructuraCompra: {
            ...(m.aportacionPropia > 0 ? { aportacionPropia: m.aportacionPropia } : {}),
            ...(m.importeFinanciado > 0 ? { importeFinanciado: m.importeFinanciado } : {}),
            ...(meta.prestamoVinculadoId ? { prestamoVinculadoId: meta.prestamoVinculadoId } : {}),
          },
        }
      : {}),
    documents: meta.documents.length > 0 ? meta.documents : [],
    valorReferencia: m.valorReferenciaIsManual ? m.valorReferencia : undefined,
    anexos: vis.showAnexos
      ? { tieneParking: m.tieneParking, tieneTrastero: m.tieneTrastero }
      : undefined,
    usoTipo: vis.showUso ? m.usoTipo : undefined,
    alquilerPorHabitaciones:
      vis.showAlquilerHab && m.alquilerHabActivo
        ? { activo: true, numeroHabitaciones: m.alquilerHabNum || undefined }
        : vis.showAlquilerHab
          ? { activo: false }
          : undefined,
    fiscalData: {
      cadastralValue: m.valorCatastralTotal || undefined,
      constructionCadastralValue: m.valorCatastralConstruccion || undefined,
      constructionPercentage:
        m.valorCatastralTotal > 0
          ? (m.valorCatastralConstruccion / m.valorCatastralTotal) * 100
          : undefined,
      cadastralRevised: m.cadastralRevised,
    },
  };
}
