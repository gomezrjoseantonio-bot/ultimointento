import { initDB } from './db';
import { getContractsByProperty, updateContract } from './contractService';

export interface ContratoPropuesta {
  contratoId: number;
  inquilinoNombre: string;
  habitacionId?: string;
  fechaInicio: string;
  fechaFin: string;
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

  const importeDeclarado = sinId.ejerciciosFiscales?.[ejercicio]?.importeDeclarado ?? 0;
  if (importeDeclarado === 0) {
    return {
      inmuebleId: sinId.inmuebleId,
      ejercicio,
      importeDeclarado: 0,
      contratos: [],
      totalPropuesto: 0,
      diferencia: 0,
    };
  }

  const todosContratos = await getContractsByProperty(sinId.inmuebleId);
  const contratosReales = todosContratos.filter(
    (c) => c.estadoContrato !== 'sin_identificar' && c.id !== sinIdentificadorId
  );

  const inicioEjercicio = new Date(`${ejercicio}-01-01`);
  const finEjercicio = new Date(`${ejercicio}-12-31`);

  const propuestas: ContratoPropuesta[] = [];

  for (const contrato of contratosReales) {
    const inicio = new Date(contrato.fechaInicio);
    const fin = new Date(contrato.fechaFin);

    const inicioEfectivo = inicio > inicioEjercicio ? inicio : inicioEjercicio;
    const finEfectivo = fin < finEjercicio ? fin : finEjercicio;

    if (inicioEfectivo > finEfectivo) continue;

    const diasActivos =
      Math.round((finEfectivo.getTime() - inicioEfectivo.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const rentaAnual = contrato.rentaMensual * 12;
    const diasEjercicio = ejercicio % 4 === 0 ? 366 : 365;
    const importePropuesto =
      Math.round((rentaAnual / diasEjercicio) * diasActivos * 100) / 100;

    propuestas.push({
      contratoId: contrato.id!,
      inquilinoNombre: contrato.inquilino?.nombre
        ? `${contrato.inquilino.nombre} ${contrato.inquilino.apellidos ?? ''}`.trim()
        : contrato.inquilino?.dni ?? 'Sin nombre',
      habitacionId: contrato.habitacionId,
      fechaInicio: contrato.fechaInicio,
      fechaFin: contrato.fechaFin,
      rentaMensual: contrato.rentaMensual,
      diasActivosEnEjercicio: diasActivos,
      importePropuesto,
      importeAsignado: importePropuesto,
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
