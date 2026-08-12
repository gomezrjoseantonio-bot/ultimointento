import React, { useMemo, useState } from 'react';
import { MoneyValue } from '../../../design-system/v5';
import type { PatrimonioInmuebleResumen, ValoracionPunto } from '../adapters/patrimonioInmuebleAdapter';
import { derivarComposicion } from './ComposicionPatrimonioNeto';
import { calcularCambioAnual } from './ValorHoyHero';
import styles from './ResumenCockpitInmueble.module.css';

/** Coste mensual de tener el activo · importes ya calculados en la página. */
export interface CostePropiedadMensual {
  hipoteca: number;
  mantenimiento: number;
  explotacion: number;
}

/** Ganancia acumulada · rentas netas declaradas + año desde el que se acumulan. */
export interface GananciaAcumuladaDatos {
  rentasAcumuladas: number;
  desdeAnio: number | null;
}

/** Rentabilidad para el toggle del chart (renta bruta sobre valor + neta real). */
export interface RentabilidadCockpit {
  rentaMensual: number;
  netaPct: number | null;
  netaEtiqueta?: string;
}

export interface ResumenCockpitInmuebleProps {
  resumen: PatrimonioInmuebleResumen;
  gananciaAcumulada?: GananciaAcumuladaDatos;
  costePropiedad?: CostePropiedadMensual;
  rentabilidad?: RentabilidadCockpit;
  onImportarValoraciones?: () => void;
  onVerFinanciacion?: (prestamoId?: string) => void;
}

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Formatea YYYY-MM o YYYY-MM-DD a un `mmm YYYY` legible en es-ES. */
const formatMes = (fecha: string): string => {
  const [anio, mes] = fecha.split('-');
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < 12 ? `${MESES[idx]} ${anio}` : fecha;
};

const anioDe = (fecha: string): number => Number(fecha.split('-')[0]);

// ───────────────────────── Geometría común del chart ─────────────────────────

const CW = 360;
const CH = 96;
const CPT = 12;
const CPB = 6;
const CPL = 6;
const CPR = 6;
const TASA = 0.03; // supuesto Mi Plan · +3 %/año
const PROY_ANIOS = 20;

/** 'YYYY-MM[-DD]' → año decimal para espaciar el eje X por fecha real. */
const aAnioDecimal = (fecha: string): number => {
  const [anioStr, mesStr] = fecha.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  if (!Number.isFinite(anio)) return 0;
  const mesIdx = Number.isFinite(mes) ? Math.min(Math.max(mes - 1, 0), 11) : 0;
  return anio + mesIdx / 12;
};

// ───────────────────────── Chart · Valor ─────────────────────────

interface ValorModelo {
  areaReal: string;
  lineaReal: string;
  lineaProyeccion: string | null;
  markerX: number;
  markerY: number;
  etiquetaInicio: string;
  etiquetaHoy: string;
  etiquetaFin: string;
  hayProyeccion: boolean;
}

function construirValor(puntos: ValoracionPunto[]): ValorModelo | null {
  const reales = [...puntos]
    .filter((p) => Number.isFinite(p.valor))
    .sort((a, b) => aAnioDecimal(a.fecha) - aAnioDecimal(b.fecha));
  if (reales.length === 0) return null;

  const ultimo = reales[reales.length - 1];
  const xUltimoReal = aAnioDecimal(ultimo.fecha);

  const proyeccion: Array<{ x: number; valor: number }> = [];
  for (let k = 1; k <= PROY_ANIOS; k++) {
    proyeccion.push({ x: xUltimoReal + k, valor: Math.round(ultimo.valor * Math.pow(1 + TASA, k)) });
  }

  const puntosReales =
    reales.length === 1
      ? [{ x: xUltimoReal - 0.001, valor: reales[0].valor }, { x: xUltimoReal, valor: reales[0].valor }]
      : reales.map((p) => ({ x: aAnioDecimal(p.fecha), valor: p.valor }));

  const todos = [...puntosReales, ...proyeccion];
  const xMin = todos[0].x;
  const xMax = todos[todos.length - 1].x;
  const yMax = Math.max(...todos.map((p) => p.valor)) * 1.08 || 1;
  const spanX = xMax - xMin || 1;

  const px = (x: number) => CPL + ((x - xMin) / spanX) * (CW - CPL - CPR);
  const py = (v: number) => CPT + (1 - v / yMax) * (CH - CPT - CPB);

  const linea = (pts: Array<{ x: number; valor: number }>) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.valor).toFixed(1)}`).join(' ');

  const areaReal = `${linea(puntosReales)} L${px(xUltimoReal).toFixed(1)},${CH - CPB} L${px(
    puntosReales[0].x,
  ).toFixed(1)},${CH - CPB} Z`;

  return {
    areaReal,
    lineaReal: linea(puntosReales),
    lineaProyeccion: linea([puntosReales[puntosReales.length - 1], ...proyeccion]),
    markerX: px(xUltimoReal),
    markerY: py(ultimo.valor),
    etiquetaInicio: String(anioDe(reales[0].fecha)),
    etiquetaHoy: `hoy · ${anioDe(ultimo.fecha)}`,
    etiquetaFin: String(Math.round(xMax)),
    hayProyeccion: true,
  };
}

// ───────────────────────── Chart · Rentabilidad % ─────────────────────────

interface RentabModelo {
  renta: { solido: string; discontinuo: string };
  reval: { solido: string; discontinuo: string } | null;
  total: { solido: string; discontinuo: string } | null;
  etiquetaInicio: string;
  etiquetaHoy: string;
  etiquetaFin: string;
  rentaPct: number;
}

/**
 * Rentabilidad anual sobre el valor actual: renta bruta (renta/valor, plana),
 * revalorización real (variación interanual de valoraciones) y total. La parte
 * futura proyecta la revalorización al supuesto de Mi Plan (+3 %). Solo dato
 * real; sin histórico de valoraciones la reval solo se proyecta.
 */
function construirRentab(
  puntos: ValoracionPunto[],
  rentabilidad: RentabilidadCockpit | undefined,
  valorActual: number | null,
): RentabModelo | null {
  if (!rentabilidad || valorActual == null || valorActual <= 0) return null;
  const rentaAnual = rentabilidad.rentaMensual * 12;
  const rentaPct = rentaAnual > 0 ? (rentaAnual / valorActual) * 100 : 0;

  // Valoraciones deduplicadas por año (último valor de cada año).
  const byYear = new Map<number, number>();
  [...puntos]
    .filter((p) => Number.isFinite(p.valor))
    .sort((a, b) => aAnioDecimal(a.fecha) - aAnioDecimal(b.fecha))
    .forEach((p) => byYear.set(anioDe(p.fecha), p.valor));
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length === 0) return null;
  const vals = years.map((y) => byYear.get(y) as number);
  const hoyYear = years[years.length - 1];

  interface P { x: number; renta: number; reval: number | null; total: number | null }
  const pts: P[] = [];
  for (let i = 0; i < years.length; i++) {
    const reval = i === 0 ? null : ((vals[i] - vals[i - 1]) / vals[i - 1]) * 100;
    pts.push({ x: years[i], renta: rentaPct, reval, total: reval == null ? null : rentaPct + reval });
  }
  for (let k = 1; k <= PROY_ANIOS; k++) {
    const reval = TASA * 100;
    pts.push({ x: hoyYear + k, renta: rentaPct, reval, total: rentaPct + reval });
  }

  const xs = pts.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const spanX = xMax - xMin || 1;
  const valores: number[] = [];
  pts.forEach((p) => {
    valores.push(p.renta);
    if (p.reval != null) valores.push(p.reval);
    if (p.total != null) valores.push(p.total);
  });
  const yMax = Math.max(...valores, 1) * 1.18;

  const px = (x: number) => CPL + ((x - xMin) / spanX) * (CW - CPL - CPR);
  const py = (v: number) => CPT + (1 - v / yMax) * (CH - CPT - CPB);

  const trazo = (
    sel: (p: P) => number | null,
  ): { solido: string; discontinuo: string } | null => {
    const validos = pts.filter((p) => sel(p) != null);
    if (validos.length === 0) return null;
    const solidoPts = validos.filter((p) => p.x <= hoyYear);
    const proyPts = validos.filter((p) => p.x >= hoyYear);
    const d = (arr: P[]) =>
      arr.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(sel(p) as number).toFixed(1)}`).join(' ');
    return {
      solido: solidoPts.length >= 2 ? d(solidoPts) : '',
      discontinuo: proyPts.length >= 2 ? d(proyPts) : '',
    };
  };

  const renta = trazo((p) => p.renta) as { solido: string; discontinuo: string };
  return {
    renta,
    reval: trazo((p) => p.reval),
    total: trazo((p) => p.total),
    etiquetaInicio: String(xMin),
    etiquetaHoy: `hoy · ${hoyYear}`,
    etiquetaFin: String(xMax),
    rentaPct,
  };
}

// ───────────────────────── Chart con toggle Valor / Rentabilidad % ─────────────────────────

const FeatureProjeccion: React.FC<{
  puntos: ValoracionPunto[];
  valorActual: number | null;
  rentabilidad?: RentabilidadCockpit;
  onImportar?: () => void;
}> = ({ puntos, valorActual, rentabilidad, onImportar }) => {
  const [modo, setModo] = useState<'valor' | 'rentab'>('valor');
  const valor = useMemo(() => construirValor(puntos), [puntos]);
  const rentab = useMemo(
    () => construirRentab(puntos, rentabilidad, valorActual),
    [puntos, rentabilidad, valorActual],
  );

  if (!valor) {
    return (
      <div className={styles.chartEmpty}>
        <span>Aún no hay valoraciones registradas.</span>
        {onImportar && (
          <button type="button" className={styles.chartEmptyLink} onClick={onImportar}>
            Importar histórico
          </button>
        )}
      </div>
    );
  }

  const puedeRentab = rentab != null;
  const modoEfectivo = modo === 'rentab' && puedeRentab ? 'rentab' : 'valor';

  return (
    <>
      <div className={styles.projHd}>
        <div className={styles.fpTabs} role="group" aria-label="Modo del gráfico">
          <button
            type="button"
            className={modoEfectivo === 'valor' ? styles.fpOn : ''}
            onClick={() => setModo('valor')}
          >
            Valor
          </button>
          <button
            type="button"
            className={modoEfectivo === 'rentab' ? styles.fpOn : ''}
            onClick={() => setModo('rentab')}
            disabled={!puedeRentab}
          >
            Rentabilidad %
          </button>
        </div>
        <span className={styles.projLg}>
          {modoEfectivo === 'valor' ? (
            <>
              <span><i className={styles.lgReal} />realidad</span>
              <span><i className={styles.lgProj} />proyección</span>
            </>
          ) : (
            <>
              <span><i className={styles.lgRenta} />renta</span>
              <span><i className={styles.lgRevalL} />reval.</span>
              <span><i className={styles.lgTotal} />total</span>
            </>
          )}
        </span>
      </div>

      <div className={styles.chart}>
        <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label={modoEfectivo === 'valor' ? 'Evolución del valor' : 'Rentabilidad anual'}>
          <defs>
            <linearGradient id="cockpitValGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {modoEfectivo === 'valor' ? (
            <>
              <path d={valor.areaReal} fill="url(#cockpitValGrad)" />
              {valor.lineaProyeccion && (
                <path d={valor.lineaProyeccion} fill="none" stroke="var(--atlas-v5-gold-soft)" strokeWidth={2} strokeDasharray="5 4" strokeOpacity={0.85} vectorEffect="non-scaling-stroke" />
              )}
              <path d={valor.lineaReal} fill="none" stroke="var(--atlas-v5-gold-soft)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <line x1={valor.markerX} y1={CPT} x2={valor.markerX} y2={CH - CPB} stroke="var(--atlas-v5-on-navy-6)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              <circle cx={valor.markerX} cy={valor.markerY} r={3.6} fill="var(--atlas-v5-card)" stroke="var(--atlas-v5-gold-soft)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            rentab && (
              <>
                {rentab.reval && rentab.reval.solido && (
                  <path d={rentab.reval.solido} fill="none" stroke="var(--atlas-v5-equity-cash)" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {rentab.reval && rentab.reval.discontinuo && (
                  <path d={rentab.reval.discontinuo} fill="none" stroke="var(--atlas-v5-equity-cash)" strokeWidth={1.6} strokeDasharray="4 3" strokeOpacity={0.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {rentab.renta.solido && (
                  <path d={rentab.renta.solido} fill="none" stroke="var(--atlas-v5-equity-amort)" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {rentab.renta.discontinuo && (
                  <path d={rentab.renta.discontinuo} fill="none" stroke="var(--atlas-v5-equity-amort)" strokeWidth={1.6} strokeDasharray="4 3" strokeOpacity={0.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {rentab.total && rentab.total.solido && (
                  <path d={rentab.total.solido} fill="none" stroke="var(--atlas-v5-gold-soft)" strokeWidth={2.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {rentab.total && rentab.total.discontinuo && (
                  <path d={rentab.total.discontinuo} fill="none" stroke="var(--atlas-v5-gold-soft)" strokeWidth={2.6} strokeDasharray="4 3" strokeOpacity={0.75} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
              </>
            )
          )}
        </svg>
      </div>

      <div className={styles.chartX}>
        {modoEfectivo === 'valor' ? (
          <>
            <span>{valor.etiquetaInicio}</span>
            <span>{valor.etiquetaHoy}</span>
            <span>{valor.etiquetaFin}</span>
          </>
        ) : rentab ? (
          <>
            <span>{rentab.etiquetaInicio}</span>
            <span>{rentab.etiquetaHoy}</span>
            <span>{rentab.etiquetaFin}</span>
          </>
        ) : null}
      </div>
      <div className={styles.chartCap}>
        {modoEfectivo === 'valor'
          ? <>proyección a {PROY_ANIOS} años · supuesto de <b>Mi Plan</b></>
          : <>rentabilidad anual sobre el valor actual · realidad + proyección</>}
      </div>
    </>
  );
};

// ───────────────────────── Barra de patrimonio neto ─────────────────────────

interface SegVisual {
  key: 'cash' | 'amortizada' | 'revalorizacion' | 'deudaPendiente';
  label: string;
  amount: number;
  width: number;
}

function anchosBarra(segmentos: Array<{ key: SegVisual['key']; label: string; amount: number }>): SegVisual[] {
  const positivos = segmentos.map((s) => Math.max(s.amount, 0));
  const denom = positivos.reduce((sum, v) => sum + v, 0);
  return segmentos.map((s, i) => ({
    ...s,
    width: denom > 0 ? (positivos[i] / denom) * 100 : 0,
  }));
}

// ───────────────────────── Cockpit ─────────────────────────

const ResumenCockpitInmueble: React.FC<ResumenCockpitInmuebleProps> = ({
  resumen,
  gananciaAcumulada,
  costePropiedad,
  rentabilidad,
  onImportarValoraciones,
  onVerFinanciacion,
}) => {
  const {
    costeAdquisicion,
    valorActual,
    fechaValorActual,
    deudaPendiente,
    tieneFinanciacion,
    patrimonioNeto,
    revalorizacion,
    revalorizacionPct,
    ltv,
    financiacion,
    historicoValoraciones,
  } = resumen;

  const principalInicialTotal = financiacion.reduce((s, l) => s + l.principalInicial, 0);
  const deudaAmortizada = Math.max(principalInicialTotal - deudaPendiente, 0);
  const cambioAnual = calcularCambioAnual(historicoValoraciones);

  const composicion = useMemo(
    () =>
      derivarComposicion({
        costeAdquisicion,
        valorActual,
        deudaPendiente,
        patrimonioNeto,
        revalorizacion,
        principalInicialTotal,
      }),
    [costeAdquisicion, valorActual, deudaPendiente, patrimonioNeto, revalorizacion, principalInicialTotal],
  );

  const segmentos = useMemo(() => anchosBarra(composicion.segmentos), [composicion.segmentos]);

  const swClase: Record<SegVisual['key'], string> = {
    cash: styles.swCash,
    amortizada: styles.swAmortizada,
    revalorizacion: styles.swReval,
    deudaPendiente: styles.swDeuda,
  };
  const legVisibles = composicion.segmentos.filter(
    (s) => s.amount > 0 || s.key === 'cash' || s.key === 'revalorizacion',
  );

  const rentasAcumuladas = gananciaAcumulada?.rentasAcumuladas ?? 0;
  const gananciaTotal = (revalorizacion ?? 0) + rentasAcumuladas;
  const mostrarGanancia =
    gananciaAcumulada != null && (revalorizacion !== null || rentasAcumuladas !== 0);

  const costeMensual = costePropiedad
    ? costePropiedad.hipoteca + costePropiedad.mantenimiento + costePropiedad.explotacion
    : 0;
  const mostrarCoste = costePropiedad != null && costeMensual > 0;

  const cuotaTotal = financiacion.reduce((s, l) => s + l.cuotaMensual, 0);
  const primerPrestamo = financiacion[0];

  return (
    <div className={styles.cockpit}>
      {/* ── Feature navy ── */}
      <div className={styles.feat}>
        <div>
          <div className={styles.featKick}>
            Valor hoy{fechaValorActual ? ` · ${formatMes(fechaValorActual)}` : ''}
          </div>
          {valorActual !== null ? (
            <>
              <div className={styles.featBig}>
                <MoneyValue value={valorActual} decimals={0} />
              </div>
              <div className={styles.featDelta}>
                {cambioAnual !== null && (
                  <>
                    {cambioAnual >= 0 ? '+' : '−'}
                    <MoneyValue value={Math.abs(cambioAnual)} decimals={0} /> este año
                  </>
                )}
                {cambioAnual !== null && revalorizacionPct !== null && ' · '}
                {revalorizacionPct !== null && (
                  <>
                    {revalorizacionPct >= 0 ? '+' : '−'}
                    {Math.abs(revalorizacionPct).toFixed(0)} % s/ coste de compra
                  </>
                )}
              </div>
            </>
          ) : (
            <div className={styles.featNoData}>Sin valoración registrada</div>
          )}
        </div>

        <FeatureProjeccion
          puntos={historicoValoraciones}
          valorActual={valorActual}
          rentabilidad={rentabilidad}
          onImportar={onImportarValoraciones}
        />

        {/* Patrimonio neto · barra apilada */}
        <div className={styles.eqWrap}>
          <div className={styles.eqBarHd}>
            <span className={styles.eqLabel}>
              Patrimonio neto · <b><MoneyValue value={patrimonioNeto} decimals={0} /></b>
              {composicion.netoPct !== null && ` · ${composicion.netoPct} %`}
            </span>
            <span className={styles.eqHint}>de qué se compone</span>
          </div>
          <div className={styles.eqBar} role="img" aria-label="Composición del patrimonio neto sobre el valor actual">
            {segmentos.map((s) => {
              if (s.width <= 0) return null;
              if (s.key === 'deudaPendiente') {
                return (
                  <div key={s.key} className={styles.eqSegDeuda} style={{ width: `${s.width}%` }} title={s.label}>
                    {s.width >= 12 && 'Deuda'}
                  </div>
                );
              }
              const clase =
                s.key === 'cash'
                  ? styles.segCash
                  : s.key === 'amortizada'
                    ? styles.segAmortizada
                    : styles.segReval;
              return (
                <div
                  key={s.key}
                  className={`${styles.eqSeg} ${s.key === 'revalorizacion' ? styles.gold : ''} ${clase}`}
                  style={{ width: `${s.width}%` }}
                  title={s.label}
                >
                  {s.width >= 16 && s.key === 'revalorizacion' && 'Revalorización'}
                </div>
              );
            })}
          </div>
          <div className={styles.eqLeg}>
            {legVisibles.map((s) => (
              <div key={s.key} className={styles.eqLegItem}>
                <span className={styles.eqLegLabel}>
                  <span className={`${styles.sw} ${swClase[s.key]}`} />
                  {s.label}
                </span>
                <span className={styles.eqLegValue}>
                  {s.key === 'revalorizacion' && s.amount < 0 && '−'}
                  <MoneyValue value={Math.abs(s.amount)} decimals={0} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Columna derecha · KPIs patrimoniales ── */}
      <div className={styles.colR}>
        {/* Ganancia acumulada */}
        <div className={`${styles.kc} ${styles.gold}`}>
          <div className={styles.kcTop}>
            <span className={styles.kcLab}>Ganancia acumulada</span>
            <span className={styles.kcIco}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8M21 7v5h-5" />
              </svg>
            </span>
          </div>
          {mostrarGanancia ? (
            <>
              <div className={`${styles.kcBig} ${styles.gold}`}>
                {gananciaTotal >= 0 ? '+' : '−'}
                <MoneyValue value={Math.abs(gananciaTotal)} decimals={0} />
              </div>
              <div className={styles.flowEq}>
                {revalorizacion !== null && (
                  <>
                    <span className="am">
                      <MoneyValue value={Math.abs(revalorizacion)} decimals={0} showCurrency={false} />
                    </span>
                    <span className={styles.op}>reval.</span>
                  </>
                )}
                {revalorizacion !== null && rentasAcumuladas !== 0 && <span className={styles.op}>+</span>}
                {rentasAcumuladas !== 0 && (
                  <>
                    <span className="am">
                      <MoneyValue value={Math.abs(rentasAcumuladas)} decimals={0} showCurrency={false} />
                    </span>
                    <span className={styles.op}>rentas</span>
                  </>
                )}
              </div>
              <div className={styles.kcSub}>
                sobre <MoneyValue value={costeAdquisicion} decimals={0} /> de coste
                {gananciaAcumulada?.desdeAnio != null && ` · desde ${gananciaAcumulada.desdeAnio}`}
              </div>
            </>
          ) : (
            <>
              <div className={styles.kcBig}>—</div>
              <div className={styles.kcSub}>requiere una valoración registrada</div>
            </>
          )}
        </div>

        {/* Coste de propiedad */}
        <div className={styles.kc}>
          <div className={styles.kcTop}>
            <span className={styles.kcLab}>Coste de propiedad</span>
            <span className={styles.kcIco}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6" />
              </svg>
            </span>
          </div>
          {mostrarCoste ? (
            <>
              <div className={styles.kcBig}>
                <MoneyValue value={costeMensual} decimals={0} />
                <span className={styles.kcUnit}>/mes</span>
              </div>
              <div className={styles.flowEq}>
                <span className="am"><MoneyValue value={costePropiedad!.hipoteca} decimals={0} showCurrency={false} /></span>
                <span className={styles.op}>hipoteca</span>
                <span className={styles.op}>+</span>
                <span className="am"><MoneyValue value={costePropiedad!.mantenimiento} decimals={0} showCurrency={false} /></span>
                <span className={styles.op}>manten.</span>
                {costePropiedad!.explotacion > 0 && (
                  <>
                    <span className={styles.op}>+</span>
                    <span className="am"><MoneyValue value={costePropiedad!.explotacion} decimals={0} showCurrency={false} /></span>
                    <span className={styles.op}>explot.</span>
                  </>
                )}
              </div>
              <div className={styles.kcSub}>
                lo que cuesta tener el activo · <MoneyValue value={costeMensual * 12} decimals={0} />/año
              </div>
            </>
          ) : (
            <>
              <div className={styles.kcBig}>—</div>
              <div className={styles.kcSub}>sin coste recurrente registrado</div>
            </>
          )}
        </div>

        {/* Financiación */}
        <div className={styles.kc}>
          <div className={styles.kcTop}>
            <span className={styles.kcLab}>Financiación</span>
            <span className={styles.kcIco}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6" />
              </svg>
            </span>
          </div>
          {tieneFinanciacion && primerPrestamo ? (
            <>
              <div className={styles.kcBig}>
                <MoneyValue value={deudaPendiente} decimals={0} />
                {ltv !== null && <span className={styles.kcUnitSm}> · LTV {ltv.toFixed(0)} %</span>}
              </div>
              <div className={styles.kcBrk}>
                <span className={styles.kcChip}>{primerPrestamo.nombre}</span>
                {cuotaTotal > 0 && (
                  <span className={styles.kcChip}>
                    cuota <MoneyValue value={cuotaTotal} decimals={0} showCurrency={false} /> €
                  </span>
                )}
                {deudaAmortizada > 0 && (
                  <span className={`${styles.kcChip} ${styles.g}`}>
                    amortizado <MoneyValue value={deudaAmortizada} decimals={0} showCurrency={false} /> €
                  </span>
                )}
              </div>
              <div className={styles.kcSub}>
                cada cuota amortiza deuda · <b>más propietario</b>
                {onVerFinanciacion && (
                  <button type="button" className={styles.kcLink} onClick={() => onVerFinanciacion(primerPrestamo.id)}>
                    ver préstamo
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={styles.kcBig}>
                <MoneyValue value={0} decimals={0} />
              </div>
              <div className={styles.kcSub}>
                sin financiación vinculada · 100 % en propiedad
                {onVerFinanciacion && (
                  <button type="button" className={styles.kcLink} onClick={() => onVerFinanciacion()}>
                    gestionar financiación
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumenCockpitInmueble;
