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
 * Posicionamiento · % = días_desde_hoy / 365 * 100
 * Stack-b · si dos hitos < 5% de distancia · el segundo va al carril inferior
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

/** Hito ya resuelto con posición calculada */
interface Hito {
  id: string;
  categoria: HitoCategoria;
  label: string;
  pos: number;       // 0-100 (% sobre 365 días)
  stack: boolean;    // true → carril inferior
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

/** Dado un array de hitos ordenado por pos, aplica flag stack */
function aplicarStack(hitos: Omit<Hito, 'stack'>[]): Hito[] {
  const resultado: Hito[] = [];
  // Recorremos en orden; si la distancia al anterior (carril superior) es < 5%
  // usamos carril inferior.
  const lastPosByCarril: Record<'main' | 'alt', number> = { main: -999, alt: -999 };
  for (const h of hitos) {
    const solapaMain = h.pos - lastPosByCarril.main < 5;
    const solapaAlt = h.pos - lastPosByCarril.alt < 5;
    if (solapaMain && !solapaAlt) {
      resultado.push({ ...h, stack: true });
      lastPosByCarril.alt = h.pos;
    } else {
      resultado.push({ ...h, stack: false });
      lastPosByCarril.main = h.pos;
    }
  }
  return resultado;
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
    const lista: Omit<Hito, 'stack'>[] = [];

    // ── 1. Hitos FISCAL ────────────────────────────────────────────────
    // TODO: conectar con servicio dedicado de obligaciones fiscales cuando esté disponible.
    // Derivación heurística: treasuryEvents de tipo expense o financing cuya fuente
    // indica IRPF, autónomo o prevision fiscal, dentro de los próximos 365d.
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
      const ms = fecha.getTime() - today.getTime();
      const pos = Math.max(0, Math.min(100, (ms / msTotal) * 100));
      lista.push({
        id: `fiscal-${ev.id ?? ev.predictedDate}`,
        categoria: 'fiscal',
        label: ev.description.slice(0, 18) || 'Fiscal',
        pos,
        href: '/fiscal',
      });
    }

    // ── 2. Hitos CONTRATO ──────────────────────────────────────────────
    // Contratos activos cuya fechaFin cae en los próximos 365d.
    for (const c of contracts) {
      if (c.estadoContrato !== 'activo') continue;
      const fechaFin = c.fechaFin ?? (c as Contract & { endDate?: string }).endDate;
      if (!fechaFin) continue;
      const fecha = new Date(fechaFin);
      if (fecha <= today || fecha > fin365) continue;
      const ms = fecha.getTime() - today.getTime();
      const pos = Math.max(0, Math.min(100, (ms / msTotal) * 100));
      const nombreInquilino =
        c.inquilino?.apellidos ? c.inquilino.apellidos.split(' ')[0] : 'Contrato';
      lista.push({
        id: `contrato-${c.id ?? fechaFin}`,
        categoria: 'contrato',
        label: `Vto. ${nombreInquilino}`,
        pos,
        href: '/contratos',
      });
    }

    // ── 3. Hitos DEUDA ─────────────────────────────────────────────────
    // Préstamos activos cuyo vencimiento calculado (fechaFirma + plazoMeses) cae
    // en los próximos 365d.
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
      const ms = fechaVenc.getTime() - today.getTime();
      const pos = Math.max(0, Math.min(100, (ms / msTotal) * 100));
      lista.push({
        id: `deuda-${p.id}`,
        categoria: 'deuda',
        label: p.nombre.slice(0, 14) || 'Préstamo',
        pos,
        href: '/financiacion',
      });
    }

    // ── 4. Hitos DEVOLUCIÓN ────────────────────────────────────────────
    // TreasuryEvents con amount > 0 y sourceType 'irpf_prevision' en próximos 365d.
    // TODO: ampliar a devoluciones IVA cuando el store fiscal tenga campo tipo_devolucion.
    const eventsDevoluciones = treasuryEvents.filter((ev) => {
      if (ev.amount <= 0) return false;
      if (ev.sourceType !== 'irpf_prevision') return false;
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      return fecha > today && fecha <= fin365;
    });
    for (const ev of eventsDevoluciones) {
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      const ms = fecha.getTime() - today.getTime();
      const pos = Math.max(0, Math.min(100, (ms / msTotal) * 100));
      lista.push({
        id: `devolucion-${ev.id ?? ev.predictedDate}`,
        categoria: 'devolucion',
        label: ev.description.slice(0, 16) || 'Devolución',
        pos,
        href: '/fiscal',
      });
    }

    // Ordenar por posición antes de aplicar stack
    lista.sort((a, b) => a.pos - b.pos);
    return aplicarStack(lista);
  }, [treasuryEvents, contracts, prestamos, today]);

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

        {/* Fila eventos */}
        <div className={styles.miniTlEventsRow}>
          {/* Línea HOY */}
          <div className={styles.miniTlToday} style={{ left: `${posicionHoy}%` }}>
            <span className={styles.miniTlTodayLab}>HOY</span>
          </div>

          {hitos.length === 0 && (
            <div className={styles.miniTlEmpty}>Sin hitos en los próximos 12 meses</div>
          )}

          {hitos.map((h) => (
            <button
              key={h.id}
              type="button"
              className={[
                styles.miniTlEvento,
                styles[h.categoria],
                h.stack ? styles.stackB : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${h.pos}%` }}
              onClick={() => navigate(h.href)}
            >
              <IconByCategoria categoria={h.categoria} />
              {h.label}
            </button>
          ))}
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
