import { initDB } from './db';
import { getContractsByProperty, updateContract } from './contractService';

// Parse a YYYY-MM-DD string as a UTC date to avoid timezone-induced off-by-one errors
function parseUTCDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  const parsedDate = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== y ||
    parsedDate.getUTCMonth() !== m - 1 ||
    parsedDate.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: "${dateStr}". Expected a real YYYY-MM-DD date.`);
  }

  return parsedDate;
}

export interface ContratoPropuesta {
  contratoId: number;
  inquilinoNombre: string;
  inquilinoDni?: string;
  habitacionId?: string;
  fechaInicio: string;
  fechaFin: string;
  fechaFinEfectiva: string; // fechaFin capped to end of ejercicio (YYYY-MM-DD)
  rentaMensual: number;
  diasActivosEnEjercicio: number;
  importePropuesto: number;
  importeAsignado: number;
}

export interface PropuestaDistribucion {
  inmuebleId: number;
  ejercicio: number;
  importeDeclarado: number;
  contratos: ContratoPropuesta[];
  totalPropuesto: number;
  diferencia: number;
  nifsDetectados: string[];
}

export async function calcularPropostaDistribucion(
  sinIdentificadorId: number,
  ejercicio: number
): Promise<PropuestaDistribucion> {
  const db = await initDB();

  const sinId = await db.get('contracts', sinIdentificadorId);
  if (!sinId || sinId.estadoContrato !== 'sin_identificar') {
    throw new Error('Contrato sin_identificar no encontrado');
  }

  const ejercicioData = sinId.ejerciciosFiscales?.[ejercicio];
  const importeDeclarado = ejercicioData?.importeDeclarado ?? 0;
  const nifsDetectados = ejercicioData?.nifsDetectados ?? [];
  if (importeDeclarado === 0) {
    return {
      inmuebleId: sinId.inmuebleId,
      ejercicio,
      importeDeclarado: 0,
      contratos: [],
      totalPropuesto: 0,
      diferencia: 0,
      nifsDetectados,
    };
  }

  const todosContratos = await getContractsByProperty(sinId.inmuebleId);
  const contratosReales = todosContratos.filter(
    (c) => c.estadoContrato !== 'sin_identificar' && c.id !== sinIdentificadorId
  );

  // Use Date.UTC to build boundary dates — avoids timezone-induced off-by-one errors
  const inicioEjercicio = new Date(Date.UTC(ejercicio, 0, 1));  // Jan 1
  const finEjercicio = new Date(Date.UTC(ejercicio, 11, 31));   // Dec 31
  const finEjercicioStr = `${ejercicio}-12-31`;

  const propuestas: ContratoPropuesta[] = [];

  for (const contrato of contratosReales) {
    const inicio = parseUTCDate(contrato.fechaInicio);
    const fin = parseUTCDate(contrato.fechaFin);

    const inicioEfectivo = inicio > inicioEjercicio ? inicio : inicioEjercicio;
    const finEfectivo = fin < finEjercicio ? fin : finEjercicio;

    if (inicioEfectivo > finEfectivo) continue;

    const diasActivos =
      Math.round((finEfectivo.getTime() - inicioEfectivo.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // F-drawer: leer importe real del contrato para ese año,
    // sumando sus rentaMensual del ejercicio.
    const todasRentas = await db.getAllFromIndex('rentaMensual', 'contratoId', contrato.id!);
    const importeRealAño = todasRentas
      .filter(r => r.periodo.startsWith(String(ejercicio)))
      .reduce((sum, r) => sum + (r.importePrevisto || 0), 0);

    // Si el contrato no tiene rentaMensual en ese año (porque el año está declarado
    // y F3 impide generarlas), caer al cálculo clásico: rentaMensual × 12 × días/365
    const esBisiesto = (ejercicio % 4 === 0 && ejercicio % 100 !== 0) || ejercicio % 400 === 0;
    const diasEjercicio = esBisiesto ? 366 : 365;
    const importePropuesto = importeRealAño > 0
      ? Math.round(importeRealAño * 100) / 100
      : Math.round((contrato.rentaMensual * 12) * (diasActivos / diasEjercicio) * 100) / 100;

    // Effective end date: contract's real fechaFin or end of ejercicio, whichever is earlier
    const fechaFinEfectiva = fin <= finEjercicio ? contrato.fechaFin : finEjercicioStr;

    propuestas.push({
      contratoId: contrato.id!,
      inquilinoNombre: contrato.inquilino?.nombre
        ? `${contrato.inquilino.nombre} ${contrato.inquilino.apellidos ?? ''}`.trim()
        : contrato.inquilino?.dni ?? 'Sin nombre',
      habitacionId: contrato.habitacionId,
      fechaInicio: contrato.fechaInicio,
      fechaFin: contrato.fechaFin,
      fechaFinEfectiva,
      rentaMensual: contrato.rentaMensual,
      diasActivosEnEjercicio: diasActivos,
      importePropuesto,
      importeAsignado: importePropuesto,
      inquilinoDni: contrato.inquilino?.dni ?? contrato.tenant?.nif ?? '',
    });
  }

  const totalPropuesto = propuestas.reduce((s, p) => s + p.importePropuesto, 0);

  return {
    inmuebleId: sinId.inmuebleId,
    ejercicio,
    importeDeclarado,
    contratos: propuestas,
    totalPropuesto: Math.round(totalPropuesto * 100) / 100,
    diferencia: Math.round((importeDeclarado - totalPropuesto) * 100) / 100,
    nifsDetectados,
  };
}

export async function confirmarVinculacion(
  sinIdentificadorId: number,
  ejercicio: number,
  asignaciones: Array<{ contratoId: number; importeAsignado: number }>
): Promise<void> {
  const db = await initDB();

  const sinId = await db.get('contracts', sinIdentificadorId);
  if (!sinId || sinId.estadoContrato !== 'sin_identificar') {
    throw new Error('Contrato sin_identificar no encontrado');
  }

  const ejercicioData = sinId.ejerciciosFiscales?.[ejercicio];
  if (!ejercicioData) throw new Error(`Ejercicio ${ejercicio} no encontrado`);

  for (const asig of asignaciones) {
    if (asig.importeAsignado <= 0) continue;

    const contrato = await db.get('contracts', asig.contratoId);
    if (!contrato) continue;

    const ejerciciosFiscales = contrato.ejerciciosFiscales ?? {};
    const existente = ejerciciosFiscales[ejercicio];
    ejerciciosFiscales[ejercicio] = {
      estado: 'declarado',
      importeDeclarado: (existente?.importeDeclarado ?? 0) + asig.importeAsignado,
      dias: ejercicioData.dias,
      fuente: 'xml_aeat',
      fechaImportacion: new Date().toISOString(),
    };

    await updateContract(asig.contratoId, { ejerciciosFiscales });
  }

  const ejerciciosFiscalesActualizados = { ...(sinId.ejerciciosFiscales ?? {}) };
  delete ejerciciosFiscalesActualizados[ejercicio];

  if (Object.keys(ejerciciosFiscalesActualizados).length === 0) {
    await db.delete('contracts', sinIdentificadorId);
  } else {
    await updateContract(sinIdentificadorId, {
      ejerciciosFiscales: ejerciciosFiscalesActualizados,
    });
  }
}

export async function dejarSinVincular(
  sinIdentificadorId: number,
  ejercicio: number
): Promise<void> {
  const db = await initDB();
  const sinId = await db.get('contracts', sinIdentificadorId);
  if (!sinId) return;

  const ejerciciosFiscales = sinId.ejerciciosFiscales ?? {};
  if (ejerciciosFiscales[ejercicio]) {
    ejerciciosFiscales[ejercicio] = {
      ...ejerciciosFiscales[ejercicio],
      fuente: 'manual',
      fechaImportacion: new Date().toISOString(),
    };
    await updateContract(sinIdentificadorId, { ejerciciosFiscales });
  }
}
