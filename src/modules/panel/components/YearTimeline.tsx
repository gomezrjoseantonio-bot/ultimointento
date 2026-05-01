/**
 * ATLAS · Panel · YearTimeline
 *
 * Mini-timeline 12 meses · § Z.12 · TAREA 22.7
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §8 · mockup §192-235
 *
 * Muestra hitos de los próximos 365 días:
 *   fiscal    → obligaciones fiscales próximas (treasuryEvents tipo fiscal)
 *   contrato  → contratos que vencen en 365d
 *   deuda     → préstamos que vencen en 365d
 *   devolucion → devoluciones IRPF/IVA pendientes cobrar
 *
 * Layout (T25.4) · grid 12 columnas · cada columna apila chips verticalmente
 * sin límite de carriles. La línea HOY roja se superpone en posición absoluta.
 *
 * Iconos · § AA.7 · FileText / Calendar / AlertTriangle / Banknote
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import type { TreasuryEvent, Contract } from '../../../services/db';
import type { Prestamo } from '../../../types/prestamos';
import styles from './YearTimeline.module.css';

/** Categoría de un hito del timeline */
type HitoCategoria = 'fiscal' | 'contrato' | 'deuda' | 'devolucion';

/** Hito ya resuelto con posición calculada (mes 0-11 desde mes actual) */
interface Hito {
  id: string;
  categoria: HitoCategoria;
  label: string;
  /** Índice 0-11 del mes desde el mes actual */
  mesIdx: number;
  /** Posición horizontal 0-100 (% sobre 365 días) — usada para HOY y orden */
  pos: number;
  href: string;
}

/** Props del componente */
export interface YearTimelineProps {
  /** TreasuryEvents cargados del store · usados para fiscal y devoluciones */
  treasuryEvents: TreasuryEvent[];
  /** Contratos cargados del store · usados para hitos contrato */
  contracts: Contract[];
  /** Préstamos activos · usados para hitos deuda */
  prestamos: Prestamo[];
  /** Fecha de referencia · por defecto new Date() */
  today?: Date;
}

/** Etiqueta corta del mes (3 letras) en es-ES */
const mesLabel = (d: Date): string =>
  d.toLocaleDateString('es-ES', { month: 'short' }).slice(0, 3).toUpperCase();

/** Icono asociado a cada categoría · § AA.7 */
const IconByCategoria: React.FC<{ categoria: HitoCategoria }> = ({ categoria }) => {
  const size = 10;
  const stroke = 1.7;
  switch (categoria) {
    case 'fiscal':
      // Icons.Contratos === Lucide FileText · § AA.7 · ver design-system/v5/icons.ts
      return <Icons.Contratos size={size} strokeWidth={stroke} />;
    case 'contrato':
      return <Icons.Calendar size={size} strokeWidth={stroke} />;
    case 'deuda':
      return <Icons.Warning size={size} strokeWidth={stroke} />;
    case 'devolucion':
      return <Icons.Banknote size={size} strokeWidth={stroke} />;
  }
};

/** Calcula el índice del mes (0-11) desde el mes actual para una fecha futura */
function mesIdxDesde(today: Date, fecha: Date): number {
  const diffMonths = (fecha.getFullYear() - today.getFullYear()) * 12
    + (fecha.getMonth() - today.getMonth());
  return Math.max(0, Math.min(11, diffMonths));
}

const YearTimeline: React.FC<YearTimelineProps> = ({
  treasuryEvents,
  contracts,
  prestamos,
  today: todayProp,
}) => {
  const navigate = useNavigate();
  const today = useMemo(() => todayProp ?? new Date(), [todayProp]);

  /** Meses · fila superior · 12 etiquetas desde el mes actual */
  const meses = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      return { label: mesLabel(d) };
    });
  }, [today]);

  /** Posición HOY · siempre 0% (inicio del periodo) */
  const posicionHoy = 0;

  /** Hitos derivados de los stores · sin modificar datos */
  const hitos = useMemo((): Hito[] => {
    const fin365 = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    const msTotal = 365 * 24 * 60 * 60 * 1000;
    const lista: Hito[] = [];

    const posPct = (fecha: Date): number => {
      const ms = fecha.getTime() - today.getTime();
      return Math.max(0, Math.min(100, (ms / msTotal) * 100));
    };

    // ── 1. Hitos FISCAL ────────────────────────────────────────────────
    // TODO: conectar con servicio dedicado de obligaciones fiscales cuando esté disponible.
    const sourcesFiscales: TreasuryEvent['sourceType'][] = [
      'autonomo',
      'irpf_prevision',
    ];
    const eventsFiscales = treasuryEvents.filter((ev) => {
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      if (fecha <= today || fecha > fin365) return false;
      return sourcesFiscales.includes(ev.sourceType);
    });
    for (const ev of eventsFiscales) {
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      lista.push({
        id: `fiscal-${ev.id ?? ev.predictedDate}`,
        categoria: 'fiscal',
        label: ev.description.slice(0, 18) || 'Fiscal',
        mesIdx: mesIdxDesde(today, fecha),
        pos: posPct(fecha),
        href: '/fiscal',
      });
    }

    // ── 2. Hitos CONTRATO ──────────────────────────────────────────────
    for (const c of contracts) {
      if (c.estadoContrato !== 'activo') continue;
      const fechaFin = c.fechaFin ?? (c as Contract & { endDate?: string }).endDate;
      if (!fechaFin) continue;
      const fecha = new Date(fechaFin);
      if (fecha <= today || fecha > fin365) continue;
      const nombreInquilino =
        c.inquilino?.apellidos ? c.inquilino.apellidos.split(' ')[0] : 'Contrato';
      lista.push({
        id: `contrato-${c.id ?? fechaFin}`,
        categoria: 'contrato',
        label: nombreInquilino,
        mesIdx: mesIdxDesde(today, fecha),
        pos: posPct(fecha),
        href: '/contratos?tab=acciones',
      });
    }

    // ── 3. Hitos DEUDA ─────────────────────────────────────────────────
    // TODO: conectar con servicio de préstamos para obtener fecha exacta de
    //       cancelación cuando esté disponible.
    for (const p of prestamos) {
      if (p.activo === false || p.estado === 'cancelado') continue;
      const inicio = new Date(p.fechaFirma);
      const fechaVenc = new Date(
        inicio.getFullYear(),
        inicio.getMonth() + p.plazoMesesTotal,
        inicio.getDate(),
      );
      if (fechaVenc <= today || fechaVenc > fin365) continue;
      lista.push({
        id: `deuda-${p.id}`,
        categoria: 'deuda',
        label: p.nombre.slice(0, 14) || 'Préstamo',
        mesIdx: mesIdxDesde(today, fechaVenc),
        pos: posPct(fechaVenc),
        href: '/financiacion',
      });
    }

    // ── 4. Hitos DEVOLUCIÓN ────────────────────────────────────────────
    const eventsDevoluciones = treasuryEvents.filter((ev) => {
      if (ev.amount <= 0) return false;
      if (ev.sourceType !== 'irpf_prevision') return false;
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      return fecha > today && fecha <= fin365;
    });
    for (const ev of eventsDevoluciones) {
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      lista.push({
        id: `devolucion-${ev.id ?? ev.predictedDate}`,
        categoria: 'devolucion',
        label: ev.description.slice(0, 16) || 'Devolución',
        mesIdx: mesIdxDesde(today, fecha),
        pos: posPct(fecha),
        href: '/fiscal',
      });
    }

    // Orden global por fecha (asc)
    lista.sort((a, b) => a.pos - b.pos);
    return lista;
  }, [treasuryEvents, contracts, prestamos, today]);

  /** Agrupar hitos por mes (0-11) — orden por pos preservado dentro del grupo */
  const hitosPorMes = useMemo(() => {
    const mapa = new Map<number, Hito[]>();
    for (const h of hitos) {
      const lista = mapa.get(h.mesIdx) ?? [];
      lista.push(h);
      mapa.set(h.mesIdx, lista);
    }
    return mapa;
  }, [hitos]);

  return (
    <div className={styles.miniTimeline}>
      <div className={styles.miniTlHead}>
        <div className={styles.miniTlTitle}>Próximos 12 meses · hitos relevantes</div>
        <div className={styles.miniTlSub}>fiscal · contratos · deudas · devoluciones</div>
      </div>

      <div className={styles.miniTlStack}>
        {/* Fila meses */}
        <div className={styles.miniTlMonthsRow}>
          {meses.map((m, i) => (
            <div key={i} className={styles.miniTlMonth}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Grid 12 columnas · cada columna apila chips verticalmente · T25.4 */}
        <div className={styles.miniTlEventsGrid}>
          {/* Línea HOY · superpuesta sin afectar layout */}
          <div className={styles.miniTlToday} style={{ left: `${posicionHoy}%` }}>
            <span className={styles.miniTlTodayLab}>HOY</span>
          </div>

          {hitos.length === 0 && (
            <div className={styles.miniTlEmpty}>Sin hitos en los próximos 12 meses</div>
          )}

          {meses.map((_, idx) => {
            const eventosDelMes = hitosPorMes.get(idx) ?? [];
            return (
              <div key={idx} className={styles.miniTlMesColumn}>
                {eventosDelMes.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={[styles.miniTlEvento, styles[h.categoria]].join(' ')}
                    onClick={() => navigate(h.href)}
                    title={h.label}
                  >
                    <IconByCategoria categoria={h.categoria} />
                    <span className={styles.miniTlEventoLab}>{h.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className={styles.miniTlLeg}>
        <div className={styles.miniTlLegItem}>
          <div className={[styles.miniTlLegMini, styles.fiscal].join(' ')} />
          Obligación fiscal
        </div>
        <div className={styles.miniTlLegItem}>
          <div className={[styles.miniTlLegMini, styles.contrato].join(' ')} />
          Contrato
        </div>
        <div className={styles.miniTlLegItem}>
          <div className={[styles.miniTlLegMini, styles.deuda].join(' ')} />
          Deuda crítica
        </div>
        <div className={styles.miniTlLegItem}>
          <div className={[styles.miniTlLegMini, styles.devolucion].join(' ')} />
          Devolución
        </div>
      </div>
    </div>
  );
};

export default YearTimeline;
