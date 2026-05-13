// ============================================================================
// S-WIZARD-PRESTAMO-V2 · pantalla única ATLAS v8
// ============================================================================
//
// Wizard de préstamo · 1 sola pantalla · modal full-screen · 2 columnas
// (form izquierda · preview live derecha). Reemplaza al antiguo wizard de
// 4 pasos. Mockup canónico · docs/mockups/atlas-wizard-prestamo-v2.html.
//
// Motor de cálculo puro · src/services/prestamoCalculatorService.ts ·
// validado al céntimo contra el contrato Santander Jose (cuota 993,43 €,
// carencia técnica 214,64 €, cuadro 97 líneas, total intereses 17.083,96 €).
//
// Reglas inviolables aplicadas:
//   · Selección visual = oro en TODOS los elementos seleccionables.
//   · Sentence case · sólo títulos de bloque uppercase.
//   · Cero hex hardcoded en JSX · 100 % tokens v8 (CSS Module).
//   · Cuadro N+1 líneas si existe carencia técnica · línea 0 destacada.
//   · Cuota NUNCA cambia por carencia técnica · cargo SEPARADO.
//   · NO se aplica detección retroactiva a préstamos existentes.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CreditCard,
  HelpCircle,
  Home,
  Info,
  Landmark,
  Plus,
  Save,
  TrendingDown,
  Trash2,
  User,
  X,
  Wallet,
} from 'lucide-react';
import { initDB, type Account, type TreasuryEvent } from '../../../services/db';
import { inmuebleService } from '../../../services/inmuebleService';
import LoanSettlementModal from '../../horizon/financiacion/components/LoanSettlementModal';
import type { Inmueble } from '../../../types/inmueble';
import type { LucideIcon } from 'lucide-react';
import { prestamosService } from '../../../services/prestamosService';
import {
  detectarCarenciaTecnica,
  generarCuadroAmortizacion,
  generarTreasuryEventDescriptors,
  type CuadroAmortizacionV2,
  type LineaCuadroV2,
  type TipoCarenciaInicialV2,
  type TipoDestinoV2,
  type TipoGarantiaV2,
  type TipoInteresV2,
  type TipoPrestamoV2,
} from '../../../services/prestamoCalculatorService';
import type { Bonificacion, DestinoCapital, Garantia, Prestamo } from '../../../types/prestamos';
import type { PrestamoFinanciacion } from '../../../types/financiacion';
import styles from './PrestamoPageV2.module.css';

// ─── Tipos auxiliares ───────────────────────────────────────────────────────
interface DestinoRow {
  id: string;
  tipo: TipoDestinoV2;
  inmuebleId: string;
  importe: number;
  porcentaje: number;
  descripcion?: string;
}

interface BonificacionRow {
  id: string;
  nombre: string;
  ppDescuento: number;            // p.p. (0.30 = -0,30 pp)
  activa: boolean;
}

interface FormState {
  // Bloque 1 · tipo
  tipoPrestamo: TipoPrestamoV2;
  // Bloque 2 · identificación
  alias: string;
  banco: string;
  cuentaCargoId: string;
  numeroContrato: string;
  // Bloque 3 · importe y plazo
  capitalRaw: string;
  plazoRaw: string;
  plazoPeriodo: 'MESES' | 'AÑOS';
  fechaFirma: string;
  fechaPrimerCargo: string;
  diaCobroRaw: string;
  // Bloque 4 · tipo de interés
  tipoInteres: TipoInteresV2;
  tinFijoRaw: string;
  interesDemoraRaw: string;
  // variable
  euriborRaw: string;
  diferencialRaw: string;
  referenciaInteres: 'euribor_12m' | 'euribor_6m' | 'euribor_3m';
  revisionPeriodo: 6 | 12;
  // mixto
  tramoFijoMesesRaw: string;
  tinTramoFijoRaw: string;
  // Bloque 5 · comisiones
  comAperturaRaw: string;
  comMantenimientoRaw: string;
  comAmortAnticipadaRaw: string;
  comModifCondicionesRaw: string;
  gastoReclamacionImpagoRaw: string;
  // Bloque 6 · bonificaciones
  bonificacionesActivas: boolean;
  bonificaciones: BonificacionRow[];
  // Bloque 7 · carencia inicial
  carenciaInicialTipo: TipoCarenciaInicialV2;
  carenciaInicialMesesRaw: string;
  // Bloque 8 · destinos
  destinos: DestinoRow[];
  // Bloque 9 · garantía
  garantiaTipo: TipoGarantiaV2;
  garantiaInmuebleId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const fmtEur = (v: number, dec = 2): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Number.isFinite(v) ? v : 0) + ' €';

const fmtPct = (v: number, dec = 2): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Number.isFinite(v) ? v : 0) + ' %';

const parseNum = (raw: string): number => {
  if (!raw) return 0;
  const normalized = String(raw).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const fmtNumeroEs = (v: number, dec = 2): string => {
  if (!Number.isFinite(v)) return '';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
};

const fmtFechaCorta = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return '';
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${MES[m - 1]} ${y}`;
};

const accountLabel = (a: Account): string => {
  const last4 = (a.iban || '').replace(/\s/g, '').slice(-4) || '????';
  const banco = a.alias || a.banco?.name || a.bank || a.name || 'Cuenta';
  return `${banco} · ···· ${last4}`;
};

// Lista de bancos derivada de las cuentas reales del usuario · sin
// catálogo inventado. Se rellena en runtime con los nombres únicos
// presentes en `accounts[].banco.name` / `accounts[].bank`.
function deriveBancosFromAccounts(accs: Account[]): string[] {
  const set = new Set<string>();
  for (const a of accs) {
    const name = (a.banco?.name || a.bank || '').trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort((x, y) => x.localeCompare(y, 'es'));
}

// Catálogo destinos · spec §2.6
const DESTINOS_OPCIONES: Array<{ value: TipoDestinoV2; label: string }> = [
  { value: 'adquisicion_inmueble', label: 'Adquisición inmueble' },
  { value: 'reforma_inmueble',     label: 'Reforma · mejora inmueble' },
  { value: 'cancelar_deuda',       label: 'Cancelar deuda anterior' },
  { value: 'inversion',            label: 'Inversión' },
  { value: 'personal',             label: 'Personal' },
  { value: 'otro',                 label: 'Otro' },
];

// Catálogo bonificaciones predefinidas
const BONIF_CATALOGO: Array<{ nombre: string; sub: string; pp: number }> = [
  { nombre: 'Nómina',       sub: '≥ 1.200 €/mes domiciliada',   pp: 0.30 },
  { nombre: 'Seguro hogar', sub: 'Contratado con el banco',     pp: 0.20 },
  { nombre: 'Seguro vida',  sub: 'Contratado con el banco',     pp: 0.20 },
  { nombre: 'Uso tarjeta',  sub: '≥ 6 operaciones/mes',         pp: 0.10 },
];

// ─── Mapeos prestamo legacy ↔ v2 ────────────────────────────────────────────
function mapCarenciaLegacyToV2(c: Prestamo['carencia']): TipoCarenciaInicialV2 {
  if (c === 'CAPITAL') return 'solo_capital';
  if (c === 'TOTAL') return 'total';
  return 'ninguna';
}
function mapCarenciaV2ToLegacy(c: TipoCarenciaInicialV2): Prestamo['carencia'] {
  if (c === 'solo_capital') return 'CAPITAL';
  if (c === 'total') return 'TOTAL';
  return 'NINGUNA';
}
function mapDestinoLegacyToV2(t: DestinoCapital['tipo']): TipoDestinoV2 {
  switch (t) {
    case 'ADQUISICION':        return 'adquisicion_inmueble';
    case 'REFORMA':            return 'reforma_inmueble';
    case 'CANCELACION_DEUDA':  return 'cancelar_deuda';
    case 'INVERSION':          return 'inversion';
    case 'PERSONAL':           return 'personal';
    case 'OTRA':
    default:                   return 'otro';
  }
}
function mapDestinoV2ToLegacy(t: TipoDestinoV2): DestinoCapital['tipo'] {
  switch (t) {
    case 'adquisicion_inmueble': return 'ADQUISICION';
    case 'reforma_inmueble':     return 'REFORMA';
    case 'cancelar_deuda':       return 'CANCELACION_DEUDA';
    case 'inversion':            return 'INVERSION';
    case 'personal':             return 'PERSONAL';
    case 'otro':
    default:                     return 'OTRA';
  }
}
function mapGarantiaLegacyToV2(t: Garantia['tipo']): TipoGarantiaV2 {
  switch (t) {
    case 'HIPOTECARIA':  return 'hipotecaria';
    case 'PIGNORATICIA': return 'pignoraticia';
    case 'PERSONAL':
    default:             return 'personal';
  }
}
function mapGarantiaV2ToLegacy(t: TipoGarantiaV2): Garantia['tipo'] {
  switch (t) {
    case 'hipotecaria':  return 'HIPOTECARIA';
    case 'pignoraticia': return 'PIGNORATICIA';
    case 'personal':
    default:             return 'PERSONAL';
  }
}

// ─── Estado inicial ─────────────────────────────────────────────────────────
// ISO YYYY-MM-DD construido desde componentes LOCALES (evita drift por UTC).
function localIsoToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyFormState(): FormState {
  const isoToday = localIsoToday();
  return {
    tipoPrestamo: 'personal',
    alias: '',
    banco: '',
    cuentaCargoId: '',
    numeroContrato: '',
    capitalRaw: '',
    plazoRaw: '',
    plazoPeriodo: 'MESES',
    fechaFirma: isoToday,
    fechaPrimerCargo: '',
    diaCobroRaw: '1',
    tipoInteres: 'fijo',
    tinFijoRaw: '',
    interesDemoraRaw: '',
    euriborRaw: '',
    diferencialRaw: '',
    referenciaInteres: 'euribor_12m',
    revisionPeriodo: 12,
    tramoFijoMesesRaw: '',
    tinTramoFijoRaw: '',
    comAperturaRaw: '0',
    comMantenimientoRaw: '0',
    comAmortAnticipadaRaw: '0',
    comModifCondicionesRaw: '0',
    gastoReclamacionImpagoRaw: '0',
    bonificacionesActivas: false,
    bonificaciones: BONIF_CATALOGO.map((b) => ({
      id: uid(),
      nombre: b.nombre,
      ppDescuento: b.pp,
      activa: false,
    })),
    carenciaInicialTipo: 'ninguna',
    carenciaInicialMesesRaw: '0',
    destinos: [
      { id: uid(), tipo: 'personal', inmuebleId: '', importe: 0, porcentaje: 100 },
    ],
    garantiaTipo: 'personal',
    garantiaInmuebleId: '',
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────
export interface PrestamoPageV2Props {
  /** Id del préstamo en modo edición. Undefined/null = creación. */
  prestamoId?: string;
  /** Datos iniciales (procedentes de FEIN u otro origen). */
  initialData?: Partial<PrestamoFinanciacion>;
  onSuccess: () => void;
  onCancel: () => void;
}

const PrestamoPageV2: React.FC<PrestamoPageV2Props> = ({
  prestamoId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCuadroCompleto, setShowCuadroCompleto] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadedPrestamo, setLoadedPrestamo] = useState<Prestamo | null>(null);
  const [showAmortizarModal, setShowAmortizarModal] = useState(false);

  const isEditing = Boolean(prestamoId);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }, []);

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const [accs, props] = await Promise.all([
          db.getAll('accounts'),
          inmuebleService.getAll(),
        ]);
        if (cancelled) return;
        const activeAccs = (accs as Account[]).filter(
          (a) => a.activa !== false && a.status !== 'DELETED',
        );
        setAccounts(activeAccs);
        setInmuebles(props as Inmueble[]);

        if (prestamoId) {
          const prestamo = await prestamosService.getPrestamoById(prestamoId);
          if (prestamo && !cancelled) {
            setLoadedPrestamo(prestamo);
            hydrateFromPrestamo(prestamo, activeAccs);
          }
        } else if (initialData) {
          hydrateFromFEIN(initialData);
        } else if (activeAccs.length > 0 && !cancelled) {
          const def = activeAccs.find((a) => a.isDefault) ?? activeAccs[0];
          const defBanco = (def.banco?.name || def.bank || '').trim();
          setForm((prev) => ({
            ...prev,
            cuentaCargoId: String(def.id ?? ''),
            banco: prev.banco || defBanco,
          }));
        }
      } catch (e) {
        console.error('[PrestamoPageV2] error carga inicial', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestamoId]);

  const hydrateFromPrestamo = (p: Prestamo, _accs: Account[]) => {
    const destinos: DestinoRow[] = (p.destinos && p.destinos.length > 0)
      ? p.destinos.map((d) => ({
          id: d.id || uid(),
          tipo: mapDestinoLegacyToV2(d.tipo),
          inmuebleId: d.inmuebleId || '',
          importe: d.importe,
          porcentaje: d.porcentaje ?? (p.principalInicial > 0 ? (d.importe / p.principalInicial) * 100 : 0),
          descripcion: d.descripcion,
        }))
      : [{
          id: uid(),
          tipo: p.inmuebleId ? 'adquisicion_inmueble' : 'personal',
          inmuebleId: p.inmuebleId || '',
          importe: p.principalInicial,
          porcentaje: 100,
        }];

    const garantiaPrimera = p.garantias?.[0];

    const bonificaciones: BonificacionRow[] = (p.bonificaciones && p.bonificaciones.length > 0)
      ? p.bonificaciones.map((b) => ({
          id: b.id,
          nombre: b.nombre,
          ppDescuento: b.reduccionPuntosPorcentuales,
          activa: b.estado !== 'INACTIVO',
        }))
      : BONIF_CATALOGO.map((b) => ({ id: uid(), nombre: b.nombre, ppDescuento: b.pp, activa: false }));

    setForm({
      tipoPrestamo: (p.tipoPrestamoV2 as TipoPrestamoV2) || (p.inmuebleId ? 'hipotecario' : 'personal'),
      alias: p.nombre || '',
      banco: p.banco || '',
      cuentaCargoId: p.cuentaCargoId || '',
      numeroContrato: p.numeroContrato || '',
      capitalRaw: fmtNumeroEs(p.principalInicial),
      plazoRaw: String(p.plazoMesesTotal),
      plazoPeriodo: 'MESES',
      fechaFirma: p.fechaFirma,
      fechaPrimerCargo: p.fechaPrimerCargo,
      diaCobroRaw: String(p.diaCargoMes ?? 1),
      tipoInteres: p.tipo.toLowerCase() as TipoInteresV2,
      tinFijoRaw: p.tipoNominalAnualFijo !== undefined ? fmtNumeroEs(p.tipoNominalAnualFijo) : '',
      interesDemoraRaw: p.interesDemoraPct !== undefined ? fmtNumeroEs(p.interesDemoraPct) : '',
      euriborRaw: p.valorIndiceActual !== undefined ? fmtNumeroEs(p.valorIndiceActual) : '',
      diferencialRaw: p.diferencial !== undefined ? fmtNumeroEs(p.diferencial) : '',
      referenciaInteres: 'euribor_12m',
      revisionPeriodo: (p.periodoRevisionMeses as 6 | 12) || 12,
      tramoFijoMesesRaw: p.tramoFijoMeses ? String(p.tramoFijoMeses) : '',
      tinTramoFijoRaw: p.tipoNominalAnualMixtoFijo !== undefined ? fmtNumeroEs(p.tipoNominalAnualMixtoFijo) : '',
      comAperturaRaw: fmtNumeroEs(p.comisionApertura ?? 0),
      comMantenimientoRaw: fmtNumeroEs(p.comisionMantenimiento ?? 0),
      comAmortAnticipadaRaw: fmtNumeroEs(p.comisionAmortizacionAnticipada ?? 0),
      comModifCondicionesRaw: fmtNumeroEs(p.comisionModificacionCondiciones ?? 0),
      gastoReclamacionImpagoRaw: fmtNumeroEs(p.gastoReclamacionImpago ?? 0),
      bonificacionesActivas: bonificaciones.some((b) => b.activa),
      bonificaciones,
      carenciaInicialTipo: mapCarenciaLegacyToV2(p.carencia),
      carenciaInicialMesesRaw: String(p.carenciaMeses ?? 0),
      destinos,
      garantiaTipo: garantiaPrimera ? mapGarantiaLegacyToV2(garantiaPrimera.tipo) : 'personal',
      garantiaInmuebleId: garantiaPrimera?.inmuebleId || '',
    });
  };

  const hydrateFromFEIN = (data: Partial<PrestamoFinanciacion>) => {
    const cap = data.capitalInicial ?? 0;
    const plazo = data.plazoPeriodo === 'AÑOS' ? (data.plazoTotal || 0) * 12 : (data.plazoTotal || 0);
    setForm((prev) => ({
      ...prev,
      alias: data.alias || prev.alias,
      cuentaCargoId: data.cuentaCargoId || prev.cuentaCargoId,
      capitalRaw: cap ? fmtNumeroEs(cap) : prev.capitalRaw,
      plazoRaw: plazo ? String(plazo) : prev.plazoRaw,
      fechaFirma: data.fechaFirma || prev.fechaFirma,
      fechaPrimerCargo: data.fechaPrimerCargo || prev.fechaPrimerCargo,
      diaCobroRaw: data.diaCobroMes ? String(data.diaCobroMes) : prev.diaCobroRaw,
      tipoInteres: (data.tipo?.toLowerCase() as TipoInteresV2) || prev.tipoInteres,
      tinFijoRaw: data.tinFijo !== undefined ? fmtNumeroEs(data.tinFijo) : prev.tinFijoRaw,
      comAperturaRaw: data.comisionApertura !== undefined ? fmtNumeroEs(data.comisionApertura) : prev.comAperturaRaw,
    }));
  };

  // ─── Derivados ────────────────────────────────────────────────────────────
  const capital = useMemo(() => parseNum(form.capitalRaw), [form.capitalRaw]);
  const numCuotas = useMemo(() => {
    const p = parseInt(form.plazoRaw, 10) || 0;
    return form.plazoPeriodo === 'AÑOS' ? p * 12 : p;
  }, [form.plazoRaw, form.plazoPeriodo]);
  const tinFijoPct = useMemo(() => parseNum(form.tinFijoRaw), [form.tinFijoRaw]);
  const diaCobro = useMemo(() => {
    const d = parseInt(form.diaCobroRaw, 10) || 1;
    return Math.max(1, Math.min(31, d));
  }, [form.diaCobroRaw]);

  // Bancos disponibles · derivados de las cuentas del usuario (no de un
  // catálogo hardcoded). Si el préstamo trae un banco que ya no existe en
  // accounts (caso edit · cuenta eliminada), lo añadimos para no perderlo.
  const bancosDisponibles = useMemo(() => {
    const list = deriveBancosFromAccounts(accounts);
    if (form.banco && !list.includes(form.banco)) list.unshift(form.banco);
    return list;
  }, [accounts, form.banco]);

  // TIN base aplicable según tipo de interés (a t=0).
  //   fijo     · TIN fijo.
  //   variable · euríbor + diferencial.
  //   mixto    · TIN del tramo fijo (durante el período fijo · que es lo que
  //              se carga al inicio del préstamo y por tanto lo correcto
  //              para el cuadro inicial y los eventos de tesorería).
  // El motor financiero v2 sigue calculando con cuota CONSTANTE — los
  // ajustes en revisiones futuras (variable/mixto) son spec aparte (§7).
  const tinBasePct = useMemo(() => {
    if (form.tipoInteres === 'fijo') return tinFijoPct;
    if (form.tipoInteres === 'variable') {
      return parseNum(form.euriborRaw) + parseNum(form.diferencialRaw);
    }
    if (form.tipoInteres === 'mixto') return parseNum(form.tinTramoFijoRaw);
    return 0;
  }, [form.tipoInteres, tinFijoPct, form.euriborRaw, form.diferencialRaw, form.tinTramoFijoRaw]);

  // TIN efectivo (con bonificaciones activas)
  const tinEfectivoPct = useMemo(() => {
    const base = tinBasePct;
    if (!form.bonificacionesActivas) return base;
    const totalBonif = form.bonificaciones
      .filter((b) => b.activa)
      .reduce((sum, b) => sum + b.ppDescuento, 0);
    return Math.max(0, base - totalBonif);
  }, [tinBasePct, form.bonificacionesActivas, form.bonificaciones]);

  const cuadro: CuadroAmortizacionV2 | null = useMemo(() => {
    if (capital <= 0 || numCuotas <= 0 || tinEfectivoPct < 0 || !form.fechaFirma || !form.fechaPrimerCargo) {
      return null;
    }
    return generarCuadroAmortizacion({
      capital,
      tinAnual: tinEfectivoPct / 100,
      numCuotas,
      fechaFirma: form.fechaFirma,
      primerCargoCuadro: form.fechaPrimerCargo,
      diaCobro,
      comisiones: {
        apertura: parseNum(form.comAperturaRaw),
      },
    });
  }, [capital, numCuotas, tinEfectivoPct, form.fechaFirma, form.fechaPrimerCargo, diaCobro, form.comAperturaRaw]);

  const carencia = useMemo(() => {
    if (!form.fechaFirma) return null;
    return detectarCarenciaTecnica(form.fechaFirma, diaCobro);
  }, [form.fechaFirma, diaCobro]);

  // Cuadre destinos · suma de importes = capital (± 0,01)
  const destinosCuadre = useMemo(() => {
    const total = form.destinos.reduce((sum, d) => sum + (d.importe || 0), 0);
    const ok = Math.abs(total - capital) < 0.01;
    return { total, ok };
  }, [form.destinos, capital]);

  // Deducibilidad fiscal — heurística según destino
  const deducibilidadInfo = useMemo(() => {
    const destinos = form.destinos;
    const hayInmuebleAfectado = destinos.some(
      (d) => (d.tipo === 'adquisicion_inmueble' || d.tipo === 'reforma_inmueble') && d.inmuebleId,
    );
    if (hayInmuebleAfectado) {
      return {
        deducible: true,
        mensaje: 'Intereses potencialmente deducibles en casilla 0105 IRPF si el inmueble está alquilado.',
      };
    }
    const soloPersonal = destinos.every((d) => d.tipo === 'personal' || d.tipo === 'otro');
    if (soloPersonal) {
      return {
        deducible: false,
        mensaje: 'Destino personal · los intereses NO son deducibles fiscalmente. Si el préstamo financia un inmueble en alquiler · cambia el destino para activar la deducibilidad en casilla 0105.',
      };
    }
    return {
      deducible: false,
      mensaje: 'Destino mixto · revisa la deducibilidad según el destino concreto.',
    };
  }, [form.destinos]);

  // ─── Acciones sobre destinos ──────────────────────────────────────────────
  const addDestino = () => {
    update('destinos', [
      ...form.destinos,
      { id: uid(), tipo: 'personal', inmuebleId: '', importe: 0, porcentaje: 0 },
    ]);
  };
  const removeDestino = (id: string) => {
    update('destinos', form.destinos.filter((d) => d.id !== id));
  };
  const updateDestino = (id: string, patch: Partial<DestinoRow>) => {
    update(
      'destinos',
      form.destinos.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...patch };
        if (patch.porcentaje !== undefined && capital > 0) {
          next.importe = (patch.porcentaje / 100) * capital;
        } else if (patch.importe !== undefined && capital > 0) {
          next.porcentaje = (patch.importe / capital) * 100;
        }
        return next;
      }),
    );
  };

  const toggleBonificacion = (id: string) => {
    update(
      'bonificaciones',
      form.bonificaciones.map((b) => (b.id === id ? { ...b, activa: !b.activa } : b)),
    );
  };
  const addBonificacionCustom = () => {
    update('bonificaciones', [
      ...form.bonificaciones,
      { id: uid(), nombre: 'Personalizada', ppDescuento: 0.10, activa: true },
    ]);
  };
  // ─── Validación + submit ──────────────────────────────────────────────────
  const validar = (): string | null => {
    if (!form.alias.trim()) return 'Introduce un alias para el préstamo.';
    if (!form.cuentaCargoId) return 'Selecciona la cuenta de cargo.';
    if (capital <= 0) return 'Introduce el capital inicial.';
    if (numCuotas <= 0) return 'Introduce el plazo.';
    if (!form.fechaFirma) return 'Introduce la fecha de firma.';
    if (!form.fechaPrimerCargo) return 'Introduce la fecha del primer cargo.';
    if (diaCobro < 1 || diaCobro > 31) return 'El día de cobro debe estar entre 1 y 31.';
    if (form.tipoInteres === 'fijo' && tinFijoPct <= 0) return 'Introduce el TIN fijo.';
    if (form.tipoInteres === 'variable' && parseNum(form.diferencialRaw) <= 0) return 'Introduce el diferencial.';
    if (form.tipoInteres === 'mixto') {
      if (parseNum(form.tinTramoFijoRaw) <= 0) return 'Introduce el TIN del tramo fijo.';
      if ((parseInt(form.tramoFijoMesesRaw, 10) || 0) <= 0) return 'Introduce los meses del tramo fijo.';
    }
    if (tinBasePct <= 0) return 'Introduce un TIN válido.';
    if (!destinosCuadre.ok) {
      return `Los importes (${fmtEur(destinosCuadre.total)}) deben sumar el capital inicial (${fmtEur(capital)}).`;
    }
    const inmuebleFaltante = form.destinos.some(
      (d) => (d.tipo === 'adquisicion_inmueble' || d.tipo === 'reforma_inmueble') && !d.inmuebleId,
    );
    if (inmuebleFaltante) return 'Selecciona un inmueble para todos los destinos de compra o reforma.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validar();
    if (err) {
      setSubmitError(err);
      toast.error(err);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const destinosLegacy: DestinoCapital[] = form.destinos.map((d) => ({
        id: d.id,
        tipo: mapDestinoV2ToLegacy(d.tipo),
        inmuebleId: d.inmuebleId || undefined,
        importe: d.importe,
        porcentaje: d.porcentaje,
        descripcion: d.descripcion,
      }));
      const garantias: Garantia[] = [{
        tipo: mapGarantiaV2ToLegacy(form.garantiaTipo),
        inmuebleId: form.garantiaTipo === 'hipotecaria' ? form.garantiaInmuebleId || undefined : undefined,
      }];

      const ambito: 'PERSONAL' | 'INMUEBLE' = destinosLegacy.some((d) => d.inmuebleId)
        ? 'INMUEBLE'
        : 'PERSONAL';

      const bonificaciones: Bonificacion[] = form.bonificacionesActivas
        ? form.bonificaciones.filter((b) => b.activa).map((b) => ({
            id: b.id,
            tipo: 'OTROS',
            nombre: b.nombre,
            reduccionPuntosPorcentuales: b.ppDescuento,
            impacto: { puntos: -b.ppDescuento },
            aplicaEn: 'FIJO',
            lookbackMeses: 6,
            regla: { tipo: 'OTRA', descripcion: b.nombre },
            estado: 'SELECCIONADO',
            seleccionado: true,
          }))
        : [];

      // NO aplicar detección retroactiva a préstamos pre-v2:
      // si estamos editando y el préstamo existente NO trae el campo
      // `carenciaTecnica` (undefined ≡ creado antes del wizard v2 o
      // importado), preservamos null para no inyectar un cargo nuevo.
      // Si el campo viene de v2 (objeto o null explícito), recalculamos.
      const existingPrestamo = prestamoId
        ? await prestamosService.getPrestamoById(prestamoId)
        : null;
      const esPreV2 = Boolean(existingPrestamo) && existingPrestamo?.carenciaTecnica === undefined;
      const carenciaInfo = !esPreV2 && cuadro && cuadro.resumen.interesesCarenciaTecnica > 0 && carencia?.existe
        ? {
            dias: carencia.dias,
            fechaLiquidacion: carencia.fechaLiquidacion as string,
            intereses: cuadro.resumen.interesesCarenciaTecnica,
          }
        : (esPreV2 ? (existingPrestamo?.carenciaTecnica ?? null) : null);

      const payload: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
        ambito,
        destinos: destinosLegacy,
        garantias,
        nombre: form.alias.trim(),
        cuentaCargoId: form.cuentaCargoId,
        fechaFirma: form.fechaFirma,
        fechaPrimerCargo: form.fechaPrimerCargo,
        diaCargoMes: diaCobro,
        esquemaPrimerRecibo: carenciaInfo ? 'PRORRATA' : 'NORMAL',
        principalInicial: capital,
        principalVivo: capital,
        plazoMesesTotal: numCuotas,
        tipo: form.tipoInteres.toUpperCase() as Prestamo['tipo'],
        sistema: 'FRANCES',
        tipoNominalAnualFijo: form.tipoInteres === 'fijo' ? tinFijoPct : undefined,
        valorIndiceActual: form.tipoInteres !== 'fijo' ? parseNum(form.euriborRaw) : undefined,
        diferencial: form.tipoInteres !== 'fijo' ? parseNum(form.diferencialRaw) : undefined,
        periodoRevisionMeses: form.tipoInteres !== 'fijo' ? form.revisionPeriodo : undefined,
        tramoFijoMeses: form.tipoInteres === 'mixto' ? parseInt(form.tramoFijoMesesRaw, 10) || undefined : undefined,
        tipoNominalAnualMixtoFijo: form.tipoInteres === 'mixto' ? parseNum(form.tinTramoFijoRaw) : undefined,
        carencia: mapCarenciaV2ToLegacy(form.carenciaInicialTipo),
        carenciaMeses: form.carenciaInicialTipo !== 'ninguna' ? parseInt(form.carenciaInicialMesesRaw, 10) || 0 : undefined,
        comisionApertura: parseNum(form.comAperturaRaw),
        comisionMantenimiento: parseNum(form.comMantenimientoRaw),
        comisionAmortizacionAnticipada: parseNum(form.comAmortAnticipadaRaw),
        bonificaciones,
        cuotasPagadas: 0,
        origenCreacion: initialData ? 'FEIN' : 'MANUAL',
        activo: true,
        // ── v2 extensiones ────────────────────────────────────────────────
        tipoPrestamoV2: form.tipoPrestamo,
        banco: form.banco,
        numeroContrato: form.numeroContrato || undefined,
        interesDemoraPct: parseNum(form.interesDemoraRaw) || undefined,
        comisionModificacionCondiciones: parseNum(form.comModifCondicionesRaw) || undefined,
        gastoReclamacionImpago: parseNum(form.gastoReclamacionImpagoRaw) || undefined,
        carenciaTecnica: carenciaInfo,
      };

      let saved: Prestamo | null;
      if (prestamoId) {
        if (existingPrestamo) {
          payload.principalVivo = existingPrestamo.principalVivo;
          payload.cuotasPagadas = existingPrestamo.cuotasPagadas;
        }
        saved = await prestamosService.updatePrestamo(prestamoId, payload as Partial<Prestamo>);
      } else {
        saved = await prestamosService.createPrestamo(payload);
      }

      if (!saved) {
        throw new Error('No se ha podido guardar el préstamo.');
      }

      // Treasury events · regenerar desde cero (sub-tarea 6). Si el préstamo
      // es pre-v2 (no admitimos detección retroactiva) excluimos la línea
      // de carencia técnica del flujo de eventos.
      await regenerarTreasuryEvents(saved, { incluirCarencia: !esPreV2 });

      toast.success(prestamoId ? 'Préstamo actualizado' : 'Préstamo creado');
      onSuccess();
    } catch (e) {
      console.error('[PrestamoPageV2] error al guardar', e);
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setSubmitError(`Error al guardar · ${msg}`);
      toast.error('Error al guardar el préstamo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Treasury events · regenerar al guardar ──────────────────────────────
  // Derivamos el TIN aplicable directamente del `prestamo` guardado (no del
  // memo de form state) para asegurarnos de que NO dependemos de un cuadro
  // memoizado · vale para fijo/variable/mixto a tipos no-cero.
  // `incluirCarencia=false` (préstamos pre-v2) excluye la línea 0 de
  // carencia técnica · el resto se persisten igual.
  const tinEfectivoFromPrestamo = (p: Prestamo): number => {
    let base = 0;
    switch (p.tipo) {
      case 'FIJO':
        base = p.tipoNominalAnualFijo ?? 0;
        break;
      case 'VARIABLE':
        base = (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0);
        break;
      case 'MIXTO':
        // Cuadro inicial · período fijo del mixto.
        base = p.tipoNominalAnualMixtoFijo ?? 0;
        break;
    }
    const bonifSum = (p.bonificaciones ?? [])
      .filter((b) => b.estado !== 'INACTIVO')
      .reduce((s, b) => s + (b.reduccionPuntosPorcentuales ?? 0), 0);
    return Math.max(0, base - bonifSum);
  };

  const regenerarTreasuryEvents = async (
    prestamo: Prestamo,
    options: { incluirCarencia: boolean } = { incluirCarencia: true },
  ) => {
    const tinPct = tinEfectivoFromPrestamo(prestamo);
    if (
      prestamo.principalInicial <= 0 ||
      prestamo.plazoMesesTotal <= 0 ||
      tinPct <= 0 ||
      !prestamo.fechaFirma ||
      !prestamo.fechaPrimerCargo
    ) {
      // Datos incompletos · NO regeneramos eventos.
      return;
    }

    const db = await initDB();
    const accountIdNum = parseInt(prestamo.cuentaCargoId, 10);
    const accountId = Number.isFinite(accountIdNum) ? accountIdNum : undefined;

    // 1. borrar eventos previstos existentes con prestamoId · respetar executed
    const todos = await db.getAll('treasuryEvents');
    const aBorrar = (todos as TreasuryEvent[]).filter(
      (e) => e.prestamoId === prestamo.id && e.status !== 'executed',
    );
    for (const ev of aBorrar) {
      if (ev.id !== undefined) {
        await db.delete('treasuryEvents', ev.id);
      }
    }

    // 2. generar descriptores y persistir · TIN derivado del prestamo
    //    (no del memo del form) · variable/mixto coherentes.
    const descriptors = generarTreasuryEventDescriptors({
      id: prestamo.id,
      alias: prestamo.nombre,
      capital: prestamo.principalInicial,
      fechaFirma: prestamo.fechaFirma,
      primerCargoCuadro: prestamo.fechaPrimerCargo,
      diaCobro: prestamo.diaCargoMes,
      tinAnual: tinPct / 100,
      numCuotas: prestamo.plazoMesesTotal,
      cuentaCargoId: accountId,
    });
    const descriptorsAPersistir = options.incluirCarencia
      ? descriptors
      : descriptors.filter((d) => !d.esCarenciaTecnica);

    const now = new Date().toISOString();
    const isHipoteca = prestamo.ambito === 'INMUEBLE';
    for (const d of descriptorsAPersistir) {
      const event: Omit<TreasuryEvent, 'id'> = {
        type: d.tipo === 'ingreso' ? 'income' : 'financing',
        amount: d.importe,
        predictedDate: d.fecha,
        description: d.concepto,
        sourceType: d.tipo === 'ingreso' ? 'otros_ingresos' : (isHipoteca ? 'hipoteca' : 'prestamo'),
        accountId: d.cuentaId,
        prestamoId: d.prestamoId,
        numeroCuota: d.numeroCuota,
        status: 'predicted',
        ambito: prestamo.ambito,
        // Marker explícito para que la UI de tesorería pueda surfacear la
        // línea de carencia técnica · NO depender del texto del concepto.
        notes: d.esCarenciaTecnica ? 'carencia_tecnica' : undefined,
        createdAt: now,
        updatedAt: now,
        generadoPor: 'treasurySyncService',
      };
      await db.add('treasuryEvents', event as TreasuryEvent);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.loadingState}>Cargando préstamo…</div>
          </div>
        </div>
      </div>
    );
  }

  const tipoOptions: Array<{ id: TipoPrestamoV2; label: string; Icon: LucideIcon }> = [
    { id: 'hipotecario',  label: 'Hipotecario',   Icon: Home },
    { id: 'personal',     label: 'Personal',      Icon: User },
    { id: 'linea_credito',label: 'Línea crédito', Icon: CreditCard },
    { id: 'otro',         label: 'Otro',          Icon: HelpCircle },
  ];

  const garantiaOptions: Array<{ id: TipoGarantiaV2; label: string; sub: string; Icon: LucideIcon }> = [
    { id: 'hipotecaria', label: 'Hipotecaria', sub: 'Un inmueble responde como garantía',  Icon: Landmark },
    { id: 'personal',    label: 'Personal',    sub: 'El titular responde con su patrimonio', Icon: User },
    { id: 'pignoraticia',label: 'Pignoraticia',sub: 'Activo financiero pignorado',         Icon: Wallet },
  ];

  const titleHeader = isEditing ? `Editar préstamo · ${form.alias || '—'}` : 'Nuevo préstamo';
  const subHeader = capital > 0 && numCuotas > 0
    ? `${fmtEur(capital, 0)} · ${form.tipoPrestamo} · ${numCuotas} cuotas · firma ${fmtFechaCorta(form.fechaFirma)}`
    : 'Completa los datos del préstamo';

  return (
    <div className={styles.root}>
      <div className={styles.overlay}>
        <div className={styles.modal}>

          {/* HEADER */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.headerIcon}>
                <Building2 />
              </div>
              <div>
                <div className={styles.headerTitle}>{titleHeader}</div>
                <div className={styles.headerSub}>{subHeader}</div>
              </div>
            </div>
            <button className={styles.headerClose} onClick={onCancel} title="Cerrar">
              <X size={14} />
            </button>
          </div>

          {/* BODY */}
          <div className={styles.body}>

            {/* COLUMNA FORM */}
            <div className={styles.colForm}>

              {/* Bloque 1 · Tipo */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Tipo de préstamo</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.typeSelector4}>
                    {tipoOptions.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.typeCard} ${form.tipoPrestamo === id ? styles.typeCardSelected : ''}`}
                        onClick={() => update('tipoPrestamo', id)}
                      >
                        <Icon size={22} />
                        <span className={styles.typeCardLabel}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bloque 2 · Identificación */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Identificación</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={`${styles.fieldsRow} ${styles.rowIdentif}`}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Alias <span className="req">*</span></label>
                      <input
                        className={styles.input}
                        value={form.alias}
                        onChange={(e) => update('alias', e.target.value)}
                        placeholder="Santander preconcedido"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Banco</label>
                      <select
                        className={styles.select}
                        value={form.banco}
                        onChange={(e) => update('banco', e.target.value)}
                      >
                        <option value="">— Selecciona —</option>
                        {bancosDisponibles.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Cuenta cargo <span className="req">*</span></label>
                      <select
                        className={styles.select}
                        value={form.cuentaCargoId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          const acc = accounts.find((a) => String(a.id) === newId);
                          const newBanco = (acc?.banco?.name || acc?.bank || '').trim();
                          setForm((prev) => ({
                            ...prev,
                            cuentaCargoId: newId,
                            // Si el banco está vacío o coincide con el de la cuenta previa,
                            // lo sincronizamos con la nueva cuenta.
                            banco: newBanco && (!prev.banco || prev.banco === '') ? newBanco : prev.banco,
                          }));
                          setSubmitError(null);
                        }}
                      >
                        <option value="">— Selecciona —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={String(a.id)}>{accountLabel(a)}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Nº contrato <span className="hint">opcional</span></label>
                      <input
                        className={`${styles.input} ${styles.inputMono}`}
                        style={{ fontSize: 11 }}
                        value={form.numeroContrato}
                        onChange={(e) => update('numeroContrato', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 3 · Importe y plazo */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Importe y plazo</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={`${styles.fieldsRow} ${styles.rowImporte}`}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Capital inicial <span className="req">*</span></label>
                      <div className={styles.inputSuffix}>
                        <input
                          className={`${styles.input} ${styles.inputMono}`}
                          value={form.capitalRaw}
                          onChange={(e) => update('capitalRaw', e.target.value)}
                          placeholder="78.500,00"
                        />
                        <span className={styles.suffix}>€</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Plazo</label>
                      <input
                        className={`${styles.input} ${styles.inputMono}`}
                        value={form.plazoRaw}
                        onChange={(e) => update('plazoRaw', e.target.value)}
                        placeholder="96"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>&nbsp;</label>
                      <select
                        className={styles.select}
                        value={form.plazoPeriodo}
                        onChange={(e) => update('plazoPeriodo', e.target.value as 'MESES' | 'AÑOS')}
                      >
                        <option value="MESES">Meses</option>
                        <option value="AÑOS">Años</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Fecha firma <span className="req">*</span></label>
                      <input
                        type="date"
                        className={styles.input}
                        value={form.fechaFirma}
                        onChange={(e) => update('fechaFirma', e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Primer cargo</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={form.fechaPrimerCargo}
                        onChange={(e) => update('fechaPrimerCargo', e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Día cobro</label>
                      <input
                        className={`${styles.input} ${styles.inputMono}`}
                        value={form.diaCobroRaw}
                        onChange={(e) => update('diaCobroRaw', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 4 · Tipo interés */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Tipo de interés</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.seg3} style={{ marginBottom: 12 }}>
                    {(['fijo', 'variable', 'mixto'] as TipoInteresV2[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.seg} ${form.tipoInteres === t ? styles.segSelected : ''}`}
                        onClick={() => update('tipoInteres', t)}
                      >
                        {t[0].toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  {form.tipoInteres === 'fijo' && (
                    <div className={`${styles.fieldsRow} ${styles.rowTinFijo}`}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>TIN fijo <span className="req">*</span></label>
                        <div className={styles.inputSuffix}>
                          <input
                            className={`${styles.input} ${styles.inputMono}`}
                            value={form.tinFijoRaw}
                            onChange={(e) => update('tinFijoRaw', e.target.value)}
                            placeholder="4,99"
                          />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Interés demora</label>
                        <div className={styles.inputSuffix}>
                          <input
                            className={`${styles.input} ${styles.inputMono}`}
                            value={form.interesDemoraRaw}
                            onChange={(e) => update('interesDemoraRaw', e.target.value)}
                            placeholder="6,99"
                          />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {form.tipoInteres === 'variable' && (
                    <div className={`${styles.fieldsRow} ${styles.rowTinVariable}`}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Referencia</label>
                        <select
                          className={styles.select}
                          value={form.referenciaInteres}
                          onChange={(e) => update('referenciaInteres', e.target.value as FormState['referenciaInteres'])}
                        >
                          <option value="euribor_12m">Euríbor 12m</option>
                          <option value="euribor_6m">Euríbor 6m</option>
                          <option value="euribor_3m">Euríbor 3m</option>
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Valor</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.euriborRaw}
                            onChange={(e) => update('euriborRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Diferencial <span className="req">*</span></label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.diferencialRaw}
                            onChange={(e) => update('diferencialRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Revisión</label>
                        <select
                          className={styles.select}
                          value={form.revisionPeriodo}
                          onChange={(e) => update('revisionPeriodo', Number(e.target.value) as 6 | 12)}
                        >
                          <option value={6}>Semestral</option>
                          <option value={12}>Anual</option>
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Interés demora</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.interesDemoraRaw}
                            onChange={(e) => update('interesDemoraRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {form.tipoInteres === 'mixto' && (
                    <div className={`${styles.fieldsRow} ${styles.rowTinMixto}`}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Período fijo</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.tramoFijoMesesRaw}
                            onChange={(e) => update('tramoFijoMesesRaw', e.target.value)} />
                          <span className={styles.suffix}>meses</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>TIN período fijo</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.tinTramoFijoRaw}
                            onChange={(e) => update('tinTramoFijoRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Euríbor</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.euriborRaw}
                            onChange={(e) => update('euriborRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Diferencial</label>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={form.diferencialRaw}
                            onChange={(e) => update('diferencialRaw', e.target.value)} />
                          <span className={styles.suffix}>%</span>
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Revisión variable</label>
                        <select
                          className={styles.select}
                          value={form.revisionPeriodo}
                          onChange={(e) => update('revisionPeriodo', Number(e.target.value) as 6 | 12)}
                        >
                          <option value={6}>Semestral</option>
                          <option value={12}>Anual</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bloque 5 · Comisiones */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>Comisiones</div>
                </div>
                <div className={styles.blockBody}>
                  <div className={`${styles.fieldsRow} ${styles.rowComisiones}`}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Apertura</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.comAperturaRaw}
                          onChange={(e) => update('comAperturaRaw', e.target.value)} />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Mantenimiento</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.comMantenimientoRaw}
                          onChange={(e) => update('comMantenimientoRaw', e.target.value)} />
                        <span className={styles.suffix}>€/mes</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Amort. anticipada</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.comAmortAnticipadaRaw}
                          onChange={(e) => update('comAmortAnticipadaRaw', e.target.value)} />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Modif. condiciones</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.comModifCondicionesRaw}
                          onChange={(e) => update('comModifCondicionesRaw', e.target.value)} />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Reclamación impago</label>
                      <div className={styles.inputSuffix}>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.gastoReclamacionImpagoRaw}
                          onChange={(e) => update('gastoReclamacionImpagoRaw', e.target.value)} />
                        <span className={styles.suffix}>€</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 6 · Bonificaciones */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Bonificaciones <span className="count">· {form.bonificaciones.filter((b) => b.activa).length} activas</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${form.bonificacionesActivas ? styles.toggleOn : ''}`}
                    onClick={() => update('bonificacionesActivas', !form.bonificacionesActivas)}
                    title={form.bonificacionesActivas ? 'Desactivar' : 'Activar'}
                  />
                </div>
                {form.bonificacionesActivas && (
                  <div className={styles.blockBody}>
                    <div className={styles.bonifGrid}>
                      {form.bonificaciones.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`${styles.bonifCard} ${b.activa ? styles.bonifCardActive : ''}`}
                          onClick={() => toggleBonificacion(b.id)}
                        >
                          <div className={styles.bonifCardTitle}>{b.nombre}</div>
                          <div className={styles.bonifCardSub}>−{fmtNumeroEs(b.ppDescuento, 2)} p.p.</div>
                          <div className={styles.bonifCardPp}>−{fmtNumeroEs(b.ppDescuento, 2)} p.p.</div>
                        </button>
                      ))}
                    </div>
                    <button className={styles.btnAdd} onClick={addBonificacionCustom} type="button">
                      <Plus size={13} /> Añadir bonificación personalizada
                    </button>
                  </div>
                )}
              </div>

              {/* Bloque 7 · Carencia inicial */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Carencia inicial <span className="count">· opcional</span>
                  </div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.seg3}>
                    {(['ninguna', 'solo_capital', 'total'] as TipoCarenciaInicialV2[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.seg} ${form.carenciaInicialTipo === c ? styles.segSelected : ''}`}
                        onClick={() => update('carenciaInicialTipo', c)}
                      >
                        {c === 'ninguna' ? 'Ninguna' : c === 'solo_capital' ? 'Solo capital' : 'Total'}
                      </button>
                    ))}
                  </div>
                  {form.carenciaInicialTipo !== 'ninguna' && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '0.4fr 1fr', gap: 10, alignItems: 'end' }}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Meses</label>
                        <input className={`${styles.input} ${styles.inputMono}`}
                          value={form.carenciaInicialMesesRaw}
                          onChange={(e) => update('carenciaInicialMesesRaw', e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className={styles.hintNote}>
                    <b>Solo capital</b> · pagas solo intereses durante N meses · útil en obra nueva.
                    <b> Total</b> · sin pagos durante N meses · los intereses se capitalizan.
                  </div>
                </div>
              </div>

              {/* Bloque 8 · Destinos */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Destino del capital <span className="count">· determina deducibilidad fiscal</span>
                  </div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.destinoList}>
                    {form.destinos.map((d) => (
                      <div key={d.id} className={styles.destinoRow}>
                        <select
                          className={styles.select}
                          value={d.tipo}
                          onChange={(e) => updateDestino(d.id, { tipo: e.target.value as TipoDestinoV2 })}
                        >
                          {DESTINOS_OPCIONES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          className={styles.select}
                          value={d.inmuebleId}
                          onChange={(e) => updateDestino(d.id, { inmuebleId: e.target.value })}
                          disabled={d.tipo !== 'adquisicion_inmueble' && d.tipo !== 'reforma_inmueble'}
                        >
                          <option value="">— sin inmueble vinculado —</option>
                          {inmuebles.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.alias || `Inmueble ${p.id}`}
                            </option>
                          ))}
                        </select>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={fmtNumeroEs(d.importe)}
                            onChange={(e) => updateDestino(d.id, { importe: parseNum(e.target.value) })} />
                          <span className={styles.suffix}>€</span>
                        </div>
                        <div className={styles.inputSuffix}>
                          <input className={`${styles.input} ${styles.inputMono}`}
                            value={fmtNumeroEs(d.porcentaje)}
                            onChange={(e) => updateDestino(d.id, { porcentaje: parseNum(e.target.value) })} />
                          <span className={styles.suffix}>%</span>
                        </div>
                        <button
                          type="button"
                          className={styles.del}
                          onClick={() => removeDestino(d.id)}
                          disabled={form.destinos.length <= 1}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className={styles.btnAdd} onClick={addDestino} type="button">
                    <Plus size={13} /> Añadir otro destino
                  </button>
                  <div className={`${styles.destinoBanner} ${destinosCuadre.ok ? '' : styles.destinoBannerError}`}>
                    {destinosCuadre.ok ? <CheckCheck size={13} /> : <AlertCircle size={13} />}
                    {destinosCuadre.ok ? (
                      <span>Destinos cuadran con el capital · <b>{fmtEur(destinosCuadre.total)} / {fmtEur(capital)}</b></span>
                    ) : (
                      <span>Los importes deben sumar el capital · <b>{fmtEur(destinosCuadre.total)} / {fmtEur(capital)}</b></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloque 9 · Garantía */}
              <div className={styles.block}>
                <div className={styles.blockHd}>
                  <div className={styles.blockHdTitle}>
                    Garantía <span className="count">· informativa · no afecta a cálculos</span>
                  </div>
                </div>
                <div className={styles.blockBody}>
                  <div className={styles.garantiaGrid}>
                    {garantiaOptions.map(({ id, label, sub, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.garantiaCard} ${form.garantiaTipo === id ? styles.garantiaCardSelected : ''}`}
                        onClick={() => update('garantiaTipo', id)}
                      >
                        <Icon size={18} />
                        <div className={styles.garantiaCardTitle}>{label}</div>
                        <div className={styles.garantiaCardSub}>{sub}</div>
                      </button>
                    ))}
                  </div>
                  {form.garantiaTipo === 'hipotecaria' && (
                    <div style={{ marginTop: 10 }}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Inmueble que responde</label>
                        <select
                          className={styles.select}
                          value={form.garantiaInmuebleId}
                          onChange={(e) => update('garantiaInmuebleId', e.target.value)}
                        >
                          <option value="">— Selecciona —</option>
                          {inmuebles.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.alias || `Inmueble ${p.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* COLUMNA PREVIEW */}
            <div className={styles.colPreview}>
              <div className={styles.previewTitle}>
                <TrendingDown size={12} /> Cálculo financiero · vista previa
              </div>

              {cuadro ? (
                <>
                  <div className={styles.previewKpiMain}>
                    <div className={styles.previewKpiMainLabel}>Cuota mensual</div>
                    <div className={styles.previewKpiMainValue}>{fmtEur(cuadro.resumen.cuotaMensual)}</div>
                    <div className={styles.previewKpiMainSub}>
                      {numCuotas} cuotas · sistema francés · fin {fmtFechaCorta(cuadro.resumen.fechaUltimaCuota)}
                    </div>
                  </div>

                  <div className={styles.previewKpiSecondary}>
                    <div className={styles.previewKpiMini}>
                      <div className={styles.previewKpiMiniLabel}>TIN efectivo</div>
                      <div className={styles.previewKpiMiniValue}>{fmtPct(tinEfectivoPct)}</div>
                      <div className={styles.previewKpiMiniSub}>
                        {form.bonificacionesActivas
                          ? `con ${form.bonificaciones.filter((b) => b.activa).length} bonificaciones`
                          : 'sin bonificaciones aplicadas'}
                      </div>
                    </div>
                    <div className={styles.previewKpiMini}>
                      <div className={styles.previewKpiMiniLabel}>TAE</div>
                      <div className={styles.previewKpiMiniValue}>{fmtPct(cuadro.resumen.tae)}</div>
                      <div className={styles.previewKpiMiniSub}>
                        {cuadro.resumen.interesesCarenciaTecnica > 0 ? 'incluye carencia técnica' : '—'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewDesglose}>
                    <div className={styles.previewDesgloseRow}>
                      <span className="label">Capital prestado</span>
                      <span className="value">{fmtEur(capital)}</span>
                    </div>
                    <div className={styles.previewDesgloseRow}>
                      <span className="label">+ Intereses período amortización ({numCuotas} cuotas)</span>
                      <span className="value">{fmtEur(cuadro.resumen.interesesCuadro)}</span>
                    </div>
                    {cuadro.resumen.interesesCarenciaTecnica > 0 && (
                      <div className={styles.previewDesgloseRow}>
                        <span className="label">
                          + Liquidación carencia técnica ({carencia?.dias} días · {fmtFechaCorta(carencia?.fechaLiquidacion ?? '')})
                        </span>
                        <span className="value">{fmtEur(cuadro.resumen.interesesCarenciaTecnica)}</span>
                      </div>
                    )}
                    <div className={styles.previewDesgloseRow}>
                      <span className="label">+ Comisión apertura</span>
                      <span className="value">{fmtEur((parseNum(form.comAperturaRaw) * capital) / 100)}</span>
                    </div>
                    <div className={`${styles.previewDesgloseRow} ${styles.previewDesgloseTotal}`}>
                      <span className="label">Total a pagar</span>
                      <span className="value">
                        {fmtEur(
                          capital +
                          cuadro.resumen.interesesCuadro +
                          cuadro.resumen.interesesCarenciaTecnica +
                          (parseNum(form.comAperturaRaw) * capital) / 100,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className={styles.previewInfo}>
                    <Info />
                    <span>
                      {deducibilidadInfo.deducible ? <b>Destino con inmueble · </b> : null}
                      {deducibilidadInfo.mensaje}
                    </span>
                  </div>

                  <button
                    className={styles.btnAmort}
                    onClick={() => setShowCuadroCompleto((v) => !v)}
                    type="button"
                  >
                    <Calendar size={14} />
                    {showCuadroCompleto ? 'Ocultar cuadro de amortización' : `Ver cuadro de amortización completo · ${cuadro.resumen.numLineas} líneas${cuadro.resumen.interesesCarenciaTecnica > 0 ? ` (1 carencia + ${numCuotas} cuotas)` : ''}`}
                  </button>

                  {showCuadroCompleto && (
                    <CuadroTabla lineas={cuadro.lineas} />
                  )}
                </>
              ) : (
                <div style={{ padding: 20, color: 'var(--v8-txt-muted, #6b7280)', fontSize: 12 }}>
                  Completa capital, plazo, TIN y fechas para ver el cálculo financiero en directo.
                </div>
              )}
            </div>

          </div>

          {/* FOOTER */}
          <div className={styles.footer}>
            <div className={styles.footerMeta}>
              <Info />
              {submitError ? (
                <span style={{ color: 'var(--v8-danger, #b91c1c)' }}>{submitError}</span>
              ) : (
                'Al guardar se generan los cargos previstos en Tesorería y el cuadro de amortización completo'
              )}
            </div>
            <div className={styles.footerActions}>
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                type="button"
                onClick={() => setShowAmortizarModal(true)}
                disabled={!loadedPrestamo}
                title={loadedPrestamo ? 'Amortizar anticipadamente' : 'Guarda el préstamo antes de amortizar'}
              >
                <Check size={14} /> Amortizar anticipado
              </button>
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={onCancel}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSubmit}
                disabled={saving}
                type="button"
              >
                <Save size={14} /> {saving ? 'Guardando…' : 'Guardar préstamo'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {loadedPrestamo && (
        <LoanSettlementModal
          prestamo={loadedPrestamo}
          isOpen={showAmortizarModal}
          onClose={() => setShowAmortizarModal(false)}
          onConfirmed={async () => {
            setShowAmortizarModal(false);
            // Tras amortizar, recargar el préstamo desde DB y rehidratar el form.
            const fresh = await prestamosService.getPrestamoById(loadedPrestamo.id);
            if (fresh) {
              setLoadedPrestamo(fresh);
              hydrateFromPrestamo(fresh, accounts);
            }
          }}
        />
      )}
    </div>
  );
};

// ─── Cuadro completo · tabla simple desplegable ─────────────────────────────
const CuadroTabla: React.FC<{ lineas: LineaCuadroV2[] }> = ({ lineas }) => {
  return (
    <div className={styles.cuadroTabla}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Fecha</th>
            <th>Cuota</th>
            <th>Capital</th>
            <th>Intereses</th>
            <th>Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={`${l.tipo}-${l.numero}`} className={l.tipo === 'carencia_tecnica' ? styles.cuadroTablaCarencia : ''}>
              <td>{l.tipo === 'carencia_tecnica' ? '0 · carencia' : l.numero}</td>
              <td>{fmtFechaCorta(l.fecha)}</td>
              <td className={styles.mono}>{fmtEur(l.cuota)}</td>
              <td className={styles.mono}>{fmtEur(l.capitalAmortizado)}</td>
              <td className={styles.mono}>{fmtEur(l.intereses)}</td>
              <td className={styles.mono}>{fmtEur(l.capitalPendiente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrestamoPageV2;
