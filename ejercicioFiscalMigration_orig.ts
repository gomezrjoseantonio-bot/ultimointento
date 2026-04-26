import { initDB } from './db';
import type {
  DeclaracionIRPF,
  EjercicioFiscal,
  OrigenDeclaracion,
} from '../types/fiscal';
import {
  getEjercicio,
  inicializarEjercicioActual,
  saveEjercicio,
  verificarCierresAutomaticos,
} from './ejercicioFiscalService';

const MIGRATION_KEY = 'atlas_fiscal_migration_v1';

interface DatosViejos {
  ejercicio: number;
  estado?: string;
  origen?: string;
  baseImponibleGeneral?: number;
  baseLiquidableGeneral?: number;
  cuotaIntegra?: number;
  cuotaLiquida?: number;
  retencionesTotal?: number;
  resultado?: number;
  rendimientosTrabajo?: number;
  rendimientosInmuebles?: number;
  rendimientosAutonomo?: number;
  [key: string]: unknown;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.').trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function createEmptyDeclaracion(): DeclaracionIRPF {
  return {
    trabajo: {
      retribucionesDinerarias: 0,
      retribucionEspecie: 0,
      ingresosACuenta: 0,
      contribucionesPPEmpresa: 0,
      totalIngresosIntegros: 0,
      cotizacionSS: 0,
      rendimientoNetoPrevio: 0,
      otrosGastosDeducibles: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesTrabajoTotal: 0,
    },
    inmuebles: [],
    actividades: [],
    capitalMobiliario: {
      interesesCuentas: 0,
      otrosRendimientos: 0,
      totalIngresosIntegros: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesCapital: 0,
    },
    gananciasPerdidas: {
      gananciasNoTransmision: 0,
      perdidasNoTransmision: 0,
      saldoNetoGeneral: 0,
      gananciasTransmision: 0,
      perdidasTransmision: 0,
      saldoNetoAhorro: 0,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [],
    },
    planPensiones: {
      aportacionesTrabajador: 0,
      contribucionesEmpresariales: 0,
      totalConDerecho: 0,
      reduccionAplicada: 0,
    },
    basesYCuotas: {
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      baseLiquidableAhorro: 0,
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaIntegra: 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      cuotaLiquida: 0,
      cuotaResultante: 0,
      retencionesTotal: 0,
      cuotaDiferencial: 0,
      resultadoDeclaracion: 0,
    },
  };
}

function parsearDatoViejo(raw: Record<string, any> | null | undefined): DatosViejos | null {
  if (!raw) return null;

  const ejercicio = toNumber(raw.ejercicio ?? raw.year ?? raw.anio ?? raw.año ?? raw.taxYear);
  if (!ejercicio || !Number.isInteger(ejercicio)) {
    return null;
  }

  const data = raw.data ?? raw.resumen ?? raw.snapshot ?? raw.declaracion ?? {};
  const liquidacion = raw.liquidacion ?? data.liquidacion ?? {};
  const retenciones = raw.retenciones ?? data.retenciones ?? {};
  const baseGeneral = raw.baseGeneral ?? data.baseGeneral ?? {};

  return {
    ejercicio,
    estado: raw.estado ?? raw.status ?? raw.fuente,
    origen: raw.origen ?? raw.source,
    baseImponibleGeneral: toNumber(raw.baseImponibleGeneral ?? data.baseImponibleGeneral ?? liquidacion.baseImponibleGeneral ?? baseGeneral.total ?? data.casilla_0435),
    baseLiquidableGeneral: toNumber(raw.baseLiquidableGeneral ?? data.baseLiquidableGeneral ?? liquidacion.baseLiquidableGeneral ?? data.casilla_0500),
    cuotaIntegra: toNumber(raw.cuotaIntegra ?? data.cuotaIntegra ?? liquidacion.cuotaIntegra),
    cuotaLiquida: toNumber(raw.cuotaLiquida ?? data.cuotaLiquida ?? liquidacion.cuotaLiquida),
    retencionesTotal: toNumber(raw.retencionesTotal ?? raw.totalRetenciones ?? data.totalRetenciones ?? retenciones.total ?? data.casilla_0609),
    resultado: toNumber(raw.resultado ?? raw.resultadoDeclaracion ?? data.resultado ?? data.casilla_0670),
    rendimientosTrabajo: toNumber(raw.rendimientosTrabajo ?? data.rendimientosTrabajo ?? baseGeneral.rendimientosTrabajo?.rendimientoNeto),
    rendimientosInmuebles: toNumber(raw.rendimientosInmuebles ?? data.rendimientosInmuebles),
    rendimientosAutonomo: toNumber(raw.rendimientosAutonomo ?? data.rendimientosAutonomo ?? baseGeneral.rendimientosAutonomo?.rendimientoNeto),
  };
}

function construirDeclaracionParcial(datos: DatosViejos): DeclaracionIRPF {
  const rendimientoTrabajo = datos.rendimientosTrabajo ?? 0;
  const rendimientoAutonomo = datos.rendimientosAutonomo ?? 0;

  return {
    trabajo: {
      retribucionesDinerarias: rendimientoTrabajo,
      retribucionEspecie: 0,
      ingresosACuenta: 0,
      contribucionesPPEmpresa: 0,
      totalIngresosIntegros: rendimientoTrabajo,
      cotizacionSS: 0,
      rendimientoNetoPrevio: rendimientoTrabajo,
      otrosGastosDeducibles: 0,
      rendimientoNeto: rendimientoTrabajo,
      rendimientoNetoReducido: rendimientoTrabajo,
      retencionesTrabajoTotal: 0,
    },
    inmuebles: [],
    actividades: rendimientoAutonomo > 0 ? [{
      contribuyente: 'declarante',
      tipoActividad: 'legacy',
      epigrafeIAE: '',
      modalidad: 'simplificada',
      ingresos: rendimientoAutonomo,
      gastos: 0,
      rendimientoNeto: rendimientoAutonomo,
      rendimientoNetoReducido: rendimientoAutonomo,
      retencionesActividad: 0,
    }] : [],
    capitalMobiliario: {
      interesesCuentas: 0,
      otrosRendimientos: 0,
      totalIngresosIntegros: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesCapital: 0,
    },
    gananciasPerdidas: {
      gananciasNoTransmision: 0,
      perdidasNoTransmision: 0,
      saldoNetoGeneral: 0,
      gananciasTransmision: 0,
      perdidasTransmision: 0,
      saldoNetoAhorro: 0,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [],
    },
    planPensiones: {
      aportacionesTrabajador: 0,
      contribucionesEmpresariales: 0,
      totalConDerecho: 0,
      reduccionAplicada: 0,
    },
    basesYCuotas: {
      baseImponibleGeneral: datos.baseImponibleGeneral ?? 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: datos.baseLiquidableGeneral ?? 0,
      baseLiquidableAhorro: 0,
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaIntegra: datos.cuotaIntegra ?? 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      cuotaLiquida: datos.cuotaLiquida ?? 0,
      cuotaResultante: 0,
      retencionesTotal: datos.retencionesTotal ?? 0,
      cuotaDiferencial: datos.resultado ?? 0,
      resultadoDeclaracion: datos.resultado ?? 0,
    },
  };
}

function convertirAEjercicioFiscal(datos: DatosViejos): EjercicioFiscal {
  const ahora = new Date().toISOString();
  const anioActual = new Date().getFullYear();

  let estado: EjercicioFiscal['estado'];
  if (datos.ejercicio === anioActual) {
    estado = 'en_curso';
  } else if (
    datos.estado === 'declarado'
    || datos.estado === 'importado'
    || datos.origen === 'importado'
    || datos.origen === 'pdf'
  ) {
    estado = 'declarado';
  } else {
    estado = 'cerrado';
  }

  let origen: OrigenDeclaracion = 'no_presentada';
  if (datos.origen === 'importado' || datos.origen === 'pdf') {
    origen = 'pdf_importado';
  } else if (datos.origen === 'manual' || datos.resultado !== undefined) {
    origen = 'manual';
  }

  const declaracion = construirDeclaracionParcial(datos);
  const ejercicio: EjercicioFiscal = {
    ejercicio: datos.ejercicio,
    estado,
    declaracionAeatOrigen: origen,
    arrastresRecibidos: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
    arrastresGenerados: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
    createdAt: ahora,
    updatedAt: ahora,
  };

  if (datos.resultado !== undefined || datos.retencionesTotal !== undefined || datos.baseImponibleGeneral !== undefined) {
    if (estado === 'declarado') {
      ejercicio.declaracionAeat = declaracion;
      ejercicio.declaracionAeatFecha = ahora;
      ejercicio.declaradoAt = ahora;
    } else {
      ejercicio.calculoAtlas = declaracion;
      ejercicio.calculoAtlasFecha = ahora;
      if (estado === 'cerrado') {
        ejercicio.cerradoAt = ahora;
      }
    }
  }

  return ejercicio;
}

async function leerFiscalHistoryViejo(): Promise<DatosViejos[]> {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames);
  const posiblesStores = [
    'fiscalHistory',
    'fiscal_history',
    'declaraciones',
    'declaracionesHistorico',
    'irpfHistory',
    'resultadosEjercicio',
    'snapshotsDeclaracion',
  ];

  const migrados = new Map<number, DatosViejos>();

  for (const storeName of posiblesStores.filter((candidate) => storeNames.includes(candidate))) {
    try {
      const all = await db.getAll(storeName);
      for (const item of all as Array<Record<string, any>>) {
        const parsed = parsearDatoViejo(item);
        if (parsed) {
          migrados.set(parsed.ejercicio, { ...migrados.get(parsed.ejercicio), ...parsed });
        }
      }
    } catch (error) {
      console.warn(`[MigraciónFiscal] Error leyendo store legacy "${storeName}":`, error);
    }
  }

  const localStorageKeys = [
    'fiscalHistory',
    'atlas_fiscal_history',
    'atlas_fiscalHistory',
    'declaracionesHistorico',
  ];

  for (const key of localStorageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsedJson = JSON.parse(raw);
      const entries = Array.isArray(parsedJson)
        ? parsedJson
        : typeof parsedJson === 'object' && parsedJson !== null
          ? Object.values(parsedJson)
          : [];

      for (const item of entries as Array<Record<string, any>>) {
        const parsed = parsearDatoViejo(item);
        if (parsed) {
          migrados.set(parsed.ejercicio, { ...migrados.get(parsed.ejercicio), ...parsed });
        }
      }
    } catch (error) {
      console.warn(`[MigraciónFiscal] Error leyendo localStorage "${key}":`, error);
    }
  }

  return Array.from(migrados.values()).sort((a, b) => a.ejercicio - b.ejercicio);
}

async function migrarDatosDeclaracionActual(): Promise<void> {
  const currentYear = new Date().getFullYear();
  const ejercicioExistente = await getEjercicio(currentYear);
  if (ejercicioExistente?.calculoAtlas || ejercicioExistente?.declaracionAeat) {
    return;
  }

  const db = await initDB();
  const declaracion = createEmptyDeclaracion();
  let hasData = false;

  if (db.objectStoreNames.contains('nominas')) {
    const nominas = (await db.getAll('nominas')) as Array<Record<string, any>>;
    const activas = nominas.filter((nomina) => nomina?.activa !== false);
    const trabajo = activas.reduce((acc, nomina) => {
      const bruto = toNumber(nomina.salarioBrutoAnual) ?? 0;
      const especie = toNumber(nomina.retribucionEspecieAnual) ?? 0;
      const ppEmpresa = toNumber(nomina.aportacionEmpresaPlanPensionesAnual) ?? 0;
      const irpf = bruto * ((toNumber(nomina.retencion?.irpfPorcentaje) ?? 0) / 100);
      const baseSsMensual = toNumber(nomina.retencion?.ss?.baseCotizacionMensual) ?? 0;
      const porcentajeSs = [
        toNumber(nomina.retencion?.ss?.contingenciasComunes) ?? 0,
        toNumber(nomina.retencion?.ss?.desempleo) ?? 0,
        toNumber(nomina.retencion?.ss?.formacionProfesional) ?? 0,
        toNumber(nomina.retencion?.ss?.mei) ?? 0,
      ].reduce((sum, value) => sum + value, 0) / 100;
      const ss = baseSsMensual * 12 * porcentajeSs;

      acc.retribucionesDinerarias += bruto;
      acc.retribucionEspecie += especie;
      acc.contribucionesPPEmpresa += ppEmpresa;
      acc.cotizacionSS += ss;
      acc.retencionesTrabajoTotal += irpf;
      return acc;
    }, {
      retribucionesDinerarias: 0,
      retribucionEspecie: 0,
      contribucionesPPEmpresa: 0,
      cotizacionSS: 0,
      retencionesTrabajoTotal: 0,
    });

    if (trabajo.retribucionesDinerarias || trabajo.retribucionEspecie || trabajo.contribucionesPPEmpresa) {
      hasData = true;
      declaracion.trabajo.retribucionesDinerarias = trabajo.retribucionesDinerarias;
      declaracion.trabajo.retribucionEspecie = trabajo.retribucionEspecie;
      declaracion.trabajo.contribucionesPPEmpresa = trabajo.contribucionesPPEmpresa;
      declaracion.trabajo.totalIngresosIntegros = trabajo.retribucionesDinerarias + trabajo.retribucionEspecie + trabajo.contribucionesPPEmpresa;
      declaracion.trabajo.cotizacionSS = trabajo.cotizacionSS;
      declaracion.trabajo.rendimientoNetoPrevio = declaracion.trabajo.totalIngresosIntegros - trabajo.cotizacionSS;
      declaracion.trabajo.rendimientoNeto = declaracion.trabajo.rendimientoNetoPrevio;
      declaracion.trabajo.rendimientoNetoReducido = declaracion.trabajo.rendimientoNetoPrevio;
      declaracion.trabajo.retencionesTrabajoTotal = trabajo.retencionesTrabajoTotal;
    }
  }

  if (db.objectStoreNames.contains('autonomos')) {
    const autonomos = (await db.getAll('autonomos')) as Array<Record<string, any>>;
    const activos = autonomos.filter((autonomo) => autonomo?.activo !== false);
    const actividades = activos
      .map((autonomo) => {
        const ingresos = (autonomo.ingresosFacturados ?? []).reduce((sum: number, item: Record<string, any>) => sum + (toNumber(item?.importe) ?? 0), 0);
        const gastos = (autonomo.gastosDeducibles ?? []).reduce((sum: number, item: Record<string, any>) => sum + (toNumber(item?.importe) ?? 0), 0);
        const cuota = (toNumber(autonomo.cuotaAutonomos) ?? 0) * 12;
        const rendimiento = ingresos - gastos - cuota;
        const retencion = ingresos * ((toNumber(autonomo.irpfRetencionPorcentaje) ?? 0) / 100);

        return {
          contribuyente: 'declarante' as const,
          tipoActividad: autonomo.descripcionActividad ?? autonomo.tipoActividad ?? 'autonomo',
          epigrafeIAE: autonomo.epigrafeIAE ?? '',
          modalidad: autonomo.modalidad === 'normal' ? 'normal' as const : 'simplificada' as const,
          ingresos,
          gastos: gastos + cuota,
          rendimientoNeto: rendimiento,
          rendimientoNetoReducido: rendimiento,
          retencionesActividad: retencion,
        };
      })
      .filter((actividad) => actividad.ingresos || actividad.gastos || actividad.retencionesActividad);

    if (actividades.length > 0) {
      hasData = true;
      declaracion.actividades = actividades;
    }
  }

  if (db.objectStoreNames.contains('configuracion_fiscal')) {
    const config = await db.get('configuracion_fiscal', 'default') as Record<string, any> | undefined;
    const aportacionTrabajador = toNumber(config?.planPensiones?.aportacionTrabajadorAnual ?? config?.aportacionTrabajadorPP);
    const contribucionesEmpresariales = toNumber(config?.planPensiones?.contribucionEmpresarialAnual ?? config?.contribucionEmpresarialPP);

    if (aportacionTrabajador || contribucionesEmpresariales) {
      hasData = true;
      declaracion.planPensiones.aportacionesTrabajador = aportacionTrabajador ?? 0;
      declaracion.planPensiones.contribucionesEmpresariales = contribucionesEmpresariales ?? 0;
      declaracion.planPensiones.totalConDerecho = (aportacionTrabajador ?? 0) + (contribucionesEmpresariales ?? 0);
      declaracion.planPensiones.reduccionAplicada = declaracion.planPensiones.totalConDerecho;
    }
  }

  if (!hasData) {
    console.log('[MigraciónFiscal] No se encontraron datos persistidos de la pantalla de Declaración para migrar.');
    return;
  }

  declaracion.basesYCuotas.baseImponibleGeneral = declaracion.trabajo.rendimientoNetoReducido + declaracion.actividades.reduce((sum, actividad) => sum + actividad.rendimientoNetoReducido, 0);
  declaracion.basesYCuotas.baseLiquidableGeneral = Math.max(0, declaracion.basesYCuotas.baseImponibleGeneral - declaracion.planPensiones.reduccionAplicada);
  declaracion.basesYCuotas.retencionesTotal = declaracion.trabajo.retencionesTrabajoTotal + declaracion.actividades.reduce((sum, actividad) => sum + actividad.retencionesActividad, 0);
  declaracion.basesYCuotas.resultadoDeclaracion = -declaracion.basesYCuotas.retencionesTotal;
  declaracion.basesYCuotas.cuotaDiferencial = declaracion.basesYCuotas.resultadoDeclaracion;

  const now = new Date().toISOString();
  await saveEjercicio({
    ejercicio: currentYear,
    estado: 'en_curso',
    declaracionAeatOrigen: 'manual',
    calculoAtlas: declaracion,
    calculoAtlasFecha: now,
    arrastresRecibidos: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
    arrastresGenerados: { gastos0105_0106: [], perdidasPatrimonialesAhorro: [], amortizacionesAcumuladas: [] },
    createdAt: now,
    updatedAt: now,
  });
}

export async function ejecutarMigracionFiscal(): Promise<{
  migrado: boolean;
  ejerciciosMigrados: number[];
  ejercicioActualCreado: boolean;
  ejerciciosCerrados: number[];
}> {
  if (localStorage.getItem(MIGRATION_KEY) === 'done') {
    const antes = await getEjercicio(new Date().getFullYear());
    await inicializarEjercicioActual();
    const cerrados = await verificarCierresAutomaticos();
    return {
      migrado: false,
      ejerciciosMigrados: [],
      ejercicioActualCreado: !antes,
      ejerciciosCerrados: cerrados.map((item) => item.ejercicio),
    };
  }

  const ejerciciosMigrados: number[] = [];

  try {
    const datosViejos = await leerFiscalHistoryViejo();

    for (const datos of datosViejos) {
      const existente = await getEjercicio(datos.ejercicio);
      if (existente) continue;

      const ejercicio = convertirAEjercicioFiscal(datos);
      await saveEjercicio(ejercicio);
      ejerciciosMigrados.push(datos.ejercicio);
    }

    await migrarDatosDeclaracionActual();

    const ejercicioActualPrevio = await getEjercicio(new Date().getFullYear());
    await inicializarEjercicioActual();
    const ejerciciosCerrados = await verificarCierresAutomaticos();

    localStorage.setItem(MIGRATION_KEY, 'done');

    return {
      migrado: true,
      ejerciciosMigrados,
      ejercicioActualCreado: !ejercicioActualPrevio,
      ejerciciosCerrados: ejerciciosCerrados.map((item) => item.ejercicio),
    };
  } catch (error) {
    console.error('[MigraciónFiscal] Error:', error);
    return {
      migrado: false,
      ejerciciosMigrados,
      ejercicioActualCreado: false,
      ejerciciosCerrados: [],
    };
  }
}

export function resetMigracion(): void {
  localStorage.removeItem(MIGRATION_KEY);
}
