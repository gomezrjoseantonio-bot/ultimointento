import { Contract, Property, initDB, PropertySale } from './db';
import { triggerTreasuryUpdate } from './treasuryEventsService';

export interface SaleSimulationInput {
  salePrice: number;
  agencyCommission?: number;
  municipalTax?: number;
  saleNotaryCosts?: number;
  loanPayoffAmount?: number;
  loanCancellationFee?: number;
  otherCosts?: number;
}

export interface ConfirmPropertySaleInput extends SaleSimulationInput {
  propertyId: number;
  saleDate: string;
  source: 'cartera' | 'detalle' | 'analisis';
  settlementAccountId?: number;
  notes?: string;
  autoTerminateContracts?: boolean;
}

export interface PrepareSaleResult {
  property: Property;
  activeContracts: Contract[];
}

interface SaleExecutionJournal {
  settlementAccountId?: number;
  movementIds: number[];
  autoTerminatedContracts: Array<{ id: number; previous: Contract }>;
  updatedLoans: Array<{ id: string; previous: Record<string, unknown> }>;
}

const isActiveContract = (contract: Contract, referenceDateIso?: string): boolean => {
  const referenceDate = referenceDateIso ? new Date(referenceDateIso) : new Date();
  if (Number.isNaN(referenceDate.getTime())) return false;

  const startDate = contract.fechaInicio || contract.startDate;
  const endDate = contract.fechaFin || contract.endDate;

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime()) && parsedStart > referenceDate) {
      return false;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime()) && parsedEnd < referenceDate) {
      return false;
    }
  }

  if (contract.estadoContrato === 'rescindido' || contract.status === 'terminated') {
    return false;
  }

  if (contract.estadoContrato === 'activo' || contract.status === 'active') {
    return true;
  }

  return !endDate;
};

const createTreasuryMovement = ({
  accountId,
  amount,
  date,
  description,
  propertyId,
  saleId,
}: {
  accountId: number;
  amount: number;
  date: string;
  description: string;
  propertyId: number;
  saleId: number;
}) => ({
  accountId,
  date,
  valueDate: date,
  amount,
  description,
  counterparty: 'Venta inmueble',
  reference: `property_sale:${saleId}`,
  status: 'conciliado' as const,
  unifiedStatus: 'conciliado' as const,
  source: 'manual' as const,
  category: {
    tipo: amount >= 0 ? 'Venta inmueble' : 'Costes venta inmueble',
  },
  type: amount >= 0 ? 'Ingreso' as const : 'Gasto' as const,
  origin: 'Manual' as const,
  movementState: 'Conciliado' as const,
  ambito: 'INMUEBLE' as const,
  inmuebleId: String(propertyId),
  statusConciliacion: 'match_manual' as const,
  tags: ['property_sale'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const simulatePropertySale = (input: SaleSimulationInput) => {
  const salePrice = Number(input.salePrice || 0);
  const agencyCommission = Number(input.agencyCommission || 0);
  const municipalTax = Number(input.municipalTax || 0);
  const saleNotaryCosts = Number(input.saleNotaryCosts || 0);
  const loanPayoffAmount = Number(input.loanPayoffAmount || 0);
  const loanCancellationFee = Number(input.loanCancellationFee || 0);
  const otherCosts = Number(input.otherCosts || 0);

  const totalSaleCosts = agencyCommission + municipalTax + saleNotaryCosts + otherCosts;
  const totalLoanSettlement = loanPayoffAmount + loanCancellationFee;
  const netProceeds = salePrice - totalSaleCosts - totalLoanSettlement;

  return {
    grossProceeds: salePrice,
    totalSaleCosts,
    totalLoanSettlement,
    netProceeds,
  };
};

export const preparePropertySale = async (propertyId: number, saleDate?: string): Promise<PrepareSaleResult> => {
  const db = await initDB();
  const property = await db.get('properties', propertyId);

  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const contracts = await db.getAll('contracts');
  const activeContracts = contracts.filter(
    (contract) =>
      (contract.inmuebleId === propertyId || contract.propertyId === propertyId) &&
      isActiveContract(contract, saleDate)
  );

  return { property, activeContracts };
};

export const confirmPropertySale = async (input: ConfirmPropertySaleInput): Promise<PropertySale> => {
  if (!input.saleDate) {
    throw new Error('La fecha de venta es obligatoria');
  }

  if (!input.salePrice || input.salePrice <= 0) {
    throw new Error('El precio de venta debe ser mayor que 0');
  }

  const db = await initDB();
  const tx = db.transaction(['properties', 'contracts', 'property_sales', 'accounts', 'movements', 'prestamos'], 'readwrite');

  const property = await tx.objectStore('properties').get(input.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  if (property.state !== 'activo') {
    throw new Error('Solo se pueden vender inmuebles activos');
  }

  const allContracts = await tx.objectStore('contracts').getAll();
  const activeContracts = allContracts.filter(
    (contract) =>
      (contract.inmuebleId === input.propertyId || contract.propertyId === input.propertyId) &&
      isActiveContract(contract, input.saleDate)
  );

  if (input.settlementAccountId !== undefined) {
    const settlementAccount = await tx.objectStore('accounts').get(input.settlementAccountId);
    if (!settlementAccount || settlementAccount.deleted_at || settlementAccount.isActive === false) {
      throw new Error('Selecciona una cuenta de tesorería válida para registrar la venta');
    }
  }

  if (activeContracts.length > 0 && !input.autoTerminateContracts) {
    throw new Error('Existen contratos activos. Ciérralos antes de vender o activa el cierre automático.');
  }

  const autoTerminatedContracts: SaleExecutionJournal['autoTerminatedContracts'] = [];
  if (activeContracts.length > 0 && input.autoTerminateContracts) {
    for (const contract of activeContracts) {
      if (typeof contract.id !== 'number') {
        continue;
      }
      autoTerminatedContracts.push({ id: contract.id, previous: contract });
      await tx.objectStore('contracts').put({
        ...contract,
        fechaFin: input.saleDate,
        endDate: input.saleDate,
        estadoContrato: 'rescindido',
        status: 'terminated',
        rescision: {
          fecha: input.saleDate,
          motivo: 'Venta del inmueble',
        },
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const simulation = simulatePropertySale(input);
  const now = new Date().toISOString();

  const sale: Omit<PropertySale, 'id'> = {
    propertyId: input.propertyId,
    saleDate: input.saleDate,
    salePrice: input.salePrice,
    saleCosts: {
      agencyCommission: Number(input.agencyCommission || 0),
      municipalTax: Number(input.municipalTax || 0),
      saleNotaryCosts: Number(input.saleNotaryCosts || 0),
      otherCosts: Number(input.otherCosts || 0),
    },
    loanSettlement: {
      payoffAmount: Number(input.loanPayoffAmount || 0),
      cancellationFee: Number(input.loanCancellationFee || 0),
      total: simulation.totalLoanSettlement,
    },
    grossProceeds: simulation.grossProceeds,
    netProceeds: simulation.netProceeds,
    status: 'confirmed',
    source: input.source,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  const rawSaleId = await tx.objectStore('property_sales').add(sale);
  const saleId = typeof rawSaleId === 'number' ? rawSaleId : undefined;

  const executionJournal: SaleExecutionJournal = {
    settlementAccountId: input.settlementAccountId,
    movementIds: [],
    autoTerminatedContracts,
    updatedLoans: [],
  };

  if (saleId && input.settlementAccountId !== undefined) {
    const saleCostsTotal = simulation.totalSaleCosts;
    const loanSettlementTotal = simulation.totalLoanSettlement;
    const movementStore = tx.objectStore('movements');

    const movementsToCreate = [
      createTreasuryMovement({
        accountId: input.settlementAccountId,
        amount: simulation.grossProceeds,
        date: input.saleDate,
        description: `Cobro venta inmueble #${input.propertyId}`,
        propertyId: input.propertyId,
        saleId,
      }),
      ...(saleCostsTotal > 0
        ? [
            createTreasuryMovement({
              accountId: input.settlementAccountId,
              amount: -saleCostsTotal,
              date: input.saleDate,
              description: `Costes venta inmueble #${input.propertyId}`,
              propertyId: input.propertyId,
              saleId,
            }),
          ]
        : []),
      ...(loanSettlementTotal > 0
        ? [
            createTreasuryMovement({
              accountId: input.settlementAccountId,
              amount: -loanSettlementTotal,
              date: input.saleDate,
              description: `Cancelación deuda inmueble #${input.propertyId}`,
              propertyId: input.propertyId,
              saleId,
            }),
          ]
        : []),
    ];

    for (const movement of movementsToCreate) {
      const createdId = await movementStore.add(movement);
      if (typeof createdId === 'number') {
        executionJournal.movementIds.push(createdId);
      }
    }
  }

  const loanStore = tx.objectStore('prestamos');
  const allLoans = await loanStore.getAll();
  const propertyIdAsString = String(input.propertyId);
  const linkedLoans = allLoans.filter((loan: any) => {
    if (!loan || typeof loan !== 'object') return false;
    if (loan.inmuebleId && String(loan.inmuebleId) === propertyIdAsString) return true;
    if (Array.isArray(loan.afectacionesInmueble)) {
      return loan.afectacionesInmueble.some((item: any) => String(item?.inmuebleId) === propertyIdAsString);
    }
    return false;
  });

  for (const loan of linkedLoans) {
    if (!loan?.id) continue;
    executionJournal.updatedLoans.push({ id: loan.id, previous: loan });
    await loanStore.put({
      ...loan,
      activo: false,
      principalVivo: input.loanPayoffAmount && input.loanPayoffAmount > 0 ? 0 : loan.principalVivo,
      fechaUltimaCuotaPagada: input.saleDate,
      updatedAt: new Date().toISOString(),
    });
  }

  const updatedProperty: Property = {
    ...property,
    state: 'vendido',
    notes: [property.notes, `Vendido el ${input.saleDate}.${saleId ? ` SaleId: ${saleId}.` : ''}`].filter(Boolean).join(' | '),
  };

  await tx.objectStore('properties').put(updatedProperty);
  if (saleId) {
    await tx.objectStore('property_sales').put({
      ...sale,
      id: saleId,
      notes: [sale.notes, `executionJournal:${JSON.stringify(executionJournal)}`].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;

  if (input.settlementAccountId !== undefined) {
    await triggerTreasuryUpdate([input.settlementAccountId]);
  }

  return {
    ...sale,
    id: saleId,
  };
};


export const getLatestConfirmedSaleForProperty = async (propertyId: number): Promise<PropertySale | null> => {
  const db = await initDB();
  const sales = await db.getAllFromIndex('property_sales', 'property-status', [propertyId, 'confirmed']);

  if (!sales.length) {
    return null;
  }

  return sales
    .slice()
    .sort((a, b) => {
      const aSaleDate = new Date(a.saleDate).getTime();
      const bSaleDate = new Date(b.saleDate).getTime();

      if (aSaleDate !== bSaleDate) {
        return bSaleDate - aSaleDate;
      }

      const aCreatedAt = new Date(a.createdAt).getTime();
      const bCreatedAt = new Date(b.createdAt).getTime();
      return bCreatedAt - aCreatedAt;
    })[0];
};

export const cancelPropertySale = async (saleId: number): Promise<PropertySale> => {
  const db = await initDB();
  const tx = db.transaction(['properties', 'property_sales', 'contracts', 'movements', 'prestamos'], 'readwrite');

  const saleStore = tx.objectStore('property_sales');
  const propertyStore = tx.objectStore('properties');

  const sale = await saleStore.get(saleId);
  if (!sale) {
    throw new Error('No se encontró la venta seleccionada');
  }

  if (sale.status !== 'confirmed') {
    throw new Error('Solo se pueden anular ventas confirmadas');
  }

  const property = await propertyStore.get(sale.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const extractJournalFromNotes = (): SaleExecutionJournal | null => {
    if (!sale.notes) return null;
    const marker = 'executionJournal:';
    const markerIndex = sale.notes.lastIndexOf(marker);
    if (markerIndex === -1) return null;
    const payload = sale.notes.slice(markerIndex + marker.length).trim();
    try {
      return JSON.parse(payload) as SaleExecutionJournal;
    } catch {
      return null;
    }
  };

  const journal = extractJournalFromNotes();

  if (journal?.movementIds?.length) {
    for (const movementId of journal.movementIds) {
      await tx.objectStore('movements').delete(movementId);
    }
  }

  if (journal?.autoTerminatedContracts?.length) {
    for (const snapshot of journal.autoTerminatedContracts) {
      await tx.objectStore('contracts').put(snapshot.previous);
    }
  }

  if (journal?.updatedLoans?.length) {
    for (const snapshot of journal.updatedLoans) {
      await tx.objectStore('prestamos').put(snapshot.previous as any);
    }
  }

  const now = new Date().toISOString();
  const revertedSale: PropertySale = {
    ...sale,
    status: 'reverted',
    updatedAt: now,
    notes: [sale.notes, `Venta anulada el ${now}.`].filter(Boolean).join(' | '),
  };

  await saleStore.put(revertedSale);
  await propertyStore.put({
    ...property,
    state: 'activo',
    notes: [property.notes, `Reactivado por anulación de venta (${sale.saleDate}).`].filter(Boolean).join(' | '),
  });

  await tx.done;

  if (journal?.settlementAccountId !== undefined) {
    await triggerTreasuryUpdate([journal.settlementAccountId]);
  }

  return revertedSale;
};
