// ATLAS HORIZON: Servicio de pagos fiscales
// Nivel 2: M130, M303 y declaración IRPF anual

import { initDB, ConfiguracionFiscal, TreasuryEvent } from './db';
import { DeclaracionIRPF } from './irpfCalculationService';
import { personalDataService } from './personalDataService';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface EventoFiscal {
  modelo: 'M130' | 'M303' | 'IRPF_ANUAL' | 'IRPF_FRACCIONES';
  ejercicio: number;
  trimestre?: number; // 1-4 para M130/M303
  fechaLimite: string; // ISO date
  importe: number;
  descripcion: string;
  pagado: boolean;
  fechaPago?: string;
  sourceType: 'irpf_modelo130' | 'iva_modelo303' | 'irpf_declaracion';
}

const CONFIG_STORE = 'configuracion_fiscal';

function hasStore(db: any, storeName: string): boolean {
  return !!db?.objectStoreNames?.contains?.(storeName);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fechaLimiteM130(ejercicio: number, trimestre: number): string {
  switch (trimestre) {
    case 1: return `${ejercicio}-04-20`;
    case 2: return `${ejercicio}-07-20`;
    case 3: return `${ejercicio}-10-20`;
    case 4: return `${ejercicio + 1}-01-30`;
    default: return `${ejercicio}-12-31`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Configuración fiscal ─────────────────────────────────────────────────────

export async function getConfiguracionFiscal(): Promise<ConfiguracionFiscal> {
  const db = await initDB();

  if (!hasStore(db, CONFIG_STORE)) {
    console.warn(`[fiscalPaymentsService] El store "${CONFIG_STORE}" no existe aún. Usando configuración fiscal por defecto.`);

    return {
      id: 1,
      mes_declaracion: 6,
      dia_declaracion: 25,
      incluir_prevision_irpf: true,
      fraccionarPago: false,
      modelo130_pagados: [],
      modelo303_pagados: [],
      minusvalias_pendientes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const existing = await db.get(CONFIG_STORE, 1);
  if (existing) return existing;

  // Default config
  const defaultConfig: ConfiguracionFiscal = {
    id: 1,
    mes_declaracion: 6,
    dia_declaracion: 25,
    incluir_prevision_irpf: true,
    fraccionarPago: false,
    modelo130_pagados: [],
    modelo303_pagados: [],
    minusvalias_pendientes: [],
    updatedAt: new Date().toISOString(),
  };

  await db.put(CONFIG_STORE, defaultConfig);
  return defaultConfig;
}

export async function saveConfiguracionFiscal(config: Partial<ConfiguracionFiscal>): Promise<ConfiguracionFiscal> {
  const db = await initDB();

  if (!hasStore(db, CONFIG_STORE)) {
    console.warn(`[fiscalPaymentsService] El store "${CONFIG_STORE}" no existe aún. No se puede persistir la configuración fiscal.`);
    const fallbackConfig = await getConfiguracionFiscal();
    return {
      ...fallbackConfig,
      ...config,
      id: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  const existing = await getConfiguracionFiscal();
  const updated: ConfiguracionFiscal = {
    ...existing,
    ...config,
    id: 1,
    updatedAt: new Date().toISOString(),
  };
  await db.put(CONFIG_STORE, updated);
  return updated;
}

// ─── Cálculo M130 ─────────────────────────────────────────────────────────────

async function calcularM130(
  ejercicio: number,
  autonomoRendimientoAnual: number,
  config: ConfiguracionFiscal
): Promise<EventoFiscal[]> {
  const eventos: EventoFiscal[] = [];
  const rendimientoPorTrimestre = autonomoRendimientoAnual / 4;
  let acumulado = 0;
  let m130AcumuladoPagado = 0;

  for (let t = 1; t <= 4; t++) {
    acumulado += rendimientoPorTrimestre;
    const baseAcumulada = Math.max(0, acumulado);
    const cuotaAcumulada = round2(baseAcumulada * 0.20);
    // Subtract already paid retenciones (simplified: only M130 paid)
    const yaIngresado = config.modelo130_pagados
      .filter(p => p.ejercicio === ejercicio && p.trimestre < t)
      .reduce((s, p) => s + p.importe, 0);
    const importe = round2(Math.max(0, cuotaAcumulada - yaIngresado - m130AcumuladoPagado));
    m130AcumuladoPagado += importe;

    const pagadoEntry = config.modelo130_pagados.find(
      p => p.ejercicio === ejercicio && p.trimestre === t
    );

    eventos.push({
      modelo: 'M130',
      ejercicio,
      trimestre: t,
      fechaLimite: fechaLimiteM130(ejercicio, t),
      importe: pagadoEntry ? pagadoEntry.importe : importe,
      descripcion: `Modelo 130 — ${ejercicio} T${t} (pago fraccionado IRPF autónomo)`,
      pagado: !!pagadoEntry,
      fechaPago: pagadoEntry?.fechaPago,
      sourceType: 'irpf_modelo130',
    });
  }

  return eventos;
}

// ─── Cálculo M303 ─────────────────────────────────────────────────────────────

async function calcularM303(
  ejercicio: number,
  ivaRepercutidoAnual: number,
  ivaSoportadoAnual: number,
  config: ConfiguracionFiscal
): Promise<EventoFiscal[]> {
  const eventos: EventoFiscal[] = [];
  const ivaNetoPorTrimestre = round2((ivaRepercutidoAnual - ivaSoportadoAnual) / 4);

  for (let t = 1; t <= 4; t++) {
    const importe = round2(Math.max(0, ivaNetoPorTrimestre));
    const pagadoEntry = config.modelo303_pagados.find(
      p => p.ejercicio === ejercicio && p.trimestre === t
    );

    eventos.push({
      modelo: 'M303',
      ejercicio,
      trimestre: t,
      fechaLimite: fechaLimiteM130(ejercicio, t),
      importe: pagadoEntry ? pagadoEntry.importe : importe,
      descripcion: `Modelo 303 — ${ejercicio} T${t} (IVA trimestral autónomo)`,
      pagado: !!pagadoEntry,
      fechaPago: pagadoEntry?.fechaPago,
      sourceType: 'iva_modelo303',
    });
  }

  return eventos;
}

// ─── Generación de eventos fiscales ──────────────────────────────────────────

export async function generarEventosFiscales(
  ejercicio: number,
  declaracion: DeclaracionIRPF
): Promise<EventoFiscal[]> {
  const config = await getConfiguracionFiscal();
  const personalData = await personalDataService.getPersonalData();
  const eventos: EventoFiscal[] = [];

  const esAutonomo = personalData?.situacionLaboral?.includes('autonomo') ?? false;

  // M130 — solo si autónomo
  if (esAutonomo && declaracion.baseGeneral.rendimientosAutonomo) {
    const m130 = await calcularM130(
      ejercicio,
      declaracion.baseGeneral.rendimientosAutonomo.rendimientoNeto,
      config
    );
    eventos.push(...m130);

    // M303 — solo si autónomo con IVA (detectado si tiene fuentes con aplIva)
    const db = await initDB();
    const autonomos = await db.getAll('autonomos');
    const activo = autonomos.find((a: any) => a.activo);
    const tieneIva = activo?.fuentesIngreso?.some((f: any) => f.aplIva) ?? false;

    if (tieneIva && activo) {
      const ivaRepercutido = (activo.fuentesIngreso ?? []).reduce((sum: number, f: any) => {
        if (!f.aplIva) return sum;
        const meses = Array.isArray(f.meses) ? f.meses.length : 12;
        const ivaMedio = (activo.ivaMedioPorcentaje ?? 21) / 100;
        return sum + (f.importeEstimado ?? 0) * meses * ivaMedio;
      }, 0);

      const ivaSoportado = (activo.gastosRecurrentesActividad ?? []).reduce((sum: number, g: any) => {
        const meses = Array.isArray(g.meses) && g.meses.length > 0 ? g.meses.length : 12;
        return sum + (g.importe ?? 0) * meses * 0.21; // Estimated 21% on expenses
      }, 0);

      const m303 = await calcularM303(ejercicio, round2(ivaRepercutido), round2(ivaSoportado), config);
      eventos.push(...m303);
    }
  }

  // Declaración IRPF anual
  const mesDecl = config.mes_declaracion;
  const diaDecl = config.dia_declaracion;
  const fechaDeclaracion = `${ejercicio + 1}-${String(mesDecl).padStart(2, '0')}-${String(diaDecl).padStart(2, '0')}`;

  if (config.fraccionarPago && declaracion.resultado > 0) {
    // 60% en junio
    eventos.push({
      modelo: 'IRPF_FRACCIONES',
      ejercicio,
      fechaLimite: `${ejercicio + 1}-06-30`,
      importe: round2(declaracion.resultado * 0.6),
      descripcion: `IRPF ${ejercicio} — Primera fracción (60%)`,
      pagado: false,
      sourceType: 'irpf_declaracion',
    });
    // 40% en noviembre
    eventos.push({
      modelo: 'IRPF_FRACCIONES',
      ejercicio,
      fechaLimite: `${ejercicio + 1}-11-05`,
      importe: round2(declaracion.resultado * 0.4),
      descripcion: `IRPF ${ejercicio} — Segunda fracción (40%)`,
      pagado: false,
      sourceType: 'irpf_declaracion',
    });
  } else {
    eventos.push({
      modelo: 'IRPF_ANUAL',
      ejercicio,
      fechaLimite: fechaDeclaracion,
      importe: declaracion.resultado,
      descripcion: declaracion.resultado >= 0
        ? `IRPF ${ejercicio} — A pagar (${declaracion.resultado.toFixed(2)} €)`
        : `IRPF ${ejercicio} — A devolver (${Math.abs(declaracion.resultado).toFixed(2)} €)`,
      pagado: false,
      sourceType: 'irpf_declaracion',
    });
  }

  return eventos;
}

// ─── Convertir a TreasuryEvents ────────────────────────────────────────────────

export function eventoFiscalToTreasuryEvent(evento: EventoFiscal): Omit<TreasuryEvent, 'id'> {
  return {
    type: evento.importe >= 0 ? 'expense' : 'income',
    amount: Math.abs(evento.importe),
    predictedDate: evento.fechaLimite,
    description: evento.descripcion,
    sourceType: evento.sourceType as any,
    status: evento.pagado ? 'executed' : 'predicted',
    actualDate: evento.fechaPago,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
