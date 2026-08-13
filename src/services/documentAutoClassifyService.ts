/**
 * Document Auto-Classification Service
 *
 * The OCR layer already extracts everything from an invoice (proveedor, tipo de
 * gasto, dirección, base, IVA, total, fecha…). This service is the bridge from
 * "OCR extracted fields" to "a classified document that is actually a gasto of
 * an inmueble":
 *
 *  1. `classifyDocumentFromOCR` reads the OCR data and picks a **concepto** from
 *     the unified catalog (`conceptosBase`) — luz, IBI, comunidad, seguro hogar,
 *     gestoría, caldera… not just "suministro". That concepto carries the AEAT
 *     casilla, so a factura is filed the way the rest of the app expects.
 *  2. `assignDocumentToProperty` writes `entityType='property'` + `entityId`
 *     (what the property Documentos tab / Archivo read) AND materialises the
 *     downstream fiscal record: a `GastoInmueble` line (with its casilla) for a
 *     recurring expense, or a `MuebleInmueble` for furniture. Re-assigning is
 *     idempotent — the previous line/mueble for the document is replaced.
 */

import { initDB, Document } from './db';
import {
  CONCEPTOS,
  conceptoPorId,
  familiaPorId,
  type Concepto,
  type FamiliaId,
} from './conceptos/catalogoConceptos';
import { gastosInmuebleService, CATEGORIA_A_CASILLA } from './gastosInmuebleService';
import { mueblesInmuebleService } from './mueblesInmuebleService';
import { listarCompromisos } from './personal/compromisosRecurrentesService';
import type { GastoCategoria } from './db';

// ── OCR "tipo_gasto" → concepto del catálogo ─────────────────────────────────

/** Baseline: el tipo_gasto que emite el OCR se traduce a un concepto concreto. */
const TIPO_GASTO_A_CONCEPTO: Record<string, string> = {
  electricidad:            'luz',
  agua:                    'agua',
  gas:                     'gas',
  telecomunicaciones:      'telefonia',
  seguros:                 'seguro_hogar',
  comunidad:               'comunidad_ordinaria',
  mantenimiento:           'mantenimiento_integral',
  servicios_profesionales: 'gestoria',
  alquiler:                'alquiler_vivienda',
  transporte:              'transporte',
  alimentacion:            'supermercado',
  material_oficina:        'otros_gestion',
  mobiliario:              'muebles',
};

/**
 * Refinado por texto (proveedor + notas + nombre de fichero). Se evalúa en orden
 * y el primero que casa gana, así que van de más específico a más genérico.
 * Sólo captura lo que se puede afirmar con confianza a partir del emisor.
 */
const KEYWORD_A_CONCEPTO: Array<{ re: RegExp; concepto: string }> = [
  // Tributos
  { re: /\b(ibi|impuesto sobre bienes|bienes inmuebles)\b/i, concepto: 'ibi' },
  { re: /\b(basura|residuos|alcantarillado|saneamiento)\b/i, concepto: 'tasa_basuras' },
  { re: /\blicencia tur[ií]stica\b/i, concepto: 'licencia_turistica' },
  // Comunidad
  { re: /\bderrama\b/i, concepto: 'derrama' },
  { re: /\b(comunidad de propietarios|administrad\w* de fincas|finca\w*)\b/i, concepto: 'comunidad_ordinaria' },
  // Suministros — agua
  { re: /\b(aqualia|emasesa|emacsa|canal de isabel|aig[üu]es|aguas de|hidrogea|facsa|gestagua|aguas municipal)\b/i, concepto: 'agua' },
  // Suministros — gas (antes que luz, porque comercializadoras venden ambos)
  { re: /\b(nedgia|gas natural|redexis|naturgas)\b/i, concepto: 'gas' },
  // Suministros — luz
  { re: /\b(iberdrola|endesa|naturgy|edp|holaluz|totalenergies|curenergia|gana energ|repsol|octopus|som energia|imagina energ|visalia|adph)\b/i, concepto: 'luz' },
  // Alarma (antes que telefonía, porque algunas son telecom)
  { re: /\b(securitas|prosegur|verisure|sector alarm|adt|tyco|alarma)\b/i, concepto: 'alarma' },
  // Telecomunicaciones
  { re: /\b(movistar|vodafone|orange|masmovil|m[áa]smovil|yoigo|jazztel|pepephone|lowi|finetwork|digi|o2|simyo|avatel)\b/i, concepto: 'telefonia' },
  // Seguros
  { re: /\b(mapfre|axa|allianz|generali|mutua|zurich|l[íi]nea directa|catalana occidente|reale|pelayo|caser|helvetia|santalucia|santaluc[íi]a|seguros|p[óo]liza)\b/i, concepto: 'seguro_hogar' },
  // Gestión
  { re: /\b(gestor[íi]a|asesor[íi]a|asesoramiento)\b/i, concepto: 'gestoria' },
  { re: /\b(honorarios|agencia inmobiliaria|gesti[óo]n del alquiler)\b/i, concepto: 'honorarios_agencia' },
  // Reparación y conservación
  { re: /\b(caldera|calefacci[óo]n)\b/i, concepto: 'mantenimiento_caldera' },
  { re: /\b(fontaner|electricist|pintur|alba[ñn]il|reparaci[óo]n|reforma|manitas)\b/i, concepto: 'otros_reparacion' },
  // Servicios y explotación
  { re: /\b(limpieza)\b/i, concepto: 'limpieza' },
  { re: /\b(lavander[íi]a)\b/i, concepto: 'lavanderia' },
  // Mobiliario
  { re: /\b(mueble|mobiliario|ikea|conforama|leroy merl[íi]n colch|colch[óo]n|electrodom[ée]stic)\b/i, concepto: 'muebles' },
];

// ── amount parsing ────────────────────────────────────────────────────────────

/**
 * Parse an amount that may arrive as a number or as a Spanish-formatted string
 * ("1.234,56" → 1234.56, "37,67" → 37.67). Returns undefined when unusable.
 */
export function parseAmount(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  let s = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!s) return undefined;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

// ── OCR field readers ─────────────────────────────────────────────────────────

function ocrValue(doc: Document, key: string): string | undefined {
  const data = (doc.metadata as any)?.ocr?.data;
  const v = data?.[key];
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

function fieldValue(doc: Document, names: string[]): string | undefined {
  const fields = (doc.metadata as any)?.ocr?.fields || [];
  const hit = fields.find((f: any) => names.includes(String(f.name || '').toLowerCase()));
  return hit?.value ? String(hit.value) : undefined;
}

function yearFromDate(fecha?: string): number | undefined {
  if (!fecha) return undefined;
  const dmy = fecha.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return Number(dmy[3]);
  const ymd = fecha.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (ymd) return Number(ymd[1]);
  const parsed = new Date(fecha);
  return Number.isNaN(parsed.getFullYear()) ? undefined : parsed.getFullYear();
}

export function toIsoDate(fecha?: string): string | undefined {
  if (!fecha) return undefined;
  const dmy = fecha.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const ymd = fecha.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

// ── concepto detection ────────────────────────────────────────────────────────

/**
 * Pick the best catalog concepto for a document from its OCR data.
 * Text (proveedor + notas + filename) wins over the coarse `tipo_gasto`, because
 * the emisor is the most reliable signal. Telecom refines to internet when the
 * invoice mentions fibra/internet. Returns undefined when nothing is confident —
 * the caller then asks the user instead of inventing a concepto.
 */
export function detectConceptoId(doc: Document): string | undefined {
  const proveedor = ocrValue(doc, 'proveedor') || fieldValue(doc, ['supplier_name']) || '';
  const notas = ocrValue(doc, 'notas') || '';
  const filename = String(doc.filename || '');
  const haystack = `${proveedor} ${notas} ${filename}`;

  for (const { re, concepto } of KEYWORD_A_CONCEPTO) {
    if (re.test(haystack)) {
      if (concepto === 'telefonia' && /\b(fibra|internet|adsl)\b/i.test(haystack)) return 'internet';
      return concepto;
    }
  }

  const tipoGasto = (ocrValue(doc, 'tipo_gasto') || '').trim().toLowerCase();
  const byTipo = TIPO_GASTO_A_CONCEPTO[tipoGasto];
  if (byTipo) {
    if (byTipo === 'telefonia' && /\b(fibra|internet|adsl)\b/i.test(haystack)) return 'internet';
    return byTipo;
  }
  return undefined;
}

// ── familia → carpeta / GastoCategoria ────────────────────────────────────────

const FAMILIA_A_CARPETA: Partial<Record<FamiliaId, NonNullable<Document['metadata']['carpeta']>>> = {
  suministros: 'facturas',
  mobiliario:  'mejoras',
};

/** El tipo coarse persistido en `metadata.tipo`, para el filtro del Archivo. */
function tipoParaFamilia(familia?: FamiliaId): NonNullable<Document['metadata']['tipo']> {
  if (familia === 'mobiliario') return 'Mejora';
  return 'Factura';
}

const FAMILIA_A_GASTO_CATEGORIA: Partial<Record<FamiliaId, GastoCategoria>> = {
  tributos:    'ibi',
  comunidad:   'comunidad',
  suministros: 'suministro',
  seguros:     'seguro',
  gestion:     'gestion',
  reparacion:  'reparacion',
  servicios:   'servicio',
};

// ── classification patch ──────────────────────────────────────────────────────

export interface DocumentClassification {
  /** Id del concepto del catálogo, o undefined si no se pudo determinar. */
  conceptoId?: string;
  concepto?: Concepto;
  familia?: FamiliaId;
  /** Etiqueta legible (label del concepto o del tipo_gasto). */
  label: string;
  proveedor?: string;
  direccion?: string;
  fecha?: string;
  ejercicio?: number;
  base?: number;
  iva?: number;
  total?: number;
  numeroFactura?: string;
}

/** Read OCR data off a document and produce a catalog-driven classification. */
export function classifyDocumentFromOCR(doc: Document): DocumentClassification {
  const conceptoId = detectConceptoId(doc);
  const concepto = conceptoPorId(conceptoId);
  const fecha = ocrValue(doc, 'fecha') || fieldValue(doc, ['invoice_date', 'issue_date']);
  const label = concepto?.label
    || (ocrValue(doc, 'tipo_gasto') ? String(ocrValue(doc, 'tipo_gasto')) : 'Sin clasificar');

  return {
    conceptoId,
    concepto,
    familia: concepto?.familia,
    label,
    proveedor: ocrValue(doc, 'proveedor') || fieldValue(doc, ['supplier_name']),
    direccion: ocrValue(doc, 'direccion') ||
      fieldValue(doc, ['service_address', 'supplier_address', 'receiver_address']),
    fecha,
    ejercicio: yearFromDate(fecha),
    base: parseAmount(ocrValue(doc, 'base_imponible') ?? fieldValue(doc, ['net_amount', 'subtotal'])),
    iva: parseAmount(ocrValue(doc, 'iva') ?? fieldValue(doc, ['tax_amount'])),
    total: parseAmount(ocrValue(doc, 'importe_total') ?? fieldValue(doc, ['total_amount'])),
    numeroFactura: ocrValue(doc, 'numero_factura') || fieldValue(doc, ['invoice_id', 'invoice_number']),
  };
}

/**
 * Merge a classification into a document's metadata WITHOUT touching the
 * property link. Safe to run right after OCR: it makes the document show up with
 * a real concepto/provider/amount in the Archivo even before it is assigned.
 */
export function applyClassificationMetadata(
  doc: Document,
  c: DocumentClassification,
): Document {
  const md = doc.metadata || ({} as Document['metadata']);
  const carpeta = (c.familia && FAMILIA_A_CARPETA[c.familia]) || 'facturas';
  const isCapex = c.familia === 'mobiliario';
  return {
    ...doc,
    metadata: {
      ...md,
      tipo: tipoParaFamilia(c.familia),
      carpeta,
      categoria: c.label,
      ...(c.conceptoId ? { concepto: c.conceptoId } : {}),
      ...(c.proveedor ? { proveedor: c.proveedor, counterpartyName: c.proveedor } : {}),
      ...(c.ejercicio ? { ejercicio: c.ejercicio } : {}),
      financialData: {
        ...md.financialData,
        ...(c.total != null ? { amount: c.total } : {}),
        ...(c.base != null ? { base: c.base } : {}),
        ...(c.iva != null ? { iva: c.iva } : {}),
        ...(c.numeroFactura ? { invoiceNumber: c.numeroFactura } : {}),
        ...(toIsoDate(c.fecha) ? { issueDate: toIsoDate(c.fecha) } : {}),
        ...(c.direccion ? { serviceAddress: c.direccion } : {}),
        ...(isCapex ? { isMejora: true } : {}),
      },
    },
  };
}

/** Replace the concepto of a classification with a chosen catalog id. */
export function withConcepto(base: DocumentClassification, conceptoId: string): DocumentClassification {
  const chosen = conceptoPorId(conceptoId);
  return {
    ...base,
    conceptoId,
    concepto: chosen,
    familia: chosen?.familia,
    label: chosen?.label ?? base.label,
  };
}

// ── deterministic match against a predicted expense (compromiso) ──────────────

const normId = (s?: string): string => (s || '').toUpperCase().replace(/[\s.\-/]/g, '');

/** The minimum a compromiso needs to expose for identity matching (testable). */
export interface CompromisoLike {
  id?: number;
  concepto?: string;
  cups?: string;
  numeroContrato?: string;
  proveedor?: { nombre?: string; nif?: string };
  inmuebleId?: number;
  reparto?: Array<{ inmuebleId: number }>;
}

export interface PrevistoMatch {
  compromiso: CompromisoLike;
  inmuebleId: number;
  inmuebleAlias: string;
  conceptoId?: string;
  matchedBy: 'cups' | 'numeroContrato' | 'nif';
}

/**
 * Pick the predicted expense that a document belongs to, by identity — CUPS
 * first (unique per supply point), then contract number, then supplier NIF.
 * Pure, so the matching rules can be tested without a database.
 */
export function elegirCompromiso(
  compromisos: readonly CompromisoLike[],
  keys: { cups?: string; nif?: string; numeroContrato?: string },
): { compromiso: CompromisoLike; matchedBy: PrevistoMatch['matchedBy'] } | null {
  const cups = normId(keys.cups);
  const contrato = normId(keys.numeroContrato);
  const nif = normId(keys.nif);

  if (cups) {
    const hit = compromisos.find((c) => c.cups && normId(c.cups) === cups);
    if (hit) return { compromiso: hit, matchedBy: 'cups' };
  }
  if (contrato) {
    const hit = compromisos.find((c) => c.numeroContrato && normId(c.numeroContrato) === contrato);
    if (hit) return { compromiso: hit, matchedBy: 'numeroContrato' };
  }
  if (nif) {
    const hits = compromisos.filter((c) => c.proveedor?.nif && normId(c.proveedor.nif) === nif);
    // El NIF sólo es concluyente si señala a un único compromiso: un mismo
    // proveedor (p.ej. una aseguradora) puede cubrir varios inmuebles.
    if (hits.length === 1) return { compromiso: hits[0], matchedBy: 'nif' };
  }
  return null;
}

function readCups(doc: Document): string | undefined {
  return ocrValue(doc, 'cups') || (doc.metadata as any)?.financialData?.cups;
}
function readNif(doc: Document): string | undefined {
  return ocrValue(doc, 'nif_proveedor') || (doc.metadata as any)?.financialData?.nifProveedor;
}

/**
 * Find the predicted expense (compromiso recurrente) this document belongs to.
 * Returns the inmueble + concepto to use, so assignment is deterministic instead
 * of guessed from the provider name.
 */
export async function matchCompromisoPrevisto(doc: Document): Promise<PrevistoMatch | null> {
  const cups = readCups(doc);
  const nif = readNif(doc);
  const numeroContrato = ocrValue(doc, 'numero_contrato');
  if (!cups && !nif && !numeroContrato) return null;

  const compromisos = await listarCompromisos({ ambito: 'inmueble', soloActivos: true });
  const chosen = elegirCompromiso(compromisos as unknown as CompromisoLike[], { cups, nif, numeroContrato });
  if (!chosen) return null;

  const inmuebleId = chosen.compromiso.inmuebleId ?? chosen.compromiso.reparto?.[0]?.inmuebleId;
  if (inmuebleId == null) return null;

  let inmuebleAlias = `Inmueble #${inmuebleId}`;
  try {
    const db = await initDB();
    const p = (await db.get('properties', inmuebleId)) as any;
    if (p) inmuebleAlias = p.alias || p.address || inmuebleAlias;
  } catch { /* ignore */ }

  return {
    compromiso: chosen.compromiso,
    inmuebleId,
    inmuebleAlias,
    conceptoId: chosen.compromiso.concepto,
    matchedBy: chosen.matchedBy,
  };
}

// ── downstream fiscal record ──────────────────────────────────────────────────

/** Remove any gasto/mueble previously materialised from this document (idempotency). */
async function limpiarRegistrosPrevios(documentId: number): Promise<void> {
  await gastosInmuebleService.deleteByOrigenId('manual', `doc-${documentId}`).catch(() => {});
  try {
    const db = await initDB();
    const muebles = (await db.getAll('mueblesInmueble')) as any[];
    for (const m of muebles) {
      if (m.documentId === documentId && m.id != null) {
        await mueblesInmuebleService.eliminar(m.id).catch(() => {});
      }
    }
  } catch { /* store may not exist */ }
}

/**
 * Create the fiscal record that corresponds to a classified document assigned to
 * an inmueble: a `MuebleInmueble` for furniture (amortizable), or a
 * `GastoInmueble` line (with its AEAT casilla) for a deductible recurring
 * expense. Returns silently when the concepto has no inmueble treatment.
 */
async function materializarRegistroInmueble(
  documentId: number,
  inmuebleId: number,
  c: DocumentClassification,
  nif?: string,
): Promise<void> {
  if (!c.conceptoId || !c.concepto?.inmueble) return; // sólo conceptos deducibles en inmueble

  const ejercicio = c.ejercicio ?? new Date().getFullYear();
  const fecha = toIsoDate(c.fecha) ?? `${ejercicio}-01-01`;
  const importe = c.total ?? c.base ?? 0;
  const descripcion = c.proveedor ? `${c.label} · ${c.proveedor}` : c.label;
  const nifProveedor = nif;

  await limpiarRegistrosPrevios(documentId);

  if (c.familia === 'mobiliario') {
    await mueblesInmuebleService.crear({
      inmuebleId, ejercicio,
      descripcion, fechaAlta: fecha,
      importe, vidaUtil: 10, activo: true,
      proveedorNombre: c.proveedor,
      proveedorNIF: nifProveedor,
      invoiceNumber: c.numeroFactura,
      documentId,
    });
    return;
  }

  const categoria = (c.familia && FAMILIA_A_GASTO_CATEGORIA[c.familia]) ?? 'otro';
  const casillaAEAT = CATEGORIA_A_CASILLA[categoria];
  const camposComunes = {
    concepto: c.label,
    categoria,
    casillaAEAT,
    importe,
    fecha,
    proveedorNombre: c.proveedor,
    ...(nifProveedor ? { proveedorNIF: nifProveedor } : {}),
    invoiceNumber: c.numeroFactura,
    documentId,
    categoryKey: c.concepto.inmueble.categoryKey ?? undefined,
    subtypeKey: c.concepto.inmueble.subtypeKey,
  };

  // Si ya existe un gasto PREVISTO de este ejercicio que cuadra (misma casilla,
  // importe ≈), la factura lo CONFIRMA en vez de crear una línea nueva: así no
  // se cuenta el gasto dos veces (una prevista, otra desde el documento).
  const existentes = await gastosInmuebleService
    .getByInmuebleYEjercicio(inmuebleId, ejercicio)
    .catch(() => [] as any[]);
  const tolerancia = Math.max(importe * 0.02, 1);
  const casaImporte = (g: any) => importe > 0 && Math.abs((g.importe ?? 0) - importe) <= tolerancia;

  const yaVinculado = existentes.find((g: any) => g.documentId === documentId);
  const previstoNif = !yaVinculado && nifProveedor
    ? existentes.find((g: any) => g.estado === 'previsto' && !g.documentId && normId(g.proveedorNIF) === normId(nifProveedor) && casaImporte(g))
    : undefined;
  const previstoCasilla = !yaVinculado && !previstoNif
    ? existentes.find((g: any) => g.estado === 'previsto' && !g.documentId && g.casillaAEAT === casillaAEAT && casaImporte(g))
    : undefined;

  const objetivo = yaVinculado || previstoNif || previstoCasilla;
  if (objetivo?.id != null) {
    await gastosInmuebleService.update(objetivo.id, { ...camposComunes, estado: 'confirmado' });
    return;
  }

  await gastosInmuebleService.add({
    inmuebleId, ejercicio,
    ...camposComunes,
    estado: 'confirmado',
    origen: 'manual',
    origenId: `doc-${documentId}`,
  });
}

// ── assignment to a property ──────────────────────────────────────────────────

/**
 * Bind a document to an inmueble and mark it classified. This writes the
 * `entityType`/`entityId` pair every downstream view reads, persists the
 * classification, materialises the corresponding gasto/mueble record, and clears
 * any pending-match state. Returns the updated document.
 */
export async function assignDocumentToProperty(
  documentId: number,
  propertyId: number,
  classification?: DocumentClassification,
): Promise<Document> {
  const db = await initDB();
  const doc = (await db.get('documents', documentId)) as Document | undefined;
  if (!doc) throw new Error(`Documento #${documentId} no encontrado`);

  const c = classification ?? classifyDocumentFromOCR(doc);
  const withClass = applyClassificationMetadata(doc, c);

  const nif = withClass.metadata?.financialData?.nifProveedor;

  const updated: Document = {
    ...withClass,
    metadata: {
      ...withClass.metadata,
      entityType: 'property',
      entityId: propertyId,
      destino: 'Inmueble',
      status: 'Asignado',
      queueStatus: 'procesado',
      matchCandidates: undefined,
    } as Document['metadata'],
  };

  await db.put('documents', updated);

  // Materialise the fiscal record (non-blocking for the document assignment).
  try {
    await materializarRegistroInmueble(documentId, propertyId, c, nif);
  } catch { /* la vinculación del documento no debe fallar por el registro fiscal */ }

  return updated;
}

/** All catalog concepts selectable for an inmueble, grouped by family (for the UI). */
export function conceptosInmueblePorFamilia(): Array<{ familia: string; label: string; conceptos: Concepto[] }> {
  const groups = new Map<FamiliaId, Concepto[]>();
  for (const c of CONCEPTOS) {
    if (!c.inmueble || c.oculto) continue;
    const arr = groups.get(c.familia) ?? [];
    arr.push(c);
    groups.set(c.familia, arr);
  }
  const out: Array<{ familia: string; label: string; conceptos: Concepto[] }> = [];
  for (const [familia, conceptos] of groups) {
    out.push({ familia, label: familiaPorId(familia)?.label ?? familia, conceptos });
  }
  return out;
}
