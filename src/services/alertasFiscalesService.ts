// ATLAS — T24: Alertas fiscales proactivas
// Se generan al entrar a la vista Estado. No son notificaciones push.

import { initDB } from './db';
import { round2, CONSTANTES_IRPF, DeclaracionIRPF } from './irpfCalculationService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AlertaFiscal {
  id: string;
  tipo: 'arrastre_caduca' | 'gastos_faltantes' | 'retenciones_insuficientes' | 'plan_pensiones' | 'm130_pendiente' | 'datos_fiscales';
  prioridad: 'alta' | 'media' | 'baja';
  titulo: string;
  descripcion: string;
  accion?: { label: string; ruta: string };
  importeImpacto?: number;
  descartada?: boolean;
}

const DISMISSED_KEY = 'atlas_alertas_descartadas';

function getDescartadas(ejercicio: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${DISMISSED_KEY}_${ejercicio}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function descartarAlerta(ejercicio: number, alertaId: string): void {
  const descartadas = getDescartadas(ejercicio);
  descartadas.add(alertaId);
  localStorage.setItem(`${DISMISSED_KEY}_${ejercicio}`, JSON.stringify([...descartadas]));
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n)) + ' €';

// ─── Generadores de alertas ──────────────────────────────────────────────────

const TRAMOS_BASE_GENERAL = [
  { hasta: 12450, tipo: 0.19 },
  { hasta: 20200, tipo: 0.24 },
  { hasta: 35200, tipo: 0.30 },
  { hasta: 60000, tipo: 0.37 },
  { hasta: 300000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

function getTipoMarginal(baseImponible: number): number {
  for (const tramo of TRAMOS_BASE_GENERAL) {
    if (baseImponible <= tramo.hasta) return tramo.tipo;
  }
  return 0.47;
}

async function alertaArrastresCaducan(ejercicio: number): Promise<AlertaFiscal[]> {
  const alertas: AlertaFiscal[] = [];
  try {
    const db = await initDB();
    const carryForwards = await db.getAll('aeatCarryForwards');
    for (const cf of carryForwards) {
      const cfAny = cf as any;
      const origen = cfAny.origenEjercicio ?? cfAny.ejercicioOrigen ?? cfAny.year;
      const remaining = cfAny.remainingAmount ?? cfAny.importePendiente ?? 0;
      if (origen && (origen + 4) === ejercicio && remaining > 0) {
        alertas.push({
          id: `arrastre_caduca_${origen}`,
          tipo: 'arrastre_caduca',
          prioridad: 'alta',
          titulo: 'Arrastres que caducan',
          descripcion: `Las pérdidas patrimoniales de ${origen} (${fmtMoney(remaining)}) caducan este ejercicio.`,
          importeImpacto: round2(remaining),
          accion: { label: 'Ver arrastres', ruta: '/fiscalidad/historial' },
        });
      }
    }
  } catch { /* ignore */ }
  return alertas;
}

async function alertaGastosFaltantes(declaracion: DeclaracionIRPF): Promise<AlertaFiscal[]> {
  const alertas: AlertaFiscal[] = [];
  try {
    const db = await initDB();
    const properties = await db.getAll('properties');
    const tipoMarginal = getTipoMarginal(declaracion.liquidacion.baseImponibleGeneral);

    for (const inmueble of declaracion.baseGeneral.rendimientosInmuebles) {
      if (inmueble.ingresosIntegros <= 0 || inmueble.inmuebleId < 0) continue;

      const prop = properties.find((p: any) => p.id === inmueble.inmuebleId);
      if (!prop) continue;

      // Check if key expenses are missing from gastosInmueble
      let casillas: Record<string, number> = {};
      try {
        const gastosInmuebleService = (await import('./gastosInmuebleService')).gastosInmuebleService;
        casillas = await gastosInmuebleService.getSumaPorCasilla(inmueble.inmuebleId, declaracion.ejercicio);
      } catch { /* ignore */ }

      const faltantes: string[] = [];
      if ((casillas['0109'] ?? 0) === 0) faltantes.push('comunidad');
      if ((casillas['0115'] ?? 0) === 0) faltantes.push('IBI');
      if ((casillas['0114'] ?? 0) === 0) faltantes.push('seguro');

      if (faltantes.length > 0) {
        // Estimate tax savings: average costs × marginal rate
        const estimatedMissing = faltantes.length * 800; // ~800€ avg per expense type
        const ahorro = round2(estimatedMissing * tipoMarginal);

        alertas.push({
          id: `gastos_faltantes_${inmueble.inmuebleId}`,
          tipo: 'gastos_faltantes',
          prioridad: 'media',
          titulo: 'Gastos faltantes',
          descripcion: `${inmueble.alias} no tiene ${faltantes.join(', ')} ni ${faltantes.length > 1 ? '' : 'el '}registrado${faltantes.length > 1 ? 's' : ''}. Registrarlos ahorra ~${fmtMoney(ahorro)} de cuota.`,
          importeImpacto: ahorro,
          accion: { label: 'Registrar gastos', ruta: `/inmuebles/${inmueble.inmuebleId}/gastos` },
        });
      }
    }
  } catch { /* ignore */ }
  return alertas;
}

function alertaRetencionesInsuficientes(declaracion: DeclaracionIRPF): AlertaFiscal[] {
  const cuota = declaracion.liquidacion.cuotaLiquida;
  const retenciones = declaracion.retenciones.total;
  if (cuota <= 0) return [];

  const cobertura = retenciones / cuota;
  if (cobertura >= 0.95) return [];

  const aPagar = round2(cuota - retenciones);
  const porcentaje = Math.round(cobertura * 100);

  return [{
    id: 'retenciones_insuficientes',
    tipo: 'retenciones_insuficientes',
    prioridad: 'alta',
    titulo: 'Retenciones insuficientes',
    descripcion: `Tus retenciones cubren el ${porcentaje}%. En junio pagarás ~${fmtMoney(aPagar)}.`,
    importeImpacto: aPagar,
  }];
}

function alertaPlanPensiones(declaracion: DeclaracionIRPF): AlertaFiscal[] {
  const now = new Date();
  const mes = now.getMonth(); // 0-indexed
  // Solo últimos 3 meses del año (octubre, noviembre, diciembre)
  if (mes < 9) return [];

  const tipoMarginal = getTipoMarginal(declaracion.liquidacion.baseImponibleGeneral);
  if (tipoMarginal <= 0.30) return [];

  const ppActual = declaracion.reducciones.planPensiones;
  const margen = CONSTANTES_IRPF.maxAportacionPP - ppActual;
  if (margen <= 100) return []; // Less than 100€ margin, not worth alerting

  const ahorro = round2(margen * tipoMarginal);

  return [{
    id: 'plan_pensiones',
    tipo: 'plan_pensiones',
    prioridad: 'media',
    titulo: 'Plan de pensiones',
    descripcion: `Puedes aportar hasta ${fmtMoney(margen)} y ahorrarte ~${fmtMoney(ahorro)}.`,
    importeImpacto: ahorro,
    accion: { label: 'Ver inversiones', ruta: '/inversiones' },
  }];
}

async function alertaM130Pendiente(declaracion: DeclaracionIRPF, ejercicio: number): Promise<AlertaFiscal[]> {
  if (!declaracion.baseGeneral.rendimientosAutonomo) return [];

  const now = new Date();
  const fechasM130 = [
    { trimestre: 'T1', vencimiento: new Date(ejercicio, 3, 20) },
    { trimestre: 'T2', vencimiento: new Date(ejercicio, 6, 20) },
    { trimestre: 'T3', vencimiento: new Date(ejercicio, 9, 20) },
    { trimestre: 'T4', vencimiento: new Date(ejercicio + 1, 0, 30) },
  ];

  const alertas: AlertaFiscal[] = [];
  for (const { trimestre, vencimiento } of fechasM130) {
    const diasHastaVencimiento = Math.ceil((vencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diasHastaVencimiento > 0 && diasHastaVencimiento <= 30) {
      const importeEstimado = round2(declaracion.baseGeneral.rendimientosAutonomo.pagosFraccionadosM130 / 4);
      const fechaStr = vencimiento.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' });

      alertas.push({
        id: `m130_${trimestre}_${ejercicio}`,
        tipo: 'm130_pendiente',
        prioridad: 'alta',
        titulo: 'M130 pendiente',
        descripcion: `El M130 del ${trimestre} vence el ${fechaStr}. Importe estimado: ~${fmtMoney(importeEstimado)}.`,
        importeImpacto: importeEstimado,
        accion: { label: 'Ver pagos', ruta: '/fiscalidad/historial' },
      });
    }
  }
  return alertas;
}

function alertaDatosFiscalesDisponibles(ejercicio: number): AlertaFiscal[] {
  const now = new Date();
  const fechaDisponibilidad = new Date(ejercicio + 1, 2, 15); // 15 de marzo del año siguiente
  if (now < fechaDisponibilidad) return [];

  return [{
    id: `datos_fiscales_${ejercicio}`,
    tipo: 'datos_fiscales',
    prioridad: 'baja',
    titulo: 'Datos Fiscales disponibles',
    descripcion: `Los Datos Fiscales ${ejercicio} ya están disponibles. Importarlos actualiza tus datos.`,
    accion: { label: 'Importar datos', ruta: '/fiscalidad/historial' },
  }];
}

// ─── Función principal ───────────────────────────────────────────────────────

const PRIORIDAD_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 };

export async function generarAlertasFiscales(
  declaracion: DeclaracionIRPF,
  ejercicio: number
): Promise<AlertaFiscal[]> {
  const descartadas = getDescartadas(ejercicio);

  const [arrastres, gastosFaltantes, m130] = await Promise.all([
    alertaArrastresCaducan(ejercicio),
    alertaGastosFaltantes(declaracion),
    alertaM130Pendiente(declaracion, ejercicio),
  ]);

  const todas: AlertaFiscal[] = [
    ...arrastres,
    ...gastosFaltantes,
    ...alertaRetencionesInsuficientes(declaracion),
    ...alertaPlanPensiones(declaracion),
    ...m130,
    ...alertaDatosFiscalesDisponibles(ejercicio),
  ];

  // Filter dismissed, sort by priority
  return todas
    .filter(a => !descartadas.has(a.id))
    .sort((a, b) => (PRIORIDAD_ORDEN[a.prioridad] ?? 2) - (PRIORIDAD_ORDEN[b.prioridad] ?? 2));
}
