/**
 * Document Matching Service — Pieza 8
 *
 * Given a supplier NIF (and optional amount / exercise year), finds candidate
 * operations in mejorasActivo and mobiliarioActivo that could correspond to an
 * uploaded invoice, so the user can link document → declared operation.
 */

import { initDB, MejoraActivo, MobiliarioActivo, Property } from './db';

export interface MatchCandidate {
  store: 'mejorasActivo' | 'mobiliarioActivo';
  id: number;
  inmuebleId: number;
  inmuebleAlias: string;
  tipo: MejoraActivo['tipo'] | 'mobiliario';
  ejercicio: number;
  importe: number;
  descripcion: string;
  proveedorNIF: string;
  proveedorNombre?: string;
  /** Already has a document linked */
  alreadyLinked: boolean;
  /** 0-100 relevance score */
  score: number;
}

/**
 * Find mejoras/mobiliario candidates that match a supplier NIF.
 * Results are sorted by score descending (best match first).
 */
export async function findCandidates(
  nif: string,
  importe?: number,
  ejercicio?: number
): Promise<MatchCandidate[]> {
  if (!nif || nif.trim() === '') return [];

  const db = await initDB();
  const normalizedNif = nif.trim().toUpperCase().replace(/[\s.-]/g, '');

  // Fetch all mejoras & mobiliario in parallel
  const [mejoras, mobiliarios, properties] = await Promise.all([
    db.getAll('mejorasActivo') as Promise<MejoraActivo[]>,
    db.getAll('mobiliarioActivo') as Promise<MobiliarioActivo[]>,
    db.getAll('properties') as Promise<Property[]>,
  ]);

  // Build property alias lookup
  const aliasMap = new Map<number, string>();
  for (const p of properties) {
    if (p.id != null) aliasMap.set(p.id, p.alias || p.address || `Inmueble #${p.id}`);
  }

  const candidates: MatchCandidate[] = [];

  // --- Mejoras ---
  for (const m of mejoras) {
    const mNif = (m.proveedorNIF || '').trim().toUpperCase().replace(/[\s.-]/g, '');
    if (mNif !== normalizedNif) continue;

    candidates.push({
      store: 'mejorasActivo',
      id: m.id!,
      inmuebleId: m.inmuebleId,
      inmuebleAlias: aliasMap.get(m.inmuebleId) || `Inmueble #${m.inmuebleId}`,
      tipo: m.tipo,
      ejercicio: m.ejercicio,
      importe: m.importe,
      descripcion: m.descripcion,
      proveedorNIF: m.proveedorNIF,
      proveedorNombre: m.proveedorNombre,
      alreadyLinked: m.documentId != null && m.documentId > 0,
      score: computeScore(m.importe, m.ejercicio, importe, ejercicio),
    });
  }

  // --- Mobiliario ---
  for (const mb of mobiliarios) {
    const mbNif = (mb.proveedorNIF || '').trim().toUpperCase().replace(/[\s.-]/g, '');
    if (mbNif !== normalizedNif) continue;

    candidates.push({
      store: 'mobiliarioActivo',
      id: mb.id!,
      inmuebleId: mb.inmuebleId,
      inmuebleAlias: aliasMap.get(mb.inmuebleId) || `Inmueble #${mb.inmuebleId}`,
      tipo: 'mobiliario',
      ejercicio: mb.ejercicio,
      importe: mb.importe,
      descripcion: mb.descripcion,
      proveedorNIF: mb.proveedorNIF,
      proveedorNombre: mb.proveedorNombre,
      alreadyLinked: mb.documentId != null && mb.documentId > 0,
      score: computeScore(mb.importe, mb.ejercicio, importe, ejercicio),
    });
  }

  // Sort: unlinked first, then by score descending
  candidates.sort((a, b) => {
    if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
    return b.score - a.score;
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
 * Run matching for all unlinked documents that have a supplier NIF.
 * Returns the number of documents that got new candidates.
 */
export async function rematchPendingDocuments(): Promise<number> {
  const db = await initDB();
  const allDocs = await db.getAll('documents');
  let updated = 0;

  for (const doc of allDocs) {
    const status = doc.metadata?.status;
    // Only process documents that are pending assignment or new
    if (status !== 'Nuevo' && status !== 'pendiente_asignacion' as any) continue;

    const nif = extractNifFromDocument(doc);
    if (!nif) continue;

    const importe = doc.metadata?.financialData?.amount;
    const ejercicio = doc.metadata?.aeatClassification?.exerciseYear
      || (doc.metadata?.financialData?.issueDate
        ? new Date(doc.metadata.financialData.issueDate).getFullYear()
        : undefined);

    const candidates = await findCandidates(nif, importe, ejercicio);

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

  // 2. contraparte (sometimes stores NIF)
  const contraparte = doc.metadata?.contraparte;
  if (contraparte && /^[A-Z0-9]\d{7}[A-Z0-9]$/i.test(contraparte.trim())) {
    return contraparte.trim();
  }

  return undefined;
}

/**
 * Score a candidate 0-100 based on how closely it matches the invoice.
 * - Exact amount match: +50
 * - Close amount (within 5%): +30
 * - Same exercise year: +40
 * - Already linked: -20
 */
function computeScore(
  candidateImporte: number,
  candidateEjercicio: number,
  invoiceImporte?: number,
  invoiceEjercicio?: number
): number {
  let score = 50; // Base score for NIF match

  if (invoiceImporte != null && invoiceImporte > 0 && candidateImporte > 0) {
    const diff = Math.abs(candidateImporte - invoiceImporte) / candidateImporte;
    if (diff < 0.001) score += 50;
    else if (diff < 0.05) score += 30;
    else if (diff < 0.15) score += 10;
  }

  if (invoiceEjercicio != null && candidateEjercicio === invoiceEjercicio) {
    score += 40;
  }

  return Math.min(100, score);
}
