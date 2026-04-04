/**
 * Document Matching Service — Pieza 8 (multicriteria)
 *
 * Given OCR-extracted data (NIF, dirección, fecha), finds candidate
 * operations in mejorasActivo and mobiliarioActivo that could correspond to an
 * uploaded invoice, so the user can link document → declared operation.
 *
 * Scoring:
 *  - NIF exacto         → +3
 *  - Dirección coincide  → +2
 *  - Año coincide        → +1
 *  - Solo candidatos con score ≥ 2
 */

import { initDB, MejoraActivo, MobiliarioActivo, Property } from './db';

export interface CandidatoMatch {
  id: number;
  tipo: 'mejoraActivo' | 'mobiliarioActivo';
  inmuebleId: number;
  inmuebleAlias: string;
  ejercicio: number;
  importe: number;
  tipoGasto: string; // 'mejora' | 'ampliacion' | 'reparacion' | 'mobiliario'
  descripcion: string;
  proveedorNIF: string;
  proveedorNombre?: string;
  alreadyLinked: boolean;
  score: number;
}

// Keep the old MatchCandidate name as alias for backwards compatibility with DocumentLinkingPanel
export type MatchCandidate = CandidatoMatch;

interface FindCandidatesParams {
  nif?: string;
  direccion?: string;
  fecha?: string;
}

/**
 * Normalise a string for fuzzy address comparison: lowercase, remove accents,
 * collapse whitespace.
 */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check whether the document address loosely matches a property address or alias.
 * Returns true if the property address/alias tokens are found within the document address.
 */
function addressMatches(docAddress: string, propertyAddress: string, propertyAlias: string): boolean {
  const normDoc = normalizeText(docAddress);
  if (!normDoc) return false;

  // Check alias first (shorter, more distinctive)
  const normAlias = normalizeText(propertyAlias);
  if (normAlias && normAlias.length >= 3 && normDoc.includes(normAlias)) return true;

  // Check full address — split into meaningful tokens and check overlap
  const normAddr = normalizeText(propertyAddress);
  if (!normAddr) return false;

  // If the document address contains the property address directly
  if (normDoc.includes(normAddr)) return true;

  // Token-based: at least 2 significant tokens from the address must appear
  const tokens = normAddr.split(' ').filter(t => t.length >= 3);
  if (tokens.length === 0) return false;
  const matched = tokens.filter(t => normDoc.includes(t));
  return matched.length >= Math.min(2, tokens.length);
}

/**
 * Find mejoras/mobiliario candidates that match the given multicriteria params.
 * Results are sorted by score descending (best match first), only score ≥ 2 returned.
 */
export async function findCandidates(params: FindCandidatesParams): Promise<CandidatoMatch[]> {
  const { nif, direccion, fecha } = params;

  // Need at least one criterion
  if (!nif && !direccion && !fecha) return [];

  const db = await initDB();
  const normalizedNif = nif ? nif.trim().toUpperCase().replace(/[\s.-]/g, '') : '';
  const invoiceYear = fecha ? new Date(fecha).getFullYear() : undefined;

  const [mejorasInm, mueblesInm, properties] = await Promise.all([
    db.getAll('mejorasInmueble') as Promise<any[]>,
    db.getAll('mueblesInmueble') as Promise<any[]>,
    db.getAll('properties') as Promise<Property[]>,
  ]);
  // Map to legacy shape for scoring
  const mejoras = mejorasInm.map((m: any) => ({
    id: m.id, inmuebleId: m.inmuebleId, ejercicio: m.ejercicio, importe: m.importe,
    tipo: m.tipo, descripcion: m.descripcion, proveedorNIF: m.proveedorNIF,
    proveedorNombre: m.proveedorNombre, documentId: m.documentId,
  })) as MejoraActivo[];
  const mobiliarios = mueblesInm.map((m: any) => ({
    id: m.id, inmuebleId: m.inmuebleId, ejercicio: m.ejercicio, importe: m.importe,
    descripcion: m.descripcion, proveedorNIF: m.proveedorNIF,
    proveedorNombre: m.proveedorNombre, documentId: m.documentId, fechaAlta: m.fechaAlta,
  })) as MobiliarioActivo[];

  // Build property lookup maps
  const aliasMap = new Map<number, string>();
  const addressMap = new Map<number, string>();
  for (const p of properties) {
    if (p.id != null) {
      aliasMap.set(p.id, p.alias || p.address || `Inmueble #${p.id}`);
      addressMap.set(p.id, p.address || '');
    }
  }

  const candidates: CandidatoMatch[] = [];

  // --- Score a single record ---
  function scoreRecord(
    recordNif: string,
    recordInmuebleId: number,
    recordEjercicio: number,
  ): number {
    let score = 0;

    // NIF exacto → +3
    if (normalizedNif) {
      const recNif = recordNif.trim().toUpperCase().replace(/[\s.-]/g, '');
      if (recNif && recNif === normalizedNif) score += 3;
    }

    // Dirección del documento contiene dirección o alias del inmueble → +2
    if (direccion) {
      const propAddress = addressMap.get(recordInmuebleId) || '';
      const propAlias = aliasMap.get(recordInmuebleId) || '';
      if (addressMatches(direccion, propAddress, propAlias)) score += 2;
    }

    // Año del documento coincide con ejercicio del registro → +1
    if (invoiceYear && !isNaN(invoiceYear) && recordEjercicio === invoiceYear) {
      score += 1;
    }

    return score;
  }

  // --- Mejoras ---
  for (const m of mejoras) {
    const score = scoreRecord(m.proveedorNIF || '', m.inmuebleId, m.ejercicio);
    if (score < 2) continue;

    candidates.push({
      id: m.id!,
      tipo: 'mejoraActivo',
      inmuebleId: m.inmuebleId,
      inmuebleAlias: aliasMap.get(m.inmuebleId) || `Inmueble #${m.inmuebleId}`,
      ejercicio: m.ejercicio,
      importe: m.importe,
      tipoGasto: m.tipo, // 'mejora' | 'ampliacion' | 'reparacion'
      descripcion: m.descripcion,
      proveedorNIF: m.proveedorNIF,
      proveedorNombre: m.proveedorNombre,
      alreadyLinked: m.documentId != null && m.documentId > 0,
      score,
    });
  }

  // --- Mobiliario ---
  for (const mb of mobiliarios) {
    const score = scoreRecord(mb.proveedorNIF || '', mb.inmuebleId, mb.ejercicio);
    if (score < 2) continue;

    candidates.push({
      id: mb.id!,
      tipo: 'mobiliarioActivo',
      inmuebleId: mb.inmuebleId,
      inmuebleAlias: aliasMap.get(mb.inmuebleId) || `Inmueble #${mb.inmuebleId}`,
      ejercicio: mb.ejercicio,
      importe: mb.importe,
      tipoGasto: 'mobiliario',
      descripcion: mb.descripcion,
      proveedorNIF: mb.proveedorNIF,
      proveedorNombre: mb.proveedorNombre,
      alreadyLinked: mb.documentId != null && mb.documentId > 0,
      score,
    });
  }

  // --- Also read from unified stores (mejorasInmueble / mueblesInmueble) ---
  const buildKey = (tipo: string, inmId: number, ej: number, desc: string, imp: number) =>
    `${tipo}-${inmId}-${ej}-${(desc || '').trim()}-${imp}`;
  const existingKeys = new Set(candidates.map(c => buildKey(c.tipo, c.inmuebleId, c.ejercicio, c.descripcion || '', c.importe)));

  try {
    const dbUnif = await initDB();
    const allMejorasUnif = await dbUnif.getAll('mejorasInmueble').catch(() => [] as any[]);
    for (const m of allMejorasUnif) {
      const key = buildKey('mejoraActivo', m.inmuebleId, m.ejercicio, m.descripcion || '', m.importe);
      if (existingKeys.has(key)) continue;
      const score = scoreRecord(m.proveedorNIF || '', m.inmuebleId, m.ejercicio);
      if (score < 2) continue;
      existingKeys.add(key);
      candidates.push({
        id: m.id!,
        tipo: 'mejoraActivo',
        inmuebleId: m.inmuebleId,
        inmuebleAlias: aliasMap.get(m.inmuebleId) || `Inmueble #${m.inmuebleId}`,
        ejercicio: m.ejercicio,
        importe: m.importe,
        tipoGasto: m.tipo,
        descripcion: m.descripcion,
        proveedorNIF: m.proveedorNIF,
        proveedorNombre: m.proveedorNombre,
        alreadyLinked: m.documentId != null && m.documentId > 0,
        score,
      });
    }

    const allMueblesUnif = await dbUnif.getAll('mueblesInmueble').catch(() => [] as any[]);
    for (const mb of allMueblesUnif) {
      const key = buildKey('mobiliarioActivo', mb.inmuebleId, mb.ejercicio, mb.descripcion || '', mb.importe);
      if (existingKeys.has(key)) continue;
      const score = scoreRecord(mb.proveedorNIF || '', mb.inmuebleId, mb.ejercicio);
      if (score < 2) continue;
      existingKeys.add(key);
      candidates.push({
        id: mb.id!,
        tipo: 'mobiliarioActivo',
        inmuebleId: mb.inmuebleId,
        inmuebleAlias: aliasMap.get(mb.inmuebleId) || `Inmueble #${mb.inmuebleId}`,
        ejercicio: mb.ejercicio,
        importe: mb.importe,
        tipoGasto: 'mobiliario',
        descripcion: mb.descripcion,
        proveedorNIF: mb.proveedorNIF,
        proveedorNombre: mb.proveedorNombre,
        alreadyLinked: mb.documentId != null && mb.documentId > 0,
        score,
      });
    }
  } catch {
    // Unified stores may not exist yet — ignore
  }

  // Sort by score desc (unlinked first within same score)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
    return 0;
  });

  return candidates;
}

/**
 * Confirm a link: write documentId into the matching mejora or mobiliario record.
 */
export async function confirmLink(
  store: 'mejorasActivo' | 'mobiliarioActivo',
  recordId: number,
  documentId: number
): Promise<void> {
  const db = await initDB();
  const record = await db.get(store, recordId);
  if (!record) throw new Error(`Registro ${store}#${recordId} no encontrado`);

  await db.put(store, {
    ...record,
    documentId,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Run matching for all unlinked documents that have OCR data.
 * Returns the number of documents that got new candidates.
 */
export async function rematchPendingDocuments(): Promise<number> {
  const db = await initDB();
  const allDocs = await db.getAll('documents');
  let updated = 0;

  for (const doc of allDocs) {
    const status = doc.metadata?.status;
    if (status !== 'Nuevo' && status !== 'pendiente_asignacion') continue;

    const nif = extractNifFromDocument(doc);
    const direccion = extractDireccionFromDocument(doc);
    const fecha = extractFechaFromDocument(doc);

    if (!nif && !direccion && !fecha) continue;

    const candidates = await findCandidates({ nif, direccion, fecha });

    if (candidates.length > 0) {
      doc.metadata = {
        ...doc.metadata,
        status: 'pendiente_vinculacion',
        matchCandidates: candidates,
      };
    } else {
      doc.metadata = {
        ...doc.metadata,
        status: 'pendiente_asignacion',
      };
    }

    await db.put('documents', doc);
    updated++;
  }

  return updated;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract supplier NIF from any available source in the document */
export function extractNifFromDocument(doc: any): string | undefined {
  // 1. OCR fields (supplier_tax_id)
  const ocrFields = doc.metadata?.ocr?.fields;
  if (ocrFields) {
    const taxField = ocrFields.find(
      (f: any) => f.name === 'supplier_tax_id' || f.name === 'tax_id'
    );
    if (taxField?.value) return taxField.value.trim();
  }

  // 2. OCR data
  const ocrData = doc.metadata?.ocr?.data;
  if (ocrData?.nif_proveedor) return String(ocrData.nif_proveedor).trim();

  // 3. contraparte (sometimes stores NIF)
  const contraparte = doc.metadata?.contraparte;
  if (contraparte && /^[A-Z0-9]\d{7}[A-Z0-9]$/i.test(contraparte.trim())) {
    return contraparte.trim();
  }

  return undefined;
}

/** Extract address from OCR data */
export function extractDireccionFromDocument(doc: any): string | undefined {
  // OCR data.direccion
  const ocrData = doc.metadata?.ocr?.data;
  if (ocrData?.direccion) return String(ocrData.direccion).trim();

  // OCR fields
  const ocrFields = doc.metadata?.ocr?.fields;
  if (ocrFields) {
    const addrField = ocrFields.find(
      (f: any) => f.name === 'service_address' || f.name === 'supplier_address' || f.name === 'receiver_address'
    );
    if (addrField?.value) return String(addrField.value).trim();
  }

  // financialData.serviceAddress or direccionInmueble
  const fd = doc.metadata?.financialData;
  if (fd?.serviceAddress) return String(fd.serviceAddress).trim();
  if (fd?.direccionInmueble) return String(fd.direccionInmueble).trim();

  return undefined;
}

/** Extract date from OCR data */
export function extractFechaFromDocument(doc: any): string | undefined {
  // OCR data.fecha
  const ocrData = doc.metadata?.ocr?.data;
  if (ocrData?.fecha) return String(ocrData.fecha).trim();

  // OCR fields
  const ocrFields = doc.metadata?.ocr?.fields;
  if (ocrFields) {
    const dateField = ocrFields.find(
      (f: any) => f.name === 'invoice_date' || f.name === 'issue_date'
    );
    if (dateField?.value) return String(dateField.value).trim();
  }

  // financialData.issueDate or fechaDocumento
  const fdDate = doc.metadata?.financialData;
  if (fdDate?.issueDate) return String(fdDate.issueDate).trim();
  if (fdDate?.fechaDocumento) return String(fdDate.fechaDocumento).trim();

  return undefined;
}
