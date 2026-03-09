import { ArrastreIRPF, TipoArrastre, initDB } from './db';

const STORE_NAME = 'arrastresIRPF';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveEstado(importePendiente: number, nowYear: number, ejercicioCaducidad?: number): ArrastreIRPF['estado'] {
  if (typeof ejercicioCaducidad === 'number' && nowYear > ejercicioCaducidad && importePendiente > 0) {
    return 'caducado';
  }

  if (importePendiente <= 0) {
    return 'aplicado_total';
  }

  return 'aplicado_parcial';
}

export async function crearArrastreFiscal(input: {
  ejercicioOrigen: number;
  tipo: TipoArrastre;
  importe: number;
  ejercicioCaducidad?: number;
  inmuebleId?: number;
}): Promise<ArrastreIRPF> {
  const now = new Date().toISOString();
  const db = await initDB();

  const record: ArrastreIRPF = {
    ejercicioOrigen: input.ejercicioOrigen,
    tipo: input.tipo,
    importeOriginal: round2(input.importe),
    importePendiente: round2(input.importe),
    ejercicioCaducidad: input.ejercicioCaducidad,
    inmuebleId: input.inmuebleId,
    aplicaciones: [],
    estado: 'pendiente',
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.add(STORE_NAME, record);
  return { ...record, id: typeof id === 'number' ? id : undefined };
}

export async function aplicarArrastresFIFO(params: {
  ejercicioDestino: number;
  tipo: TipoArrastre;
  importeNecesario: number;
}): Promise<{ aplicadoTotal: number; pendienteSinCubrir: number; aplicaciones: Array<{ arrastreId: number; importe: number }> }> {
  const db = await initDB();
  const now = new Date().toISOString();

  const candidates = ((await db.getAllFromIndex(STORE_NAME, 'tipo', params.tipo)) as ArrastreIRPF[])
    .filter((arrastre) => arrastre.importePendiente > 0)
    .filter((arrastre) => typeof arrastre.ejercicioCaducidad !== 'number' || arrastre.ejercicioCaducidad >= params.ejercicioDestino)
    .sort((a, b) => {
      if (a.ejercicioOrigen !== b.ejercicioOrigen) {
        return a.ejercicioOrigen - b.ejercicioOrigen;
      }
      return (a.id ?? 0) - (b.id ?? 0);
    });

  let restante = round2(params.importeNecesario);
  const aplicaciones: Array<{ arrastreId: number; importe: number }> = [];

  for (const arrastre of candidates) {
    if (restante <= 0 || arrastre.id == null) {
      break;
    }

    const aplicado = round2(Math.min(arrastre.importePendiente, restante));
    if (aplicado <= 0) {
      continue;
    }

    const updated: ArrastreIRPF = {
      ...arrastre,
      importePendiente: round2(arrastre.importePendiente - aplicado),
      aplicaciones: [
        ...arrastre.aplicaciones,
        { ejercicio: params.ejercicioDestino, importe: aplicado, fecha: now },
      ],
      estado: resolveEstado(round2(arrastre.importePendiente - aplicado), params.ejercicioDestino, arrastre.ejercicioCaducidad),
      updatedAt: now,
    };

    await db.put(STORE_NAME, updated);

    restante = round2(restante - aplicado);
    aplicaciones.push({ arrastreId: arrastre.id, importe: aplicado });
  }

  return {
    aplicadoTotal: round2(params.importeNecesario - restante),
    pendienteSinCubrir: round2(restante),
    aplicaciones,
  };
}

export async function recalcularCaducidadArrastres(ejercicioActual: number): Promise<number> {
  const db = await initDB();
  const all = (await db.getAll(STORE_NAME)) as ArrastreIRPF[];
  let updatedCount = 0;

  for (const item of all) {
    if (typeof item.ejercicioCaducidad !== 'number' || item.importePendiente <= 0) {
      continue;
    }

    if (ejercicioActual > item.ejercicioCaducidad && item.estado !== 'caducado') {
      const updated: ArrastreIRPF = {
        ...item,
        estado: 'caducado',
        updatedAt: new Date().toISOString(),
      };
      await db.put(STORE_NAME, updated);
      updatedCount += 1;
    }
  }

  return updatedCount;
}
