import {
  Contract,
  Property,
  PropertySale,
  PropertySaleContractSnapshot,
  initDB,
} from './db';
import { recalculateAccountBalance } from './treasuryEventsService';

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
  destinationAccountId?: number;
  notes?: string;
  autoTerminateContracts?: boolean;
}

export interface PrepareSaleResult {
  property: Property;
  activeContracts: Contract[];
}

const isActiveContract = (contract: Contract): boolean => {
  if (contract.estadoContrato === 'activo' || contract.status === 'active') return true;

  const endDate = contract.fechaFin || contract.endDate;
  if (!endDate) return false;

  const end = new Date(endDate);
  const now = new Date();
  return !Number.isNaN(end.getTime()) && end >= now;
};

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

export const preparePropertySale = async (propertyId: number): Promise<PrepareSaleResult> => {
  const db = await initDB();
  const property = await db.get('properties', propertyId);

  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const contracts = await db.getAll('contracts');
  const activeContracts = contracts.filter(
    (contract) => (contract.inmuebleId === propertyId || contract.propertyId === propertyId) && isActiveContract(contract)
  );

  return { property, activeContracts };
};

export const getLatestConfirmedSaleForProperty = async (propertyId: number): Promise<PropertySale | null> => {
  const db = await initDB();
  const sales = await db.getAll('property_sales');
  const confirmedSales = sales
    .filter((sale) => sale.propertyId === propertyId && sale.status === 'confirmed')
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

  return confirmedSales[0] || null;
};

export const cancelPropertySale = async (saleId: number, userId: string = 'system'): Promise<PropertySale> => {
  const db = await initDB();
  const tx = db.transaction(['property_sales', 'properties', 'contracts', 'movements'], 'readwrite');

  const sale = await tx.objectStore('property_sales').get(saleId);
  if (!sale) {
    throw new Error('No se encontró la venta para anular');
  }

  if (sale.status !== 'confirmed') {
    throw new Error('Solo se pueden anular ventas confirmadas');
  }

  const property = await tx.objectStore('properties').get(sale.propertyId);
  if (!property) {
    throw new Error('No se encontró el inmueble asociado a la venta');
  }

  if (sale.treasuryMovementIds?.length) {
    for (const movementId of sale.treasuryMovementIds) {
      await tx.objectStore('movements').delete(movementId);
    }
  }

  if (sale.autoTerminatedContractSnapshots?.length) {
    for (const snapshot of sale.autoTerminatedContractSnapshots) {
      const contract = await tx.objectStore('contracts').get(snapshot.contractId);
      if (!contract) continue;

      await tx.objectStore('contracts').put({
        ...contract,
        fechaFin: snapshot.previousFechaFin || contract.fechaFin,
        endDate: snapshot.previousEndDate || contract.endDate,
        estadoContrato: snapshot.previousEstadoContrato || 'activo',
        status: snapshot.previousStatus || 'active',
        rescision: snapshot.previousRescision,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const restoredProperty: Property = {
    ...property,
    state: 'activo',
    notes: [property.notes, `Venta anulada (${saleId}) el ${new Date().toISOString().slice(0, 10)}.`].filter(Boolean).join(' | '),
  };

  const revertedSale: PropertySale = {
    ...sale,
    status: 'reverted',
    revertedAt: new Date().toISOString(),
    revertedBy: userId,
    updatedAt: new Date().toISOString(),
  };

  await tx.objectStore('properties').put(restoredProperty);
  await tx.objectStore('property_sales').put(revertedSale);
  await tx.done;

  if (sale.destinationAccountId) {
    await recalculateAccountBalance(sale.destinationAccountId);
  }

  return revertedSale;
};

export const confirmPropertySale = async (input: ConfirmPropertySaleInput): Promise<PropertySale> => {
  if (!input.saleDate) {
    throw new Error('La fecha de venta es obligatoria');
  }

  if (!input.salePrice || input.salePrice <= 0) {
    throw new Error('El precio de venta debe ser mayor que 0');
  }

  const db = await initDB();
  const tx = db.transaction(['properties', 'contracts', 'property_sales', 'accounts', 'movements'], 'readwrite');

  const property = await tx.objectStore('properties').get(input.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  if (property.state !== 'activo') {
    throw new Error('Solo se pueden vender inmuebles activos');
  }

  const allContracts = await tx.objectStore('contracts').getAll();
  const activeContracts = allContracts.filter(
    (contract) => (contract.inmuebleId === input.propertyId || contract.propertyId === input.propertyId) && isActiveContract(contract)
  );

  if (activeContracts.length > 0 && !input.autoTerminateContracts) {
    throw new Error('Existen contratos activos. Ciérralos antes de vender o activa el cierre automático.');
  }

  const autoTerminatedContractSnapshots: PropertySaleContractSnapshot[] = [];

  if (activeContracts.length > 0 && input.autoTerminateContracts) {
    for (const contract of activeContracts) {
      if (!contract.id) continue;

      autoTerminatedContractSnapshots.push({
        contractId: contract.id,
        previousFechaFin: contract.fechaFin,
        previousEndDate: contract.endDate,
        previousEstadoContrato: contract.estadoContrato,
        previousStatus: contract.status,
        previousRescision: contract.rescision,
      });

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

  const accounts = await tx.objectStore('accounts').getAll();
  const selectedAccount = input.destinationAccountId
    ? accounts.find((acc) => acc.id === input.destinationAccountId)
    : accounts.find((acc) => acc.isDefault && acc.status === 'ACTIVE');

  if (!selectedAccount?.id) {
    throw new Error('Selecciona una cuenta de tesorería de destino para registrar la venta.');
  }

  const movementIds: number[] = [];
  const movementBase = {
    accountId: selectedAccount.id,
    date: input.saleDate,
    valueDate: input.saleDate,
    status: 'pendiente' as const,
    unifiedStatus: 'confirmado' as const,
    source: 'manual' as const,
    category: { tipo: 'Venta inmueble', subtipo: property.alias },
    type: 'Ajuste' as const,
    origin: 'Manual' as const,
    movementState: 'Confirmado' as const,
    ambito: 'INMUEBLE' as const,
    inmuebleId: String(input.propertyId),
    statusConciliacion: 'sin_match' as const,
    createdAt: now,
    updatedAt: now,
  };

  const grossMovementId = await tx.objectStore('movements').add({
    ...movementBase,
    amount: simulation.grossProceeds,
    description: `Venta inmueble ${property.alias} (entrada bruta)`,
    counterparty: 'Comprador inmueble',
  } as any);
  if (typeof grossMovementId === 'number') movementIds.push(grossMovementId);

  if (simulation.totalSaleCosts > 0) {
    const costsMovementId = await tx.objectStore('movements').add({
      ...movementBase,
      amount: -Math.abs(simulation.totalSaleCosts),
      description: `Venta inmueble ${property.alias} (gastos de venta)`,
      counterparty: 'Gastos compraventa',
    } as any);
    if (typeof costsMovementId === 'number') movementIds.push(costsMovementId);
  }

  if (simulation.totalLoanSettlement > 0) {
    const debtMovementId = await tx.objectStore('movements').add({
      ...movementBase,
      amount: -Math.abs(simulation.totalLoanSettlement),
      description: `Venta inmueble ${property.alias} (cancelación deuda)`,
      counterparty: 'Entidad financiera',
    } as any);
    if (typeof debtMovementId === 'number') movementIds.push(debtMovementId);
  }

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
    destinationAccountId: selectedAccount.id,
    treasuryMovementIds: movementIds,
    autoTerminatedContractSnapshots,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  const rawSaleId = await tx.objectStore('property_sales').add(sale);
  const saleId = typeof rawSaleId === 'number' ? rawSaleId : undefined;

  const updatedProperty: Property = {
    ...property,
    state: 'vendido',
    notes: [property.notes, `Vendido el ${input.saleDate}.${saleId ? ` SaleId: ${saleId}.` : ''}`].filter(Boolean).join(' | '),
  };

  await tx.objectStore('properties').put(updatedProperty);
  await tx.done;

  await recalculateAccountBalance(selectedAccount.id);

  return {
    ...sale,
    id: saleId,
  };
};
