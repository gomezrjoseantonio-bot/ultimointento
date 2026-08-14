// Ficha de inmueble · MODELO del formulario y mappers Property <-> modelo.
//
// El modelo es la forma que edita la UI; los mappers lo traducen a/desde el
// `Property` de la DB SIN PÉRDIDA. La ficha (decisión Jose · ronda 2) es la
// del ACTIVO patrimonial: tipo, ubicación, compra/coste con financiación e
// impuestos, características y datos fiscales. Lo que NO es del activo se saca
// de aquí pero se CONSERVA al guardar:
//   · arrendamiento (usoTipo de alquiler · alquiler por habitaciones) → se
//     gestiona en el detalle; aquí solo un check de "vivienda habitual" que
//     alterna vivienda_habitual ↔ disponible sin pisar la config de alquiler.
//   · mejoras y mobiliario → viven en sus stores y se gestionan en el detalle;
//     la ficha ya no los toca (no crea ni borra).
// Además:
//   · "otros gastos" no aplasta N conceptos en uno (se preserva el desglose).
//   · impuestos AUTO por estado: ITP (usada · sobre valor de referencia) o
//     IVA+AJD (nueva · sobre precio), editables (override manual).
//   · la financiación deja de ser dato huérfano: el modelo lleva la FK al
//     préstamo y quién manda cuando hay uno vinculado (ver `financiacion.ts`).

import type { Property } from '../../../services/db';
import type { TipoActivo } from '../../../types/tipoActivo';
import { getCCAAFromProvince } from '../../../utils/locationUtils';
import { calcularTributosAuto } from './tributos';

export type UsoTipo = NonNullable<Property['usoTipo']>;
export type Titularidad = 'yo' | 'pareja' | 'ambos';
export type EstadoCompra = 'usada' | 'obra-nueva';

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
  // 4a · impuestos (auto por estado · editables con override)
  itp: number;
  itpIsManual: boolean;
  iva: number;
  ivaIsManual: boolean;
  ajd: number;
  ajdIsManual: boolean;
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
  tieneTerraza: boolean;
  tieneAscensor: boolean;
  // 6 · datos fiscales
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
  cadastralRevised: boolean;
  // 7 · uso · SOLO el check de vivienda habitual (el arrendamiento se gestiona
  // en el detalle · aquí no). vivienda_habitual → sin imputación de rentas y
  // relevante para reinversión; sin marcar → disponible (imputación).
  esViviendaHabitual: boolean;
  // 8 · foto
  fotoOn: boolean;
  foto?: string;
}

/** Impuesto de compra vigente según el estado (usada = ITP · nueva = IVA + AJD). */
export function impuestosTotal(m: InmuebleFormModel): number {
  return m.estado === 'usada' ? m.itp || 0 : (m.iva || 0) + (m.ajd || 0);
}

/**
 * Datos que el formulario NO edita pero tiene que conservar al guardar, para no
 * pisar lo que la ficha ya no gestiona: documentos, desglose de otros gastos, la
 * FK del préstamo, y el arrendamiento (usoTipo de alquiler + alquiler por
 * habitaciones), que ahora vive en el detalle.
 */
export interface InmuebleFormMeta {
  documents: number[];
  prestamoVinculadoId?: string;
  otrosOriginal: OtroGasto[];
  purchaseDateOriginal: string;
  /** usoTipo original en DB · se conserva salvo que el check de vivienda habitual lo cambie. */
  usoTipoOriginal?: UsoTipo;
  /** Config de alquiler por habitaciones original · se conserva verbatim (se gestiona en el detalle). */
  alquilerOriginal?: Property['alquilerPorHabitaciones'];
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
    itp: 0,
    itpIsManual: false,
    iva: 0,
    ivaIsManual: false,
    ajd: 0,
    ajdIsManual: false,
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
    tieneTerraza: false,
    tieneAscensor: false,
    valorCatastralTotal: 0,
    valorCatastralConstruccion: 0,
    cadastralRevised: false,
    esViviendaHabitual: false,
    fotoOn: false,
    foto: undefined,
  };
}

export function emptyMeta(): InmuebleFormMeta {
  return {
    documents: [],
    prestamoVinculadoId: undefined,
    otrosOriginal: [],
    purchaseDateOriginal: '',
    usoTipoOriginal: undefined,
    alquilerOriginal: undefined,
  };
}

// ── Visibilidad por tipo de activo (pura · la usan la UI y el mapper) ────────
export interface Visibilidad {
  isPiso: boolean;
  showHabitacionesBanos: boolean;
  showAnexos: boolean;
  /** ¿Se persiste usoTipo? (parking/trastero no tienen uso fiscal de renta). */
  showUso: boolean;
  /** ¿Se ofrece el check de vivienda habitual? (solo tiene sentido en vivienda). */
  showViviendaHabitual: boolean;
}

export function visibilidad(m: Pick<InmuebleFormModel, 'tipoActivo'>): Visibilidad {
  const isPiso = m.tipoActivo === 'piso';
  const isParkingOrTrastero = m.tipoActivo === 'parking' || m.tipoActivo === 'trastero';
  return {
    isPiso,
    showHabitacionesBanos: isPiso,
    showAnexos: isPiso,
    showUso: !isParkingOrTrastero,
    showViviendaHabitual: isPiso,
  };
}

const sumOtros = (items: OtroGasto[]): number =>
  items.reduce((s, o) => s + (o.amount || 0), 0);

// ── DB → modelo ──────────────────────────────────────────────────────────────
export function modelFromProperty(
  prop: Property,
  fallbackCCAA: string,
): { model: InmuebleFormModel; meta: InmuebleFormMeta } {
  const otrosOriginal: OtroGasto[] = Array.isArray(prop.acquisitionCosts.other)
    ? prop.acquisitionCosts.other.map((o) => ({ concept: o.concept, amount: o.amount || 0 }))
    : [];

  const ccaaResolved = prop.ccaa || fallbackCCAA;
  const inferredCCAA = prop.province ? getCCAAFromProvince(prop.province) ?? '' : '';
  const ccaaIsManual = ccaaResolved !== '' && ccaaResolved !== inferredCCAA;

  const tipoActivo = prop.tipoActivo ?? 'piso';
  const precio = prop.acquisitionCosts.price || 0;
  const vRef = prop.valorReferencia ?? precio;
  const valorRefIsManual =
    typeof prop.valorReferencia === 'number' && Math.abs(vRef - precio) > 0.01;

  // Impuestos · respetamos el flag manual explícito; si no lo hay, inferimos
  // "manual" cuando el importe guardado difiere del auto (mismo patrón que el
  // valor de referencia · evita pisar un importe puesto a mano por el usuario).
  const auto = calcularTributosAuto({ tipoActivo, ccaa: ccaaResolved, precioCompra: precio, valorReferencia: vRef });
  // Un importe guardado a 0 o vacío NO es "manual": es que nadie lo puso, y debe
  // auto-calcularse (si no, una usada migrada sin ITP se queda en 0 para siempre).
  // Solo se respeta como manual un importe > 0 que difiere del auto, o el flag explícito.
  const itpStored = prop.acquisitionCosts.itp;
  const ivaStored = prop.acquisitionCosts.iva;
  const ajdStored = prop.acquisitionCosts.ajd;
  const itpIsManual =
    prop.acquisitionCosts.itpIsManual ?? (!!itpStored && Math.abs(itpStored - auto.itp) > 0.5);
  const ivaIsManual =
    prop.acquisitionCosts.ivaIsManual ?? (!!ivaStored && Math.abs(ivaStored - auto.iva) > 0.5);
  const ajdIsManual =
    prop.acquisitionCosts.ajdIsManual ?? (!!ajdStored && Math.abs(ajdStored - auto.ajd) > 0.5);
  const itp = itpIsManual ? (itpStored as number) : auto.itp;
  const iva = ivaIsManual ? (ivaStored as number) : auto.iva;
  const ajd = ajdIsManual ? (ajdStored as number) : auto.ajd;

  const model: InmuebleFormModel = {
    tipoActivo,
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
    itp,
    itpIsManual,
    iva,
    ivaIsManual,
    ajd,
    ajdIsManual,
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
    tieneTerraza: prop.anexos?.tieneTerraza ?? false,
    tieneAscensor: prop.anexos?.tieneAscensor ?? false,
    valorCatastralTotal: prop.fiscalData?.cadastralValue || 0,
    valorCatastralConstruccion: prop.fiscalData?.constructionCadastralValue || 0,
    cadastralRevised: prop.fiscalData?.cadastralRevised ?? false,
    esViviendaHabitual: prop.usoTipo === 'vivienda_habitual',
    fotoOn: !!prop.foto,
    foto: prop.foto,
  };

  const meta: InmuebleFormMeta = {
    documents: Array.isArray(prop.documents) ? prop.documents : [],
    prestamoVinculadoId: prop.estructuraCompra?.prestamoVinculadoId,
    otrosOriginal,
    purchaseDateOriginal: prop.purchaseDate || '',
    usoTipoOriginal: prop.usoTipo,
    alquilerOriginal: prop.alquilerPorHabitaciones,
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

  // Uso fiscal · el check solo alterna vivienda_habitual ↔ disponible; cualquier
  // otro uso (arrendamiento) se conserva del original, que se gestiona aparte.
  const usoTipo: UsoTipo | undefined = vis.showUso
    ? m.esViviendaHabitual
      ? 'vivienda_habitual'
      : meta.usoTipoOriginal && meta.usoTipoOriginal !== 'vivienda_habitual'
        ? meta.usoTipoOriginal
        : 'disponible'
    : undefined;

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
      ...(m.estado === 'usada'
        ? { itp: m.itp || 0, itpIsManual: m.itpIsManual }
        : {
            iva: m.iva || 0,
            ivaIsManual: m.ivaIsManual,
            ajd: m.ajd || 0,
            ajdIsManual: m.ajdIsManual,
          }),
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
      ? {
          tieneParking: m.tieneParking,
          tieneTrastero: m.tieneTrastero,
          tieneTerraza: m.tieneTerraza,
          tieneAscensor: m.tieneAscensor,
        }
      : undefined,
    usoTipo,
    // Arrendamiento · se conserva verbatim del original (se gestiona en el detalle).
    alquilerPorHabitaciones: meta.alquilerOriginal,
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
