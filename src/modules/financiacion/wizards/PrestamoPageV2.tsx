// ============================================================================
// Wizard de préstamo · pantalla única · ATLAS V5
// ============================================================================
//
// Modal a pantalla casi completa, en dos columnas: a la izquierda el formulario
// —con scroll propio—, a la derecha el cálculo financiero en vivo sobre navy.
// Mockup canónico · docs/mockups/atlas-wizard-prestamo-v1.html.
//
// El reparto es la idea entera de esta pantalla:
//
//   · **Lo esencial siempre a la vista y sin scroll** — tipo, identificación,
//     importe y plazo, tipo de interés. Es lo que trae CUALQUIER préstamo.
//   · **Lo avanzado, plegado** — condiciones del banco, bonificaciones,
//     garantía y destino. Solo lo abre quien tenga la escritura delante, y cada
//     bloque dice en UNA línea qué guarda, para no tener que abrirlo a ciegas.
//
// El cuadro que enseña la derecha sale del motor ÚNICO
// (`services/prestamos/cuadro`), el mismo que se persiste y el mismo del que
// salen las previsiones de tesorería. Dos motores acaban dando dos cuotas.
//
// Reglas de diseño aplicadas:
//   · Oro SOLO en la cifra-veredicto (la cuota del hero) y en la selección.
//   · Sentence case · cero hex hardcodeado en JSX · números en JetBrains Mono.
//   · Ancho de campo ajustado al contenido: un `0,25` no ocupa media pantalla.
//   · Un bloque plegado lleva UN resumen, en su subtítulo. Ni chips que lo
//     repitan ni párrafos explicativos dentro.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCheck,
  ChevronDown,
  Home,
  Info,
  Percent,
  Plus,
  Save,
  Shield,
  Sliders,
  Upload,
  Target,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { initDB, type Account, type TreasuryEvent } from '../../../services/db';
import { inmuebleService } from '../../../services/inmuebleService';
import type { Inmueble } from '../../../types/inmueble';
import type { LucideIcon } from 'lucide-react';
import { prestamosService } from '../../../services/prestamosService';
import { planificarEventos, cambiaElCuadro } from '../../../services/prestamoEventosPlan';
import { generarCuadro, type Cuadro } from '../../../services/prestamos/cuadro';
import { cadaCuantoRevisa } from '../../../services/bonificaciones/revisionDelBanco';
import { baseDiasSueltosDe } from '../../../services/prestamos/baseDeCalculo';
import {
  diasSueltosDelArranqueDe,
  fechaDeLaPrimeraCuota,
} from '../../../services/prestamos/fechasDelArranque';
import {
  generarTreasuryEventDescriptors,
  type TipoCarenciaInicialV2,
  type TipoDestinoV2,
  type TipoGarantiaV2,
  type TipoInteresV2,
  type TipoPrestamoV2,
} from '../../../services/prestamoCalculatorService';
import type {
  Bonificacion,
  DestinoCapital,
  Garantia,
  ModoBonificaciones,
  PeriodoPago,
  Prestamo,
  ReglaBonificacion,
  TramoDeRebaja,
} from '../../../types/prestamos';
import type { Tarjeta } from '../../../types/tarjetas';
import { listarTarjetas } from '../../../services/tarjetasService';
import { bonificaHipoteca } from '../../../services/tarjetasReglas';
import { tinDelTramo } from '../../../services/prestamos/tinDelTramo';
import { effectiveTIN } from '../helpers';
import { enteroNoNegativo, esNumero, fmtNumeroEs, parseNum } from './numeros';
import { comisionPactadaDe, type ComisionPactada } from '../../../services/prestamos/comisiones';
import { topesDeReembolso, type OpcionDeTope } from '../../../services/prestamos/topesLegales';
import ComisionEditor, { SIN_COMISION, describirComision, TopesLegales } from './ComisionEditor';
import { BASE_POR_DEFECTO, NOMBRE_DE_LA_BASE, type BaseDeCalculo }
  from '../../../services/prestamos/baseDeCalculo';
import styles from './PrestamoPageV2.module.css';
// El panel navy es otra superficie y vive en su propio módulo · ver la
// cabecera de `PanelCalculo.module.css`.
import panel from './PanelCalculo.module.css';

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
  /** Lo que rebaja, en p.p. · en crudo, para poder teclear «0,25». */
  ppRaw: string;
  activa: boolean;
  /**
   * Qué hay que demostrar · sin esto la bonificación no se puede mirar contra
   * los movimientos, y una bonificación no se cumple por declararla (§6 ter).
   */
  regla: ReglaBonificacion;
  /** En cuántos meses se mide · la ventana de §6 ter. */
  lookbackMeses: number;
  /** Con qué tarjeta se cumple · la concreta, no la cuenta (§3.6). */
  tarjetaExigidaId?: number;
  /** En qué cuenta hay que domiciliarla · la del banco que bonifica (§6 ter). */
  cuentaExigidaId?: string;
  /** Lo tecleado en el umbral · en crudo, como el resto de importes. */
  umbralRaw: string;
  /** El tope de ESTA bonificación, en p.p. · vacío = no trae tope propio. */
  sublimiteRaw: string;
  /** Los escalones, cuando la rebaja no es una cifra fija. */
  tramos: Array<{ id: string; desdeRaw: string; ppRaw: string }>;
  /**
   * El estado que ya tenía · se conserva en la edición.
   *
   * Al guardar se ponía `SELECCIONADO` a todas. Hoy no se nota porque nadie
   * escribe otro estado (§8), pero el veredicto de §6 ter va a moverlo: en
   * cuanto lo haga, editar el plazo del préstamo degradaría una bonificación
   * ya cumplida.
   */
  estadoPrevio?: Bonificacion['estado'];
}

interface FormState {
  // ── Esencial ────────────────────────────────────────────────────────────
  tipoPrestamo: TipoPrestamoV2;
  alias: string;
  banco: string;
  cuentaCargoId: string;
  numeroContrato: string;
  capitalRaw: string;
  plazoRaw: string;
  plazoPeriodo: 'MESES' | 'AÑOS';
  fechaFirma: string;
  /**
   * Deducida, no tecleada · la primera cuota entera. Se sigue guardando
   * porque el motor la lee, pero ya nadie la escribe a mano.
   */
  fechaPrimerCargo: string;
  diaCobroRaw: string;
  tipoInteres: TipoInteresV2;
  tinFijoRaw: string;
  euriborRaw: string;
  diferencialRaw: string;
  tramoFijoMesesRaw: string;
  tinTramoFijoRaw: string;

  // ── Condiciones del banco ───────────────────────────────────────────────
  /** Cómo cuenta los días el banco · §6 bis · bis. */
  baseCalculo: BaseDeCalculo;
  interesDemoraRaw: string;
  /** Qué hace el banco con los días entre disponer y la primera cuota. */
  diasSueltos: NonNullable<Prestamo['diasSueltosDelArranque']>;
  /** Y cómo los cuenta · puede no ser la base del resto del cuadro. */
  baseDiasSueltos: NonNullable<Prestamo['baseDiasSueltos']>;
  /** Las revisiones del índice que ya ocurrieron · §6 bis · bis. */
  revisionesIndice: Array<{ id: string; desde: string; valorRaw: string }>;
  comAperturaRaw: string;
  comMantenimientoRaw: string;
  comModifCondicionesRaw: string;
  gastoReclamacionImpagoRaw: string;
  /** El calendario de cada comisión de reembolso · §6 bis · quater. */
  comReembolsoParcial: ComisionPactada;
  comReembolsoTotal: ComisionPactada;

  // ── Bonificaciones ──────────────────────────────────────────────────────
  bonificacionesActivas: boolean;
  bonificaciones: BonificacionRow[];
  /** El tope acumulado del anexo, en p.p. · «no baja de −1,00». */
  topeBonificacionesRaw: string;
  /** Cómo cuentan entre sí · independientes o en cascada. */
  modoBonificaciones: ModoBonificaciones;
  /** La próxima revisión tal como la da el banco · `YYYY-MM`. Manda. */
  proximaRevision: string;
  /** Cada cuántos meses las revisa el banco · '' = la escritura no lo dice. */
  revisionCadaMeses: string;
  /** Desde cuándo REBAJAN · solo se pregunta en un mixto. */
  bonificacionesDesde: 'FIRMA' | 'TRAMO_VARIABLE';
  /** Meses iniciales en que se dan por cumplidas · '' o '0' = ninguno. */
  graciaBonificacionesMeses: string;

  // ── Garantía y destino ──────────────────────────────────────────────────
  destinos: DestinoRow[];
  garantiaTipo: TipoGarantiaV2;
  garantiaInmuebleId: string;

  // ── Fuera del wizard, pero NO se pierde ─────────────────────────────────
  /**
   * La carencia inicial ya no se pregunta aquí (spec §8, fuera de alcance).
   *
   * Sigue en el estado porque un préstamo guardado con carencia se edita por
   * esta pantalla: no preguntarla es una decisión de interfaz, y borrarla al
   * guardar sería otra cosa —cambiarle el cuadro a un préstamo por haber
   * abierto su ficha—.
   */
  carenciaInicialTipo: TipoCarenciaInicialV2;
  carenciaInicialMesesRaw: string;
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

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtFechaCorta = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return '';
  return `${d} ${MES[m - 1]} ${y}`;
};

/** «ago 2043» · para los rangos del panel, donde el día no aporta nada. */
const fmtMesAnio = (iso: string): string => {
  if (!iso) return '';
  const [y, m] = iso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m) return '';
  return `${MES[m - 1]} ${y}`;
};

const accountLabel = (a: Account): string => {
  const last4 = (a.iban || '').replace(/\s/g, '').slice(-4) || '????';
  const banco = a.alias || a.banco?.name || a.bank || a.name || 'Cuenta';
  return `${banco} · ···· ${last4}`;
};

// Lista de bancos derivada de las cuentas reales del usuario · sin
// catálogo inventado.
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
  { value: 'reforma_inmueble',     label: 'Reforma o mejora' },
  { value: 'cancelar_deuda',       label: 'Cancelar otro préstamo' },
  { value: 'inversion',            label: 'Inversión' },
  { value: 'personal',             label: 'Uso personal' },
  { value: 'otro',                 label: 'Circulante u otro' },
];

const PIDE_INMUEBLE = (t: TipoDestinoV2): boolean =>
  t === 'adquisicion_inmueble' || t === 'reforma_inmueble';

// ─── Catálogo de condiciones · lenguaje NEUTRO ──────────────────────────────
//
// Cada entrada dice QUÉ hay que demostrar y EN QUÉ UNIDAD, porque de eso
// depende que la bonificación se pueda mirar luego contra los datos reales. Una
// condición escrita a mano no se puede comprobar contra nada.
//
// Los nombres son de banca, no de UN banco: «ingresos domiciliados», no
// «Bloque Haberes». La jerga de cada entidad cambia y significa lo mismo, y
// guardarla obligaría a traducirla cada vez que alguien quiera comparar dos
// préstamos.

type TipoCondicion = ReglaBonificacion['tipo'];

interface Condicion {
  tipo: TipoCondicion;
  label: string;
  /** Qué se teclea en la casilla del umbral · `null` = esta condición no pide cifra. */
  unidad: string | null;
  /** Una letra («A») no es una cantidad, y no elige escalón. */
  umbralEsTexto?: boolean;
  ppSugerido: number;
}

const CONDICIONES: Condicion[] = [
  { tipo: 'NOMINA',                 label: 'Ingresos domiciliados',        unidad: '€/mes',  ppSugerido: 0.5 },
  { tipo: 'RECIBOS',                label: 'Recibos domiciliados',         unidad: 'nº',     ppSugerido: 0.1 },
  { tipo: 'TARJETA',                label: 'Uso de tarjeta',               unidad: '€/año',  ppSugerido: 0.1 },
  { tipo: 'SEGURO_HOGAR',           label: 'Seguro de hogar',              unidad: '€/año',  ppSugerido: 0.2 },
  { tipo: 'SEGURO_VIDA',            label: 'Seguro de vida',               unidad: '% cap.', ppSugerido: 0.4 },
  // Lo que «seguro de hogar» y «seguro de vida» no saben decir: «dos pólizas,
  // las que sean». Y da sitio al agrario, al de salud, al de auto y al de RC,
  // que caían a «Otra» y se volvían incomprobables siendo lo mismo · un recibo.
  { tipo: 'SEGUROS',                label: 'Seguros · cuántos',            unidad: 'nº',     ppSugerido: 0.2 },
  { tipo: 'PLAN_PENSIONES',         label: 'Plan de pensiones o previsión', unidad: '€/año',  ppSugerido: 0.25 },
  { tipo: 'FONDOS',                 label: 'Fondos de inversión',          unidad: '€',      ppSugerido: 0.1 },
  { tipo: 'ALARMA',                 label: 'Alarma o seguridad',           unidad: null,     ppSugerido: 0.1 },
  { tipo: 'CERTIFICADO_ENERGETICO', label: 'Certificado energético',       unidad: 'letra',  umbralEsTexto: true, ppSugerido: 0.1 },
  { tipo: 'OTRA',                   label: 'Otra condición',               unidad: null,     ppSugerido: 0.1 },
];

const condicionDe = (t: TipoCondicion): Condicion =>
  CONDICIONES.find((c) => c.tipo === t) ?? CONDICIONES[CONDICIONES.length - 1];

/**
 * La condición de una fila, con la unidad que de verdad usa SU regla.
 *
 * `SEGUROS` admite dos umbrales —cuántas pólizas y cuánta prima al año— y la
 * fila solo tiene una casilla. En vez de añadir un campo que rompa la rejilla,
 * la casilla habla del umbral que la regla trae: si viene del anexo con una
 * prima mínima, se teclea la prima y el sufijo lo dice.
 *
 * Antes esa prima era invisible: la casilla enseñaba el número de pólizas —
 * vacío— y al teclear se perdía la mitad de la condición.
 */
const condicionDeLaRegla = (r: ReglaBonificacion): Condicion => {
  const base = condicionDe(r.tipo);
  if (r.tipo === 'SEGUROS' && r.primaAnualMinima != null && r.minimoPolizas == null) {
    return { ...base, label: 'Seguros · prima total', unidad: '€/año' };
  }
  return base;
};

/** La cifra (o la letra) que la regla exige, ya en el crudo de la casilla. */
function umbralDeRegla(r: ReglaBonificacion): string {
  switch (r.tipo) {
    case 'NOMINA':                 return r.minimoMensual ? fmtNumeroEs(r.minimoMensual, 0) : '';
    case 'RECIBOS':                return r.minimoRecibos ? String(r.minimoRecibos) : '';
    case 'TARJETA':                return r.importeMinimo ? fmtNumeroEs(r.importeMinimo, 0) : '';
    // El que la regla use · si el anexo pidió prima y no número, se enseña la
    // prima. Enseñar siempre el número dejaba la casilla vacía en un contrato
    // que sí dice algo.
    case 'SEGUROS':
      if (r.minimoPolizas) return String(r.minimoPolizas);
      return r.primaAnualMinima ? fmtNumeroEs(r.primaAnualMinima, 0) : '';
    case 'SEGURO_HOGAR':           return r.primaAnual ? fmtNumeroEs(r.primaAnual, 0) : '';
    case 'SEGURO_VIDA':            return r.capitalAseguradoPct ? fmtNumeroEs(r.capitalAseguradoPct, 0) : '';
    case 'PLAN_PENSIONES':         return r.aportacionAnual ? fmtNumeroEs(r.aportacionAnual, 0) : '';
    case 'FONDOS':                 return r.saldoMinimo ? fmtNumeroEs(r.saldoMinimo, 0) : '';
    case 'CERTIFICADO_ENERGETICO': return r.letraMinima ?? '';
    case 'ALARMA':
    case 'OTRA':                   return '';
  }
}

/**
 * La regla que corresponde a una condición y su umbral.
 *
 * Exhaustiva a propósito: una condición nueva no compila hasta que alguien
 * decida qué hay que demostrar para darla por cumplida.
 */
function reglaDeCondicion(
  tipo: TipoCondicion,
  umbralRaw: string,
  nombre: string,
  anterior?: ReglaBonificacion
): ReglaBonificacion {
  const n = parseNum(umbralRaw);
  switch (tipo) {
    case 'NOMINA':                 return { tipo, minimoMensual: n };
    case 'RECIBOS':                return { tipo, minimoRecibos: enteroNoNegativo(n) };
    case 'TARJETA':                return { tipo, importeMinimo: n };
    // La casilla edita el NÚMERO de pólizas, pero la regla admite además una
    // prima mínima que puede venir del anexo. Sin conservarla, teclear aquí la
    // borraría en silencio: se guardaría «dos pólizas» y se perdería «y por al
    // menos 600 € al año», que es media condición.
    // Se escribe el umbral que esta fila está editando y se conserva el otro.
    // Cuál edita lo dice la regla anterior: una que vino del anexo con prima y
    // sin número sigue editando la prima.
    case 'SEGUROS': {
      const previa = anterior?.tipo === 'SEGUROS' ? anterior : undefined;
      const editaLaPrima = previa?.primaAnualMinima != null && previa.minimoPolizas == null;
      return editaLaPrima
        ? { tipo, primaAnualMinima: n > 0 ? n : undefined }
        : {
            tipo,
            minimoPolizas: enteroNoNegativo(n) || undefined,
            primaAnualMinima: previa?.primaAnualMinima,
          };
    }
    case 'SEGURO_HOGAR':           return { tipo, activo: true, primaAnual: n || undefined };
    case 'SEGURO_VIDA':            return { tipo, activo: true, capitalAseguradoPct: n || undefined };
    case 'PLAN_PENSIONES':         return { tipo, activo: true, aportacionAnual: n || undefined };
    case 'FONDOS':                 return { tipo, saldoMinimo: n || undefined };
    case 'CERTIFICADO_ENERGETICO': return { tipo, letraMinima: umbralRaw.trim().toUpperCase() || undefined };
    case 'ALARMA':                 return { tipo, activo: true };
    case 'OTRA':                   return { tipo, descripcion: nombre || 'Condición del anexo' };
  }
}

/** De qué tipo es una bonificación según lo que hay que demostrar. */
const TIPO_DE_REGLA: Record<TipoCondicion, Bonificacion['tipo']> = {
  NOMINA: 'NOMINA',
  PLAN_PENSIONES: 'PENSIONES',
  SEGURO_HOGAR: 'SEGURO_HOGAR',
  SEGURO_VIDA: 'SEGURO_VIDA',
  // `Bonificacion.tipo` es la etiqueta gruesa y no tiene un valor para «seguros
  // en general» · lo que se comprueba es la REGLA, y esa sí lo distingue.
  SEGUROS: 'OTROS',
  TARJETA: 'TARJETA',
  RECIBOS: 'RECIBOS',
  FONDOS: 'FONDOS',
  CERTIFICADO_ENERGETICO: 'CERTIFICADO_ENERGETICO',
  ALARMA: 'ALARMA',
  OTRA: 'OTROS',
};

/** La ventana por defecto · medio año, como el `lookbackMeses` que ya se guardaba. */
const LOOKBACK_POR_DEFECTO = 6;

const filaVacia = (tipo: TipoCondicion): BonificacionRow => {
  const c = condicionDe(tipo);
  return {
    id: uid(),
    nombre: c.label,
    ppRaw: fmtNumeroEs(c.ppSugerido, 2),
    activa: true,
    regla: reglaDeCondicion(tipo, '', c.label),
    lookbackMeses: LOOKBACK_POR_DEFECTO,
    umbralRaw: '',
    sublimiteRaw: '',
    tramos: [],
  };
};

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
  return {
    tipoPrestamo: 'personal',
    alias: '',
    banco: '',
    cuentaCargoId: '',
    numeroContrato: '',
    capitalRaw: '',
    plazoRaw: '',
    plazoPeriodo: 'MESES',
    fechaFirma: localIsoToday(),
    fechaPrimerCargo: '',
    diaCobroRaw: '1',
    tipoInteres: 'fijo',
    tinFijoRaw: '',
    euriborRaw: '',
    diferencialRaw: '',
    tramoFijoMesesRaw: '',
    tinTramoFijoRaw: '',
    baseCalculo: BASE_POR_DEFECTO,
    interesDemoraRaw: '',
    diasSueltos: 'CARGO_APARTE',
    baseDiasSueltos: 'ACT/365',
    revisionesIndice: [],
    comAperturaRaw: '0',
    comMantenimientoRaw: '0',
    comModifCondicionesRaw: '0',
    gastoReclamacionImpagoRaw: '0',
    comReembolsoParcial: SIN_COMISION,
    comReembolsoTotal: SIN_COMISION,
    bonificacionesActivas: false,
    bonificaciones: [],
    topeBonificacionesRaw: '',
    modoBonificaciones: 'INDEPENDIENTES',
    proximaRevision: '',
    revisionCadaMeses: '',
    bonificacionesDesde: 'FIRMA',
    graciaBonificacionesMeses: '',
    destinos: [
      { id: uid(), tipo: 'personal', inmuebleId: '', importe: 0, porcentaje: 100 },
    ],
    garantiaTipo: 'personal',
    garantiaInmuebleId: '',
    carenciaInicialTipo: 'ninguna',
    carenciaInicialMesesRaw: '0',
  };
}

/**
 * Un préstamo, en el formulario · **el único camino**.
 *
 * Se llega aquí desde los dos sitios: editando uno guardado y subiendo una
 * FEIN. Antes eran dos funciones distintas —treinta y tantos campos una, diez
 * la otra— y por eso el mismo préstamo salía distinto según por dónde entrara.
 *
 * Acepta un préstamo INCOMPLETO porque una FEIN lo es: **está normalizada en
 * contenido, no en forma** *(Jose · 6 ago 2026: «hay mil FEIN, mil documentos
 * distintos»)*, así que ningún lector va a sacarlo todo nunca. Lo que no venga
 * se queda como está en `base`, que es la diferencia entre rellenar un hueco y
 * pisar lo que había.
 */
function formDesdePrestamo(p: Partial<Prestamo>, base: FormState): FormState {
  const destinos: DestinoRow[] =
    p.destinos && p.destinos.length > 0
      ? p.destinos.map((d) => ({
          id: d.id || uid(),
          tipo: mapDestinoLegacyToV2(d.tipo),
          inmuebleId: d.inmuebleId || '',
          importe: d.importe,
          porcentaje:
            d.porcentaje ??
            ((p.principalInicial ?? 0) > 0 ? (d.importe / (p.principalInicial as number)) * 100 : 0),
          descripcion: d.descripcion,
        }))
      : p.principalInicial !== undefined || p.inmuebleId
        ? [
            {
              id: uid(),
              tipo: p.inmuebleId ? 'adquisicion_inmueble' : 'personal',
              inmuebleId: p.inmuebleId || '',
              importe: p.principalInicial ?? 0,
              porcentaje: 100,
            },
          ]
        : base.destinos;

  const garantiaPrimera = p.garantias?.[0];

  // Se traen TODOS los campos, no solo nombre y puntos: lo que no se leía aquí
  // se perdía al guardar, y con ello se iba la única forma de mirar la
  // bonificación contra los movimientos (§6 ter).
  const bonificaciones: BonificacionRow[] =
    p.bonificaciones && p.bonificaciones.length > 0
      ? [...p.bonificaciones]
          .map((b, i) => ({ b, orden: Number.isFinite(Number(b.orden)) ? Number(b.orden) : i }))
          .sort((x, y) => x.orden - y.orden)
          .map(({ b }) => {
            const regla: ReglaBonificacion = b.regla ?? { tipo: 'OTRA', descripcion: b.nombre };
            return {
              id: b.id,
              nombre: b.nombre,
              ppRaw: fmtNumeroEs(b.reduccionPuntosPorcentuales ?? 0, 2),
              activa: b.estado !== 'INACTIVO',
              regla,
              lookbackMeses: b.lookbackMeses ?? LOOKBACK_POR_DEFECTO,
              tarjetaExigidaId: b.tarjetaExigidaId,
              cuentaExigidaId: b.cuentaExigidaId,
              umbralRaw: umbralDeRegla(regla),
              sublimiteRaw: b.sublimitePP ? fmtNumeroEs(b.sublimitePP, 2) : '',
              tramos: (b.rebajaPorTramos ?? []).map((t) => ({
                id: uid(),
                desdeRaw: fmtNumeroEs(t.desde, 0),
                ppRaw: fmtNumeroEs(t.pp, 2),
              })),
              estadoPrevio: b.estado,
            };
          })
      : base.bonificaciones;

  const texto = (v: string | undefined, previo: string): string => v ?? previo;
  const numero = (v: number | undefined, previo: string): string =>
    v !== undefined ? fmtNumeroEs(v) : previo;

  // El tope viene en dos unidades distintas · `maximoBonificacionPorcentaje` es
  // una fracción (0,006 = 0,60 p.p.) y `topeBonificacionesTotal` ya son puntos.
  // Tratarlos igual habría dividido uno por cien o multiplicado el otro.
  const topeEnPuntos =
    p.maximoBonificacionPorcentaje && p.maximoBonificacionPorcentaje > 0
      ? p.maximoBonificacionPorcentaje * 100
      : p.topeBonificacionesTotal
        ? Math.abs(p.topeBonificacionesTotal)
        : undefined;

  return {
    ...base,
    tipoPrestamo:
      (p.tipoPrestamoV2 as TipoPrestamoV2) ||
      (p.inmuebleId ? 'hipotecario' : p.tipoPrestamoV2 === undefined ? base.tipoPrestamo : 'personal'),
    alias: texto(p.nombre, base.alias),
    banco: texto(p.banco, base.banco),
    cuentaCargoId: texto(p.cuentaCargoId, base.cuentaCargoId),
    numeroContrato: texto(p.numeroContrato, base.numeroContrato),
    capitalRaw: numero(p.principalInicial, base.capitalRaw),
    plazoRaw: p.plazoMesesTotal !== undefined ? String(p.plazoMesesTotal) : base.plazoRaw,
    plazoPeriodo: 'MESES',
    fechaFirma: texto(p.fechaFirma, base.fechaFirma),
    fechaPrimerCargo: texto(p.fechaPrimerCargo, base.fechaPrimerCargo),
    diaCobroRaw: p.diaCargoMes !== undefined ? String(p.diaCargoMes) : base.diaCobroRaw,
    diasSueltos: p.diasSueltosDelArranque ?? base.diasSueltos,
    baseDiasSueltos: p.baseCalculoIntereses ? baseDiasSueltosDe(p as Prestamo) : base.baseDiasSueltos,
    tipoInteres: (p.tipo?.toLowerCase() as TipoInteresV2) ?? base.tipoInteres,
    tinFijoRaw: numero(p.tipoNominalAnualFijo, base.tinFijoRaw),
    interesDemoraRaw: numero(p.interesDemoraPct, base.interesDemoraRaw),
    euriborRaw: numero(p.valorIndiceActual, base.euriborRaw),
    diferencialRaw: numero(p.diferencial, base.diferencialRaw),
    baseCalculo: p.baseCalculoIntereses ?? base.baseCalculo,
    revisionesIndice: p.revisionesDeTipo
      ? p.revisionesDeTipo.map((r, i) => ({
          id: `rev-${i}`,
          desde: r.desde,
          valorRaw: fmtNumeroEs(r.valorIndice),
        }))
      : base.revisionesIndice,
    tramoFijoMesesRaw: p.tramoFijoMeses ? String(p.tramoFijoMeses) : base.tramoFijoMesesRaw,
    tinTramoFijoRaw: numero(p.tipoNominalAnualMixtoFijo, base.tinTramoFijoRaw),
    comAperturaRaw: numero(p.comisionApertura, base.comAperturaRaw),
    comMantenimientoRaw: numero(p.comisionMantenimiento, base.comMantenimientoRaw),
    comReembolsoParcial: comisionPactadaDe(p as Prestamo, 'PARCIAL') ?? base.comReembolsoParcial,
    comReembolsoTotal: comisionPactadaDe(p as Prestamo, 'TOTAL') ?? base.comReembolsoTotal,
    comModifCondicionesRaw: numero(p.comisionModificacionCondiciones, base.comModifCondicionesRaw),
    gastoReclamacionImpagoRaw: numero(p.gastoReclamacionImpago, base.gastoReclamacionImpagoRaw),
    // Que HAYA bonificaciones, no que alguna esté marcada · las de una FEIN
    // entran sin marcar —el papel dice lo que el banco ofrece, no lo que tú
    // contrataste— y con `some(activa)` el interruptor salía apagado y las
    // catorce quedaban escondidas detrás de un «0 activas».
    bonificacionesActivas: (p.bonificaciones?.length ?? 0) > 0 || base.bonificacionesActivas,
    bonificaciones,
    topeBonificacionesRaw:
      topeEnPuntos !== undefined ? fmtNumeroEs(topeEnPuntos, 2) : base.topeBonificacionesRaw,
    modoBonificaciones: p.modoBonificaciones ?? base.modoBonificaciones,
    proximaRevision: p.proximaRevisionBonificaciones ?? base.proximaRevision,
    revisionCadaMeses: cadaCuantoRevisa(p) ? String(cadaCuantoRevisa(p)) : base.revisionCadaMeses,
    bonificacionesDesde: p.bonificacionesDesde ?? base.bonificacionesDesde,
    graciaBonificacionesMeses: p.graciaMesesBonificaciones
      ? String(p.graciaMesesBonificaciones)
      : base.graciaBonificacionesMeses,
    carenciaInicialTipo: p.carencia ? mapCarenciaLegacyToV2(p.carencia) : base.carenciaInicialTipo,
    carenciaInicialMesesRaw:
      p.carenciaMeses !== undefined ? String(p.carenciaMeses) : base.carenciaInicialMesesRaw,
    destinos,
    garantiaTipo: garantiaPrimera ? mapGarantiaLegacyToV2(garantiaPrimera.tipo) : base.garantiaTipo,
    garantiaInmuebleId: garantiaPrimera?.inmuebleId || base.garantiaInmuebleId,
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────
export interface PrestamoPageV2Props {
  /** Id del préstamo en modo edición. Undefined/null = creación. */
  prestamoId?: string;
  /**
   * Datos iniciales · de una FEIN leída o de donde sea.
   *
   * `Partial<Prestamo>`, el tipo BUENO. Antes era `PrestamoFinanciacion`, que
   * no tiene dónde poner el valor del índice, la base de cálculo ni la
   * tasación: los tres se leían de la FEIN y morían en esa escala.
   */
  initialData?: Partial<Prestamo>;
  onSuccess: () => void;
  onCancel: () => void;
}

type BloqueAvanzado = 'condiciones' | 'bonificaciones' | 'garantia' | 'destino';

const PrestamoPageV2: React.FC<PrestamoPageV2Props> = ({
  prestamoId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  /**
   * Solo las que pueden bonificar · §3.6.
   *
   * Ofrecer la Carrefour aquí sería ofrecer una respuesta falsa: las de fuera
   * nunca bonifican, y elegirla haría creer que se cumple un requisito que no
   * se cumple.
   */
  const [tarjetasQueBonifican, setTarjetasQueBonifican] = useState<Tarjeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadedPrestamo, setLoadedPrestamo] = useState<Prestamo | null>(null);

  // Qué bloques avanzados están abiertos · todos plegados al entrar, que es lo
  // que deja lo esencial sin scroll.
  const [abiertos, setAbiertos] = useState<Set<BloqueAvanzado>>(new Set());
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);
  const [verTramosComision, setVerTramosComision] = useState(false);
  const [verVariable, setVerVariable] = useState(false);
  const [verAhorro, setVerAhorro] = useState(false);
  const [showCuadroCompleto, setShowCuadroCompleto] = useState(false);

  const isEditing = Boolean(prestamoId);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }, []);

  const toggleBloque = (b: BloqueAvanzado) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const [accs, props, tarjetas] = await Promise.all([
          db.getAll('accounts'),
          inmuebleService.getAll(),
          listarTarjetas(),
        ]);
        if (cancelled) return;
        const activeAccs = (accs as Account[]).filter(
          (a) => a.activa !== false && a.status !== 'DELETED',
        );
        setAccounts(activeAccs);
        setInmuebles(props as Inmueble[]);
        setTarjetasQueBonifican(tarjetas.filter(bonificaHipoteca));

        if (prestamoId) {
          const prestamo = await prestamosService.getPrestamoById(prestamoId);
          if (prestamo && !cancelled) {
            setLoadedPrestamo(prestamo);
            setForm(formDesdePrestamo(prestamo, emptyFormState()));
          }
        } else if (initialData) {
          setForm((prev) => formDesdePrestamo(initialData, prev));
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

  const bancosDisponibles = useMemo(() => {
    const list = deriveBancosFromAccounts(accounts);
    if (form.banco && !list.includes(form.banco)) list.unshift(form.banco);
    return list;
  }, [accounts, form.banco]);

  // TIN base aplicable según tipo de interés (a t=0).
  const tinBasePct = useMemo(() => {
    if (form.tipoInteres === 'fijo') return tinFijoPct;
    if (form.tipoInteres === 'variable') {
      return parseNum(form.euriborRaw) + parseNum(form.diferencialRaw);
    }
    if (form.tipoInteres === 'mixto') return parseNum(form.tinTramoFijoRaw);
    return 0;
  }, [form.tipoInteres, tinFijoPct, form.euriborRaw, form.diferencialRaw, form.tinTramoFijoRaw]);

  /**
   * Las revisiones completas · una a medio escribir no dice nada todavía.
   *
   * Y lo que no sea un número NO cuenta: `parseNum` devuelve 0 ante cualquier
   * cosa, así que un dedazo se guardaría como «el índice fue del 0 %» — una
   * revisión inventada, que es exactamente lo que este cuadro no puede tener.
   */
  const revisionesDeTipo = useMemo(
    () =>
      form.revisionesIndice
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.desde) && esNumero(r.valorRaw))
        .map((r) => ({ desde: r.desde, valorIndice: parseNum(r.valorRaw) }))
        .sort((a, b) => a.desde.localeCompare(b.desde)),
    [form.revisionesIndice],
  );

  /** El tope del anexo, en puntos · vacío = el anexo no dice ninguno. */
  const topePP = useMemo(
    () => (esNumero(form.topeBonificacionesRaw) ? Math.abs(parseNum(form.topeBonificacionesRaw)) : 0),
    [form.topeBonificacionesRaw],
  );

  /** Una fila del formulario, como la entiende el modelo. */
  const aBonificacion = useCallback(
    (b: BonificacionRow, orden: number): Bonificacion => {
      const tramos: TramoDeRebaja[] = b.tramos
        .filter((t) => esNumero(t.desdeRaw) && esNumero(t.ppRaw))
        .map((t) => ({ desde: parseNum(t.desdeRaw), pp: Math.abs(parseNum(t.ppRaw)) }))
        .sort((x, y) => x.desde - y.desde);
      // La MAGNITUD · una rebaja se escribe «0,30» y se enseña «−0,30 p.p.», así
      // que el menos ya lo pone la pantalla. Teclear «-0,30» guardaría una
      // reducción negativa con su `impacto.puntos` en positivo: el signo
      // invertido en los dos campos a la vez, y cada lector creyéndose el suyo.
      const pp = Math.abs(parseNum(b.ppRaw));
      const sublimite = esNumero(b.sublimiteRaw) ? Math.abs(parseNum(b.sublimiteRaw)) : 0;

      return {
        id: b.id,
        tipo: TIPO_DE_REGLA[b.regla.tipo],
        nombre: b.nombre,
        reduccionPuntosPorcentuales: pp,
        impacto: { puntos: -pp },
        lookbackMeses: b.lookbackMeses,
        regla: b.regla,
        tarjetaExigidaId: b.tarjetaExigidaId,
        cuentaExigidaId: b.cuentaExigidaId,
        // El orden solo es contrato en cascada · en independientes guardarlo
        // afirmaría una prelación que el anexo no pacta.
        orden: form.modoBonificaciones === 'CASCADA' ? orden : undefined,
        sublimitePP: sublimite || undefined,
        rebajaPorTramos: tramos.length > 0 ? tramos : undefined,
        // Solo lo que nace empieza en `SELECCIONADO`; lo demás conserva el
        // suyo. Ver `estadoPrevio`.
        estado: b.estadoPrevio && b.estadoPrevio !== 'INACTIVO' ? b.estadoPrevio : 'SELECCIONADO',
        seleccionado: true,
      };
    },
    [form.modoBonificaciones],
  );

  // Las bonificaciones tal como las entiende el modelo · UN solo mapeo, usado
  // por la vista previa y por el guardado. Antes la pantalla sumaba los puntos
  // por su cuenta —sin el tope— y el guardado hacía otra cosa, así que la cuota
  // de la vista previa podía ser más baja que la que acababa guardada.
  const bonificacionesModelo: Bonificacion[] = useMemo(
    () =>
      form.bonificacionesActivas
        ? form.bonificaciones.filter((b) => b.activa).map(aBonificacion)
        : [],
    [form.bonificacionesActivas, form.bonificaciones, aBonificacion],
  );

  /** Todas las de la lista, cumplidas o no · para el «con bonificación máxima». */
  const bonificacionesTodas: Bonificacion[] = useMemo(
    () =>
      form.bonificacionesActivas
        ? form.bonificaciones.map((b, i) => ({ ...aBonificacion(b, i), estado: 'SELECCIONADO' as const }))
        : [],
    [form.bonificacionesActivas, form.bonificaciones, aBonificacion],
  );

  // Solo un mixto tiene dos fases · en un fijo o en un variable la pregunta no
  // existe, y guardar la respuesta ahí sería guardar un dato que no dice nada.
  const bonificacionesDesde: Prestamo['bonificacionesDesde'] =
    form.tipoInteres === 'mixto' ? form.bonificacionesDesde : undefined;

  // El TIN que se paga AL ARRANCAR · la regla de §6 ter, con su tope.
  //
  // Y en un mixto que solo bonifica desde su tramo variable, al arrancar no
  // rebaja nada: la Unicaja de Jose paga su 2,600 % entero durante 36 meses.
  const tinEfectivoPct = useMemo(
    () =>
      tinDelTramo(
        {
          ...(loadedPrestamo ?? {}),
          bonificacionesDesde,
          topeBonificacionesTotal: topePP || undefined,
          maximoBonificacionPorcentaje: undefined,
          modoBonificaciones: form.modoBonificaciones,
        } as Prestamo,
        { tinBase: tinBasePct, variable: form.tipoInteres === 'variable' },
        bonificacionesModelo,
      ),
    [
      tinBasePct,
      bonificacionesModelo,
      loadedPrestamo,
      bonificacionesDesde,
      form.tipoInteres,
      form.modoBonificaciones,
      topePP,
    ],
  );

  // «01/07/2026» · leído del ISO, sin pasar por `Date`, que corre el día.
  const fmtFechaEs = (iso: string): string => {
    const [y, m, d] = iso.split('-');
    return d ? `${d}/${m}/${y}` : iso;
  };

  // Las dos fechas del arranque · deducidas de la disposición y del día de
  // cobro, que es lo único que hay que preguntar (§6 bis · bis).
  const primeraCuota = useMemo(
    () => (form.fechaFirma ? fechaDeLaPrimeraCuota(form.fechaFirma, diaCobro) : ''),
    [form.fechaFirma, diaCobro],
  );

  // Un préstamo pre-v2 no estrena carencia técnica al editarlo · nació sin ella
  // y detectarla ahora le inyectaría un cargo que nunca tuvo.
  const esPreV2 = Boolean(prestamoId) && loadedPrestamo?.carenciaTecnica === undefined;

  /**
   * La carencia, normalizada · UN solo cálculo para la vista previa y para lo
   * que se guarda.
   *
   * «Carencia de capital, cero meses» no es una carencia, es un estado que se
   * contradice: al reabrir la ficha volvería a enseñar un tipo distinto de
   * «ninguna» con cero meses, y el motor tendría que interpretarlo.
   */
  const carenciaInicial = useMemo(() => {
    const meses = parseInt(form.carenciaInicialMesesRaw, 10);
    if (form.carenciaInicialTipo === 'ninguna' || !Number.isFinite(meses) || meses <= 0) {
      return { carencia: 'NINGUNA' as const, carenciaMeses: undefined };
    }
    return { carencia: mapCarenciaV2ToLegacy(form.carenciaInicialTipo), carenciaMeses: meses };
  }, [form.carenciaInicialTipo, form.carenciaInicialMesesRaw]);

  /**
   * El tope que la ley permite para ESTE préstamo · §6 bis · quater.
   *
   * Vacío cuando no se puede saber —una mixta, un personal, una hipoteca muy
   * antigua—: entonces no se propone nada, que es mejor que proponer mal.
   */
  const topesLegales = useMemo(
    () =>
      topesDeReembolso({
        tipoPrestamo: form.tipoPrestamo,
        tipoInteres: form.tipoInteres,
        fechaFirma: form.fechaFirma,
      }),
    [form.tipoPrestamo, form.tipoInteres, form.fechaFirma]
  );

  /** Poner el tope en las dos · queda marcado como propuesto, no leído. */
  const aplicarTope = useCallback((tope: OpcionDeTope) => {
    const pactada: ComisionPactada = { tramos: tope.tramos, origen: 'TOPE_LEGAL' };
    setForm((f) => ({ ...f, comReembolsoParcial: pactada, comReembolsoTotal: pactada }));
  }, []);

  // Al dar de alta se propone el tope · dejar el campo en cero tampoco es
  // neutral, porque cero afirma «no hay comisión». Solo en préstamos NUEVOS y
  // solo mientras nadie lo haya tocado: editar uno existente no puede pisar lo
  // que ya diga su escritura.
  const yaPropuesto = useRef(false);
  useEffect(() => {
    if (prestamoId || yaPropuesto.current || topesLegales.length === 0) return;
    yaPropuesto.current = true;
    aplicarTope(topesLegales[0]);
  }, [prestamoId, topesLegales, aplicarTope]);

  /**
   * Los días sueltos entre disponer y la primera cuota · con SU base.
   *
   * Si el banco los mete dentro de la primera cuota no hay recibo que guardar.
   */
  const carenciaTecnica = useMemo(() => {
    if (esPreV2) return loadedPrestamo?.carenciaTecnica ?? null;
    if (form.diasSueltos === 'EN_LA_PRIMERA_CUOTA') return null;

    return diasSueltosDelArranqueDe({
      fechaFirma: form.fechaFirma,
      diaCargo: diaCobro,
      capital,
      tinAnual: tinEfectivoPct,
      base: form.baseDiasSueltos,
    });
  }, [
    esPreV2,
    loadedPrestamo,
    form.fechaFirma,
    form.diasSueltos,
    form.baseDiasSueltos,
    diaCobro,
    capital,
    tinEfectivoPct,
  ]);

  /**
   * El préstamo tal como lo lee el motor · UNA construcción.
   *
   * De aquí salen el cuadro que se enseña y las comparaciones del panel. Que
   * sea uno solo es lo que garantiza que «con bonificaciones» y «sin ellas» se
   * midan sobre exactamente el mismo préstamo.
   */
  const borrador: Prestamo | null = useMemo(() => {
    if (capital <= 0 || numCuotas <= 0 || !form.fechaFirma || !primeraCuota) return null;

    return {
      id: prestamoId ?? 'borrador',
      principalInicial: capital,
      plazoMesesTotal: numCuotas,
      fechaFirma: form.fechaFirma,
      fechaPrimerCargo: primeraCuota,
      diaCargoMes: diaCobro,
      tipo: form.tipoInteres.toUpperCase() as Prestamo['tipo'],
      tipoNominalAnualFijo: form.tipoInteres === 'fijo' ? tinFijoPct : undefined,
      valorIndiceActual: form.tipoInteres !== 'fijo' ? parseNum(form.euriborRaw) : undefined,
      diferencial: form.tipoInteres !== 'fijo' ? parseNum(form.diferencialRaw) : undefined,
      tipoNominalAnualMixtoFijo:
        form.tipoInteres === 'mixto' ? parseNum(form.tinTramoFijoRaw) : undefined,
      tramoFijoMeses:
        form.tipoInteres === 'mixto' ? parseInt(form.tramoFijoMesesRaw, 10) || undefined : undefined,
      revisionesDeTipo: form.tipoInteres !== 'fijo' ? revisionesDeTipo : undefined,
      // El tope ya se pregunta en esta pantalla · antes solo podía venir del
      // préstamo cargado, porque no había dónde escribirlo.
      topeBonificacionesTotal: topePP || undefined,
      modoBonificaciones: form.modoBonificaciones,
      bonificaciones: bonificacionesModelo,
      bonificacionesDesde,
      comisionApertura: parseNum(form.comAperturaRaw),
      comisionMantenimiento: parseNum(form.comMantenimientoRaw),
      carenciaTecnica,
      // La carencia inicial · el motor la aplica, así que la vista previa la
      // enseña aunque ya no se pregunte aquí.
      ...carenciaInicial,
      baseCalculoIntereses: form.baseCalculo,
      baseDiasSueltos: form.baseDiasSueltos,
      diasSueltosDelArranque: form.diasSueltos,
      esquemaPrimerRecibo: 'NORMAL',
    } as Prestamo;
  }, [
    capital,
    numCuotas,
    form.fechaFirma,
    primeraCuota,
    form.tipoInteres,
    form.euriborRaw,
    form.diferencialRaw,
    form.tinTramoFijoRaw,
    form.tramoFijoMesesRaw,
    form.comAperturaRaw,
    form.comMantenimientoRaw,
    form.baseCalculo,
    form.baseDiasSueltos,
    form.diasSueltos,
    form.modoBonificaciones,
    carenciaInicial,
    revisionesDeTipo,
    tinFijoPct,
    diaCobro,
    prestamoId,
    topePP,
    bonificacionesModelo,
    bonificacionesDesde,
    carenciaTecnica,
  ]);

  // El cuadro de la vista previa sale del MISMO motor que el que se guarda
  // (`services/prestamos/cuadro`).
  const cuadro: Cuadro | null = useMemo(
    () => (borrador ? generarCuadro(borrador) : null),
    [borrador],
  );

  // Memoizado, no `?? []` suelto · el array vacío nacía nuevo en cada render y
  // arrastraba consigo a los memos que dependen de él, que son los que generan
  // cuadros. Recalcular 240 líneas por cada tecla no se nota hasta que se nota.
  const tramos = useMemo(() => cuadro?.resumen.tramos ?? [], [cuadro]);
  const hayDosTramos = tramos.length > 1;

  /**
   * En qué tramo rebajan · el único sitio donde comparar tiene sentido.
   *
   * En un mixto que solo bonifica «en el segundo y sucesivos períodos» comparar
   * en el tramo fijo daría cero ahorro, que es cierto ahí y engañoso como
   * titular: lo que el usuario quiere saber es cuánto valen cuando empiecen.
   */
  const idxTramoBonificado = useMemo(() => {
    if (bonificacionesDesde !== 'TRAMO_VARIABLE') return 0;
    const i = tramos.findIndex((t) => t.variable);
    return i >= 0 ? i : 0;
  }, [bonificacionesDesde, tramos]);

  /** La cuota que se paga en un tramo · la del primer recibo que devenga en él. */
  const cuotaDelTramo = useCallback((c: Cuadro | null, idx: number): number => {
    if (!c) return 0;
    const desde = c.resumen.tramos[idx]?.desde;
    if (!desde) return c.resumen.cuotaMensual;
    const p = c.plan.periodos.find((x) => x.periodo > 0 && x.devengoDesde >= desde);
    return p?.cuota ?? c.resumen.cuotaMensual;
  }, []);

  /** El mismo préstamo sin ninguna bonificación · el suelo con el que comparar. */
  const cuadroSinBonificar = useMemo(
    () => (borrador ? generarCuadro({ ...borrador, bonificaciones: [] }) : null),
    [borrador],
  );

  /** Y con TODAS las de la lista · lo que el banco llama «bonificación máxima». */
  const cuadroMaximo = useMemo(
    () => (borrador ? generarCuadro({ ...borrador, bonificaciones: bonificacionesTodas }) : null),
    [borrador, bonificacionesTodas],
  );

  const cuotaSin = cuotaDelTramo(cuadroSinBonificar, idxTramoBonificado);
  const cuotaMax = cuotaDelTramo(cuadroMaximo, idxTramoBonificado);
  const ahorroMes = Math.max(0, cuotaSin - cuotaMax);
  /** El tipo del tramo variable con TODAS aplicadas · ya capado al tope. */
  const tinMaximoVariable =
    cuadroMaximo?.resumen.tramos[idxTramoBonificado]?.tin ?? 0;

  /**
   * Lo que vale CADA bonificación, por separado · el efecto de su rebaja aislada.
   *
   * Se generan tantos cuadros como bonificaciones, y a propósito: la alternativa
   * era una segunda fórmula de la cuota aquí dentro, y dos fórmulas para lo
   * mismo acaban dando dos cifras. Solo se calcula con el desglose abierto —
   * nadie paga N cuadros por tecla si no está mirando.
   *
   * Los individuales pueden sumar MÁS que el total: el total va capado al tope
   * del anexo, y la nota de debajo lo dice. Enseñar solo el capado escondería
   * cuál de ellas conviene mantener.
   */
  const ahorroPorBonificacion = useMemo(() => {
    if (!verAhorro || !borrador || bonificacionesTodas.length === 0) return [];
    return bonificacionesTodas.map((b) => {
      const solo = generarCuadro({ ...borrador, bonificaciones: [b] });
      return {
        id: b.id,
        nombre: b.nombre,
        mes: Math.max(0, cuotaSin - cuotaDelTramo(solo, idxTramoBonificado)),
      };
    });
  }, [verAhorro, borrador, bonificacionesTodas, cuotaSin, cuotaDelTramo, idxTramoBonificado]);

  // Cuadre destinos · suma de importes = capital (± 0,01)
  const destinosCuadre = useMemo(() => {
    const total = form.destinos.reduce((sum, d) => sum + (d.importe || 0), 0);
    return { total, ok: Math.abs(total - capital) < 0.01 };
  }, [form.destinos, capital]);

  // ─── Resúmenes de los bloques plegados · UNA línea cada uno ───────────────
  const resumenCondiciones = useMemo(() => {
    const partes = [NOMBRE_DE_LA_BASE[form.baseCalculo].toLowerCase()];
    const demora = parseNum(form.interesDemoraRaw);
    if (demora > 0) partes.push(`demora ${fmtNumeroEs(demora, 2)} %`);
    const comisiones = [
      parseNum(form.comAperturaRaw),
      parseNum(form.comMantenimientoRaw),
      parseNum(form.comModifCondicionesRaw),
      parseNum(form.gastoReclamacionImpagoRaw),
    ];
    partes.push(comisiones.some((c) => c > 0) ? 'con comisiones' : 'sin comisiones');
    partes.push(`amort. ${describirComision(form.comReembolsoParcial)}`);
    return partes.join(' · ');
  }, [
    form.baseCalculo,
    form.interesDemoraRaw,
    form.comAperturaRaw,
    form.comMantenimientoRaw,
    form.comModifCondicionesRaw,
    form.gastoReclamacionImpagoRaw,
    form.comReembolsoParcial,
  ]);

  const sumaPP = useMemo(
    () =>
      form.bonificaciones
        .filter((b) => b.activa)
        // En magnitud, igual que al construir el modelo · si no, el pie sumaría
        // una cifra y el motor otra.
        .reduce((t, b) => t + Math.abs(parseNum(b.ppRaw)), 0),
    [form.bonificaciones],
  );

  const resumenBonificaciones = useMemo(() => {
    if (!form.bonificacionesActivas || form.bonificaciones.length === 0) return 'ninguna';
    const n = form.bonificaciones.length;
    const modo = form.modoBonificaciones === 'CASCADA' ? 'en cascada' : 'independientes';
    // Sin tope el bloque avisa de que FALTA, no de que no lo haya · el anexo
    // que las lista siempre dice hasta dónde bajan, y guardarlas sin él las
    // dejaría sumando sin techo, que es el defecto que este bloque viene a
    // cerrar. Decir «sin tope dicho» prometía un estado que no se puede
    // guardar, porque la validación lo exige.
    return topePP > 0
      ? `${n} · ${modo} · tope ${fmtNumeroEs(topePP, 2)} p.p.`
      : `${n} · ${modo} · falta el tope`;
  }, [form.bonificacionesActivas, form.bonificaciones.length, form.modoBonificaciones, topePP]);

  const nombreInmueble = useCallback(
    (id: string): string => {
      const i = inmuebles.find((x) => String(x.id) === id);
      return i?.alias || (id ? `Inmueble ${id}` : '');
    },
    [inmuebles],
  );

  const resumenGarantia = useMemo(() => {
    if (form.tipoPrestamo !== 'hipotecario') return 'responde el titular';
    return nombreInmueble(form.garantiaInmuebleId) || 'sin inmueble elegido';
  }, [form.tipoPrestamo, form.garantiaInmuebleId, nombreInmueble]);

  const resumenDestino = useMemo(() => {
    if (form.destinos.length === 0) return 'sin destino';
    const d = form.destinos[0];
    const label = DESTINOS_OPCIONES.find((o) => o.value === d.tipo)?.label ?? '—';
    const ref = PIDE_INMUEBLE(d.tipo) ? nombreInmueble(d.inmuebleId) : '';
    const extra = form.destinos.length > 1 ? ` · +${form.destinos.length - 1}` : '';
    return [label, ref, `${fmtNumeroEs(d.porcentaje, 0)} %`].filter(Boolean).join(' · ') + extra;
  }, [form.destinos, nombreInmueble]);

  // ─── Acciones · revisiones del índice ─────────────────────────────────────
  const addRevision = () =>
    update('revisionesIndice', [...form.revisionesIndice, { id: uid(), desde: '', valorRaw: '' }]);
  const removeRevision = (id: string) =>
    update('revisionesIndice', form.revisionesIndice.filter((r) => r.id !== id));
  const updateRevision = (id: string, patch: Partial<{ desde: string; valorRaw: string }>) =>
    update('revisionesIndice', form.revisionesIndice.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ─── Acciones · destinos ──────────────────────────────────────────────────
  const addDestino = () =>
    update('destinos', [
      ...form.destinos,
      { id: uid(), tipo: 'personal', inmuebleId: '', importe: 0, porcentaje: 0 },
    ]);
  const removeDestino = (id: string) =>
    update('destinos', form.destinos.filter((d) => d.id !== id));
  const updateDestino = (id: string, patch: Partial<DestinoRow>) =>
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

  // ─── Acciones · bonificaciones ────────────────────────────────────────────
  const addBonificacion = () => {
    const fila = filaVacia('NOMINA');
    update('bonificaciones', [...form.bonificaciones, fila]);
    setFilaAbierta(fila.id);
  };
  const removeBonificacion = (id: string) =>
    update('bonificaciones', form.bonificaciones.filter((b) => b.id !== id));

  const editarBonificacion = (id: string, cambio: Partial<BonificacionRow>) =>
    update('bonificaciones', form.bonificaciones.map((b) => (b.id === id ? { ...b, ...cambio } : b)));

  /** Cambiar de condición rehace la regla · el umbral tecleado se conserva. */
  const cambiarCondicion = (b: BonificacionRow, tipo: TipoCondicion) => {
    const c = condicionDe(tipo);
    // El nombre solo se pisa si era el de la condición anterior · si el usuario
    // lo escribió (o vino de una FEIN), es suyo y se respeta.
    const nombreEraAutomatico = b.nombre === condicionDe(b.regla.tipo).label;
    editarBonificacion(b.id, {
      regla: reglaDeCondicion(tipo, c.unidad ? b.umbralRaw : '', b.nombre),
      umbralRaw: c.unidad ? b.umbralRaw : '',
      nombre: nombreEraAutomatico ? c.label : b.nombre,
    });
  };

  const cambiarUmbral = (b: BonificacionRow, raw: string) =>
    editarBonificacion(b.id, {
      umbralRaw: raw,
      regla: reglaDeCondicion(b.regla.tipo, raw, b.nombre, b.regla),
    });

  /** Mover una fila · en cascada el orden ES el contrato, no la presentación. */
  const moverBonificacion = (id: string, delta: -1 | 1) => {
    const i = form.bonificaciones.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= form.bonificaciones.length) return;
    const next = [...form.bonificaciones];
    [next[i], next[j]] = [next[j], next[i]];
    update('bonificaciones', next);
  };

  const addTramoRebaja = (b: BonificacionRow) =>
    editarBonificacion(b.id, {
      tramos: [...b.tramos, { id: uid(), desdeRaw: '', ppRaw: '' }],
    });
  const removeTramoRebaja = (b: BonificacionRow, tid: string) =>
    editarBonificacion(b.id, { tramos: b.tramos.filter((t) => t.id !== tid) });
  const updateTramoRebaja = (
    b: BonificacionRow,
    tid: string,
    patch: Partial<{ desdeRaw: string; ppRaw: string }>,
  ) =>
    editarBonificacion(b.id, {
      tramos: b.tramos.map((t) => (t.id === tid ? { ...t, ...patch } : t)),
    });

  // ─── Validación + submit ──────────────────────────────────────────────────
  const validar = (): string | null => {
    if (!form.alias.trim()) return 'Introduce un alias para el préstamo.';
    if (!form.cuentaCargoId) return 'Selecciona la cuenta de cargo.';
    if (capital <= 0) return 'Introduce el capital inicial.';
    if (numCuotas <= 0) return 'Introduce el plazo.';
    if (!form.fechaFirma) return 'Introduce la fecha de firma.';
    if (diaCobro < 1 || diaCobro > 31) return 'El día de cobro debe estar entre 1 y 31.';
    if (form.tipoInteres === 'fijo' && tinFijoPct <= 0) return 'Introduce el TIN fijo.';
    if (form.tipoInteres === 'variable' && parseNum(form.diferencialRaw) <= 0) {
      return 'Introduce el diferencial.';
    }
    if (form.tipoInteres === 'mixto') {
      if (parseNum(form.tinTramoFijoRaw) <= 0) return 'Introduce el TIN del tramo fijo.';
      if ((parseInt(form.tramoFijoMesesRaw, 10) || 0) <= 0) return 'Introduce los meses del tramo fijo.';
    }
    if (tinBasePct <= 0) return 'Introduce un TIN válido.';
    if (form.bonificacionesActivas && form.bonificaciones.length > 0 && topePP <= 0) {
      return 'Introduce el tope de bonificaciones · lo dice el anexo de tu escritura.';
    }
    if (!destinosCuadre.ok) {
      return `Los importes (${fmtEur(destinosCuadre.total)}) deben sumar el capital inicial (${fmtEur(capital)}).`;
    }
    if (form.destinos.some((d) => PIDE_INMUEBLE(d.tipo) && !d.inmuebleId)) {
      return 'Selecciona un inmueble para todos los destinos de compra o reforma.';
    }
    if (form.tipoPrestamo === 'hipotecario' && !form.garantiaInmuebleId) {
      return 'Selecciona el inmueble hipotecado · en un hipotecario, es lo que responde.';
    }
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

      // La garantía la decide el tipo de préstamo · en un hipotecario responde
      // el inmueble que se hipoteca, en un personal responde el titular. Una
      // pignoraticia guardada antes se conserva: esta pantalla no la pregunta,
      // y convertirla en personal sería cambiarle la garantía a un préstamo por
      // haber abierto su ficha.
      const tipoGarantia: TipoGarantiaV2 =
        form.tipoPrestamo === 'hipotecario'
          ? 'hipotecaria'
          : form.garantiaTipo === 'pignoraticia'
            ? 'pignoraticia'
            : 'personal';
      const garantias: Garantia[] = [{
        tipo: mapGarantiaV2ToLegacy(tipoGarantia),
        inmuebleId: tipoGarantia === 'hipotecaria' ? form.garantiaInmuebleId || undefined : undefined,
      }];

      const ambito: 'PERSONAL' | 'INMUEBLE' = destinosLegacy.some((d) => d.inmuebleId)
        ? 'INMUEBLE'
        : 'PERSONAL';

      // Las bonificaciones y la carencia técnica son las MISMAS que ha usado la
      // vista previa · si se recalcularan aquí volverían a ser dos cuentas.
      const bonificaciones = bonificacionesModelo;
      const existingPrestamo = prestamoId
        ? await prestamosService.getPrestamoById(prestamoId)
        : null;

      // Cuándo mira el banco · §6 ter. Vacío se guarda como `undefined` y no
      // como 0: «no lo dice la escritura» y «no revisa nunca» son cosas
      // distintas, y de la segunda saldría una fecha inventada.
      const revisionCada = enteroNoNegativo(Number(form.revisionCadaMeses));
      const graciaBonif = enteroNoNegativo(Number(form.graciaBonificacionesMeses));

      const payload: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
        ambito,
        destinos: destinosLegacy,
        garantias,
        nombre: form.alias.trim(),
        cuentaCargoId: form.cuentaCargoId,
        fechaFirma: form.fechaFirma,
        fechaPrimerCargo: primeraCuota,
        diaCargoMes: diaCobro,
        // La carencia técnica es un cargo APARTE (línea 0) · la primera cuota
        // es entera, y marcarla prorrateada cobraría esos días dos veces.
        esquemaPrimerRecibo: 'NORMAL',
        principalInicial: capital,
        principalVivo: capital,
        plazoMesesTotal: numCuotas,
        tipo: form.tipoInteres.toUpperCase() as Prestamo['tipo'],
        sistema: 'FRANCES',
        tipoNominalAnualFijo: form.tipoInteres === 'fijo' ? tinFijoPct : undefined,
        valorIndiceActual: form.tipoInteres !== 'fijo' ? parseNum(form.euriborRaw) : undefined,
        diferencial: form.tipoInteres !== 'fijo' ? parseNum(form.diferencialRaw) : undefined,
        // Una sola periodicidad, y también en un fijo: un fijo no revisa el
        // índice pero sí las bonificaciones, y sin esto no tenía calendario.
        periodoRevisionMeses: revisionCada || undefined,
        // Las revisiones que ya ocurrieron · sin ellas el cuadro de una
        // variable de hace años se genera entero al índice de hoy.
        revisionesDeTipo:
          form.tipoInteres !== 'fijo' && revisionesDeTipo.length > 0 ? revisionesDeTipo : undefined,
        tramoFijoMeses: form.tipoInteres === 'mixto' ? parseInt(form.tramoFijoMesesRaw, 10) || undefined : undefined,
        tipoNominalAnualMixtoFijo: form.tipoInteres === 'mixto' ? parseNum(form.tinTramoFijoRaw) : undefined,
        ...carenciaInicial,
        baseCalculoIntereses: form.baseCalculo,
        baseDiasSueltos: form.baseDiasSueltos,
        diasSueltosDelArranque: form.diasSueltos,
        comisionApertura: parseNum(form.comAperturaRaw),
        comisionMantenimiento: parseNum(form.comMantenimientoRaw),
        comisionReembolsoParcial: form.comReembolsoParcial,
        comisionReembolsoTotal: form.comReembolsoTotal,
        // Los sueltos se siguen escribiendo para que el exportador y la
        // plantilla no se queden en blanco · el calendario manda, y esto es su
        // primer tramo.
        comisionAmortizacionAnticipada: form.comReembolsoParcial.tramos[0]?.porcentaje ?? 0,
        comisionCancelacionTotal: form.comReembolsoTotal.tramos[0]?.porcentaje ?? 0,
        bonificaciones,
        // El tope va en PUNTOS · `maximoBonificacionPorcentaje` es el mismo dato
        // en fracción, y escribir los dos los dejaría contradiciéndose.
        topeBonificacionesTotal: topePP || undefined,
        // `INDEPENDIENTES` no se guarda · es lo que se lee cuando falta, y
        // guardarlo solo añadiría una respuesta que no cambia nada.
        modoBonificaciones: form.modoBonificaciones === 'CASCADA' ? 'CASCADA' : undefined,
        proximaRevisionBonificaciones: form.proximaRevision || undefined,
        // `FIRMA` tampoco se guarda, por el mismo motivo.
        bonificacionesDesde:
          bonificacionesDesde === 'TRAMO_VARIABLE' ? 'TRAMO_VARIABLE' : undefined,
        graciaMesesBonificaciones: graciaBonif || undefined,
        cuotasPagadas: 0,
        origenCreacion: initialData ? 'FEIN' : 'MANUAL',
        activo: true,
        tipoPrestamoV2: form.tipoPrestamo,
        banco: form.banco,
        numeroContrato: form.numeroContrato || undefined,
        interesDemoraPct: parseNum(form.interesDemoraRaw) || undefined,
        comisionModificacionCondiciones: parseNum(form.comModifCondicionesRaw) || undefined,
        gastoReclamacionImpago: parseNum(form.gastoReclamacionImpagoRaw) || undefined,
        carenciaTecnica,
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

      if (!saved) throw new Error('No se ha podido guardar el préstamo.');

      // Treasury events · solo si el cuadro se ha movido.
      //
      // Antes se rehacían SIEMPRE, así que cambiar el nombre de un préstamo
      // firmado hace años volvía a emitir todas sus cuotas. El nombre, una nota
      // o el inmueble asociado no mueven el calendario de pagos: rehacerlo solo
      // destruye el punteo hecho encima.
      const hayQueRehacer =
        !prestamoId || cambiaElCuadro(
          existingPrestamo as unknown as Record<string, unknown> | null,
          saved as unknown as Record<string, unknown>,
        );
      if (hayQueRehacer) {
        await regenerarTreasuryEvents(saved, { incluirCarencia: !esPreV2 });
      }

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
  const regenerarTreasuryEvents = async (
    prestamo: Prestamo,
    options: { incluirCarencia: boolean } = { incluirCarencia: true },
  ) => {
    const tinPct = effectiveTIN(prestamo);
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

    const todos = await db.getAll('treasuryEvents');
    const descriptors = generarTreasuryEventDescriptors(prestamo, accountId);
    const descriptorsAPersistir = options.incluirCarencia
      ? descriptors
      : descriptors.filter((d) => !d.esCarenciaTecnica);

    // Qué se borra y qué se emite · lo confirmado, lo conciliado y lo
    // descartado no se toca, así que editar NO duplica ni resucita cuotas.
    const plan = planificarEventos({
      descriptores: descriptorsAPersistir,
      existentes: (todos as TreasuryEvent[]).filter((e) => e.prestamoId === prestamo.id),
      hoy: new Date().toISOString().slice(0, 10),
    });

    for (const id of plan.borrar) {
      await db.delete('treasuryEvents', id);
    }

    const now = new Date().toISOString();
    const isHipoteca = prestamo.ambito === 'INMUEBLE';
    for (const { d, status } of plan.emitir) {
      const event: Omit<TreasuryEvent, 'id'> = {
        type: d.tipo === 'ingreso' ? 'income' : 'financing',
        amount: d.importe,
        predictedDate: d.fecha,
        description: d.concepto,
        sourceType: d.tipo === 'ingreso' ? 'otros_ingresos' : (isHipoteca ? 'hipoteca' : 'prestamo'),
        accountId: d.cuentaId,
        prestamoId: d.prestamoId,
        numeroCuota: d.numeroCuota,
        status,
        ambito: prestamo.ambito,
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
        <div className={styles.overlay} />
        <div className={styles.modal}>
          <div className={styles.loadingState}>Cargando préstamo…</div>
        </div>
      </div>
    );
  }

  // Dos, como manda la escritura: o responde un inmueble o responde el titular.
  // Un préstamo guardado con otro tipo comercial conserva su tarjeta, porque
  // cambiárselo por abrir la ficha sería reescribir un dato que nadie tocó.
  const tipoOptions: Array<{ id: TipoPrestamoV2; label: string; sub: string; Icon: LucideIcon }> = [
    { id: 'hipotecario', label: 'Hipotecario', sub: 'garantía sobre el inmueble', Icon: Home },
    { id: 'personal',    label: 'Personal',    sub: 'responde el titular',        Icon: User },
  ];
  if (form.tipoPrestamo !== 'hipotecario' && form.tipoPrestamo !== 'personal') {
    tipoOptions.push({
      id: form.tipoPrestamo,
      label: form.tipoPrestamo === 'linea_credito' ? 'Línea de crédito' : 'Otro',
      sub: 'como se guardó',
      Icon: User,
    });
  }

  const finCuadro = cuadro?.resumen.fechaUltimaCuota ?? '';
  const tramo0 = tramos[0];
  const tramo1 = hayDosTramos ? tramos[1] : null;
  const comisionAperturaEur = (parseNum(form.comAperturaRaw) * capital) / 100;

  const titleHeader = isEditing ? `Editar préstamo · ${form.alias || '—'}` : 'Nuevo préstamo';
  const subHeader = form.fechaFirma
    ? `${form.tipoPrestamo} · firma ${fmtMesAnio(form.fechaFirma)}`
    : 'Completa los datos del préstamo';

  return (
    <div className={styles.root}>
      <div className={styles.overlay} />
      <div className={styles.modal}>

        {/* ═══ HEADER ═══ */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerIcon}><Sliders /></div>
            <div>
              <div className={styles.headerTitle}>{titleHeader}</div>
              <div className={styles.headerSub}>{subHeader}</div>
            </div>
          </div>
          <button className={styles.headerClose} onClick={onCancel} title="Cerrar" type="button">
            <X size={18} />
          </button>
        </div>

        {/* ═══ CUERPO · FORMULARIO ═══ */}
        <div className={styles.body}>

          {/* La FEIN, aquí dentro · es una forma de RELLENAR este formulario,
              no otro sitio al que ir. Como botón propio en la pantalla anterior
              competía con «Nuevo préstamo» siendo la misma cosa, y quien no
              supiera qué es una FEIN tenía dos puertas para una sola tarea
              *(Jose · 8 ago 2026)*. Solo al dar de alta: editando ya hay datos
              que una lectura pisaría. */}
          {!isEditing && (
            <button
              type="button"
              className={styles.desdeFein}
              onClick={() => navigate('/financiacion/nuevo-fein')}
            >
              <Upload size={15} strokeWidth={2} />
              <span>
                <strong>¿Tienes la FEIN?</strong>
                <small>súbela y rellenamos lo que diga · lo demás lo repasas aquí</small>
              </span>
            </button>
          )}

          {/* ── Tipo de préstamo ── */}
          <div className={styles.sec}>
            <div className={styles.secLab}>Tipo de préstamo</div>
            <div className={`${styles.rcardGrid} ${tipoOptions.length > 2 ? styles.rcardGrid3 : ''}`}>
              {tipoOptions.map(({ id, label, sub, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.rcard} ${form.tipoPrestamo === id ? styles.rcardSelected : ''}`}
                  onClick={() => update('tipoPrestamo', id)}
                >
                  <div className={styles.rcardIcon}><Icon size={17} /></div>
                  <div>
                    <div className={styles.rcardTitle}>{label}</div>
                    <div className={styles.rcardSub}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Identificación ── */}
          <div className={styles.sec}>
            <div className={styles.secLab}>Identificación</div>
            <div className={styles.gridIdentif}>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-alias">
                  Alias <span className={styles.req}>*</span>
                </label>
                <input
                  id="p-alias"
                  className={styles.inp}
                  value={form.alias}
                  onChange={(e) => update('alias', e.target.value)}
                  placeholder="Hipoteca Unicaja"
                />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-banco">Banco</label>
                <select
                  id="p-banco"
                  className={styles.inp}
                  value={form.banco}
                  onChange={(e) => update('banco', e.target.value)}
                >
                  <option value="">— Selecciona —</option>
                  {bancosDisponibles.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-cuenta">
                  Cuenta cargo <span className={styles.req}>*</span>
                </label>
                <select
                  id="p-cuenta"
                  className={styles.inp}
                  value={form.cuentaCargoId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const newAcc = accounts.find((a) => String(a.id) === newId);
                    const newBanco = (newAcc?.banco?.name || newAcc?.bank || '').trim();
                    setForm((prev) => {
                      // El banco se sincroniza con la cuenta solo si NO lo
                      // editó el usuario · se detecta comparando con el de la
                      // cuenta que estaba puesta antes.
                      const prevAcc = accounts.find((a) => String(a.id) === prev.cuentaCargoId);
                      const prevBancoFromAcc = (prevAcc?.banco?.name || prevAcc?.bank || '').trim();
                      const userEditedBank = Boolean(prev.banco) && prev.banco !== prevBancoFromAcc;
                      return {
                        ...prev,
                        cuentaCargoId: newId,
                        banco: userEditedBank ? prev.banco : (newBanco || prev.banco),
                      };
                    });
                    setSubmitError(null);
                  }}
                >
                  <option value="">— Selecciona —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>{accountLabel(a)}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-contrato">
                  Nº contrato <span className={styles.opt}>opcional</span>
                </label>
                <input
                  id="p-contrato"
                  className={`${styles.inp} ${styles.mono}`}
                  value={form.numeroContrato}
                  onChange={(e) => update('numeroContrato', e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          </div>

          {/* ── Importe y plazo ── */}
          <div className={styles.sec}>
            <div className={styles.secLab}>Importe y plazo</div>
            <div className={styles.gridImporte}>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-capital">
                  Capital inicial <span className={styles.req}>*</span>
                </label>
                <div className={styles.inpGroup}>
                  <input
                    id="p-capital"
                    className={`${styles.inp} ${styles.mono}`}
                    value={form.capitalRaw}
                    onChange={(e) => update('capitalRaw', e.target.value)}
                    placeholder="85.000"
                  />
                  <span className={styles.suffix}>€</span>
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-plazo">
                  Plazo <span className={styles.req}>*</span>
                </label>
                <div className={styles.inpGroup}>
                  <input
                    id="p-plazo"
                    className={`${styles.inp} ${styles.mono}`}
                    value={form.plazoRaw}
                    onChange={(e) => update('plazoRaw', e.target.value)}
                    placeholder="240"
                  />
                  <span className={`${styles.suffix} ${styles.suffixSel}`}>
                    <select
                      aria-label="Unidad del plazo"
                      value={form.plazoPeriodo}
                      onChange={(e) => update('plazoPeriodo', e.target.value as 'MESES' | 'AÑOS')}
                    >
                      <option value="MESES">meses</option>
                      <option value="AÑOS">años</option>
                    </select>
                  </span>
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-firma">
                  Fecha firma <span className={styles.req}>*</span>
                </label>
                <input
                  id="p-firma"
                  type="date"
                  className={`${styles.inp} ${styles.mono}`}
                  value={form.fechaFirma}
                  onChange={(e) => update('fechaFirma', e.target.value)}
                />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldLab} htmlFor="p-dia">Día cobro</label>
                <input
                  id="p-dia"
                  className={`${styles.inp} ${styles.mono}`}
                  value={form.diaCobroRaw}
                  onChange={(e) => update('diaCobroRaw', e.target.value)}
                />
              </div>
            </div>
            {/*
              La fecha del primer cargo NO se pregunta · §6 bis · bis.

              «El primer cargo» son dos fechas distintas —el recibo de los días
              sueltos y la primera cuota entera— y la casilla que había aceptaba
              las dos. Con una salía el cuadro del banco; con la otra, un
              devengo que termina antes de empezar. Las dos se deducen de la
              disposición y del día de cobro, y aquí se enseñan para poder
              contrastarlas con el papel.
            */}
            <div className={styles.fldNote}>
              {form.fechaFirma && primeraCuota ? (
                <>
                  1.ª cuota el <b>{fmtFechaCorta(primeraCuota)}</b> · sistema francés
                  {finCuadro && <> · fin <b>{fmtFechaCorta(finCuadro)}</b></>}
                  {carenciaTecnica && (
                    <>
                      {' '}· antes, {carenciaTecnica.dias} días de intereses el{' '}
                      <b>{fmtFechaEs(carenciaTecnica.fechaLiquidacion)}</b> (
                      {fmtNumeroEs(carenciaTecnica.intereses)} €)
                    </>
                  )}
                </>
              ) : (
                'Pon la fecha de firma y el día de cobro.'
              )}
            </div>
          </div>

          {/* ── Tipo de interés ── */}
          <div className={styles.sec}>
            <div className={styles.secLab}>Tipo de interés</div>
            <div className={styles.seg}>
              {(['fijo', 'variable', 'mixto'] as TipoInteresV2[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.segBtn} ${form.tipoInteres === t ? styles.segBtnActive : ''}`}
                  onClick={() => update('tipoInteres', t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {form.tipoInteres === 'fijo' && (
              <div className={`${styles.condFields} ${styles.grid2}`}>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-tinfijo">
                    TIN fijo <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-tinfijo"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.tinFijoRaw}
                      onChange={(e) => update('tinFijoRaw', e.target.value)}
                      placeholder="2,60"
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
              </div>
            )}

            {form.tipoInteres === 'variable' && (
              <div className={`${styles.condFields} ${styles.grid3}`}>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-eur">Euríbor</label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-eur"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.euriborRaw}
                      onChange={(e) => update('euriborRaw', e.target.value)}
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-dif">
                    Diferencial <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-dif"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.diferencialRaw}
                      onChange={(e) => update('diferencialRaw', e.target.value)}
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
              </div>
            )}

            {form.tipoInteres === 'mixto' && (
              <div className={`${styles.condFields} ${styles.gridMixto}`}>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-pf">Período fijo</label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-pf"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.tramoFijoMesesRaw}
                      onChange={(e) => update('tramoFijoMesesRaw', e.target.value)}
                      placeholder="36"
                    />
                    <span className={styles.suffix}>mes</span>
                  </div>
                </div>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-tinpf">
                    TIN período fijo <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-tinpf"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.tinTramoFijoRaw}
                      onChange={(e) => update('tinTramoFijoRaw', e.target.value)}
                      placeholder="2,60"
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-eurm">Euríbor</label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-eurm"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.euriborRaw}
                      onChange={(e) => update('euriborRaw', e.target.value)}
                      placeholder="4,149"
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
                <div className={styles.fld}>
                  <label className={styles.fldLab} htmlFor="p-difm">Diferencial</label>
                  <div className={styles.inpGroup}>
                    <input
                      id="p-difm"
                      className={`${styles.inp} ${styles.mono}`}
                      value={form.diferencialRaw}
                      onChange={(e) => update('diferencialRaw', e.target.value)}
                      placeholder="1,750"
                    />
                    <span className={styles.suffix}>%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ AVANZADO · plegable ═══ */}
          <div className={`${styles.secLab} ${styles.secLabAvanzado}`}>
            Condiciones avanzadas
            <span className={styles.secLabHint}>· solo si tu escritura las trae</span>
          </div>

          {/* ── Condiciones del banco ── */}
          <div className={`${styles.adv} ${abiertos.has('condiciones') ? styles.advOpen : ''}`}>
            <button
              type="button"
              className={styles.advHead}
              onClick={() => toggleBloque('condiciones')}
              aria-expanded={abiertos.has('condiciones')}
            >
              <div className={styles.advIc}><Percent size={16} /></div>
              <div className={styles.advTt}>
                <div className={styles.advTitle}>Condiciones del banco</div>
                {!abiertos.has('condiciones') && (
                  <div className={styles.advSum}>{resumenCondiciones}</div>
                )}
              </div>
              <ChevronDown className={styles.advChev} size={18} />
            </button>

            {abiertos.has('condiciones') && (
              <div className={styles.advBody}>
                <div className={`${styles.subLab} ${styles.subLabFirst}`}>Intereses</div>
                <div className={styles.rowTight}>
                  <div className={`${styles.fld} ${styles.wLg}`}>
                    <label className={styles.fldLab} htmlFor="p-base">Base de cálculo</label>
                    <select
                      id="p-base"
                      className={styles.inp}
                      value={form.baseCalculo}
                      onChange={(e) => update('baseCalculo', e.target.value as BaseDeCalculo)}
                    >
                      {(Object.keys(NOMBRE_DE_LA_BASE) as BaseDeCalculo[]).map((b) => (
                        <option key={b} value={b}>{NOMBRE_DE_LA_BASE[b]}</option>
                      ))}
                    </select>
                    <div className={styles.helper}>
                      Es una cláusula de tu escritura · mueve <b>la cuota</b>, no solo el desglose
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.wSm}`}>
                    <label className={styles.fldLab} htmlFor="p-demora">Demora</label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-demora"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.interesDemoraRaw}
                        onChange={(e) => update('interesDemoraRaw', e.target.value)}
                      />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                </div>

                <div className={styles.subLab}>Los días sueltos del arranque</div>
                <div className={styles.rowTight}>
                  <div className={`${styles.fld} ${styles.wLg}`}>
                    <label className={styles.fldLab} htmlFor="p-sueltos">El banco los</label>
                    <select
                      id="p-sueltos"
                      className={styles.inp}
                      value={form.diasSueltos}
                      onChange={(e) => update('diasSueltos', e.target.value as FormState['diasSueltos'])}
                    >
                      <option value="CARGO_APARTE">Cobra en un recibo aparte</option>
                      <option value="EN_LA_PRIMERA_CUOTA">Mete en la primera cuota</option>
                    </select>
                  </div>
                  <div className={`${styles.fld} ${styles.wLg}`}>
                    <label className={styles.fldLab} htmlFor="p-basesueltos">y los cuenta</label>
                    <select
                      id="p-basesueltos"
                      className={styles.inp}
                      value={form.baseDiasSueltos}
                      onChange={(e) =>
                        update('baseDiasSueltos', e.target.value as FormState['baseDiasSueltos'])
                      }
                    >
                      <option value="ACT/365">Días reales / 365</option>
                      <option value="ACT/360">Días reales / 360</option>
                      <option value="30/360">Como el resto (30/360)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.subLab}>Comisiones</div>
                <div className={styles.rowTight}>
                  <div className={`${styles.fld} ${styles.wSm}`}>
                    <label className={styles.fldLab} htmlFor="p-apertura">Apertura</label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-apertura"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.comAperturaRaw}
                        onChange={(e) => update('comAperturaRaw', e.target.value)}
                      />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-mant">Mantenimiento</label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-mant"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.comMantenimientoRaw}
                        onChange={(e) => update('comMantenimientoRaw', e.target.value)}
                      />
                      <span className={styles.suffix}>€/mes</span>
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-modif">Modif. condiciones</label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-modif"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.comModifCondicionesRaw}
                        onChange={(e) => update('comModifCondicionesRaw', e.target.value)}
                      />
                      <span className={styles.suffix}>%</span>
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-reclama">Reclamación impago</label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-reclama"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.gastoReclamacionImpagoRaw}
                        onChange={(e) => update('gastoReclamacionImpagoRaw', e.target.value)}
                      />
                      <span className={styles.suffix}>€</span>
                    </div>
                  </div>
                </div>

                {/*
                  Adelantar dinero · §6 bis · quater.

                  Parcial y total son DOS comisiones: los topes legales son
                  máximos y no obligan a que se pacten iguales. Lo normal es que
                  no lo sean —0 % parcial y 0,25 % total es corriente—, y de esa
                  diferencia sale una decisión de dinero.

                  Una comisión tampoco suele ser un número: cambia con el tiempo
                  («2 % los diez primeros años y 1,50 % después»). Mientras sea
                  un solo tramo cabe en una casilla estrecha; en cuanto son
                  varios, la casilla mentiría, así que se abre el calendario.
                */}
                <div className={styles.subLab}>Amortización anticipada</div>
                {verTramosComision ||
                form.comReembolsoParcial.tramos.length > 1 ||
                form.comReembolsoTotal.tramos.length > 1 ? (
                  <>
                    <TopesLegales opciones={topesLegales} onElegir={aplicarTope} />
                    <ComisionEditor
                      titulo="Parcial"
                      valor={form.comReembolsoParcial}
                      onChange={(c) => update('comReembolsoParcial', c)}
                    />
                    <ComisionEditor
                      titulo="Cancelación total"
                      valor={form.comReembolsoTotal}
                      onChange={(c) => update('comReembolsoTotal', c)}
                    />
                  </>
                ) : (
                  <div className={styles.rowTight}>
                    <div className={`${styles.fld} ${styles.wSm}`}>
                      <label className={styles.fldLab} htmlFor="p-amortp">Parcial</label>
                      <div className={styles.inpGroup}>
                        <input
                          id="p-amortp"
                          className={`${styles.inp} ${styles.mono}`}
                          value={fmtNumeroEs(form.comReembolsoParcial.tramos[0]?.porcentaje ?? 0, 2)}
                          onChange={(e) =>
                            update('comReembolsoParcial', {
                              tramos: [{ porcentaje: parseNum(e.target.value) }],
                              origen: 'ESCRITURA',
                            })
                          }
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <div className={`${styles.fld} ${styles.wMd}`}>
                      <label className={styles.fldLab} htmlFor="p-amortt">Cancelación total</label>
                      <div className={styles.inpGroup}>
                        <input
                          id="p-amortt"
                          className={`${styles.inp} ${styles.mono}`}
                          value={fmtNumeroEs(form.comReembolsoTotal.tramos[0]?.porcentaje ?? 0, 2)}
                          onChange={(e) =>
                            update('comReembolsoTotal', {
                              tramos: [{ porcentaje: parseNum(e.target.value) }],
                              origen: 'ESCRITURA',
                            })
                          }
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.linkAdd}
                      onClick={() => setVerTramosComision(true)}
                    >
                      <Plus size={14} /> Cambia con los años
                    </button>
                  </div>
                )}
                {(form.comReembolsoParcial.origen === 'TOPE_LEGAL' ||
                  form.comReembolsoTotal.origen === 'TOPE_LEGAL') && (
                  <div className={styles.helper}>
                    <b>La cifra de arriba la propone ATLAS</b>, no está leída de tu escritura ·
                    contrástala.
                  </div>
                )}

                {/*
                  Las revisiones que YA ocurrieron · §6 bis · bis.

                  Sin ellas el cuadro de una variable de hace años se genera
                  entero al índice de HOY: una hipoteca firmada con el Euríbor
                  al 0 % y revisada al 4 % diría que sus cuotas pasadas fueron
                  las de ahora, y de ahí salen los intereses de cada ejercicio.
                */}
                {form.tipoInteres !== 'fijo' && (
                  <>
                    <div className={styles.subLab}>Revisiones ya aplicadas</div>
                    {form.revisionesIndice.map((r) => (
                      <div key={r.id} className={styles.rowTight}>
                        <div className={`${styles.fld} ${styles.wLg}`}>
                          <input
                            type="date"
                            aria-label="Desde qué día rige"
                            className={`${styles.inp} ${styles.mono}`}
                            value={r.desde}
                            onChange={(e) => updateRevision(r.id, { desde: e.target.value })}
                          />
                        </div>
                        <div className={`${styles.fld} ${styles.wSm}`}>
                          <div className={styles.inpGroup}>
                            <input
                              aria-label="Valor del índice"
                              className={`${styles.inp} ${styles.mono}`}
                              value={r.valorRaw}
                              placeholder="2,164"
                              onChange={(e) => updateRevision(r.id, { valorRaw: e.target.value })}
                            />
                            <span className={styles.suffix}>%</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.iconDel}
                          onClick={() => removeRevision(r.id)}
                          title="Borrar revisión"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    ))}
                    <button type="button" className={styles.linkAdd} onClick={addRevision}>
                      <Plus size={14} /> Añadir una revisión
                    </button>
                    <div className={styles.helper}>
                      Lo que no se apunte se calcula con el índice de arriba, que es el de{' '}
                      <b>hoy</b>. Después de la última apuntada el cuadro sigue con ese mismo
                      tipo: se sabe cuándo revisa el banco, no a cuánto.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Bonificaciones ── */}
          <div className={`${styles.adv} ${abiertos.has('bonificaciones') ? styles.advOpen : ''}`}>
            <button
              type="button"
              className={styles.advHead}
              onClick={() => toggleBloque('bonificaciones')}
              aria-expanded={abiertos.has('bonificaciones')}
            >
              <div className={styles.advIc}><Percent size={16} /></div>
              <div className={styles.advTt}>
                <div className={styles.advTitle}>Bonificaciones</div>
                {!abiertos.has('bonificaciones') && (
                  <div className={styles.advSum}>{resumenBonificaciones}</div>
                )}
              </div>
              <ChevronDown className={styles.advChev} size={18} />
            </button>

            {abiertos.has('bonificaciones') && (
              <div className={styles.advBody}>
                <div className={styles.rowTight} style={{ marginTop: 14 }}>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-tope">
                      Tope <span className={styles.req}>*</span>
                    </label>
                    <div className={styles.inpGroup}>
                      <input
                        id="p-tope"
                        className={`${styles.inp} ${styles.mono}`}
                        value={form.topeBonificacionesRaw}
                        placeholder="1,00"
                        onChange={(e) => {
                          update('topeBonificacionesRaw', e.target.value);
                          if (!form.bonificacionesActivas) update('bonificacionesActivas', true);
                        }}
                      />
                      <span className={styles.suffix}>p.p.</span>
                    </div>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    {/* El ÚNICO desplegable de revisión · la revisión es un
                        solo acto y antes había otro igual en el bloque de
                        interés, con sus propias opciones. Vive aquí porque
                        aquí lo tiene también un préstamo fijo, que revisa
                        bonificaciones aunque no tenga índice que revisar. */}
                    <label className={styles.fldLab} htmlFor="p-revbonif">Revisión del banco</label>
                    <select
                      id="p-revbonif"
                      className={styles.inp}
                      value={form.revisionCadaMeses}
                      onChange={(e) => update('revisionCadaMeses', e.target.value)}
                    >
                      <option value="">No lo dice la escritura</option>
                      <option value="12">Anual</option>
                      <option value="6">Semestral</option>
                      <option value="24">Cada 2 años</option>
                    </select>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-gracia">Periodo de gracia</label>
                    <select
                      id="p-gracia"
                      className={styles.inp}
                      value={form.graciaBonificacionesMeses}
                      onChange={(e) => update('graciaBonificacionesMeses', e.target.value)}
                    >
                      <option value="">Ninguno</option>
                      <option value="6">6 meses</option>
                      <option value="12">12 meses</option>
                      <option value="24">24 meses</option>
                    </select>
                  </div>
                  <div className={`${styles.fld} ${styles.wMd}`}>
                    <label className={styles.fldLab} htmlFor="p-proxrev">Próxima revisión</label>
                    <input
                      id="p-proxrev"
                      className={`${styles.inp} ${styles.mono}`}
                      type="month"
                      value={form.proximaRevision}
                      onChange={(e) => update('proximaRevision', e.target.value)}
                    />
                  </div>
                  {/*
                    Solo en un mixto, que es el único con dos fases. Y no es un
                    detalle: dos escrituras reales dicen lo contrario. La
                    Unicaja bonifica «en el segundo y en los sucesivos períodos
                    de interés» —o sea, nunca durante sus 36 meses fijos—; la
                    ING rebaja desde el primer recibo. Un punto entero de
                    diferencia durante tres años.
                  */}
                  {form.tipoInteres === 'mixto' && (
                    <div className={`${styles.fld} ${styles.wLg}`}>
                      <label className={styles.fldLab} htmlFor="p-bonifdesde">Empiezan a rebajar</label>
                      <select
                        id="p-bonifdesde"
                        className={styles.inp}
                        value={form.bonificacionesDesde}
                        onChange={(e) =>
                          update('bonificacionesDesde', e.target.value as FormState['bonificacionesDesde'])
                        }
                      >
                        <option value="FIRMA">Desde la firma</option>
                        <option value="TRAMO_VARIABLE">Al acabar el tramo fijo</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className={styles.fld} style={{ marginTop: 13 }}>
                  <span className={styles.fldLab}>Cómo cuentan</span>
                  <div className={styles.seg}>
                    {(['INDEPENDIENTES', 'CASCADA'] as ModoBonificaciones[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`${styles.segBtn} ${form.modoBonificaciones === m ? styles.segBtnActive : ''}`}
                        onClick={() => update('modoBonificaciones', m)}
                      >
                        {m === 'INDEPENDIENTES' ? 'Independientes' : 'En cascada'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.blist}>
                  {form.bonificaciones.map((b, i) => {
                    const c = condicionDeLaRegla(b.regla);
                    const abierta = filaAbierta === b.id;
                    const cascada = form.modoBonificaciones === 'CASCADA';
                    return (
                      <React.Fragment key={b.id}>
                        <div className={`${styles.crow} ${cascada ? styles.crowCascada : ''}`}>
                          {cascada && <span className={styles.cnum}>{i + 1}</span>}
                          <select
                            aria-label="Qué hay que cumplir"
                            className={styles.inp}
                            value={b.regla.tipo}
                            onChange={(e) => cambiarCondicion(b, e.target.value as TipoCondicion)}
                          >
                            {CONDICIONES.map((o) => (
                              <option key={o.tipo} value={o.tipo}>{o.label}</option>
                            ))}
                          </select>
                          {c.unidad ? (
                            <div className={styles.inpGroup}>
                              <input
                                aria-label={`Umbral de ${b.nombre}`}
                                className={`${styles.inp} ${styles.mono}`}
                                value={b.umbralRaw}
                                onChange={(e) => cambiarUmbral(b, e.target.value)}
                              />
                              <span className={styles.suffix}>{c.unidad}</span>
                            </div>
                          ) : (
                            <input
                              aria-label={`Nombre de ${b.nombre}`}
                              className={styles.inp}
                              value={b.nombre}
                              onChange={(e) => editarBonificacion(b.id, { nombre: e.target.value })}
                            />
                          )}
                          <div className={styles.inpGroup}>
                            <input
                              aria-label={`Rebaja de ${b.nombre}`}
                              className={`${styles.inp} ${styles.mono}`}
                              value={b.tramos.length > 0 ? 'escalones' : b.ppRaw}
                              disabled={b.tramos.length > 0}
                              onChange={(e) => editarBonificacion(b.id, { ppRaw: e.target.value })}
                            />
                            <span className={styles.suffix}>p.p.</span>
                          </div>
                          <button
                            type="button"
                            className={styles.iconDel}
                            onClick={() => setFilaAbierta(abierta ? null : b.id)}
                            aria-expanded={abierta}
                            title="Detalle de la condición"
                          >
                            {/*
                              Clase propia, no la del acordeón · `.advOpen
                              .advChev` gira cuanto cuelgue del bloque abierto,
                              y con ella los chevrones de las cuatro filas
                              apuntaban hacia arriba aunque estuvieran cerradas.
                            */}
                            <ChevronDown
                              className={`${styles.rowChev} ${abierta ? styles.rowChevOpen : ''}`}
                              size={15}
                            />
                          </button>
                          <button
                            type="button"
                            className={styles.iconDel}
                            onClick={() => removeBonificacion(b.id)}
                            title="Borrar bonificación"
                          >
                            <Trash2 />
                          </button>

                          {abierta && (
                            <div className={styles.bdetail}>
                              <div className={styles.rowTight}>
                                <div className={`${styles.fld} ${styles.wLg}`}>
                                  <label className={styles.fldLab} htmlFor={`bn-${b.id}`}>
                                    Cómo la llama tu escritura
                                  </label>
                                  <input
                                    id={`bn-${b.id}`}
                                    className={styles.inp}
                                    value={b.nombre}
                                    onChange={(e) => editarBonificacion(b.id, { nombre: e.target.value })}
                                  />
                                </div>
                                <div className={`${styles.fld} ${styles.wSm}`}>
                                  <label className={styles.fldLab} htmlFor={`bs-${b.id}`}>
                                    Sublímite
                                  </label>
                                  <div className={styles.inpGroup}>
                                    <input
                                      id={`bs-${b.id}`}
                                      className={`${styles.inp} ${styles.mono}`}
                                      value={b.sublimiteRaw}
                                      placeholder="—"
                                      onChange={(e) =>
                                        editarBonificacion(b.id, { sublimiteRaw: e.target.value })
                                      }
                                    />
                                    <span className={styles.suffix}>p.p.</span>
                                  </div>
                                </div>
                                <div className={`${styles.fld} ${styles.wSm}`}>
                                  <label className={styles.fldLab} htmlFor={`bw-${b.id}`}>
                                    Se mide en
                                  </label>
                                  <div className={styles.inpGroup}>
                                    <input
                                      id={`bw-${b.id}`}
                                      className={`${styles.inp} ${styles.mono}`}
                                      value={String(b.lookbackMeses)}
                                      onChange={(e) =>
                                        editarBonificacion(b.id, {
                                          lookbackMeses: enteroNoNegativo(parseNum(e.target.value)) || 1,
                                        })
                                      }
                                    />
                                    <span className={styles.suffix}>mes</span>
                                  </div>
                                </div>
                                {b.regla.tipo === 'TARJETA' ? (
                                  <div className={`${styles.fld} ${styles.wLg}`}>
                                    <label className={styles.fldLab} htmlFor={`bt-${b.id}`}>
                                      Con qué tarjeta{' '}
                                      <span className={styles.opt}>solo las del banco bonifican</span>
                                    </label>
                                    <select
                                      id={`bt-${b.id}`}
                                      className={styles.inp}
                                      value={b.tarjetaExigidaId ?? ''}
                                      onChange={(e) =>
                                        editarBonificacion(b.id, {
                                          tarjetaExigidaId: e.target.value ? Number(e.target.value) : undefined,
                                        })
                                      }
                                    >
                                      <option value="">
                                        {tarjetasQueBonifican.length
                                          ? 'Sin elegir'
                                          : 'No hay ninguna tarjeta del banco dada de alta'}
                                      </option>
                                      {tarjetasQueBonifican.map((t) => (
                                        <option key={t.id} value={t.id}>{t.alias}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className={`${styles.fld} ${styles.wLg}`}>
                                    <label className={styles.fldLab} htmlFor={`bc-${b.id}`}>
                                      En qué cuenta{' '}
                                      <span className={styles.opt}>la del banco que bonifica</span>
                                    </label>
                                    <select
                                      id={`bc-${b.id}`}
                                      className={styles.inp}
                                      value={b.cuentaExigidaId ?? ''}
                                      onChange={(e) =>
                                        editarBonificacion(b.id, {
                                          cuentaExigidaId: e.target.value || undefined,
                                        })
                                      }
                                    >
                                      <option value="">Sin elegir</option>
                                      {accounts.map((a) => (
                                        <option key={a.id} value={String(a.id)}>{accountLabel(a)}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {cascada && (
                                  <div className={styles.fld}>
                                    <span className={styles.fldLab}>Posición</span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button
                                        type="button"
                                        className={styles.iconDel}
                                        onClick={() => moverBonificacion(b.id, -1)}
                                        disabled={i === 0}
                                        title="Subir"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.iconDel}
                                        onClick={() => moverBonificacion(b.id, 1)}
                                        disabled={i === form.bonificaciones.length - 1}
                                        title="Bajar"
                                      >
                                        ↓
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/*
                                Los escalones · para cuando el anexo no paga una
                                cifra fija sino una que sube con lo que aportas.
                                Guardar solo la mayor diría que rebaja más de lo
                                que rebaja, y solo la menor, menos.
                              */}
                              {!c.umbralEsTexto && c.unidad && (
                                <>
                                  <div className={styles.subLab}>
                                    Escalones <span className={styles.opt}>si la rebaja sube por tramos</span>
                                  </div>
                                  {b.tramos.map((t) => (
                                    <div key={t.id} className={styles.tramoRow}>
                                      <div className={styles.inpGroup}>
                                        <input
                                          aria-label="Desde"
                                          className={`${styles.inp} ${styles.mono}`}
                                          value={t.desdeRaw}
                                          placeholder="desde"
                                          onChange={(e) =>
                                            updateTramoRebaja(b, t.id, { desdeRaw: e.target.value })
                                          }
                                        />
                                        <span className={styles.suffix}>{c.unidad}</span>
                                      </div>
                                      <div className={styles.inpGroup}>
                                        <input
                                          aria-label="Rebaja del escalón"
                                          className={`${styles.inp} ${styles.mono}`}
                                          value={t.ppRaw}
                                          placeholder="rebaja"
                                          onChange={(e) =>
                                            updateTramoRebaja(b, t.id, { ppRaw: e.target.value })
                                          }
                                        />
                                        <span className={styles.suffix}>p.p.</span>
                                      </div>
                                      <button
                                        type="button"
                                        className={styles.iconDel}
                                        onClick={() => removeTramoRebaja(b, t.id)}
                                        title="Borrar escalón"
                                      >
                                        <Trash2 />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className={styles.linkAdd}
                                    onClick={() => addTramoRebaja(b)}
                                  >
                                    <Plus size={14} /> Añadir escalón
                                  </button>
                                </>
                              )}

                              <div className={styles.helper}>
                                <b>La contrato</b> ·{' '}
                                <input
                                  type="checkbox"
                                  checked={b.activa}
                                  onChange={() => editarBonificacion(b.id, { activa: !b.activa })}
                                  aria-label={`Contratada · ${b.nombre}`}
                                />{' '}
                                lo que no marques queda apuntado como lo que ofrece el banco, sin
                                rebajar la cuota.
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <button type="button" className={styles.linkAdd} onClick={addBonificacion}>
                  <Plus size={14} /> Añadir bonificación
                </button>

                <div className={styles.bonifCap}>
                  {form.modoBonificaciones === 'CASCADA' ? (
                    <span>En orden — la primera que no cumplas corta las de debajo</span>
                  ) : (
                    <span>
                      Suman <span className={styles.bonifCapSuman}>−{fmtNumeroEs(sumaPP, 2)} p.p.</span>
                      {topePP > 0 && (
                        <>
                          {' '}· tope{' '}
                          <span className={styles.bonifCapTope}>−{fmtNumeroEs(topePP, 2)} p.p.</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Garantía ── */}
          <div className={`${styles.adv} ${abiertos.has('garantia') ? styles.advOpen : ''}`}>
            <button
              type="button"
              className={styles.advHead}
              onClick={() => toggleBloque('garantia')}
              aria-expanded={abiertos.has('garantia')}
            >
              <div className={styles.advIc}><Shield size={16} /></div>
              <div className={styles.advTt}>
                <div className={styles.advTitle}>
                  Garantía{' '}
                  <span className={styles.advTitleHint}>· qué responde si dejas de pagar</span>
                </div>
                {!abiertos.has('garantia') && <div className={styles.advSum}>{resumenGarantia}</div>}
              </div>
              <ChevronDown className={styles.advChev} size={18} />
            </button>

            {abiertos.has('garantia') && (
              <div className={styles.advBody}>
                {form.tipoPrestamo === 'hipotecario' ? (
                  <>
                    <div className={styles.grid2} style={{ marginTop: 12 }}>
                      <div className={styles.fld}>
                        <label className={styles.fldLab} htmlFor="p-garantia">
                          Inmueble hipotecado <span className={styles.req}>*</span>
                        </label>
                        <select
                          id="p-garantia"
                          className={styles.inp}
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
                    <div className={styles.helper}>
                      En un hipotecario responde el inmueble que se hipoteca.{' '}
                      <b>No tiene por qué ser donde va el dinero</b> — eso es el destino, justo
                      abajo.
                    </div>
                  </>
                ) : (
                  <div className={styles.helper} style={{ marginTop: 12 }}>
                    En un préstamo personal <b>responde el titular</b> con su patrimonio. No hay
                    inmueble que elegir.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Destino del capital ── */}
          <div className={`${styles.adv} ${abiertos.has('destino') ? styles.advOpen : ''}`}>
            <button
              type="button"
              className={styles.advHead}
              onClick={() => toggleBloque('destino')}
              aria-expanded={abiertos.has('destino')}
            >
              <div className={styles.advIc}><Target size={16} /></div>
              <div className={styles.advTt}>
                <div className={styles.advTitle}>
                  Destino del capital{' '}
                  <span className={styles.advTitleHint}>· en qué se emplea el dinero</span>
                </div>
                {!abiertos.has('destino') && <div className={styles.advSum}>{resumenDestino}</div>}
              </div>
              <ChevronDown className={styles.advChev} size={18} />
            </button>

            {abiertos.has('destino') && (
              <div className={styles.advBody}>
                <div style={{ marginTop: 14 }}>
                  {form.destinos.map((d) => (
                    <div key={d.id} className={styles.destRow}>
                      <select
                        aria-label="Tipo de destino"
                        className={styles.inp}
                        value={d.tipo}
                        onChange={(e) => updateDestino(d.id, { tipo: e.target.value as TipoDestinoV2 })}
                      >
                        {DESTINOS_OPCIONES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Inmueble vinculado"
                        className={styles.inp}
                        value={d.inmuebleId}
                        onChange={(e) => updateDestino(d.id, { inmuebleId: e.target.value })}
                        disabled={!PIDE_INMUEBLE(d.tipo)}
                      >
                        <option value="">— sin inmueble vinculado —</option>
                        {inmuebles.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.alias || `Inmueble ${p.id}`}
                          </option>
                        ))}
                      </select>
                      <div className={styles.inpGroup}>
                        <input
                          aria-label="Importe del destino"
                          className={`${styles.inp} ${styles.mono}`}
                          value={fmtNumeroEs(d.importe, 0)}
                          onChange={(e) => updateDestino(d.id, { importe: parseNum(e.target.value) })}
                        />
                        <span className={styles.suffix}>€</span>
                      </div>
                      <div className={styles.inpGroup}>
                        <input
                          aria-label="Porcentaje del destino"
                          className={`${styles.inp} ${styles.mono}`}
                          value={fmtNumeroEs(d.porcentaje, 0)}
                          onChange={(e) => updateDestino(d.id, { porcentaje: parseNum(e.target.value) })}
                        />
                        <span className={styles.suffix}>%</span>
                      </div>
                      <button
                        type="button"
                        className={styles.iconDel}
                        onClick={() => removeDestino(d.id)}
                        disabled={form.destinos.length <= 1}
                        title="Borrar destino"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.linkAdd} onClick={addDestino}>
                  <Plus size={14} /> Añadir otro destino
                </button>
                <div className={`${styles.destOk} ${destinosCuadre.ok ? '' : styles.destKo}`}>
                  {destinosCuadre.ok ? <CheckCheck size={15} /> : <AlertTriangle size={15} />}
                  {destinosCuadre.ok
                    ? `Los destinos cuadran con el capital · ${fmtEur(destinosCuadre.total, 0)} / ${fmtEur(capital, 0)}`
                    : `Los importes deben sumar el capital · ${fmtEur(destinosCuadre.total, 0)} / ${fmtEur(capital, 0)}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className={styles.footer}>
          <div className={`${styles.footHint} ${submitError ? styles.footError : ''}`}>
            <Info />
            {submitError ?? 'Al guardar se regeneran los cargos en Tesorería y el cuadro completo'}
          </div>
          <div className={styles.footActions}>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancel} type="button">
              Cancelar
            </button>
            <button
              className={`${styles.btn} ${styles.btnGold}`}
              onClick={handleSubmit}
              disabled={saving}
              type="button"
            >
              <Save size={15} /> {saving ? 'Guardando…' : 'Guardar préstamo'}
            </button>
          </div>
        </div>

        {/* ═══ PANEL DE CÁLCULO EN VIVO ═══ */}
        <div className={panel.aside}>
          <div className={panel.asLab}>
            Cálculo financiero
            <span className={panel.asLive}><span className={panel.asDot} /> en directo</span>
          </div>

          {cuadro && tramo0 ? (
            <>
              <div className={panel.asHero}>
                <div className={panel.asHeroLab}>
                  {hayDosTramos ? 'Cuota · tramo fijo' : 'Cuota mensual'}
                </div>
                <div className={panel.asCuota}>
                  {fmtNumeroEs(cuadro.resumen.cuotaMensual)}{' '}
                  <span className={panel.asCuotaCur}>€</span>
                </div>
                <div className={panel.asHeroSub}>
                  {numCuotas} cuotas · sistema francés · fin {fmtMesAnio(finCuadro)}
                </div>
                <span className={panel.asTag}>
                  {fmtPct(tramo0.tin)} · {fmtMesAnio(tramo0.desde)} →{' '}
                  {fmtMesAnio(tramo1?.desde ?? finCuadro)}
                </span>
              </div>

              {/*
                Cuándo cambia el tipo · el dato que un mixto esconde. Solo se
                enseña si el cuadro lo dice: sin tramo variable no hay fecha, y
                una inventada se lee igual que una real.
              */}
              {tramo1 && (
                <div className={panel.asAlert}>
                  <AlertTriangle />
                  <div>
                    <div className={panel.asAlertT}>Revisión · {fmtFechaCorta(tramo1.desde)}</div>
                    <div className={panel.asAlertS}>
                      {bonificacionesDesde === 'TRAMO_VARIABLE'
                        ? 'interés y bonificaciones · coinciden'
                        : 'cambia el interés'}
                    </div>
                  </div>
                </div>
              )}

              <div className={panel.asKpis}>
                <div className={panel.asKpi}>
                  <div className={panel.asKpiLab}>
                    {hayDosTramos ? 'TIN tramo fijo' : 'TIN efectivo'}
                  </div>
                  <div className={panel.asKpiVal}>{fmtPct(tramo0.tin)}</div>
                  <div className={panel.asKpiSub}>
                    {fmtMesAnio(tramo0.desde)} → {fmtMesAnio(tramo1?.desde ?? finCuadro)}
                  </div>
                </div>
                {tramo1 ? (
                  <button
                    type="button"
                    className={`${panel.asKpi} ${panel.asKpiBtn} ${verVariable ? panel.asKpiOpen : ''}`}
                    onClick={() => setVerVariable((v) => !v)}
                    aria-expanded={verVariable}
                  >
                    <div className={panel.asKpiLab}>TIN variable <ChevronDown /></div>
                    <div className={panel.asKpiVal}>{fmtPct(tramo1.tin)}</div>
                    <div className={panel.asKpiSub}>
                      {fmtMesAnio(tramo1.desde)} → {fmtMesAnio(finCuadro)}
                    </div>
                  </button>
                ) : (
                  <div className={panel.asKpi}>
                    <div className={panel.asKpiLab}>TAE</div>
                    <div className={panel.asKpiVal}>{fmtPct(cuadro.resumen.tae)}</div>
                    <div className={panel.asKpiSub}>
                      {cuadro.resumen.interesesCarenciaTecnica > 0 ? 'incluye días sueltos' : 'coste real'}
                    </div>
                  </div>
                )}
              </div>

              {verVariable && tramo1 && (
                <div className={panel.asVar}>
                  {/*
                    La SUMA, no el tipo ya bonificado · el KPI de arriba enseña
                    lo que se paga y esta fila enseña de dónde sale. Poner aquí
                    el bonificado dejaba escrito «4,149 + 1,750 = 4,90 %», una
                    cuenta que no cuadra, y quien la leyera buscaría el error en
                    el diferencial.
                  */}
                  <div className={panel.asVarRow}>
                    <span>
                      Euríbor {fmtNumeroEs(parseNum(form.euriborRaw), 3)} +{' '}
                      {fmtNumeroEs(parseNum(form.diferencialRaw), 3)}
                    </span>
                    <span className={panel.mono}>{fmtPct(tramo1.tinBase)}</span>
                  </div>
                  <div className={panel.asVarRow}>
                    <span>Cuota estimada</span>
                    <span className={panel.mono}>{fmtEur(cuotaSin, 0)}/mes</span>
                  </div>
                  {bonificacionesTodas.length > 0 && (
                    <>
                      <div className={panel.asVarRow}>
                        <span>
                          Con bonificación máxima · {fmtPct(tinMaximoVariable)}
                        </span>
                        <span className={panel.mono}>{fmtEur(cuotaMax, 0)}/mes</span>
                      </div>
                      <button
                        type="button"
                        className={`${panel.asVarRow} ${panel.asVarRowHl} ${panel.asVarBtn}`}
                        onClick={() => setVerAhorro((v) => !v)}
                        aria-expanded={verAhorro}
                      >
                        <span>
                          Ahorro bonificaciones
                          <ChevronDown
                            className={`${panel.asBdChev} ${verAhorro ? panel.asBdChevOpen : ''}`}
                          />
                        </span>
                        <span className={panel.mono}>
                          −{fmtEur(ahorroMes, 0)}/mes · −{fmtEur(ahorroMes * 12, 0)}/año
                        </span>
                      </button>
                      {verAhorro && (
                        <div className={panel.asBonifDet}>
                          {ahorroPorBonificacion.map((a) => (
                            <div key={a.id} className={panel.asSubRow}>
                              <span>{a.nombre}</span>
                              <span className={panel.mono}>−{fmtEur(a.mes, 0)}/mes</span>
                            </div>
                          ))}
                          <div className={panel.asSubNote}>
                            lo que vale cada una
                            {topePP > 0 && ` · el banco no baja de −${fmtNumeroEs(topePP, 2)} p.p.`}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className={panel.asBreak}>
                <div className={panel.asRow}>
                  <span className={panel.asRowLab}>Capital prestado</span>
                  <span className={panel.asRowVal}>{fmtEur(capital)}</span>
                </div>
                <div className={panel.asRow}>
                  <span className={panel.asRowLab}>
                    + Intereses{hayDosTramos ? ' · estimado' : ''}
                  </span>
                  <span className={panel.asRowVal}>{fmtEur(cuadro.resumen.interesesCuadro)}</span>
                </div>
                {cuadro.resumen.interesesCarenciaTecnica > 0 && (
                  <div className={panel.asRow}>
                    <span className={panel.asRowLab}>
                      + Días sueltos · {carenciaTecnica?.dias} días
                    </span>
                    <span className={panel.asRowVal}>
                      {fmtEur(cuadro.resumen.interesesCarenciaTecnica)}
                    </span>
                  </div>
                )}
                <div className={panel.asRow}>
                  <span className={panel.asRowLab}>+ Comisión apertura</span>
                  <span className={panel.asRowVal}>{fmtEur(comisionAperturaEur)}</span>
                </div>
                <div className={`${panel.asRow} ${panel.asRowTotal}`}>
                  <span className={panel.asRowLab}>
                    Total {hayDosTramos ? 'estimado' : 'a pagar'}
                  </span>
                  <span className={panel.asRowVal}>
                    {fmtEur(
                      capital +
                        cuadro.resumen.interesesCuadro +
                        cuadro.resumen.interesesCarenciaTecnica +
                        comisionAperturaEur,
                    )}
                  </span>
                </div>
              </div>

              {hayDosTramos && (
                <div className={panel.asNota}>
                  Estimado proyectando el tramo variable con el Euríbor actual. Cambiará en cada
                  revisión.
                </div>
              )}

              <button
                type="button"
                className={panel.asBtn}
                onClick={() => setShowCuadroCompleto((v) => !v)}
              >
                <Calendar size={15} />
                {showCuadroCompleto
                  ? 'Ocultar cuadro de amortización'
                  : `Ver cuadro de amortización · ${cuadro.resumen.numLineas} líneas`}
              </button>

              {showCuadroCompleto && <CuadroTabla periodos={cuadro.plan.periodos} />}
            </>
          ) : (
            <div className={panel.asVacio}>
              Completa capital, plazo, tipo de interés y fechas para ver el cálculo en directo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Cuadro completo · tabla desplegable ────────────────────────────────────
const CuadroTabla: React.FC<{ periodos: PeriodoPago[] }> = ({ periodos }) => (
  <div className={panel.cuadroTabla}>
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
        {periodos.map((p) => {
          // El periodo 0 es la carencia técnica · los días sueltos entre la
          // firma y el primer mes de cobro, que el banco cobra aparte.
          const esCarencia = p.periodo === 0;
          return (
            <tr key={p.periodo} className={esCarencia ? panel.cuadroTablaCarencia : ''}>
              <td>{esCarencia ? '0 · sueltos' : p.periodo}</td>
              <td>{fmtFechaCorta(p.fechaCargo)}</td>
              <td>{fmtEur(p.cuota)}</td>
              <td>{fmtEur(p.amortizacion)}</td>
              <td>{fmtEur(p.interes)}</td>
              <td>{fmtEur(p.principalFinal)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default PrestamoPageV2;

/**
 * Para el candado de que los dos caminos acaban en el mismo sitio · patrón del
 * repo. No es API de la pantalla: es lo que hay que poder probar sin montarla.
 */
export const __private__ = {
  formDesdePrestamo,
  emptyFormState,
  reglaDeCondicion,
  umbralDeRegla,
  condicionDeLaRegla,
};
