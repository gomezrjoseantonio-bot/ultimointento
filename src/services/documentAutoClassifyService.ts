/**
 * Document Auto-Classification Service
 *
 * The OCR layer already extracts everything from an invoice (proveedor, tipo de
 * gasto, dirección, base, IVA, total, fecha…). What was missing was the bridge
 * from "OCR extracted fields" to "a classified document actually linked to an
 * inmueble". This service is that bridge:
 *
 *  1. `classifyDocumentFromOCR` turns raw OCR data into a real metadata patch
 *     (financialData, proveedor, tipo, carpeta, categoría) so the document stops
 *     showing as «Sin clasificar / Otros» in the Archivo the moment it is read.
 *  2. `assignDocumentToProperty` writes the two fields that actually bind a
 *     document to an inmueble — `entityType='property'` + `entityId` — which is
 *     what the property's «Documentos» tab and the Archivo «Vinculado a» column
 *     read. Without this a document is orphaned no matter how good the OCR was.
 */

import { initDB, Document } from './db';

// ── OCR "tipo_gasto" → app taxonomy ──────────────────────────────────────────

export interface TipoGastoMeta {
  /** Human label shown in the UI. */
  label: string;
  /** Folder used by the inmueble «Documentos» view (documentosInmuebleVista). */
  carpeta: NonNullable<Document['metadata']['carpeta']>;
  /** Coarse document type persisted in `metadata.tipo`. */
  tipo: NonNullable<Document['metadata']['tipo']>;
  /** Whether this is a CAPEX operation (mejora/mobiliario) rather than a recurring expense. */
  capex: boolean;
}

/**
 * Canonical map from the OCR `tipo_gasto` key to how the document should be
 * filed. Recurring supplies/services all land in the «facturas» folder (which
 * the inmueble view renders as «Suministros»); CAPEX lands in «mejoras».
 */
export const TIPO_GASTO_META: Record<string, TipoGastoMeta> = {
  electricidad:            { label: 'Electricidad',            carpeta: 'facturas', tipo: 'Factura', capex: false },
  agua:                    { label: 'Agua',                    carpeta: 'facturas', tipo: 'Factura', capex: false },
  gas:                     { label: 'Gas',                     carpeta: 'facturas', tipo: 'Factura', capex: false },
  telecomunicaciones:      { label: 'Telecomunicaciones',      carpeta: 'facturas', tipo: 'Factura', capex: false },
  seguros:                 { label: 'Seguros',                 carpeta: 'facturas', tipo: 'Factura', capex: false },
  comunidad:               { label: 'Comunidad',               carpeta: 'facturas', tipo: 'Factura', capex: false },
  mantenimiento:           { label: 'Mantenimiento',           carpeta: 'facturas', tipo: 'Factura', capex: false },
  servicios_profesionales: { label: 'Servicios profesionales', carpeta: 'facturas', tipo: 'Factura', capex: false },
  alquiler:                { label: 'Alquiler',                carpeta: 'facturas', tipo: 'Factura', capex: false },
  transporte:              { label: 'Transporte',              carpeta: 'otros',    tipo: 'Factura', capex: false },
  alimentacion:            { label: 'Alimentación',            carpeta: 'otros',    tipo: 'Factura', capex: false },
  material_oficina:        { label: 'Material de oficina',     carpeta: 'otros',    tipo: 'Factura', capex: false },
  mejora:                  { label: 'Mejora',                  carpeta: 'mejoras',  tipo: 'Mejora',  capex: true },
  reforma:                 { label: 'Reforma',                 carpeta: 'mejoras',  tipo: 'Mejora',  capex: true },
  mobiliario:              { label: 'Mobiliario',              carpeta: 'mejoras',  tipo: 'Mejora',  capex: true },
  otros:                   { label: 'Otros',                   carpeta: 'otros',    tipo: 'Otros',   capex: false },
};

export function metaForTipoGasto(tipoGasto?: string): TipoGastoMeta {
  const key = (tipoGasto || '').trim().toLowerCase();
  return TIPO_GASTO_META[key] ?? TIPO_GASTO_META.otros;
}

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
    // Last separator is the decimal one; the other groups thousands.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

// ── read a snake-case OCR field with a couple of fallbacks ────────────────────

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
  // Accept dd/mm/yyyy, yyyy-mm-dd, etc.
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

// ── classification patch ──────────────────────────────────────────────────────

export interface DocumentClassification {
  /** OCR `tipo_gasto` key (lowercased), or 'otros'. */
  tipoGasto: string;
  meta: TipoGastoMeta;
  proveedor?: string;
  direccion?: string;
  fecha?: string;
  ejercicio?: number;
  base?: number;
  iva?: number;
  total?: number;
  numeroFactura?: string;
}

/** Read OCR data off a document and produce a normalized classification. */
export function classifyDocumentFromOCR(doc: Document): DocumentClassification {
  const tipoGasto = (ocrValue(doc, 'tipo_gasto') || '').trim().toLowerCase();
  const fecha = ocrValue(doc, 'fecha') || fieldValue(doc, ['invoice_date', 'issue_date']);
  return {
    tipoGasto: tipoGasto || 'otros',
    meta: metaForTipoGasto(tipoGasto),
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
 * a real type/provider/amount in the Archivo even before it is assigned.
 */
export function applyClassificationMetadata(
  doc: Document,
  c: DocumentClassification,
): Document {
  const md = doc.metadata || ({} as Document['metadata']);
  return {
    ...doc,
    metadata: {
      ...md,
      tipo: c.meta.tipo,
      carpeta: c.meta.carpeta,
      categoria: c.meta.label,
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
        ...(c.meta.capex ? { isMejora: true } : {}),
      },
    },
  };
}

// ── assignment to a property ──────────────────────────────────────────────────

/**
 * Bind a document to an inmueble and mark it classified. This writes the
 * `entityType`/`entityId` pair that every downstream view (property Documentos
 * tab, Archivo «Vinculado a») actually reads, persists the classification, and
 * clears any pending-match state. Returns the updated document.
 */
export async function assignDocumentToProperty(
  documentId: number,
  propertyId: number,
  classification?: DocumentClassification,
): Promise<Document> {
  const db = await initDB();
  const doc = (await db.get('documents', documentId)) as Document | undefined;
  if (!doc) throw new Error(`Documento #${documentId} no encontrado`);

  const withClass = classification ? applyClassificationMetadata(doc, classification) : doc;

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
  return updated;
}
