// FIX § 1.6 · tab Análisis · reset a 4 bloques triple A.
//   1 · Mapa temporal 24 meses (pasado · HOY · futuro)
//   2 · Ingresos · gráfico SVG de líneas comparativas por año + proyección
//   3 · Ranking inmuebles (sin cambios · solo verificado)
//   4 · Alarmas accionables con cálculos correctos
// Todo runtime · sin datos inventados · sin la cifra "23 unidades libres".

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, AlertTriangle, FileWarning, RotateCcw, CheckCircle2, type LucideIcon } from 'lucide-react';
import { initDB } from '../../../../services/db';
import type { Contract, Property, TreasuryEvent } from '../../../../services/db';
import { rankingPorInmueble } from '../../utils/analisisContratosService';
import {
  calcularMapaTemporal,
  generarMeses24,
  type NivelOcupacion,
} from '../../utils/mapaTemporalService';
import { ingresosPorAnio, proyeccionAnual } from '../../utils/ingresosAnualesService';
import {
  generarAlarmas,
  type AlarmaIcono,
} from '../../utils/alarmasAccionablesService';
import styles from './TabAnalisis.module.css';

export interface TabAnalisisProps {
  contratos: Contract[];
  properties: Property[];
}

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const NIVEL_CLASS: Record<NivelOcupacion, string> = {
  vacio: styles.axVacio,
  parcial: styles.axParcial,
  medio: styles.axMedio,
  pleno: styles.axPleno,
};

const ICONO_ALARMA: Record<AlarmaIcono, LucideIcon> = {
  clock: Clock,
  'alert-triangle': AlertTriangle,
  'file-warning': FileWarning,
  'rotate-ccw': RotateCcw,
};

// ── Geometría del SVG (§ 17 · viewBox 0 0 600 240 · Y 20..220 · range 200) ──
const W = 600;
const PAD_L = 44;
const PAD_R = 16;
const Y_TOP = 20;
const Y_BOT = 220;
const PLOT_W = W - PAD_L - PAD_R;

const TabAnalisis: React.FC<TabAnalisisProps> = ({ contratos, properties }) => {
  const hoy = useMemo(() => new Date(), []);
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth(); // 0-11

  const [events, setEvents] = useState<TreasuryEvent[]>([]);
  useEffect(() => {
    let alive = true;
    initDB()
      .then((db) => db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>)
      .then((ev) => {
        if (alive) setEvents(ev);
      })
      .catch(() => {/* sin tesorería · el gráfico muestra su empty state */});
    return () => {
      alive = false;
    };
  }, []);

  // ── Bloque 1 · mapa temporal ──
  const meses = useMemo(() => generarMeses24(hoy), [hoy]);
  const mapa = useMemo(
    () => calcularMapaTemporal(properties, contratos, hoy),
    [properties, contratos, hoy],
  );

  // ── Bloque 2 · ingresos ──
  const anios = useMemo(() => [anioActual - 2, anioActual - 1, anioActual], [anioActual]);
  const series = useMemo(() => ingresosPorAnio(events, anios), [events, anios]);
  const maxVal = useMemo(
    () => Math.max(1, ...series.flatMap((s) => s.mensual)),
    [series],
  );
  const hayIngresos = useMemo(() => series.some((s) => s.total > 0), [series]);
  const proy = useMemo(
    () => proyeccionAnual(series[2], series[1], mesActual),
    [series, mesActual],
  );

  const x = (i: number): number => PAD_L + (i / 11) * PLOT_W;
  const y = (v: number): number => Y_BOT - (v / maxVal) * (Y_BOT - Y_TOP);
  const puntos = (mensual: number[], upTo = 12): string =>
    mensual.slice(0, upTo).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // ── Bloque 3 · ranking ──
  const ranking = useMemo(() => rankingPorInmueble(contratos, properties), [contratos, properties]);
  const rankingMax = ranking.length > 0 ? Math.max(...ranking.map((r) => r.rentaAnual), 1) : 1;

  // ── Bloque 4 · alarmas ──
  const alarmas = useMemo(() => generarAlarmas(contratos, properties, hoy), [contratos, properties, hoy]);

  return (
    <div>
      {/* ── Bloque 1 · mapa temporal 24 meses ── */}
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardFull}`}>
          <div className={styles.blockHead}>
            <h3 className={styles.h}>Ocupación · 12 meses atrás · hoy · 12 meses adelante</h3>
            <div className={styles.legend}>
              <span><i className={`${styles.lgDot} ${styles.axVacio}`} /> vacío</span>
              <span><i className={`${styles.lgDot} ${styles.axParcial}`} /> parcial</span>
              <span><i className={`${styles.lgDot} ${styles.axPleno}`} /> pleno</span>
              <span><i className={`${styles.lgDot} ${styles.axNow}`} /> hoy</span>
              <span><i className={`${styles.lgDot} ${styles.lgWarn}`} /> vence pronto</span>
            </div>
          </div>

          {mapa.length === 0 ? (
            <div className={styles.headlineSub}>Sin inmuebles activos que mostrar.</div>
          ) : (
            <div className={styles.mapScroll}>
              <div className={styles.mapHeadRow}>
                <div className={styles.mapRowLabel} />
                <div className={styles.mapCells}>
                  {meses.map((m, i) => (
                    <div
                      key={i}
                      className={`${styles.mapMonth} ${m.anio === anioActual && m.mes === mesActual ? styles.mapMonthNow : ''}`}
                    >
                      {m.mes === 0 ? `${m.label} ${String(m.anio).slice(2)}` : m.label}
                    </div>
                  ))}
                </div>
              </div>
              {mapa.map((row) => (
                <div key={row.inmueble.id} className={styles.mapRow}>
                  <div className={styles.mapRowLabel} title={row.inmueble.alias}>
                    {row.inmueble.alias}
                  </div>
                  <div className={styles.mapCells}>
                    {row.cells.map((cell, i) => (
                      <div
                        key={i}
                        className={[
                          styles.axCell,
                          NIVEL_CLASS[cell.nivel],
                          cell.esHoy ? styles.axNow : '',
                          cell.warn ? styles.axWarnBorder : '',
                        ].filter(Boolean).join(' ')}
                        title={`${meses[i].label} ${meses[i].anio}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bloque 2 · ingresos · SVG líneas + proyección ── */}
      <div className={`${styles.grid} ${styles.grid21}`}>
        <div className={styles.card}>
          <h3 className={styles.h}>Ingresos por renta · comparativa anual</h3>
          {!hayIngresos ? (
            <div className={styles.headlineSub}>
              Aún no hay rentas confirmadas en tesorería para dibujar la comparativa.
            </div>
          ) : (
            <>
              <svg className={styles.chart} viewBox="0 0 600 240" role="img" aria-label="Ingresos por renta por año">
                {/* Ejes Y · 0 € abajo · máximo arriba */}
                <line x1={PAD_L} y1={Y_BOT} x2={W - PAD_R} y2={Y_BOT} className={styles.axisLine} />
                <text x={PAD_L - 6} y={Y_BOT} className={styles.axisLabel} textAnchor="end">0 €</text>
                <text x={PAD_L - 6} y={Y_TOP + 8} className={styles.axisLabel} textAnchor="end">
                  {eur(maxVal)}
                </text>
                {/* 2024 · gris claro */}
                <polyline className={styles.line2024} points={puntos(series[0].mensual)} />
                {/* 2025 · gris medio */}
                <polyline className={styles.line2025} points={puntos(series[1].mensual)} />
                {/* 2026 · dorado · solo hasta el mes actual + punto */}
                <polyline className={styles.line2026} points={puntos(series[2].mensual, mesActual + 1)} />
                <circle
                  className={styles.line2026Dot}
                  cx={x(mesActual)}
                  cy={y(series[2].mensual[mesActual] ?? 0)}
                  r={4}
                />
              </svg>
              <div className={styles.chartLegend}>
                <span><i className={`${styles.lgLine} ${styles.line2024}`} /> {anios[0]}</span>
                <span><i className={`${styles.lgLine} ${styles.line2025}`} /> {anios[1]}</span>
                <span><i className={`${styles.lgLine} ${styles.line2026}`} /> {anios[2]}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.h}>Proyección {anioActual}</h3>
          <div className={styles.proyBox}>
            <div className={styles.proyH}>Proyección {anioActual} vs {anioActual - 1}</div>
            <div className={`${styles.proyV} ${proy.pct != null && proy.pct < 0 ? styles.neg : ''}`}>
              {proy.pct == null ? '—' : `${proy.pct > 0 ? '+' : ''}${proy.pct} %`}
            </div>
            <div className={styles.proyS}>
              {proy.pct == null
                ? 'Faltan datos de renta confirmada para proyectar.'
                : 'manteniendo ocupación y rentas actuales'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bloque 3 · ranking por inmueble ── */}
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3 className={styles.h}>Ingresos por inmueble · ranking anual</h3>
          {ranking.length === 0 ? (
            <div className={styles.headlineSub}>Sin inmuebles activos que mostrar.</div>
          ) : (
            ranking.map((r) => (
              <div key={r.inmuebleId} className={styles.rankRow}>
                <div className={styles.rankName} title={r.alias}>{r.alias}</div>
                <div className={styles.rankBarTrack}>
                  <div
                    className={styles.rankBarFill}
                    style={{ width: `${Math.round((r.rentaAnual / rankingMax) * 100)}%` }}
                  />
                </div>
                <div>
                  <div className={styles.rankVal}>{eur(r.rentaAnual)}</div>
                  <div className={styles.rankSub}>{r.ocupacionPct} % ocupación</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Bloque 4 · alarmas accionables ── */}
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3 className={styles.h}>Alarmas tempranas</h3>
          {alarmas.length === 0 ? (
            <div className={styles.alarmEmpty}>
              <CheckCircle2 size={16} strokeWidth={1.8} />
              Nada que requiera tu atención. Todo en orden.
            </div>
          ) : (
            alarmas.map((a) => {
              const Icono = ICONO_ALARMA[a.icono];
              return (
                <div key={a.id} className={`${styles.alarmRow} ${a.tono === 'neg' ? styles.alarmNeg : styles.alarmWarn}`}>
                  <span className={styles.alarmIcon} aria-hidden="true">
                    <Icono size={16} strokeWidth={1.8} />
                  </span>
                  <div className={styles.alarmBody}>
                    <div className={styles.alarmTitle}>{a.titulo}</div>
                    <div className={styles.alarmDetail}>{a.detalle}</div>
                  </div>
                  <span className={styles.alarmCta}>{a.cta}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TabAnalisis;
export { TabAnalisis };
