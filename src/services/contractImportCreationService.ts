// Commit 7 · Creación efectiva de Contracts desde ContractDraft[].
//
// Todos los Contracts nacen en estado 'sin_firmar' (editables en su totalidad
// hasta que el usuario los marque activos). Tras crear cada uno se dispara
// boteAnualService.postContractCreated para preparar las sugerencias de
// vinculación retrospectiva en "Por conciliar".
import { initDB, Contract, Property } from './db';
import { saveContract, updateContract } from './contractService';
import { boteAnualService } from './boteAnualService';
import { ContractDraft } from './contractDraftService';

const FECHA_FIN_INDEFINIDO = '2099-12-31';
const EMAIL_PLACEHOLDER = 'pendiente@importado.local';

export interface ResultadoCreacion {
  creados: number;
  omitidos: number;
  fusionados: number;
  inquilinosNuevos: number;
  inmueblesAfectados: number[];   // ids únicos
  rentaMensualTotal: number;
  contractIdsCreados: number[];
  botesConSugerencia: number[];   // ids de bote únicos con sugerencia
}

export const resultadoVacio = (): ResultadoCreacion => ({
  creados: 0,
  omitidos: 0,
  fusionados: 0,
  inquilinosNuevos: 0,
  inmueblesAfectados: [],
  rentaMensualTotal: 0,
  contractIdsCreados: [],
  botesConSugerencia: [],
});

/** Combina dos resultados (para acumular las creaciones de las 3 secciones). */
export const combinarResultados = (a: ResultadoCreacion, b: ResultadoCreacion): ResultadoCreacion => ({
  creados: a.creados + b.creados,
  omitidos: a.omitidos + b.omitidos,
  fusionados: a.fusionados + b.fusionados,
  inquilinosNuevos: a.inquilinosNuevos + b.inquilinosNuevos,
  inmueblesAfectados: Array.from(new Set([...a.inmueblesAfectados, ...b.inmueblesAfectados])),
  rentaMensualTotal: a.rentaMensualTotal + b.rentaMensualTotal,
  contractIdsCreados: [...a.contractIdsCreados, ...b.contractIdsCreados],
  botesConSugerencia: Array.from(new Set([...a.botesConSugerencia, ...b.botesConSugerencia])),
});

// Divide el nombre completo en nombre + apellidos (último token = apellidos),
// coherente con el resto de imports para que el match por nombre sea estable.
const partirNombre = (full: string): { nombre: string; apellidos: string } => {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return { nombre: tokens[0] ?? 'Inquilino', apellidos: '' };
  return { nombre: tokens.slice(0, -1).join(' '), apellidos: tokens[tokens.length - 1] };
};

// Crea un inmueble mínimo cuando el usuario eligió "Crear inmueble nuevo" en la
// sección revisar. Apunte: es un alta mínima · el usuario completa el resto en
// el módulo de inmuebles (datos fiscales, dirección, etc.).
const crearInmuebleMinimo = async (raw: string): Promise<number> => {
  const db = await initDB();
  const nuevo: Omit<Property, 'id'> = {
    alias: (raw || 'Inmueble importado').slice(0, 60),
    address: raw || 'Pendiente de completar',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    squareMeters: 0,
    bedrooms: 0,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 0 },
    documents: [],
  };
  return (await db.add('properties', nuevo)) as number;
};

const construirPayload = (
  d: ContractDraft,
  inmuebleId: number,
): Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> => {
  const { nombre, apellidos } = partirNombre(d.inquilinoNombre);
  return {
    inmuebleId,
    unidadTipo: 'vivienda',
    modalidad: d.modalidadAtlas,
    inquilino: {
      nombre,
      apellidos,
      dni: d.inquilinoDni || '',
      telefono: d.inquilinoTelefono || '',
      email: d.inquilinoEmail || '',
      cotitulares: d.inquilinoCotitulares,
    },
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin || FECHA_FIN_INDEFINIDO,
    rentaMensual: d.rentaMensual,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: d.fianza > 0 && d.rentaMensual > 0 ? Number((d.fianza / d.rentaMensual).toFixed(2)) : 1,
    fianzaImporte: d.fianza,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0, // pendiente · se completa antes de activar
    estadoContrato: 'sin_firmar',
    origenImportacion: d.origen,
    // Legacy mirrors
    propertyId: inmuebleId,
    type: 'vivienda',
    tenant: { nif: d.inquilinoDni || '' },
    startDate: d.fechaInicio,
    endDate: d.fechaFin || FECHA_FIN_INDEFINIDO,
    monthlyRent: d.rentaMensual,
    paymentDay: 1,
    status: 'upcoming',
    documents: [],
  };
};

// Fusiona los datos adicionales del Excel en un Contract existente. Si el
// existente está SIN FIRMAR se actualiza todo; si ya está activo solo se
// rellenan los datos de contacto que falten (campos protegidos intactos).
const fusionarEnExistente = async (existenteId: number, d: ContractDraft): Promise<boolean> => {
  const db = await initDB();
  const existing = (await db.get('contracts', existenteId)) as Contract | undefined;
  if (!existing) return false;

  const sinFirmar = existing.estadoContrato === 'sin_firmar';
  const inq = { ...existing.inquilino };
  const emailVacio = !inq.email || inq.email === EMAIL_PLACEHOLDER;

  if (sinFirmar) {
    if (d.inquilinoEmail) inq.email = d.inquilinoEmail;
    if (d.inquilinoTelefono) inq.telefono = d.inquilinoTelefono;
    if (d.inquilinoDni) inq.dni = d.inquilinoDni;
  } else {
    // Activo · solo rellenar contacto que falte · NUNCA renta/fechas.
    if (d.inquilinoEmail && emailVacio) inq.email = d.inquilinoEmail;
    if (d.inquilinoTelefono && !inq.telefono) inq.telefono = d.inquilinoTelefono;
    if (d.inquilinoDni && !inq.dni) inq.dni = d.inquilinoDni;
  }

  const updates: Partial<Contract> = { inquilino: inq };
  if (sinFirmar) {
    updates.rentaMensual = d.rentaMensual;
    updates.monthlyRent = d.rentaMensual;
    updates.fechaInicio = d.fechaInicio;
    updates.fechaFin = d.fechaFin || FECHA_FIN_INDEFINIDO;
    updates.fianzaImporte = d.fianza;
  }

  await updateContract(existenteId, updates);
  return true;
};

/**
 * Crea Contracts a partir de una lista de drafts (típicamente una sección del
 * paso 3). Respeta la decisión de los duplicados y resuelve el inmueble.
 */
export const crearContractsDesdeDrafts = async (drafts: ContractDraft[]): Promise<ResultadoCreacion> => {
  const r = resultadoVacio();
  const inmueblesSet = new Set<number>();
  const botesSet = new Set<number>();

  for (const d of drafts) {
    // Duplicados · aplicar decisión.
    if (d.seccion === 'duplicados') {
      const decision = d.decisionDuplicado ?? 'omitir';
      if (decision === 'omitir') { r.omitidos += 1; continue; }
      if (decision === 'fusionar' && d.inquilinoExistenteId != null) {
        const ok = await fusionarEnExistente(d.inquilinoExistenteId, d);
        if (ok) { r.fusionados += 1; continue; }
        // si el existente desapareció · cae a creación normal
      }
      // 'crear_nuevo' (o fusionar fallido) → flujo de creación normal
    }

    // Resolver inmueble.
    let inmuebleId = d.crearInmuebleNuevo
      ? await crearInmuebleMinimo(d.inmuebleRaw)
      : d.inmuebleIdConfirmado ?? d.inmuebleIdSugerido;

    if (inmuebleId == null) { r.omitidos += 1; continue; }

    const id = await saveContract(construirPayload(d, inmuebleId));
    r.contractIdsCreados.push(id);
    r.creados += 1;
    if (d.inquilinoExistenteId == null) r.inquilinosNuevos += 1;
    r.rentaMensualTotal += d.rentaMensual;
    inmueblesSet.add(inmuebleId);

    const { botesSugeridos } = await boteAnualService.postContractCreated(id);
    botesSugeridos.forEach((b) => botesSet.add(b));
  }

  r.inmueblesAfectados = Array.from(inmueblesSet);
  r.botesConSugerencia = Array.from(botesSet);
  return r;
};
