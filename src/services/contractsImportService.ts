import { initDB, Contract, Property, Account } from './db';
import { saveContract, updateContract } from './contractService';

export interface RentilaImportRow {
  idExterno?: string;
  propiedad: string;
  tipo?: string;
  inicioAlquiler: string;
  finAlquiler: string;
  nombreCompania: string;
  alquiler: number;
  fianza?: number;
  comentarios?: string;
  otrosGastos?: number;
  gastos?: number;
}

export interface RentilaImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const parseTenantName = (fullName: string): { nombre: string; apellidos: string } => {
  const trimmed = fullName.trim();
  if (!trimmed) return { nombre: 'Inquilino', apellidos: 'Importado' };

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { nombre: tokens[0], apellidos: '' };

  return {
    nombre: tokens.slice(0, -1).join(' '),
    apellidos: tokens[tokens.length - 1],
  };
};

const mapContractType = (tipo: string | undefined): { unidadTipo: Contract['unidadTipo']; modalidad: Contract['modalidad'] } => {
  const normalized = normalizeText(tipo || '');

  const unidadTipo: Contract['unidadTipo'] = normalized.includes('habitacion') ? 'habitacion' : 'vivienda';

  if (normalized.includes('vacacional')) {
    return { unidadTipo, modalidad: 'vacacional' };
  }

  if (normalized.includes('temporada')) {
    return { unidadTipo, modalidad: 'temporada' };
  }

  return { unidadTipo, modalidad: 'habitual' };
};

const inferEstadoContrato = (fechaFin: string): Contract['estadoContrato'] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(fechaFin);
  end.setHours(0, 0, 0, 0);

  return end < today ? 'finalizado' : 'activo';
};

const buildPropertyMap = (properties: Property[]): Map<string, Property> => {
  const map = new Map<string, Property>();

  properties.forEach((property) => {
    const candidates = [property.alias, property.globalAlias, property.address].filter(Boolean) as string[];
    candidates.forEach((name) => {
      map.set(normalizeText(name), property);
    });
  });

  return map;
};

const findPropertyByName = (map: Map<string, Property>, name: string): Property | undefined => {
  const normalized = normalizeText(name);
  if (map.has(normalized)) return map.get(normalized);

  for (const [key, value] of Array.from(map.entries())) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }

  return undefined;
};

export const importContractsFromRentilaRows = async (
  rows: RentilaImportRow[],
  cuentaCobroId: number
): Promise<RentilaImportResult> => {
  const db = await initDB();
  const [properties, existingContracts] = await Promise.all([
    db.getAll('properties'),
    db.getAll('contracts'),
  ]);

  const propertyMap = buildPropertyMap(properties);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (!row.propiedad || !row.inicioAlquiler || !row.finAlquiler || !row.nombreCompania || !row.alquiler) {
        skipped++;
        continue;
      }

      const property = findPropertyByName(propertyMap, row.propiedad);
      if (!property?.id) {
        errors.push(`No se encontró inmueble para "${row.propiedad}"`);
        skipped++;
        continue;
      }

      const { nombre, apellidos } = parseTenantName(row.nombreCompania);
      const typeData = mapContractType(row.tipo);
      const estadoContrato = inferEstadoContrato(row.finAlquiler);

      const existing = existingContracts.find((contract) =>
        contract.inmuebleId === property.id &&
        contract.inquilino?.nombre === nombre &&
        contract.inquilino?.apellidos === apellidos &&
        contract.fechaInicio === row.inicioAlquiler
      );

      const payload: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> = {
        inmuebleId: property.id,
        unidadTipo: typeData.unidadTipo,
        modalidad: typeData.modalidad,
        inquilino: {
          nombre,
          apellidos,
          dni: row.idExterno ? `IMP-${row.idExterno}` : `IMP-${property.id}-${row.inicioAlquiler}`,
          telefono: 'pendiente',
          email: 'pendiente@importado.local',
        },
        fechaInicio: row.inicioAlquiler,
        fechaFin: row.finAlquiler,
        rentaMensual: row.alquiler,
        diaPago: 1,
        margenGraciaDias: 5,
        indexacion: 'none',
        historicoIndexaciones: [],
        fianzaMeses: row.fianza && row.alquiler > 0 ? Number((row.fianza / row.alquiler).toFixed(2)) : 1,
        fianzaImporte: row.fianza || 0,
        fianzaEstado: 'retenida',
        cuentaCobroId,
        estadoContrato,
        propertyId: property.id,
        type: typeData.unidadTipo,
        startDate: row.inicioAlquiler,
        endDate: row.finAlquiler,
        monthlyRent: row.alquiler,
        paymentDay: 1,
        status: estadoContrato === 'finalizado' ? 'terminated' : 'active',
        privateNotes: row.comentarios,
        documents: [],
      };

      if (existing?.id) {
        await updateContract(existing.id, payload);
        updated++;
      } else {
        await saveContract(payload);
        imported++;
      }
    } catch (error) {
      errors.push(`Error en contrato "${row.nombreCompania}": ${error instanceof Error ? error.message : 'desconocido'}`);
      skipped++;
    }
  }

  return { imported, updated, skipped, errors };
};

export const getAvailableAccounts = async (): Promise<Account[]> => {
  const db = await initDB();
  const accounts = await db.getAll('accounts');
  return accounts.filter((account) => (account.status === 'ACTIVE' || account.activa) && !!account.id);
};
