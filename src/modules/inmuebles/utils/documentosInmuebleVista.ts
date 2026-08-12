// Vista de documentos del inmueble para la pestaña «Documentos» (mockup ATLAS).
//
// Clasifica cada documento vinculado al inmueble en una carpeta temática y los
// agrupa. Puro y testeable: la carga desde IndexedDB se hace en el componente.

import type { Document } from '../../../services/db';

export type CarpetaKey =
  | 'contractual'
  | 'suministros'
  | 'seguros'
  | 'fiscal'
  | 'mejoras'
  | 'otros';

export interface DocumentoVista {
  id: number;
  nombre: string;
  carpeta: CarpetaKey;
  /** Fecha legible (emisión o última modificación). */
  fecha: string;
  /** Proveedor / contraparte, si consta. */
  proveedor?: string;
  /** Importe, si el documento lo lleva (facturas). */
  importe?: number;
  /** Año del documento (para el filtro). */
  anio?: number;
}

export interface CarpetaAgrupada {
  key: CarpetaKey;
  label: string;
  hint: string;
  docs: DocumentoVista[];
}

export const CARPETAS_META: Array<{ key: CarpetaKey; label: string; hint: string }> = [
  { key: 'contractual', label: 'Contractual', hint: 'escritura, contratos y certificados' },
  { key: 'suministros', label: 'Suministros', hint: 'luz, agua y facturas' },
  { key: 'seguros', label: 'Seguros', hint: 'pólizas de hogar' },
  { key: 'fiscal', label: 'Fiscal', hint: 'tributos y recibos' },
  { key: 'mejoras', label: 'Mejoras', hint: 'reformas y CAPEX' },
  { key: 'otros', label: 'Otros', hint: 'sin clasificar' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaLegible(ms: number, iso?: string): { texto: string; anio?: number } {
  if (iso && /^\d{4}-\d{2}/.test(iso)) {
    const [a, m] = iso.split('-');
    const mi = Number(m) - 1;
    return { texto: mi >= 0 && mi < 12 ? `${MESES[mi]} ${a}` : a, anio: Number(a) };
  }
  if (Number.isFinite(ms) && ms > 0) {
    const d = new Date(ms);
    return { texto: `${MESES[d.getMonth()]} ${d.getFullYear()}`, anio: d.getFullYear() };
  }
  return { texto: '—' };
}

/** Clasifica un documento en una carpeta temática a partir de sus metadatos. */
export function clasificarCarpetaDocumento(doc: Document): CarpetaKey {
  const md = doc.metadata ?? {};
  const tipo = String(md.tipo ?? '').toLowerCase();
  const carpeta = String(md.carpeta ?? '').toLowerCase();
  const categoria = String(md.categoria ?? '').toLowerCase();
  const texto = `${doc.filename ?? ''} ${categoria} ${md.proveedor ?? ''} ${md.counterpartyName ?? ''}`.toLowerCase();

  const dice = (...ks: string[]) => ks.some((k) => texto.includes(k) || categoria.includes(k));

  if (tipo === 'mejora' || carpeta === 'mejoras' || md.financialData?.isMejora || dice('reforma', 'capex')) {
    return 'mejoras';
  }
  if (tipo === 'contrato' || carpeta === 'contratos' || dice('contrato', 'escritura', 'nota simple', 'cédula', 'energ')) {
    return 'contractual';
  }
  if (tipo === 'fiscal' || md.aeatClassification != null || dice('ibi', 'tributo', 'catastro', 'modelo 100', 'irpf')) {
    return 'fiscal';
  }
  if (dice('seguro', 'póliza', 'poliza', 'mapfre', 'axa', 'allianz')) {
    return 'seguros';
  }
  if (
    tipo === 'factura' ||
    carpeta === 'facturas' ||
    dice('luz', 'agua', 'gas', 'suministro', 'iberdrola', 'endesa', 'naturgy', 'aqualia', 'electric')
  ) {
    return 'suministros';
  }
  return 'otros';
}

/** Convierte un `Document` de la BD en la vista ligera de la carpeta. */
export function aDocumentoVista(doc: Document): DocumentoVista | null {
  if (doc.id == null) return null;
  const iso = doc.metadata?.financialData?.issueDate;
  const { texto, anio } = fechaLegible(doc.lastModified, iso);
  return {
    id: doc.id,
    nombre: doc.metadata?.title || doc.filename || `Documento ${doc.id}`,
    carpeta: clasificarCarpetaDocumento(doc),
    fecha: texto,
    proveedor: doc.metadata?.counterpartyName || doc.metadata?.proveedor || doc.metadata?.contraparte,
    importe: doc.metadata?.financialData?.amount,
    anio,
  };
}

/** Agrupa las vistas en carpetas (solo las no vacías, en el orden canónico). */
export function agruparDocumentos(docs: DocumentoVista[]): CarpetaAgrupada[] {
  return CARPETAS_META.map((meta) => ({
    ...meta,
    docs: docs.filter((d) => d.carpeta === meta.key),
  })).filter((c) => c.docs.length > 0);
}
