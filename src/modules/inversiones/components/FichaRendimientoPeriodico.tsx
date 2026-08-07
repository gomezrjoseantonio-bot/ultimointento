// Ficha detalle · grupo `rendimiento_periodico`
// (préstamos P2P · cuentas remuneradas · depósitos a plazo).
//
// Replica exacta del mockup canónico atlas-inversiones-v2.html
// líneas 783-940 (SmartFlip · préstamo P2P).

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import type { PagoRendimiento, RendimientoPeriodico } from '../../../types/inversiones-extended';
import {
  formatCurrency,
  formatPercent,
  getTipoLabel,
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import {
  addMonthsISO,
  cuadroDePosicion,
  estadoPrestamoA,
  mesesCobroDesde,
  PERIODO_MESES,
  SUBTIPO_PRESTAMO_LABEL,
  toDateInput,
  type FrecuenciaCobro,
} from '../utils/prestamoCalendario';
import { parseIsoDateAsUTC, toISODateLocal } from '../../../utils/recurrenceDateUtils';
import ChartInteresesAcumulados, {
  clamp01,
  interpolarY,
  type Punto,
} from './ChartInteresesAcumulados';
import FichaShell from './FichaShell';
import styles from '../pages/FichaPosicion.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
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
  onEditar,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const rendimiento = posicion.rendimiento as RendimientoPeriodico | undefined;
  const tin = Number(rendimiento?.tasa_interes_anual ?? NaN);
  const frecuencia = posicion.frecuencia_cobro;
  const duracionMeses = posicion.duracion_meses;
  const esPrestamo = posicion.tipo === 'prestamo_p2p';
  const retencionPct = Number(
    posicion.retencion_fiscal ?? rendimiento?.retencion_porcentaje ?? 19,
  );
  const sinRetencion = Number.isFinite(retencionPct) && retencionPct === 0;

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

  // ── Cuadro de amortización ────────────────────────────────────────────────
  // Con cuota francesa el capital se devuelve poco a poco: el saldo vivo, los
  // intereses y el reparto de cada cuota salen del cuadro, no de multiplicar
  // el capital inicial por el TIN.
  const cuadro = useMemo(() => cuadroDePosicion(posicion), [posicion]);
  const hoyISO = toISODateLocal(new Date());
  const estado = useMemo(
    () => (cuadro ? estadoPrestamoA(cuadro, hoyISO) : null),
    [cuadro, hoyISO],
  );
  const amortiza = Boolean(cuadro?.amortiza);
  /** Fechas de cuota ya cobradas de verdad (punteadas contra el extracto). */
  const fechasCobradas = useMemo(
    () => new Set(cobrosPagados.map((c) => c.fecha.slice(0, 10))),
    [cobrosPagados],
  );
  /** Capital que sigue vivo hoy · en préstamos sin amortización, el prestado. */
  const capitalVivo = amortiza && estado ? estado.saldoPendiente : aportado;

  const interesAnualEstimado = useMemo(() => {
    // Mockup muestra interés ANUAL (capital × TIN/100), no acumulado generado.
    // En cuota francesa se calcula sobre el capital que sigue vivo.
    if (!Number.isFinite(tin) || capitalVivo <= 0) return null;
    return capitalVivo * (tin / 100);
  }, [tin, capitalVivo]);

  const cuotaPorPeriodo = useMemo(() => {
    // Cuota francesa · importe constante (capital + intereses) del cuadro.
    if (cuadro?.amortiza) return cuadro.cuota;
    // Resto · interés planificado del periodo según TIN + frecuencia.
    if (!frecuencia || !FREC_DIVISOR[frecuencia]) return null;
    if (interesAnualEstimado == null) return null;
    return interesAnualEstimado / FREC_DIVISOR[frecuencia];
  }, [cuadro, interesAnualEstimado, frecuencia]);

  const fechaVencimiento = useMemo(() => {
    if (!posicion.fecha_compra || !duracionMeses) return null;
    const d = new Date(posicion.fecha_compra);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + duracionMeses);
    return d.toISOString();
  }, [posicion.fecha_compra, duracionMeses]);

  // ── Fecha a partir de la cual se reciben los intereses ────────────────────
  // Canónica · `rendimiento.fecha_primer_cobro`. Para posiciones anteriores a
  // ese campo se reconstruye desde el inicio del devengo (el primer pago cae
  // un periodo después).
  const fechaPrimerCobro = useMemo<string>(() => {
    if (rendimiento?.fecha_primer_cobro) return toDateInput(rendimiento.fecha_primer_cobro);
    if (rendimiento?.fecha_inicio_rendimiento) {
      const paso = PERIODO_MESES[(rendimiento.frecuencia_pago ?? 'mensual') as FrecuenciaCobro] ?? 1;
      return addMonthsISO(toDateInput(rendimiento.fecha_inicio_rendimiento), paso);
    }
    return '';
  }, [rendimiento]);

  // Meses naturales (1-12) en los que hay cobro. Vacío = sin restricción.
  const mesesCobro = useMemo<number[]>(() => {
    if (rendimiento?.meses_cobro?.length) return rendimiento.meses_cobro;
    if (fechaPrimerCobro && frecuencia && frecuencia !== 'al_vencimiento') {
      return mesesCobroDesde(fechaPrimerCobro, frecuencia);
    }
    return [];
  }, [rendimiento, fechaPrimerCobro, frecuencia]);

  const aniosOperacion = useMemo(() => {
    if (!duracionMeses) return null;
    return Math.round((duracionMeses / 12) * 10) / 10;
  }, [duracionMeses]);

  const interesesTotalesProyectados = useMemo(() => {
    // Con amortización los intereses caen cada periodo (se calculan sobre el
    // saldo vivo), así que el total sale del cuadro · no de capital × TIN × años.
    if (cuadro) return cuadro.totalIntereses;
    if (interesAnualEstimado == null || aniosOperacion == null) return null;
    return interesAnualEstimado * aniosOperacion;
  }, [cuadro, interesAnualEstimado, aniosOperacion]);

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

  /**
   * ¿Toca cobro en el mes `i` (0-11) del año en curso? Falso antes del primer
   * cobro de intereses, después del vencimiento, o si la frecuencia no paga
   * en ese mes.
   */
  const mesTieneCobro = useMemo(() => {
    const finMes = fechaVencimiento ? fechaVencimiento.slice(0, 7) : null;
    const inicioMes = fechaPrimerCobro ? fechaPrimerCobro.slice(0, 7) : null;
    return (i: number): boolean => {
      const mesActual = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      if (inicioMes && mesActual < inicioMes) return false;
      if (finMes && mesActual > finMes) return false;
      if (mesesCobro.length > 0 && !mesesCobro.includes(i + 1)) return false;
      return true;
    };
  }, [fechaPrimerCobro, fechaVencimiento, mesesCobro, currentYear]);

  /** Nº de cobros previstos dentro del año en curso. */
  const cobrosPorAnio = useMemo(() => {
    const meses = Array.from({ length: 12 }, (_, i) => i).filter(mesTieneCobro);
    return meses.length;
  }, [mesTieneCobro]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const sanitizeCSVTextCell = (value: string | null | undefined): string => {
    const normalized = String(value ?? '').replace(/;/g, ',');
    return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  };

  const exportarCSV = () => {
    // Con cuadro exportamos el calendario completo (es lo que se ve en pantalla);
    // sin él, el histórico de cobros registrados.
    const filas = cuadro
      ? [
          ['Nº', 'Fecha', 'Cuota (€)', 'Intereses (€)', 'Capital (€)', 'Pendiente (€)', 'Estado'].join(';'),
          ...cuadro.periodos.map((p) =>
            [
              String(p.numero),
              p.fecha,
              p.cuota.toFixed(2),
              p.interes.toFixed(2),
              p.amortizacion.toFixed(2),
              p.saldoPendiente.toFixed(2),
              fechasCobradas.has(p.fecha)
                ? 'Cobrada'
                : p.fecha <= hoyISO
                  ? 'Vencida'
                  : 'Prevista',
            ].join(';'),
          ),
        ].join('\n')
      : [
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
  const tipoBadge =
    esPrestamo && posicion.subtipo_prestamo
      ? SUBTIPO_PRESTAMO_LABEL[posicion.subtipo_prestamo]
      : getTipoLabel(posicion.tipo);
  const heroBadge = `${tipoBadge} · ${frecuencia ?? 'cobro periódico'} · ${
    amortiza ? 'capital + intereses en cada cuota' : 'capital al vencimiento'
  }`;

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
    const ratioHoy = clamp01((ahora - t0) / (t1 - t0));

    // Curva real de intereses acumulados. Con cuota francesa es cóncava: los
    // primeros periodos pagan muchos más intereses que los últimos, porque el
    // interés se calcula sobre el capital vivo. Sin cuadro · recta.
    let puntos: Punto[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    if (cuadro && cuadro.periodos.length > 0) {
      let acumulado = 0;
      const trazado: Punto[] = [{ x: 0, y: 0 }];
      for (const periodo of cuadro.periodos) {
        acumulado += periodo.interes;
        const ms = parseIsoDateAsUTC(periodo.fecha).getTime();
        if (Number.isNaN(ms)) continue;
        trazado.push({
          x: clamp01((ms - t0) / (t1 - t0)),
          y: clamp01(acumulado / totalIntereses),
        });
      }
      if (trazado.length > 1) puntos = trazado;
    }
    const acumuladoHoy = interpolarY(puntos, ratioHoy) * totalIntereses;
    return { totalIntereses, ratioHoy, acumuladoHoy, inicio, fin, puntos };
  }, [posicion.fecha_compra, duracionMeses, cuotaPorPeriodo, frecuencia, cuadro, interesesTotalesProyectados]);

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
            {amortiza && estado && (
              <>
                <span className={styles.detailHeroSep}>·</span>
                amortizado <strong>{formatPercent(estado.pctAmortizado)}</strong> de{' '}
                <strong>{formatCurrency(aportado)}</strong>
              </>
            )}
            <span className={styles.detailHeroSep}>·</span>
            IRPF <strong>base ahorro</strong>
          </>
        ),
        stats: [
          {
            lab: amortiza ? 'Capital pendiente' : 'Capital',
            val: formatCurrency(capitalVivo),
          },
          amortiza && cuadro
            ? {
                lab: `Cuota ${frecuencia ?? 'periódica'}`,
                val: formatCurrency(cuadro.cuota),
                valVariant: 'gold' as const,
              }
            : {
                lab: 'Interés anual',
                val: interesAnualEstimado != null ? formatCurrency(interesAnualEstimado) : '—',
                valVariant: interesAnualEstimado != null ? ('gold' as const) : undefined,
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
      // Los cobros NO se registran a mano desde aquí: cada cuota se despliega
      // como previsión de tesorería al crear el préstamo y se da por cobrada al
      // puntearla contra el extracto, como cualquier otro movimiento.
      actions={[
        {
          label: esPrestamo ? 'Editar préstamo' : 'Editar posición',
          variant: 'gold',
          icon: <Icons.Edit size={13} strokeWidth={2} />,
          onClick: onEditar,
        },
      ]}
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
            {cobrosPorAnio} {cobrosPorAnio === 1 ? 'cuota' : 'cuotas'} de{' '}
            {formatCurrency(cuotaPorPeriodo)}
            {amortiza && estado ? (
              <> · capital + intereses · pendiente {formatCurrency(estado.saldoPendiente)}</>
            ) : (
              <> · {formatCurrency(interesAnualEstimado)} anuales</>
            )}
            {fechaPrimerCobro && (
              <> · intereses desde {formatDate(fechaPrimerCobro)}</>
            )}
            {fechaVencimiento && !amortiza && (
              <> · capital al vencimiento · {formatMesAnio(fechaVencimiento)}</>
            )}
          </div>
        )}
        <div className={styles.calGrid}>
          {MES_NOMBRE.map((mesLabel, i) => {
            const importeReal = cobrosAnio[i];
            const cobrado = importeReal != null && importeReal > 0;
            const hayCuota = mesTieneCobro(i);
            let cls = styles.calMes;
            let imp: string;

            if (cobrado) {
              // Pago real registrado vía conciliación tesorería
              cls += ' ' + styles.cobrado;
              imp = '+' + formatCurrency(importeReal);
            } else if (!hayCuota) {
              // Fuera del calendario · antes del primer cobro de intereses,
              // después del vencimiento o mes sin cobro según la frecuencia.
              cls += ' ' + styles.futuro;
              imp = '—';
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
              totalIntereses={chartData.totalIntereses}
              ratioHoy={chartData.ratioHoy}
              acumuladoHoy={chartData.acumuladoHoy}
              inicio={chartData.inicio}
              fin={chartData.fin}
              puntos={chartData.puntos}
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
            {amortiza && estado && (
              <>
                <div className={styles.statRow}>
                  <span className={styles.statRowLab}>
                    Capital amortizado · {estado.cuotasPagadas}
                    {estado.cuotasPagadas === 1 ? ' cuota' : ' cuotas'}
                  </span>
                  <span className={`${styles.statRowVal} ${styles.pos}`}>
                    {formatCurrency(estado.capitalAmortizado)} ·{' '}
                    {formatPercent(estado.pctAmortizado)}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLab}>Capital pendiente hoy</span>
                  <span className={styles.statRowVal}>
                    {formatCurrency(estado.saldoPendiente)}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLab}>Intereses cobrados hasta hoy</span>
                  <span className={`${styles.statRowVal} ${styles.gold}`}>
                    +{formatCurrency(estado.interesesAcumulados)}
                  </span>
                </div>
              </>
            )}
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
            <strong>Fiscalidad · IRPF base ahorro</strong> ·{' '}
            {sinRetencion ? (
              <>
                el prestatario es un particular y <strong>no practica retención</strong>: el
                cobro llega íntegro y los intereses se declaran en tu base del ahorro
                (<strong>19%</strong> hasta 6.000 € · <strong>21%</strong> 6.000-50.000 € ·{' '}
                <strong>23%</strong> 50.000-200.000 €).
              </>
            ) : (
              <>
                los intereses tributan con retención del{' '}
                <strong>{formatPercent(retencionPct)}</strong> (base del ahorro ·{' '}
                <strong>19%</strong> hasta 6.000 € · <strong>21%</strong> 6.000-50.000 € ·{' '}
                <strong>23%</strong> 50.000-200.000 €).
              </>
            )}{' '}
            {amortiza ? (
              <>
                El capital <strong>vuelve a caja en cada cuota</strong>
                {fechaVencimiento ? <> hasta {formatMesAnio(fechaVencimiento)}</> : null}
                {' · '}solo tributa la parte de intereses.
              </>
            ) : (
              <>
                El capital <strong>queda bloqueado</strong>
                {fechaVencimiento ? <> hasta {formatMesAnio(fechaVencimiento)}</> : null}
                {' · '}no hay liquidez anticipada.
              </>
            )}
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
            {cuadro ? 'Cuadro de cuotas' : 'Cobros · histórico'}
          </div>
          {(cuadro ? cuadro.periodos.length > 0 : cobros.length > 0) && (
            <button type="button" className={styles.linkBtn} onClick={exportarCSV}>
              Exportar CSV
            </button>
          )}
        </div>
        {cuadro ? (
          <>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--atlas-v5-ink-4)',
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              Cada cuota se prevé en Tesorería y se da por cobrada cuando la punteas
              contra el extracto · aquí no se registran cobros a mano.
            </div>
            <div className={styles.tablaWrap} style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Cuota</th>
                    <th style={{ textAlign: 'right' }}>Intereses</th>
                    <th style={{ textAlign: 'right' }}>Capital</th>
                    <th style={{ textAlign: 'right' }}>Pendiente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuadro.periodos.map((p) => {
                    const cobrado = fechasCobradas.has(p.fecha);
                    const vencida = p.fecha <= hoyISO;
                    return (
                      <tr key={p.numero}>
                        <td className={styles.num}>{p.numero}</td>
                        <td>{formatDate(p.fecha)}</td>
                        <td className={styles.num}>{formatCurrency(p.cuota)}</td>
                        <td className={`${styles.num} ${styles.gold}`}>
                          {formatCurrency(p.interes)}
                        </td>
                        <td className={styles.num}>{formatCurrency(p.amortizacion)}</td>
                        <td className={styles.num}>{formatCurrency(p.saldoPendiente)}</td>
                        <td className={styles.txt}>
                          {cobrado ? (
                            <span className={styles.pos}>Cobrada</span>
                          ) : vencida ? (
                            'Vencida · por puntear'
                          ) : (
                            'Prevista'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : cobros.length === 0 ? (
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

export default FichaRendimientoPeriodico;
