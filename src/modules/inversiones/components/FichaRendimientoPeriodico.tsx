// INVERSIONES V1 · Fase 3 · Ficha detalle · grupo `rendimiento_periodico`
// (préstamos P2P · cuentas remuneradas · depósitos a plazo).
//
// Restyle V5 al mockup atlas-inversiones-v10.html · #page-detalle-prestamo
// (l.631-713). Pantalla de supervisión sin scroll: back + dhero fijos ·
// cuerpo de 2 cards (Renta + "La ficha"). Los cobros son SOLO LECTURA
// (regla de oro §3): esta ficha los muestra, no los registra.

import React, { useMemo, useState } from 'react';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import type { PagoRendimiento, RendimientoPeriodico } from '../../../types/inversiones-extended';
import { formatCurrency, formatPercent, getTipoLabel } from '../helpers';
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
import styles from './ficha/fichaDetalleV5.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}

const MES_NOMBRE = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MES_NOMBRE_LOWER = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const yearOf = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear());
};

const FREC_DIVISOR: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

const PERIODO_LABEL: Record<string, string> = {
  mensual: 'mes',
  trimestral: 'trimestre',
  semestral: 'semestre',
  anual: 'año',
};

const TrashIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const ChevronLeft: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const FichaRendimientoPeriodico: React.FC<Props> = ({ posicion, onBack, onEditar, onEliminar }) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const rendimiento = posicion.rendimiento as RendimientoPeriodico | undefined;
  const tin = Number(rendimiento?.tasa_interes_anual ?? NaN);
  const frecuencia = posicion.frecuencia_cobro;
  const duracionMeses = posicion.duracion_meses;
  const esPrestamo = posicion.tipo === 'prestamo_p2p';
  const esDeposito = posicion.tipo === 'deposito_plazo' || posicion.tipo === 'deposito';
  const retencionPctRaw = Number(posicion.retencion_fiscal ?? rendimiento?.retencion_porcentaje ?? 19);
  const retencionPct = Number.isFinite(retencionPctRaw) ? retencionPctRaw : 19;

  const [avisoVisible, setAvisoVisible] = useState(true);

  // ── Cobros registrados (canónico · pagos_generados 'pagado'; fallback
  //    a aportaciones tipo 'dividendo' · legacy) ──────────────────────────
  const cobrosPagados = useMemo<Array<{ fecha: string; importe: number }>>(() => {
    const posExt = posicion as PosicionInversion & {
      rendimiento?: { pagos_generados?: PagoRendimiento[] };
    };
    const pagos = posExt.rendimiento?.pagos_generados ?? [];
    if (pagos.length) {
      return pagos.filter((p) => p.estado === 'pagado').map((p) => ({ fecha: p.fecha_pago, importe: p.importe_neto }));
    }
    return (posicion.aportaciones ?? [])
      .filter((a: Aportacion) => a.tipo === 'dividendo' && a.fecha)
      .map((a) => ({ fecha: a.fecha, importe: Number(a.importe ?? 0) }));
  }, [posicion]);

  // ── Cuadro de amortización ────────────────────────────────────────────
  const cuadro = useMemo(() => cuadroDePosicion(posicion), [posicion]);
  const hoyISO = toISODateLocal(new Date());
  const estado = useMemo(() => (cuadro ? estadoPrestamoA(cuadro, hoyISO) : null), [cuadro, hoyISO]);
  const amortiza = Boolean(cuadro?.amortiza);
  const capitalVivo = amortiza && estado ? estado.saldoPendiente : aportado;

  const interesAnualEstimado = useMemo(() => {
    if (!Number.isFinite(tin) || capitalVivo <= 0) return null;
    return capitalVivo * (tin / 100);
  }, [tin, capitalVivo]);

  const cuotaPorPeriodo = useMemo(() => {
    if (cuadro?.amortiza) return cuadro.cuota;
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

  const fechaPrimerCobro = useMemo<string>(() => {
    if (rendimiento?.fecha_primer_cobro) return toDateInput(rendimiento.fecha_primer_cobro);
    if (rendimiento?.fecha_inicio_rendimiento) {
      const paso = PERIODO_MESES[(rendimiento.frecuencia_pago ?? 'mensual') as FrecuenciaCobro] ?? 1;
      return addMonthsISO(toDateInput(rendimiento.fecha_inicio_rendimiento), paso);
    }
    return '';
  }, [rendimiento]);

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
    if (cuadro) return cuadro.totalIntereses;
    if (interesAnualEstimado == null || aniosOperacion == null) return null;
    return interesAnualEstimado * aniosOperacion;
  }, [cuadro, interesAnualEstimado, aniosOperacion]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

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

  // ── Gráfica de renta acumulada (curva cobrado + previsto) ──────────────
  const chartData = useMemo(() => {
    if (!posicion.fecha_compra || duracionMeses == null || cuotaPorPeriodo == null || !FREC_DIVISOR[frecuencia ?? '']) {
      return null;
    }
    const inicio = new Date(posicion.fecha_compra);
    if (Number.isNaN(inicio.getTime())) return null;
    const fin = new Date(inicio);
    fin.setMonth(fin.getMonth() + duracionMeses);
    const totalIntereses = interesesTotalesProyectados ?? 0;
    if (totalIntereses <= 0) return null;
    const ahora = Date.now();
    const t0 = inicio.getTime();
    const t1 = fin.getTime();
    if (t1 <= t0) return null;
    const ratioHoy = clamp01((ahora - t0) / (t1 - t0));
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
        trazado.push({ x: clamp01((ms - t0) / (t1 - t0)), y: clamp01(acumulado / totalIntereses) });
      }
      if (trazado.length > 1) puntos = trazado;
    }
    const acumuladoHoy = interpolarY(puntos, ratioHoy) * totalIntereses;
    return { totalIntereses, ratioHoy, acumuladoHoy, inicio, fin, puntos };
  }, [posicion.fecha_compra, duracionMeses, cuotaPorPeriodo, frecuencia, cuadro, interesesTotalesProyectados]);

  // ── Agregados de supervisión (cobrado / por cobrar) ────────────────────
  const cobradoTotalReal = useMemo(
    () => cobrosPagados.reduce((s, c) => s + (c.importe || 0), 0),
    [cobrosPagados],
  );
  const cobradoHastaHoy = cobradoTotalReal > 0 ? cobradoTotalReal : (chartData?.acumuladoHoy ?? 0);
  const porCobrar =
    interesesTotalesProyectados != null ? Math.max(0, interesesTotalesProyectados - cobradoHastaHoy) : null;

  const totalPeriodos = useMemo<number | null>(() => {
    if (cuadro) return cuadro.periodos.length;
    if (duracionMeses && frecuencia && FREC_DIVISOR[frecuencia]) {
      return Math.round(duracionMeses / (12 / FREC_DIVISOR[frecuencia]));
    }
    return null;
  }, [cuadro, duracionMeses, frecuencia]);

  const nCobrosHechos = cobrosPagados.length
    ? cobrosPagados.length
    : chartData && totalPeriodos != null
      ? Math.round(chartData.ratioHoy * totalPeriodos)
      : 0;
  const nCobrosPrevistos = totalPeriodos != null ? Math.max(0, totalPeriodos - nCobrosHechos) : null;

  const periodoLabel = frecuencia ? PERIODO_LABEL[frecuencia] ?? 'periodo' : 'periodo';

  // Próximo cobro dentro del año en curso (primer mes con cobro previsto y
  // aún no cobrado, de este mes en adelante).
  const proximoCobro = useMemo<{ label: string; importe: number | null } | null>(() => {
    for (let i = currentMonth; i < 12; i++) {
      if (mesTieneCobro(i) && !(cobrosAnio[i] != null && (cobrosAnio[i] as number) > 0)) {
        return { label: `${MES_NOMBRE_LOWER[i]} ${currentYear}`, importe: cuotaPorPeriodo };
      }
    }
    return null;
  }, [currentMonth, mesTieneCobro, cobrosAnio, cuotaPorPeriodo, currentYear]);

  const garantiaText = esPrestamo
    ? posicion.subtipo_prestamo === 'familiar'
      ? 'préstamo familiar'
      : 'sin garantía real'
    : esDeposito
      ? 'FGD hasta 100.000 €'
      : null;

  const tipoBadge =
    esPrestamo && posicion.subtipo_prestamo
      ? SUBTIPO_PRESTAMO_LABEL[posicion.subtipo_prestamo]
      : getTipoLabel(posicion.tipo);
  const heroEyebrow = `${tipoBadge} · ${retencionPct === 0 ? 'sin retención' : 'rendimiento periódico'}`;
  const desdeYear = yearOf(posicion.fecha_compra);
  const venceYear = yearOf(fechaVencimiento);

  const what = esPrestamo ? 'este préstamo' : esDeposito ? 'este depósito' : 'esta posición';

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ChevronLeft />
        Volver a Inversiones
      </button>

      {/* ── Hero navy de detalle ─────────────────────────────────────── */}
      <div className={styles.dhero}>
        <div>
          <div className={styles.dheroEyebrow}>{heroEyebrow}</div>
          <div className={styles.dheroNom}>
            {posicion.nombre || 'Posición'}
            {posicion.entidad ? ` · ${posicion.entidad}` : ''}
          </div>
          <div className={styles.dheroMeta}>
            {desdeYear !== '—' && <>desde <strong>{desdeYear}</strong></>}
            {aniosOperacion != null && (
              <>
                <span className={styles.dheroSep}>·</span>
                <strong>{aniosOperacion} {aniosOperacion === 1 ? 'año' : 'años'}</strong>
              </>
            )}
            {Number.isFinite(tin) && (
              <>
                <span className={styles.dheroSep}>·</span>TIN <strong>{formatPercent(tin)}</strong>
              </>
            )}
            {frecuencia && (
              <>
                <span className={styles.dheroSep}>·</span>cobro {frecuencia}
              </>
            )}
            {venceYear !== '—' && (
              <>
                <span className={styles.dheroSep}>·</span>vence <strong>{venceYear}</strong>
              </>
            )}
          </div>
        </div>
        <div className={styles.dheroStats}>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>{amortiza ? 'Capital pendiente' : 'Capital prestado'}</div>
            <div className={styles.dstatVal}>{formatCurrency(capitalVivo)}</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>Cobrado hasta hoy</div>
            <div className={`${styles.dstatVal} ${styles.g}`}>{formatCurrency(cobradoHastaHoy)}</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>TIN</div>
            <div className={styles.dstatVal}>{Number.isFinite(tin) ? formatPercent(tin) : '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo · 2 columnas ──────────────────────────────────────── */}
      <div className={styles.dbody}>
        {/* Renta · lo que te paga */}
        <div className={styles.card}>
          <div className={styles.projHd}>
            <div>
              <div className={styles.projEyebrow}>Renta · lo que te paga este {esDeposito ? 'depósito' : 'préstamo'}</div>
              <div className={styles.projVerdict}>
                Ya has cobrado <span className={styles.g}>{formatCurrency(cobradoHastaHoy)}</span>
                {porCobrar != null && (
                  <>
                    <br />
                    <span className={styles.muted}>
                      te quedan {formatCurrency(porCobrar)} por cobrar
                      {venceYear !== '—' ? ` hasta ${venceYear}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className={styles.objCtrl}>
              <div className={styles.objChip}>
                TIN <span className={styles.v}>{Number.isFinite(tin) ? formatPercent(tin) : '—'}</span>
                {frecuencia ? ` · ${frecuencia}` : ''}
              </div>
              {cuotaPorPeriodo != null && (
                <div className={`${styles.objChip} ${styles.alt}`}>
                  Cobras <span className={styles.v}>{formatCurrency(cuotaPorPeriodo)}</span> / {periodoLabel}
                </div>
              )}
            </div>
          </div>

          <div className={styles.projLegend}>
            <span className={styles.pl}><span className={`${styles.plSwatch} ${styles.solid}`} />Cobrado (real)</span>
            <span className={styles.pl}><span className={`${styles.plSwatch} ${styles.dash}`} />Por cobrar (previsto)</span>
          </div>

          <div className={styles.projChart}>
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
              <div className={styles.chartPlaceholder}>
                Datos insuficientes para la gráfica (necesitamos firma · duración · TIN · frecuencia).
              </div>
            )}
          </div>

          <div className={styles.projBoxes}>
            <div className={styles.pbox}>
              <div className={styles.pboxLab}>Cobrado hasta hoy</div>
              <div className={`${styles.pboxVal} ${styles.g}`}>{formatCurrency(cobradoHastaHoy)}</div>
              <div className={styles.pboxSub}>
                {nCobrosHechos} {nCobrosHechos === 1 ? 'cobro' : 'cobros'}
              </div>
            </div>
            <div className={styles.pbox}>
              <div className={styles.pboxLab}>Por cobrar{venceYear !== '—' ? ` hasta ${venceYear}` : ''}</div>
              <div className={styles.pboxVal}>{porCobrar != null ? formatCurrency(porCobrar) : '—'}</div>
              <div className={styles.pboxSub}>
                {nCobrosPrevistos != null ? `${nCobrosPrevistos} ${nCobrosPrevistos === 1 ? 'cobro previsto' : 'cobros previstos'}` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* La ficha · lo esencial */}
        <div className={`${styles.card} ${styles.cardScroll}`}>
          <div className={styles.fcardTitle}>La ficha</div>
          <div className={styles.fcardSub}>lo esencial de {esDeposito ? 'este depósito' : 'este préstamo'}</div>

          <div className={styles.frow}>
            <span className={styles.k}>Interés anual</span>
            <span className={styles.v}>{interesAnualEstimado != null ? formatCurrency(interesAnualEstimado) : '—'}</span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>TIN · TAE</span>
            <span className={styles.v}>{Number.isFinite(tin) ? formatPercent(tin) : '—'}</span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>{amortiza ? 'Capital pendiente' : 'Capital vivo'}</span>
            <span className={styles.v}>{formatCurrency(capitalVivo)}</span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>Próximo cobro</span>
            <span className={`${styles.v} ${styles.g}`}>
              {proximoCobro
                ? `${proximoCobro.label}${proximoCobro.importe != null ? ` · ${formatCurrency(proximoCobro.importe)}` : ''}`
                : '—'}
            </span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>Vencimiento</span>
            <span className={styles.v}>{venceYear}</span>
          </div>
          {garantiaText && (
            <div className={styles.frow}>
              <span className={styles.k}>Garantía</span>
              <span className={styles.v}>{garantiaText}</span>
            </div>
          )}

          {avisoVisible && proximoCobro && proximoCobro.importe != null && (
            <div className={styles.aviso}>
              <button type="button" className={styles.avisoX} onClick={() => setAvisoVisible(false)} aria-label="Cerrar aviso">
                <CloseIcon />
              </button>
              <div className={styles.avisoT}>Próximo cobro</div>
              <div className={styles.avisoB}>
                en <strong>{proximoCobro.label}</strong> entran <strong>{formatCurrency(proximoCobro.importe)}</strong>
                {retencionPct === 0 ? ' (sin retención)' : ` (neto · retención ${formatPercent(retencionPct)})`}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className={styles.sectionLab}>Cobros de {currentYear}</div>
            <div className={styles.cobros}>
              {MES_NOMBRE.map((mesLabel, i) => {
                const cobrado = cobrosAnio[i] != null && (cobrosAnio[i] as number) > 0;
                const hayCuota = mesTieneCobro(i);
                let cls = styles.cmes;
                if (cobrado) cls += ' ' + styles.cob;
                else if (!hayCuota) cls += ' ' + styles.fut;
                else if (i === currentMonth) cls += ' ' + styles.now;
                else cls += ' ' + styles.fut;
                return (
                  <div key={i} className={cls}>
                    {mesLabel}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.fcardActs}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onEditar}>
              Editar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={onEliminar}
              aria-label={`Eliminar ${what}`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FichaRendimientoPeriodico;
