import { initDB, Contract, Ingreso, Gasto, Document, type GastoCategoria } from './db';
import { isCapexType, AEAT_CLASSIFICATION_MAP } from './aeatClassificationService';
import { gastosInmuebleService } from './gastosInmuebleService';
import toast from 'react-hot-toast';

function mapFiscalTypeToBox(ft: string): string {
  return (AEAT_CLASSIFICATION_MAP as any)[ft] || '0106';
}
function mapBoxToCategoria(box: string): GastoCategoria {
  const m: Record<string, GastoCategoria> = { '0105': 'intereses', '0106': 'reparacion', '0109': 'comunidad', '0112': 'gestion', '0113': 'suministro', '0114': 'seguro', '0115': 'ibi', '0117': 'otro' };
  return m[box] || 'otro';
}

/**
 * Treasury Creation Service
 * 
 * Handles automatic creation of Treasury records from various sources:
 * - Contracts → Income (Ingresos)
 * - Payroll → Income (Ingresos)  
 * - OCR Documents → Expenses/Mejoras/Income routing
 */

// Utility function to get counterparty from document metadata with backward compatibility
const getCounterpartyFromMetadata = (metadata: any): string => {
  return metadata.counterpartyName || 
         metadata.contraparte || 
         metadata.proveedor || 
         'Contraparte no identificada';
};

// Contract to Income Generation
export const generateIncomeFromContract = async (contract: Contract): Promise<number[]> => {
  const db = await initDB();
  const createdIds: number[] = [];
  
  try {
    // Get property information for destination
    const property = await db.get('properties', contract.inmuebleId);
    if (!property) {
      throw new Error(`Property ${contract.inmuebleId} not found`);
    }

    // Generate income records for active contracts
    if (contract.status === 'active') {
      const today = new Date();
      const contractEnd = contract.endDate ? new Date(contract.endDate) : null;
      
      // Generate income for the next 12 months or until contract end
      const endDate = contractEnd && contractEnd < new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000) 
        ? contractEnd 
        : new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

      let currentDate = new Date(today);
      currentDate.setDate(contract.diaPago || contract.paymentDay || 1);
      
      // If payment day has passed this month, start next month
      if (currentDate <= today) {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      while (currentDate <= endDate) {
        const ingreso: Omit<Ingreso, 'id'> = {
          origen: 'contrato_id',
          origen_id: contract.id!,
          contraparte: `${contract.inquilino.nombre} ${contract.inquilino.apellidos}`,
          fecha_emision: currentDate.toISOString().split('T')[0],
          fecha_prevista_cobro: currentDate.toISOString().split('T')[0],
          importe: contract.rentaMensual || contract.monthlyRent || 0,
          moneda: 'EUR',
          destino: 'inmueble_id',
          destino_id: contract.propertyId,
          estado: 'previsto',
          from_doc: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const ingresoId = await db.add('ingresos', ingreso);
        createdIds.push(ingresoId as number);

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return createdIds;
  } catch (error) {
    console.error('Error generating income from contract:', error);
    throw error;
  }
};

// Payroll to Income Generation
export const generateIncomeFromPayroll = async (
  employerName: string,
  grossAmount: number,
  netAmount: number,
  payDate: string,
  payrollDocumentId?: number
): Promise<number> => {
  const db = await initDB();
  
  // Avoid unused variable warning
  console.log('Gross amount for reference:', grossAmount);
  
  try {
    const ingreso: Omit<Ingreso, 'id'> = {
      origen: 'nomina_id',
      origen_id: payrollDocumentId,
      contraparte: employerName,
      fecha_emision: payDate,
      fecha_prevista_cobro: payDate,
      importe: netAmount, // Net amount is what actually gets paid
      moneda: 'EUR',
      destino: 'personal',
      destino_id: undefined,
      estado: 'previsto',
      from_doc: !!payrollDocumentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ingresoId = await db.add('ingresos', ingreso);
    return ingresoId as number;
  } catch (error) {
    console.error('Error generating income from payroll:', error);
    throw error;
  }
};

// OCR Document Routing to Treasury
export const routeOCRDocumentToTreasury = async (document: Document): Promise<{
  type: 'ingreso' | 'gasto' | 'mejora' | 'none';
  recordId?: number;
  reason: string;
}> => {
  try {
    const { metadata } = document;
    const { financialData, aeatClassification, tipo } = metadata;

    // Skip if no financial data
    if (!financialData?.amount || financialData.amount <= 0) {
      return {
        type: 'none',
        reason: 'No financial amount detected'
      };
    }

    // Route based on document type and AEAT classification
    if (tipo === 'Mejora' || (aeatClassification?.fiscalType && isCapexType(aeatClassification.fiscalType))) {
      // Route to mejora — treat as gasto via mejorasInmueble
      const recordId = await createGastoFromDocument(document);
      return {
        type: 'mejora',
        recordId,
        reason: 'Document classified as mejora based on type or AEAT classification'
      };
    }

    // Check if it's an income document (receipts, rental income, etc.)
    const isIncomeDocument = 
      financialData.amount > 0 && (
        document.filename.toLowerCase().includes('ingreso') ||
        document.filename.toLowerCase().includes('cobro') ||
        document.filename.toLowerCase().includes('receipt') ||
        document.filename.toLowerCase().includes('recibo') ||
        getCounterpartyFromMetadata(metadata).toLowerCase().includes('inquilino')
      );

    if (isIncomeDocument) {
      // Route to Income
      const recordId = await createIngresoFromDocument(document);
      return {
        type: 'ingreso',
        recordId,
        reason: 'Document identified as income based on type or content'
      };
    }

    // Default: Route to Expenses
    const recordId = await createGastoFromDocument(document);
    return {
      type: 'gasto',
      recordId,
      reason: 'Document routed to expenses as default for financial documents'
    };

  } catch (error) {
    console.error('Error routing OCR document to treasury:', error);
    return {
      type: 'none',
      reason: `Error processing document: ${error}`
    };
  }
};

// Create Income from Document
const createIngresoFromDocument = async (document: Document): Promise<number> => {
  const db = await initDB();
  const { metadata } = document;
  const { financialData } = metadata;

  // Determine destination based on document metadata
  let destino: 'personal' | 'inmueble_id' = 'personal';
  let destino_id: number | undefined;

  // If it's related to a property, find the property
  if (metadata.entityType === 'property' && metadata.entityId) {
    destino = 'inmueble_id';
    destino_id = metadata.entityId;
  }

  const ingreso: Omit<Ingreso, 'id'> = {
    origen: 'doc_id',
    origen_id: document.id!,
    contraparte: getCounterpartyFromMetadata(metadata),
    fecha_emision: financialData?.issueDate || new Date().toISOString().split('T')[0],
    fecha_prevista_cobro: financialData?.dueDate || financialData?.issueDate || new Date().toISOString().split('T')[0],
    importe: financialData?.amount || 0,
    moneda: 'EUR',
    destino,
    destino_id,
    estado: 'previsto',
    from_doc: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const ingresoId = await db.add('ingresos', ingreso);
  return ingresoId as number;
};

// Create Expense from Document
const createGastoFromDocument = async (document: Document): Promise<number> => {
  const db = await initDB();
  const { metadata } = document;
  const { financialData, aeatClassification } = metadata;

  // Determine destination based on document metadata
  let destino: 'personal' | 'inmueble_id' = 'personal';
  let destino_id: number | undefined;

  if (metadata.entityType === 'property' && metadata.entityId) {
    destino = 'inmueble_id';
    destino_id = metadata.entityId;
  }

  const gasto: Omit<Gasto, 'id'> = {
    contraparte_nombre: getCounterpartyFromMetadata(metadata),
    contraparte_nif: undefined, // Could be extracted from OCR in the future
    fecha_emision: financialData?.issueDate || new Date().toISOString().split('T')[0],
    fecha_pago_prevista: financialData?.dueDate || financialData?.predictedPaymentDate || new Date().toISOString().split('T')[0],
    total: financialData?.amount || 0,
    base: financialData?.base,
    iva: financialData?.iva,
    categoria_AEAT: aeatClassification?.fiscalType || 'reparacion-conservacion', // Default category
    destino,
    destino_id,
    estado: 'completo',
    source_doc_id: document.id!,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Only create GastoInmueble if there's a propertyId — personal expenses don't go to this store
  if (!gasto.destino_id) return 0;

  const box = mapFiscalTypeToBox(gasto.categoria_AEAT);
  const gastoId = await gastosInmuebleService.add({
    inmuebleId: gasto.destino_id,
    ejercicio: new Date(gasto.fecha_emision).getFullYear(),
    fecha: gasto.fecha_emision,
    concepto: gasto.contraparte_nombre || 'Gasto tesorería',
    categoria: mapBoxToCategoria(box),
    casillaAEAT: box as any,
    importe: gasto.total,
    origen: 'tesoreria',
    origenId: gasto.source_doc_id ? `doc-${gasto.source_doc_id}` : undefined,
    estado: 'confirmado',
    proveedorNombre: gasto.contraparte_nombre,
    proveedorNIF: gasto.contraparte_nif,
    documentId: gasto.source_doc_id,
  });
  return gastoId as number;
};

// Reconciliation with Movements
export const reconcileTreasuryRecord = async (
  recordType: 'ingreso' | 'gasto' | 'mejora',
  recordId: number,
  movementId: number
): Promise<void> => {
  const db = await initDB();
  
  try {
    // Update the Treasury record with movement link
    if (recordType === 'ingreso') {
      const ingreso = await db.get('ingresos', recordId);
      if (ingreso) {
        ingreso.movement_id = movementId;
        ingreso.estado = 'cobrado';
        ingreso.updatedAt = new Date().toISOString();
        await db.put('ingresos', ingreso);
      }
    } else if (recordType === 'gasto') {
      await gastosInmuebleService.update(recordId, {
        movimientoId: String(movementId),
        estado: 'confirmado',
      });
    }
    // mejora reconciliation is handled via mejorasInmueble service

    // Update the Movement with reconciliation info
    const movement = await db.get('movements', movementId);
    if (movement) {
      movement.estado_conciliacion = 'conciliado';
      movement.linked_registro = {
        type: recordType,
        id: recordId
      };
      await db.put('movements', movement);
    }

    toast.success('Registro reconciliado con movimiento bancario');
  } catch (error) {
    console.error('Error reconciling treasury record:', error);
    toast.error('Error al reconciliar el registro');
    throw error;
  }
};

// Auto-reconciliation logic (finds potential matches)
export const findReconciliationMatches = async (): Promise<{
  movementId: number;
  potentialMatches: Array<{
    type: 'ingreso' | 'gasto' | 'mejora';
    id: number;
    confidence: number;
    reason: string;
  }>;
}[]> => {
  const db = await initDB();
  const matches: any[] = [];
  
  try {
    // Get unreconciled movements
    const movements = await db.getAll('movements');
    const unreconciledMovements = movements.filter(m => 
      !m.estado_conciliacion || m.estado_conciliacion === 'pendiente'
    );

    // Get unreconciled treasury records
    const [ingresos, allGastosInmueble] = await Promise.all([
      db.getAll('ingresos'),
      gastosInmuebleService.getAll(),
    ]);
    const mejoras: any[] = []; // mejoras loaded from mejorasInmueble if needed
    // Map gastosInmueble to Gasto-like shape for reconciliation
    const gastos = allGastosInmueble.map(g => ({
      id: g.id, contraparte_nombre: g.proveedorNombre || '', total: g.importe,
      fecha_emision: g.fecha, fecha_pago_prevista: g.fecha,
      movement_id: g.movimientoId ? Number(g.movimientoId) : undefined,
      estado: g.estado === 'confirmado' ? 'pagado' : 'pendiente',
    }));

    const unreconciledIngresos = ingresos.filter(i => !i.movement_id);
    const unreconciledGastos = gastos.filter(g => !g.movement_id);
    const unreconciledMejoras = mejoras.filter(c => !c.movement_id);

    // For each unreconciled movement, find potential matches
    for (const movement of unreconciledMovements) {
      const potentialMatches: any[] = [];

      // Check income matches (positive amounts)
      if (movement.amount > 0) {
        for (const ingreso of unreconciledIngresos) {
          const confidence = calculateMatchConfidence(movement, ingreso, 'ingreso');
          if (confidence > 0.5) {
            potentialMatches.push({
              type: 'ingreso',
              id: ingreso.id!,
              confidence,
              reason: getMatchReason(movement, ingreso, 'ingreso')
            });
          }
        }
      }

      // Check expense matches (negative amounts)
      if (movement.amount < 0) {        
        for (const gasto of unreconciledGastos) {
          const confidence = calculateMatchConfidence(movement, gasto, 'gasto');
          if (confidence > 0.5) {
            potentialMatches.push({
              type: 'gasto',
              id: gasto.id!,
              confidence,
              reason: getMatchReason(movement, gasto, 'gasto')
            });
          }
        }

        // mejoras reconciliation handled via mejorasInmueble service
      }

      if (potentialMatches.length > 0) {
        matches.push({
          movementId: movement.id!,
          potentialMatches: potentialMatches.sort((a, b) => b.confidence - a.confidence)
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('Error finding reconciliation matches:', error);
    return [];
  }
};

// Calculate match confidence between movement and treasury record
// Enhanced with AEAT criteria: ±0.50€, -10/+45 days, provider≈match
const calculateMatchConfidence = (movement: any, record: any, type: string): number => {
  let confidence = 0;
  let autoReconcile = true; // Track if meets auto-reconciliation criteria

  // Amount matching - AEAT criteria: ±0.50€
  const movementAmount = Math.abs(movement.amount);
  const recordAmount = type === 'ingreso' ? record.importe : record.total;
  const amountDiff = Math.abs(movementAmount - recordAmount);
  
  if (amountDiff === 0) {
    confidence += 0.5; // Exact amount match
  } else if (amountDiff <= 0.50) {
    confidence += 0.45; // Within ±0.50€ - AEAT auto-reconciliation criteria
  } else if (amountDiff <= 2.00) {
    confidence += 0.3; // Close amount but not auto-reconcilable
    autoReconcile = false;
  } else if (amountDiff / recordAmount < 0.05) {
    confidence += 0.2; // Close percentage but not auto-reconcilable
    autoReconcile = false;
  } else {
    autoReconcile = false;
  }

  // Date matching - AEAT criteria: -10/+45 days
  const movementDate = new Date(movement.date);
  const recordDate = new Date(
    type === 'ingreso' ? record.fecha_prevista_cobro : 
    type === 'gasto' ? record.fecha_pago_prevista : 
    record.fecha_emision
  );
  
  const daysDiff = (movementDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff === 0) {
    confidence += 0.3; // Same date
  } else if (daysDiff >= -10 && daysDiff <= 45) {
    confidence += 0.25; // Within AEAT auto-reconciliation window
  } else if (Math.abs(daysDiff) <= 7) {
    confidence += 0.2; // Close date but outside auto-reconciliation window
    autoReconcile = false;
  } else if (Math.abs(daysDiff) <= 30) {
    confidence += 0.1; // Moderate date difference
    autoReconcile = false;
  } else {
    autoReconcile = false;
  }

  // Provider/Description matching - AEAT criteria: provider≈match
  const description = movement.description.toLowerCase();
  const recordProvider = (
    type === 'ingreso' ? record.proveedor_contraparte :
    type === 'gasto' ? record.proveedor_nombre :
    record.proveedor
  )?.toLowerCase() || '';
  
  // Enhanced provider matching with fuzzy logic
  const providerMatchScore = calculateProviderMatch(description, recordProvider);
  
  if (providerMatchScore >= 0.8) {
    confidence += 0.2; // Strong provider match
  } else if (providerMatchScore >= 0.6) {
    confidence += 0.15; // Good provider match but may not be auto-reconcilable
    autoReconcile = false;
  } else if (providerMatchScore >= 0.3) {
    confidence += 0.05; // Weak provider match
    autoReconcile = false;
  } else {
    autoReconcile = false;
  }

  // Boost confidence if meets all AEAT auto-reconciliation criteria
  if (autoReconcile && confidence >= 0.8) {
    confidence = Math.min(confidence + 0.1, 1.0); // Bonus for auto-reconcilable matches
  }

  return Math.min(confidence, 1); // Cap at 1.0
};

// Enhanced provider matching with fuzzy logic
const calculateProviderMatch = (description: string, provider: string): number => {
  if (!description || !provider) return 0;
  
  // Exact match
  if (description === provider) return 1.0;
  
  // One contains the other
  if (description.includes(provider) || provider.includes(description)) {
    return 0.8;
  }
  
  // Word-based matching
  const descWords = description.split(/\s+/).filter(w => w.length > 2);
  const provWords = provider.split(/\s+/).filter(w => w.length > 2);
  
  if (descWords.length === 0 || provWords.length === 0) return 0;
  
  let matchingWords = 0;
  for (const word of descWords) {
    if (provWords.some(pw => pw.includes(word) || word.includes(pw))) {
      matchingWords++;
    }
  }
  
  const wordMatchRatio = matchingWords / Math.max(descWords.length, provWords.length);
  
  // Levenshtein-like similarity for short strings
  if (provider.length <= 10 && description.length <= 10) {
    const similarity = 1 - (levenshteinDistance(description, provider) / Math.max(description.length, provider.length));
    return Math.max(wordMatchRatio, similarity * 0.7);
  }
  
  return wordMatchRatio * 0.9;
};

// Simple Levenshtein distance calculation
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Generate match reason description with AEAT criteria details
const getMatchReason = (movement: any, record: any, type: string): string => {
  const reasons: string[] = [];
  
  const movementAmount = Math.abs(movement.amount);
  const recordAmount = type === 'ingreso' ? record.importe : record.total;
  const amountDiff = Math.abs(movementAmount - recordAmount);
  
  // Amount reasoning
  if (amountDiff === 0) {
    reasons.push('💰 Importe exacto');
  } else if (amountDiff <= 0.50) {
    reasons.push(`💰 Importe ±${amountDiff.toFixed(2)}€ (AEAT auto)`);
  } else if (amountDiff <= 2.00) {
    reasons.push(`💰 Importe ±${amountDiff.toFixed(2)}€`);
  }
  
  // Date reasoning
  const movementDate = new Date(movement.date);
  const recordDate = new Date(
    type === 'ingreso' ? record.fecha_prevista_cobro : 
    type === 'gasto' ? record.fecha_pago_prevista : 
    record.fecha_emision
  );
  
  const daysDiff = (movementDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff === 0) {
    reasons.push('📅 Fecha exacta');
  } else if (daysDiff >= -10 && daysDiff <= 45) {
    const sign = daysDiff > 0 ? '+' : '';
    reasons.push(`📅 ${sign}${Math.round(daysDiff)}d (AEAT auto)`);
  } else if (Math.abs(daysDiff) <= 30) {
    const sign = daysDiff > 0 ? '+' : '';
    reasons.push(`📅 ${sign}${Math.round(daysDiff)}d`);
  }
  
  // Provider reasoning
  const description = movement.description.toLowerCase();
  const recordProvider = (
    type === 'ingreso' ? record.proveedor_contraparte :
    type === 'gasto' ? record.proveedor_nombre :
    record.proveedor
  )?.toLowerCase() || '';
  
  const providerMatch = calculateProviderMatch(description, recordProvider);
  if (providerMatch >= 0.8) {
    reasons.push('🏢 Proveedor coincide');
  } else if (providerMatch >= 0.6) {
    reasons.push('🏢 Proveedor similar');
  } else if (providerMatch >= 0.3) {
    reasons.push('🏢 Proveedor parcial');
  }
  
  return reasons.join(' • ') || '🔍 Coincidencia detectada';
};

/**
 * Perform automatic reconciliation for high-confidence matches
 * Returns number of automatically reconciled records
 */
export const performAutoReconciliation = async (): Promise<{
  reconciled: number;
  details: Array<{
    movementId: number;
    recordType: 'ingreso' | 'gasto' | 'mejora';
    recordId: number;
    confidence: number;
    reason: string;
  }>;
}> => {
  const matches = await findReconciliationMatches();
  const reconciled: any[] = [];
  
  for (const match of matches) {
    // Only auto-reconcile if there's exactly one high-confidence match
    const highConfidenceMatches = match.potentialMatches.filter(m => m.confidence >= 0.85);
    
    if (highConfidenceMatches.length === 1) {
      const bestMatch = highConfidenceMatches[0];
      
      try {
        await reconcileTreasuryRecord(bestMatch.type, bestMatch.id, match.movementId);
        reconciled.push({
          movementId: match.movementId,
          recordType: bestMatch.type,
          recordId: bestMatch.id,
          confidence: bestMatch.confidence,
          reason: bestMatch.reason
        });
      } catch (error) {
        console.error('Auto-reconciliation failed:', error);
      }
    }
  }
  
  return {
    reconciled: reconciled.length,
    details: reconciled
  };
};

/**
 * Mark treasury record as paid without bank statement (cash/card payment)
 */
export const markAsPaidWithoutStatement = async (
  recordType: 'ingreso' | 'gasto' | 'mejora',
  recordId: number,
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Otros',
  paymentDate: string,
  notes?: string
): Promise<void> => {
  const db = await initDB();
  
  try {
    if (recordType === 'ingreso') {
      const ingreso = await db.get('ingresos', recordId);
      if (ingreso) {
        ingreso.estado = 'cobrado';
        ingreso.movement_id = -1; // Special ID to indicate paid without statement
        ingreso.updatedAt = new Date().toISOString();
        await db.put('ingresos', ingreso);
      }
    } else if (recordType === 'gasto') {
      await gastosInmuebleService.update(recordId, {
        estado: 'confirmado',
        movimientoId: '-1', // Special ID to indicate paid without statement
      });
    } else if (recordType === 'mejora') {
      // mejora payment is handled via mejorasInmueble service
      console.warn('[Treasury] markAsPaidWithoutStatement: mejora payment handled via mejorasInmueble, skipping', recordId);
    }

    toast.success(`Marcado como pagado ${paymentMethod.toLowerCase()}`);
  } catch (error) {
    console.error('Error marking as paid without statement:', error);
    toast.error('Error al marcar como pagado');
    throw error;
  }
};