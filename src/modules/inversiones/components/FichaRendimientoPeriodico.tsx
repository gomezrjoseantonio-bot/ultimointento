// Ficha detalle · grupo `rendimiento_periodico`
// (préstamos P2P · cuentas remuneradas · depósitos a plazo).
//
// Replica exacta del mockup canónico atlas-inversiones-v2.html
// líneas 783-940 (SmartFlip · préstamo P2P).

import React, { useMemo } from 'react';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import type { PagoRendimiento } from '../../../types/inversiones-extended';
import {
  formatCurrency,
  formatPercent,
  getTipoLabel,
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import FichaShell from './FichaShell';
import styles from '../pages/FichaPosicion.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  // Mantenidos en la firma para compat con FichaPosicionPage; en el
  // mockup canónico la barra de acciones desaparece de la ficha P2P
  // — los dos handlers se siguen exponiendo desde otros flujos
  // (galería · rendimientos pendientes en tesorería).
  onRegistrarCobro: () => void;
  onEditar: () => void;
}

const MES_NOMBRE = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MES_NOMBRE_LOWER = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatMesAnio = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MES_NOMBRE_LOWER[d.getMonth()]} ${d.getFullYear()}`;
};

const FREC_DIVISOR: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

const FichaRendimientoPeriodico: React.FC<Props> = ({
  posicion,
  onBack,
  onRegistrarCobro: _onRegistrarCobro,
  onEditar: _onEditar,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const tin = Number(posicion.rendimiento?.tasa_interes_anual ?? NaN);
  const frecuencia = posicion.frecuencia_cobro;
  const duracionMeses = posicion.duracion_meses;

  // ── Cobros registrados (fuente canónica · rendimientos.pagos_generados con
  //    estado='pagado'; fallback a aportaciones tipo 'dividendo' · legacy) ───
  const cobrosPagados = useMemo<Array<{ fecha: string; importe: number }>>(() => {
    const posExt = posicion as PosicionInversion & {
      rendimiento?: { pagos_generados?: PagoRendimiento[] };
    };
    const pagos = posExt.rendimiento?.pagos_generados ?? [];
    if (pagos.length) {
      return pagos
        .filter((p) => p.estado === 'pagado')
        .map((p) => ({ fecha: p.fecha_pago, importe: p.importe_neto }));
    }
    return (posicion.aportaciones ?? [])
      .filter((a: Aportacion) => a.tipo === 'dividendo' && a.fecha)
      .map((a) => ({ fecha: a.fecha, importe: Number(a.importe ?? 0) }));
  }, [posicion]);

  const cobros = useMemo(
    () =>
      [...cobrosPagados].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [cobrosPagados],
  );

  const interesAnualEstimado = useMemo(() => {
    // Mockup muestra interés ANUAL (capital × TIN/100), no acumulado generado.
    if (!Number.isFinite(tin) || aportado <= 0) return null;
    return aportado * (tin / 100);
  }, [tin, aportado]);

  const cuotaPorPeriodo = useMemo(() => {
    // Importe planificado por período según TIN + frecuencia.
    if (!frecuencia || !FREC_DIVISOR[frecuencia]) return null;
    if (interesAnualEstimado == null) return null;
    return interesAnualEstimado / FREC_DIVISOR[frecuencia];
  }, [interesAnualEstimado, frecuencia]);

  const fechaVencimiento = useMemo(() => {
    if (!posicion.fecha_compra || !duracionMeses) return null;
    const d = new Date(posicion.fecha_compra);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + duracionMeses);
    return d.toISOString();
  }, [posicion.fecha_compra, duracionMeses]);

  const aniosOperacion = useMemo(() => {
    if (!duracionMeses) return null;
    return Math.round((duracionMeses / 12) * 10) / 10;
  }, [duracionMeses]);

  const interesesTotalesProyectados = useMemo(() => {
    if (interesAnualEstimado == null || aniosOperacion == null) return null;
    return interesAnualEstimado * aniosOperacion;
  }, [interesAnualEstimado, aniosOperacion]);

  const devolucionTotal = useMemo(() => {
    if (interesesTotalesProyectados == null) return null;
    return aportado + interesesTotalesProyectados;
  }, [aportado, interesesTotalesProyectados]);

  const rentabilidadTotal = useMemo(() => {
    if (interesesTotalesProyectados == null || aportado <= 0) return null;
    return (interesesTotalesProyectados / aportado) * 100;
  }, [interesesTotalesProyectados, aportado]);

  // ── Año/mes actual ─────────────────────────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // ── Cobros del año actual indexados por mes ───────────────────────────────
  const cobrosAnio = useMemo(() => {
    const arr = new Array<number | null>(12).fill(null);
    for (const c of cobrosPagados) {
      const d = new Date(c.fecha);
      if (d.getFullYear() === currentYear) {
        arr[d.getMonth()] = (arr[d.getMonth()] ?? 0) + c.importe;
      }
    }
    return arr;
  }, [cobrosPagados, currentYear]);

  const cobradoAnio = useMemo(
    () => cobrosAnio.reduce<number>((s, n) => s + (n ?? 0), 0),
    [cobrosAnio],
  );

  // ── CSV export ────────────────────────────────────────────────────────────
  const sanitizeCSVTextCell = (value: string | null | undefined): string => {
    const normalized = String(value ?? '').replace(/;/g, ',');
    return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  };

  const exportarCSV = () => {
    const filas = [
      ['Fecha', 'Importe (€)', 'Notas'].join(';'),
      ...cobros.map((c) =>
        [
          c.fecha,
          String(Number(c.importe ?? 0).toFixed(2)),
          sanitizeCSVTextCell(
            (posicion.aportaciones ?? []).find(
              (a) => a.tipo === 'dividendo' && a.fecha === c.fecha,
            )?.notas ?? '',
          ),
        ].join(';'),
      ),
    ].join('\n');
    const blob = new Blob([filas], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobros-${posicion.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Hero ──────────────────────────────────────────────────────────────────
  const logoCfg = getEntidadLogoConfig(posicion.entidad);
  const heroBadge = `${getTipoLabel(posicion.tipo)} · ${
    frecuencia ?? 'cobro periódico'
  } · vencimiento único`;

  // ── Gráfica intereses acumulados (curva lineal hasta vencimiento) ─────────
  const chartData = useMemo(() => {
    if (
      !posicion.fecha_compra ||
      duracionMeses == null ||
      cuotaPorPeriodo == null ||
      !FREC_DIVISOR[frecuencia ?? '']
    ) {
      return null;
    }
    const inicio = new Date(posicion.fecha_compra);
    if (Number.isNaN(inicio.getTime())) return null;
    const fin = new Date(inicio);
    fin.setMonth(fin.getMonth() + duracionMeses);
    const totalIntereses = (interesesTotalesProyectados ?? 0);
    if (totalIntereses <= 0) return null;
    const ahora = Date.now();
    const t0 = inicio.getTime();
    const t1 = fin.getTime();
    if (t1 <= t0) return null;
    const ratioHoy = Math.max(0, Math.min(1, (ahora - t0) / (t1 - t0)));
    const acumuladoHoy = totalIntereses * ratioHoy;
    return { t0, t1, totalIntereses, ratioHoy, acumuladoHoy, inicio, fin };
  }, [posicion.fecha_compra, duracionMeses, cuotaPorPeriodo, frecuencia, interesesTotalesProyectados]);

  return (
    <FichaShell
      hero={{
        variant: 'prestamo',
        badge: heroBadge,
        logo: {
          text: logoCfg.text,
          bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
          color: logoCfg.color,
          noBorder: logoCfg.noBorder,
        },
        title: `${posicion.nombre || 'Posición'}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`,
        meta: (
          <>
            {posicion.fecha_compra && (
              <>firmado <strong>{formatDate(posicion.fecha_compra)}</strong></>
            )}
            {aniosOperacion != null && (
              <>
                {posicion.fecha_compra && <span className={styles.detailHeroSep}>·</span>}
                <strong>{aniosOperacion} {aniosOperacion === 1 ? 'año' : 'años'}</strong>
              </>
            )}
            {Number.isFinite(tin) && (
              <>
                <span className={styles.detailHeroSep}>·</span>
                TIN <strong>{formatPercent(tin)}</strong>
              </>
            )}
            <span className={styles.detailHeroSep}>·</span>
            IRPF <strong>base ahorro</strong>
          </>
        ),
        stats: [
          { lab: 'Capital', val: formatCurrency(aportado) },
          {
            lab: 'Interés anual',
            val: interesAnualEstimado != null ? formatCurrency(interesAnualEstimado) : '—',
            valVariant: interesAnualEstimado != null ? 'gold' : undefined,
          },
          {
            lab: `Cobrado ${currentYear}`,
            val: cobradoAnio > 0 ? `+${formatCurrency(cobradoAnio)}` : '—',
            valVariant: cobradoAnio > 0 ? 'pos' : undefined,
          },
          {
            lab: 'Vencimiento',
            val: fechaVencimiento ? formatMesAnio(fechaVencimiento) : '—',
            small: true,
          },
        ],
      }}
      onBack={onBack}
      // Sin barra de acciones · mockup detalle P2P no la tiene.
    >
      {/* ── Calendario 12 meses año en curso · mockup l. 825-849 ─────── */}
      <div className={styles.detailCard}>
        <div className={styles.detailCardTit}>Calendario de cobros · año {currentYear}</div>
        {cuotaPorPeriodo != null && interesAnualEstimado != null && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--atlas-v5-ink-4)',
              marginTop: -8,
              marginBottom: 12,
              fontFamily: 'var(--atlas-v5-font-mono-num)',
            }}
          >
            12 cuotas de {formatCurrency(cuotaPorPeriodo)} ·{' '}
            {formatCurrency(interesAnualEstimado)} anuales
            {fechaVencimiento && (
              <> · capital al vencimiento · {formatMesAnio(fechaVencimiento)}</>
            )}
          </div>
        )}
        <div className={styles.calGrid}>
          {MES_NOMBRE.map((mesLabel, i) => {
            const importeReal = cobrosAnio[i];
            const cobrado = importeReal != null && importeReal > 0;
            let cls = styles.calMes;
            let imp: string;

            if (cobrado) {
              // Pago real registrado vía conciliación tesorería
              cls += ' ' + styles.cobrado;
              imp = '+' + formatCurrency(importeReal);
            } else if (i === currentMonth) {
              // Mes actual sin pago aún
              cls += ' ' + styles.pendiente;
              imp = cuotaPorPeriodo != null ? formatCurrency(cuotaPorPeriodo) : '—';
            } else if (i > currentMonth) {
              // Futuro
              cls += ' ' + styles.futuro;
              imp = cuotaPorPeriodo != null ? formatCurrency(cuotaPorPeriodo) : '—';
            } else {
              // Pasado sin pago registrado · pendiente de conciliación
              cls += ' ' + styles.futuro;
              imp = cuotaPorPeriodo != null ? formatCurrency(cuotaPorPeriodo) : '—';
            }
            return (
              <div key={i} className={cls}>
                <div className={styles.calMesNom}>{mesLabel}</div>
                <div className={styles.calMesImp}>{imp}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2 columnas · gráfica + resumen · mockup l. 852-937 ─────────── */}
      <div className={styles.detailCols} style={{ marginTop: 14 }}>
        {/* Gráfica intereses acumulados */}
        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>
            Intereses acumulados{aniosOperacion != null && ` · ${aniosOperacion} ${aniosOperacion === 1 ? 'año' : 'años'}`}
          </div>
          {chartData ? (
            <ChartInteresesAcumulados
              t0={chartData.t0}
              t1={chartData.t1}
              totalIntereses={chartData.totalIntereses}
              ratioHoy={chartData.ratioHoy}
              acumuladoHoy={chartData.acumuladoHoy}
              inicio={chartData.inicio}
              fin={chartData.fin}
            />
          ) : (
            <div className={styles.bigPlaceholder}>
              Datos insuficientes (necesitamos firma · duración · TIN · frecuencia).
            </div>
          )}
        </div>

        {/* Resumen de la operación · mockup l. 905-936 */}
        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>Resumen de la operación</div>
          <div style={{ fontSize: 11.5, color: 'var(--atlas-v5-ink-4)', marginTop: -10, marginBottom: 14 }}>
            proyección total a vencimiento
          </div>
          <div className={styles.statRowList}>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>Capital prestado</span>
              <span className={styles.statRowVal}>{formatCurrency(aportado)}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>
                Intereses totales
                {aniosOperacion != null && ` · ${aniosOperacion} ${aniosOperacion === 1 ? 'año' : 'años'}`}
              </span>
              <span className={`${styles.statRowVal} ${styles.gold}`}>
                {interesesTotalesProyectados != null
                  ? `+${formatCurrency(interesesTotalesProyectados)}`
                  : '—'}
              </span>
            </div>
            <div className={`${styles.statRow} ${styles.highlight}`}>
              <span className={styles.statRowLab}>Devolución total al vencimiento</span>
              <span
                className={`${styles.statRowVal} ${styles.pos}`}
                style={{ fontSize: 16 }}
              >
                {devolucionTotal != null ? formatCurrency(devolucionTotal) : '—'}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>Rentabilidad total</span>
              <span className={`${styles.statRowVal} ${styles.pos}`}>
                {rentabilidadTotal != null ? `+${rentabilidadTotal.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
          <div className={styles.fiscalNota}>
            <strong>Fiscalidad · IRPF base ahorro</strong> · los intereses tributan con retención
            del <strong>19%</strong> (hasta 6.000 €) · <strong>21%</strong> (6.000-50.000 €) ·{' '}
            <strong>23%</strong> (50.000-200.000 €). El capital{' '}
            <strong>queda bloqueado</strong>
            {fechaVencimiento ? <> hasta {formatMesAnio(fechaVencimiento)}</> : null}
            {' · '}no hay liquidez anticipada.
          </div>
        </div>
      </div>

      {/* ── Tabla cobros histórico (no en el mockup pero necesaria) ───── */}
      <div className={styles.detailCard} style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div className={styles.detailCardTit} style={{ marginBottom: 0 }}>
            Cobros · histórico
          </div>
          {cobros.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={exportarCSV}>
              Exportar CSV
            </button>
          )}
        </div>
        {cobros.length === 0 ? (
          <div className={styles.tablaEmpty}>
            Aún no se han registrado cobros. Los pagos pasados aparecerán aquí cuando
            la conciliación de tesorería los marque como cobrados.
          </div>
        ) : (
          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((c, i) => {
                  const ap = (posicion.aportaciones ?? []).find(
                    (a) => a.tipo === 'dividendo' && a.fecha === c.fecha,
                  );
                  return (
                    <tr key={`${c.fecha}-${i}`}>
                      <td>{formatDate(c.fecha)}</td>
                      <td className={`${styles.num} ${styles.pos}`}>
                        {formatCurrency(c.importe)}
                      </td>
                      <td className={styles.txt}>{ap?.notas || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FichaShell>
  );
};

// ── Sub-componente · gráfica SVG intereses acumulados ─────────────────────
interface ChartProps {
  t0: number;
  t1: number;
  totalIntereses: number;
  ratioHoy: number;
  acumuladoHoy: number;
  inicio: Date;
  fin: Date;
}

const ChartInteresesAcumulados: React.FC<ChartProps> = ({
  totalIntereses,
  ratioHoy,
  acumuladoHoy,
  inicio,
  fin,
}) => {
  // Eje X = tiempo (0..1) · eje Y = intereses (0..total)
  const W = 900;
  const H = 220;
  const padL = 50;
  const padR = 30;
  const padT = 30;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xHoy = padL + innerW * ratioHoy;
  const yHoy = padT + innerH * (1 - ratioHoy);

  // Etiquetas X · 6 puntos (inicio, 20%, 40%, 60%, 80%, fin)
  const tickLabels = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i <= 5; i++) {
      const ratio = i / 5;
      const ms = inicio.getTime() + (fin.getTime() - inicio.getTime()) * ratio;
      const d = new Date(ms);
      const label = `${MES_NOMBRE_LOWER[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
      ticks.push({ x: padL + innerW * ratio, label });
    }
    return ticks;
  }, [inicio, fin, padL, innerW]);

  // Etiquetas Y · 4 puntos
  const yLabels = useMemo(() => {
    const labels: { y: number; label: string }[] = [];
    for (let i = 0; i <= 3; i++) {
      const ratio = i / 3;
      const value = totalIntereses * (1 - ratio);
      const y = padT + innerH * ratio;
      labels.push({ y, label: `${Math.round(value / 1000)}K` });
    }
    return labels;
  }, [totalIntereses, padT, innerH]);

  const xEnd = padL + innerW;
  const yEnd = padT;

  return (
    <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Grid horizontal */}
      <g stroke="var(--atlas-v5-line-2)" strokeWidth={1} fill="none">
        {yLabels.map((y, i) => (
          <line key={i} x1={padL} y1={y.y} x2={xEnd} y2={y.y} />
        ))}
      </g>
      {/* Etiquetas Y */}
      <g
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="var(--atlas-v5-ink-4)"
        fontWeight={600}
      >
        {yLabels.map((y, i) => (
          <text key={i} x={padL - 5} y={y.y + 4} textAnchor="end">
            {y.label}
          </text>
        ))}
      </g>
      {/* Etiquetas X */}
      <g
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="var(--atlas-v5-ink-4)"
        fontWeight={600}
        textAnchor="middle"
      >
        {tickLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 10}>
            {t.label}
          </text>
        ))}
      </g>
      {/* Área bajo la línea */}
      <defs>
        <linearGradient id="gradInteresesP2P" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--atlas-v5-gold)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--atlas-v5-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M ${padL} ${padT + innerH} L ${xEnd} ${yEnd} L ${xEnd} ${padT + innerH} Z`}
        fill="url(#gradInteresesP2P)"
        opacity={0.6}
      />
      {/* Línea curva (en realidad recta · lineal en el tiempo) */}
      <path
        d={`M ${padL} ${padT + innerH} L ${xEnd} ${yEnd}`}
        stroke="var(--atlas-v5-gold)"
        strokeWidth={2.8}
        fill="none"
        strokeLinecap="round"
      />
      {/* Marker HOY · vertical dashed */}
      <line
        x1={xHoy}
        y1={padT}
        x2={xHoy}
        y2={padT + innerH}
        stroke="var(--atlas-v5-gold)"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.45}
      />
      {/* Etiqueta HOY */}
      <rect x={xHoy - 25} y={padT - 18} width={50} height={14} rx={3} fill="var(--atlas-v5-gold)" />
      <text
        x={xHoy}
        y={padT - 8}
        textAnchor="middle"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="#fff"
        fontWeight={700}
      >
        HOY
      </text>
      {/* Pelota HOY con importe */}
      <circle cx={xHoy} cy={yHoy} r={5} fill="#fff" stroke="var(--atlas-v5-gold)" strokeWidth={2.5} />
      <text
        x={xHoy + 10}
        y={yHoy + 3}
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={10}
        fill="var(--atlas-v5-ink-2)"
        fontWeight={700}
      >
        {formatCurrency(acumuladoHoy)}
      </text>
      {/* Etiqueta vencimiento */}
      <text
        x={xEnd - 8}
        y={yEnd - 8}
        textAnchor="end"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={10}
        fill="var(--atlas-v5-gold-ink)"
        fontWeight={700}
      >
        {formatCurrency(totalIntereses)} · vencimiento
      </text>
    </svg>
  );
};

export default FichaRendimientoPeriodico;
