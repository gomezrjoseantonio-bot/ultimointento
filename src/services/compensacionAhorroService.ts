import { ArrastreIRPF, initDB, PerdidaPatrimonialAhorro } from './db';
import {
  getGananciasPatrimonialesInmueblesEjercicio,
  PropertyDisposalTaxResult,
} from './propertyDisposalTaxService';
import { calcularGananciasPerdidasEjercicio } from './inversionesFiscalService';
import { getConfiguracionFiscal } from './fiscalPaymentsService';

export interface PerdidaResumen {
  ejercicioOrigen: number;
  importeOriginal: number;
  importePendiente: number;
  ejercicioCaducidad: number;
  estado: PerdidaPatrimonialAhorro['estado'];
}

export interface CompensacionDetalle {
  ejercicioOrigen: number;
  importeAplicado: number;
  importeRestanteTras: number;
}

export interface CompensacionAhorroResult {
  ejercicio: number;
  fuentes: {
    inmuebles: {
      plusvalias: number;
      minusvalias: number;
      detalle: PropertyDisposalTaxResult[];
    };
    inversiones: {
      plusvalias: number;
      minusvalias: number;
      operaciones: number;
    };
  };
  saldoNetoEjercicio: number;
  perdidasPendientesAntes: PerdidaResumen[];
  compensacionAplicada: CompensacionDetalle[];
  totalCompensado: number;
  saldoNetoTrasCompensar: number;
  compensacionConCapitalMobiliario: number;
  limiteCapitalMobiliario: number;
  nuevaPerdidaArrastrada: number;
  ejercicioCaducidadNueva: number;
  perdidasPendientesDespues: PerdidaResumen[];
  perdidasCaducadas: PerdidaResumen[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toResumen(perdida: PerdidaPatrimonialAhorro): PerdidaResumen {
  return {
    ejercicioOrigen: perdida.ejercicioOrigen,
    importeOriginal: round2(perdida.importeOriginal),
    importePendiente: round2(perdida.importePendiente),
    ejercicioCaducidad: perdida.ejercicioCaducidad,
    estado: perdida.estado,
  };
}

function normalizeLegacyArrastre(arrastre: ArrastreIRPF): PerdidaPatrimonialAhorro {
  return {
    id: arrastre.id,
    ejercicioOrigen: arrastre.ejercicioOrigen,
    ejercicioCaducidad: arrastre.ejercicioCaducidad || (arrastre.ejercicioOrigen + 4),
    importeOriginal: round2(arrastre.importeOriginal),
    importeAplicado: round2(arrastre.importeOriginal - arrastre.importePendiente),
    importePendiente: round2(arrastre.importePendiente),
    tipoOrigen: 'importado',
    estado: arrastre.estado === 'caducado'
      ? 'caducado'
      : arrastre.importePendiente <= 0
        ? 'aplicado_total'
        : arrastre.importePendiente < arrastre.importeOriginal
          ? 'aplicado_parcial'
          : 'pendiente',
    aplicaciones: (arrastre.aplicaciones || []).map((aplicacion) => ({
      ejercicioDestino: aplicacion.ejercicio,
      importe: round2(aplicacion.importe),
      fecha: aplicacion.fecha,
    })),
    createdAt: arrastre.createdAt,
    updatedAt: arrastre.updatedAt,
  };
}

async function getPerdidasPatrimonialesAhorro(ejercicioActual: number): Promise<{
  activas: PerdidaPatrimonialAhorro[];
  caducables: PerdidaPatrimonialAhorro[];
}> {
  const db = await initDB();

  try {
    const todas = (await db.getAll('perdidasPatrimonialesAhorro')) as PerdidaPatrimonialAhorro[];
    if (todas.length > 0) {
      const caducables = todas.filter(
        (item) => item.importePendiente > 0 && item.ejercicioCaducidad < ejercicioActual && item.estado !== 'caducado',
      );
      const activas = todas
        .filter(
          (item) => item.importePendiente > 0 && item.ejercicioCaducidad >= ejercicioActual && item.estado !== 'caducado',
        )
        .sort((a, b) => a.ejercicioOrigen - b.ejercicioOrigen || (a.id ?? 0) - (b.id ?? 0));

      return { activas, caducables };
    }
  } catch {
    // fallback a legacy stores
  }

  {
    const pendientes: PerdidaPatrimonialAhorro[] = [];

    try {
      const config = await getConfiguracionFiscal();
      for (const mv of config.minusvalias_pendientes || []) {
        if (mv.importe <= 0) continue;
        if ((mv.anio + 4) < ejercicioActual) continue;
        pendientes.push({
          ejercicioOrigen: mv.anio,
          ejercicioCaducidad: mv.anio + 4,
          importeOriginal: round2(mv.importe),
          importeAplicado: 0,
          importePendiente: round2(mv.importe),
          tipoOrigen: 'crypto',
          estado: 'pendiente',
          aplicaciones: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // noop legacy missing
    }

    try {
      const arrastres = (await db.getAll('arrastresIRPF')) as ArrastreIRPF[];
      for (const arr of arrastres) {
        if (arr.tipo !== 'perdidas_patrimoniales_ahorro') continue;
        if (arr.importePendiente <= 0) continue;
        if ((arr.ejercicioCaducidad || arr.ejercicioOrigen + 4) < ejercicioActual) continue;
        if (pendientes.some((item) => item.ejercicioOrigen === arr.ejercicioOrigen)) continue;
        pendientes.push(normalizeLegacyArrastre(arr));
      }
    } catch {
      // noop legacy missing
    }

    return {
      activas: pendientes.sort((a, b) => a.ejercicioOrigen - b.ejercicioOrigen || (a.id ?? 0) - (b.id ?? 0)),
      caducables: [],
    };
  }
}

export async function ejecutarCompensacionAhorro(
  ejercicio: number,
  capitalMobiliarioPositivo: number,
): Promise<CompensacionAhorroResult> {
  const db = await initDB();
  const now = new Date().toISOString();

  let ventasInmuebles: PropertyDisposalTaxResult[] = [];
  try {
    ventasInmuebles = await getGananciasPatrimonialesInmueblesEjercicio(ejercicio);
  } catch (error) {
    console.warn('Error obteniendo ventas de inmuebles:', error);
  }

  const plusvaliasInmuebles = round2(
    ventasInmuebles
      .filter((item) => item.gananciaPatrimonial > 0)
      .reduce((sum, item) => sum + item.gananciaPatrimonial, 0),
  );
  const minusvaliasInmuebles = round2(
    ventasInmuebles
      .filter((item) => item.gananciaPatrimonial < 0)
      .reduce((sum, item) => sum + Math.abs(item.gananciaPatrimonial), 0),
  );

  let plusvaliasInversiones = 0;
  let minusvaliasInversiones = 0;
  let numOperaciones = 0;
  try {
    const gpInversiones = await calcularGananciasPerdidasEjercicio(ejercicio);
    plusvaliasInversiones = round2(gpInversiones.plusvalias);
    minusvaliasInversiones = round2(gpInversiones.minusvalias);
    numOperaciones = gpInversiones.operaciones?.length ?? 0;
  } catch (error) {
    console.warn('Error obteniendo G/P de inversiones:', error);
  }

  const saldoNetoEjercicio = round2(
    plusvaliasInmuebles + plusvaliasInversiones - minusvaliasInmuebles - minusvaliasInversiones,
  );

  const { activas, caducables } = await getPerdidasPatrimonialesAhorro(ejercicio);
  const pendientesActualizados = activas.map((item) => ({
    ...item,
    aplicaciones: [...item.aplicaciones],
  }));

  const perdidasPendientesAntes = pendientesActualizados.map(toResumen);
  const compensacionAplicada: CompensacionDetalle[] = [];

  let saldoRestante = saldoNetoEjercicio;
  let totalCompensado = 0;

  if (saldoRestante > 0) {
    for (const perdida of pendientesActualizados) {
      if (saldoRestante <= 0 || perdida.importePendiente <= 0) break;

      const aplicar = round2(Math.min(perdida.importePendiente, saldoRestante));
      if (aplicar <= 0) continue;

      perdida.importeAplicado = round2(perdida.importeAplicado + aplicar);
      perdida.importePendiente = round2(perdida.importePendiente - aplicar);
      perdida.estado = perdida.importePendiente <= 0 ? 'aplicado_total' : 'aplicado_parcial';
      perdida.aplicaciones.push({
        ejercicioDestino: ejercicio,
        importe: aplicar,
        fecha: now,
      });
      perdida.updatedAt = now;

      compensacionAplicada.push({
        ejercicioOrigen: perdida.ejercicioOrigen,
        importeAplicado: aplicar,
        importeRestanteTras: perdida.importePendiente,
      });

      saldoRestante = round2(saldoRestante - aplicar);
      totalCompensado = round2(totalCompensado + aplicar);
    }
  }

  const saldoNetoTrasPendientes = round2(saldoNetoEjercicio - totalCompensado);
  const limiteCapitalMobiliario = round2(Math.max(0, capitalMobiliarioPositivo) * 0.25);
  let compensacionConCapitalMobiliario = 0;
  let nuevaPerdidaArrastrada = 0;

  if (saldoNetoTrasPendientes < 0) {
    const perdidaNeta = Math.abs(saldoNetoTrasPendientes);
    compensacionConCapitalMobiliario = round2(Math.min(perdidaNeta, limiteCapitalMobiliario));
    nuevaPerdidaArrastrada = round2(perdidaNeta - compensacionConCapitalMobiliario);
  }

  if (nuevaPerdidaArrastrada > 0) {
    const nuevaPerdida: PerdidaPatrimonialAhorro = {
      ejercicioOrigen: ejercicio,
      ejercicioCaducidad: ejercicio + 4,
      importeOriginal: nuevaPerdidaArrastrada,
      importeAplicado: 0,
      importePendiente: nuevaPerdidaArrastrada,
      tipoOrigen: 'mixto',
      estado: 'pendiente',
      aplicaciones: [],
      createdAt: now,
      updatedAt: now,
    };

    pendientesActualizados.push(nuevaPerdida);

    try {
      const id = await db.add('perdidasPatrimonialesAhorro', nuevaPerdida);
      nuevaPerdida.id = typeof id === 'number' ? id : undefined;
    } catch {
      console.warn('No se pudo registrar nueva pérdida arrastrable');
    }
  }

  for (const perdida of pendientesActualizados) {
    if (perdida.id == null) continue;
    try {
      await db.put('perdidasPatrimonialesAhorro', perdida);
    } catch {
      // legacy fallback or store missing
    }
  }

  const perdidasCaducadas: PerdidaResumen[] = [];
  for (const perdida of caducables) {
    perdida.estado = 'caducado';
    perdida.updatedAt = now;
    perdidasCaducadas.push(toResumen(perdida));
    if (perdida.id != null) {
      try {
        await db.put('perdidasPatrimonialesAhorro', perdida);
      } catch {
        // noop
      }
    }
  }

  const perdidasPendientesDespues = pendientesActualizados
    .filter((item) => item.importePendiente > 0 && item.estado !== 'caducado')
    .sort((a, b) => a.ejercicioOrigen - b.ejercicioOrigen || (a.id ?? 0) - (b.id ?? 0))
    .map(toResumen);

  return {
    ejercicio,
    fuentes: {
      inmuebles: {
        plusvalias: plusvaliasInmuebles,
        minusvalias: minusvaliasInmuebles,
        detalle: ventasInmuebles,
      },
      inversiones: {
        plusvalias: plusvaliasInversiones,
        minusvalias: minusvaliasInversiones,
        operaciones: numOperaciones,
      },
    },
    saldoNetoEjercicio,
    perdidasPendientesAntes,
    compensacionAplicada,
    totalCompensado,
    saldoNetoTrasCompensar: saldoNetoTrasPendientes >= 0 ? saldoNetoTrasPendientes : 0,
    compensacionConCapitalMobiliario,
    limiteCapitalMobiliario,
    nuevaPerdidaArrastrada,
    ejercicioCaducidadNueva: ejercicio + 4,
    perdidasPendientesDespues,
    perdidasCaducadas,
  };
}

export async function migrarPerdidasLegacy(): Promise<number> {
  const db = await initDB();

  try {
    await db.count('perdidasPatrimonialesAhorro');
  } catch {
    console.warn('Store perdidasPatrimonialesAhorro no existe aún');
    return 0;
  }

  const existentes = (await db.getAll('perdidasPatrimonialesAhorro')) as PerdidaPatrimonialAhorro[];
  if (existentes.length > 0) {
    return 0;
  }

  let migradas = 0;
  const now = new Date().toISOString();
  const ejerciciosMigrados = new Set<number>();

  try {
    const config = await getConfiguracionFiscal();
    for (const mv of config.minusvalias_pendientes || []) {
      if (mv.importe <= 0) continue;
      if (ejerciciosMigrados.has(mv.anio)) continue;

      await db.add('perdidasPatrimonialesAhorro', {
        ejercicioOrigen: mv.anio,
        ejercicioCaducidad: mv.anio + 4,
        importeOriginal: round2(mv.importe),
        importeAplicado: 0,
        importePendiente: round2(mv.importe),
        tipoOrigen: 'crypto' as const,
        estado: 'pendiente' as const,
        aplicaciones: [],
        createdAt: now,
        updatedAt: now,
      });
      ejerciciosMigrados.add(mv.anio);
      migradas += 1;
    }
  } catch {
    // noop
  }

  try {
    const arrastres = (await db.getAll('arrastresIRPF')) as ArrastreIRPF[];
    for (const arr of arrastres) {
      if (arr.tipo !== 'perdidas_patrimoniales_ahorro') continue;
      if (arr.importePendiente <= 0) continue;
      if (ejerciciosMigrados.has(arr.ejercicioOrigen)) continue;

      await db.add('perdidasPatrimonialesAhorro', normalizeLegacyArrastre({
        ...arr,
        createdAt: arr.createdAt || now,
        updatedAt: now,
      } as ArrastreIRPF));
      ejerciciosMigrados.add(arr.ejercicioOrigen);
      migradas += 1;
    }
  } catch {
    // noop
  }

  return migradas;
}
