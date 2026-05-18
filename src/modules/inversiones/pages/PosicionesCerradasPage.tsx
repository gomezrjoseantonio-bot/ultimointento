// T-INVERSIONES-DETALLE-PP-v1 · PR 5 · rediseño completo §6.
//
// Foco rentabilidad REAL · SIN columnas fiscales (vive en /fiscal).
// 4 bloques chicha · C1 hero patrimonio cerrado · C3 best/worst ·
// C2 histograma + banner análisis cerrable · C5 ranking por tipo +
// banner análisis cerrable. Listado tabular compacto al pie · 6 columnas
// (activo + fecha + aportado + tiempo + plusvalía + TWR) · sin foco fiscal.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../../design-system/v5';
import {
  calcularKpisCerradas,
  formatDuracion,
  getPosicionesCerradas,
  type PosicionCerrada,
} from '../adapters/posicionesCerradas';
import {
  analisisHistogramaCopy,
  analisisRankingCopy,
  bestWorstPorPorcentaje,
  computeHistogramaBins,
  computeRankingPorTipo,
  type RankingTipoItem,
} from '../adapters/posicionesCerradasAnalisis';
import { clasificarTipo, type GrupoPosicion } from '../helpers';
import { useAvisoCerrable } from '../components/bloques/useAvisoCerrable';
import styles from './PosicionesCerradas.module.css';

type FiltroGrupo = 'todos' | GrupoPosicion;
type Orden = 'cierre_desc' | 'cierre_asc' | 'pct_desc' | 'pct_asc';

function fmtEur(n: number, opts: { decimals?: number; sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const v = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: opts.decimals ?? 0,
    minimumFractionDigits: opts.decimals ?? 0,
    style: 'currency',
    currency: 'EUR',
  }).format(n);
  if (opts.sign && n > 0) return `+${v}`;
  return v;
}

function fmtPct(n: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const v = `${n.toFixed(1)} %`;
  return opts.sign && n > 0 ? `+${v}` : v;
}

const ORDEN_LABEL: Record<Orden, string> = {
  cierre_desc: 'Cierre más reciente',
  cierre_asc: 'Cierre más antiguo',
  pct_desc: 'Mayor plusvalía %',
  pct_asc: 'Menor plusvalía %',
};

const PosicionesCerradasPage = () => {
  const navigate = useNavigate();
  const [cerradas, setCerradas] = useState<PosicionCerrada[] | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState<FiltroGrupo>('todos');
  const [orden, setOrden] = useState<Orden>('cierre_desc');

  const bannerHisto = useAvisoCerrable('cerradas-histo', {
    ubicacionContexto: '/inversiones/cerradas',
    etiqueta: 'Análisis histograma de cierres',
  });
  const bannerRanking = useAvisoCerrable('cerradas-ranking', {
    ubicacionContexto: '/inversiones/cerradas',
    etiqueta: 'Análisis ranking por tipo',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getPosicionesCerradas();
        if (!cancelled) setCerradas(list);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[inversiones] cerradas · cargar', err);
        if (!cancelled) {
          setCerradas([]);
          showToastV5('No se pudieron cargar las posiciones cerradas.', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => calcularKpisCerradas(cerradas ?? []), [cerradas]);
  const bestWorst = useMemo(
    () => bestWorstPorPorcentaje(cerradas ?? []),
    [cerradas],
  );
  const histograma = useMemo(
    () => computeHistogramaBins(cerradas ?? []),
    [cerradas],
  );
  const ranking = useMemo(
    () => computeRankingPorTipo(cerradas ?? []),
    [cerradas],
  );
  const maxHistoCount = Math.max(1, ...histograma.map((b) => b.count));

  const tiposPresentes = useMemo(() => {
    if (!cerradas) return [] as GrupoPosicion[];
    const set = new Set<GrupoPosicion>();
    for (const p of cerradas) set.add(clasificarTipo(p.tipo));
    return Array.from(set);
  }, [cerradas]);

  const filtradas = useMemo(() => {
    if (!cerradas) return [];
    const filtered = cerradas.filter(
      (p) => filtroGrupo === 'todos' || clasificarTipo(p.tipo) === filtroGrupo,
    );
    const sorted = [...filtered];
    switch (orden) {
      case 'cierre_asc':
        sorted.sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));
        break;
      case 'pct_desc':
        sorted.sort((a, b) => b.resultadoPercent - a.resultadoPercent);
        break;
      case 'pct_asc':
        sorted.sort((a, b) => a.resultadoPercent - b.resultadoPercent);
        break;
      case 'cierre_desc':
      default:
        sorted.sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre));
    }
    return sorted;
  }, [cerradas, filtroGrupo, orden]);

  if (cerradas === null) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando posiciones cerradas…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHead
        title="Posiciones cerradas"
        sub="activos que ya has vendido o liquidado · foco rentabilidad real"
        backLabel="Volver a Inversiones"
        onBack={() => navigate('/inversiones')}
      />

      {kpis.count === 0 ? (
        <div className={styles.empty}>
          Aún no tienes posiciones cerradas. Cuando vendas una posición o importes una
          declaración con transmisiones, aparecerán aquí.
        </div>
      ) : (
        <>
          {/* ─── C1 · Hero patrimonio cerrado · 4 KPIs (§6.1) ──────────── */}
          <section className={styles.heroCerrado} aria-label="Hero patrimonio cerrado">
            <Kpi
              lab="Capital invertido"
              val={fmtEur(kpis.totalInvertido)}
              sub={`en ${kpis.count} cierre${kpis.count === 1 ? '' : 's'}`}
            />
            <Kpi
              lab="Plusvalía neta"
              val={fmtEur(kpis.resultadoNeto, { sign: true })}
              tone={kpis.resultadoNeto >= 0 ? 'pos' : 'neg'}
            />
            <Kpi
              lab="CAGR medio ponderado"
              val={kpis.cagrMedio !== 0 ? fmtPct(kpis.cagrMedio, { sign: true }) : '—'}
              tone={kpis.cagrMedio >= 0 ? 'pos' : 'neg'}
              sub="ponderado por capital"
            />
            <Kpi
              lab="Tasa de acierto"
              val={`${kpis.tasaAcierto.toFixed(0)} %`}
              sub={`${Math.round((kpis.tasaAcierto / 100) * kpis.count)} de ${kpis.count} en ganancia`}
              tone={kpis.tasaAcierto >= 50 ? 'pos' : 'neg'}
            />
          </section>

          {/* ─── C3 · Best/worst (§6.2) ───────────────────────────────── */}
          {(bestWorst.mejor || bestWorst.peor) && (
            <section className={styles.bestWorst} aria-label="Mejor y peor cierre">
              {bestWorst.mejor && (
                <BestWorstCard kind="mejor" posicion={bestWorst.mejor} />
              )}
              {bestWorst.peor && (
                <BestWorstCard kind="peor" posicion={bestWorst.peor} />
              )}
            </section>
          )}

          {/* ─── C2 · Histograma (§6.3) ────────────────────────────────── */}
          <section className={styles.bloque} aria-label="Histograma de rentabilidades">
            <header className={styles.bloqueHd}>
              <div>
                <div className={styles.bloqueSupertitle}>Histograma</div>
                <div className={styles.bloqueTit}>Distribución de plusvalías</div>
                <div className={styles.bloqueSub}>
                  5 bins · cuántas posiciones en cada rango de % de rentabilidad
                </div>
              </div>
            </header>
            <div className={styles.histoChart}>
              {histograma.map((b) => {
                const heightPct = (b.count / maxHistoCount) * 100;
                return (
                  <div key={b.bin} className={styles.histoCol}>
                    <div
                      className={`${styles.histoBar} ${b.bin === '<0%' ? styles.histoBarNeg : ''}`}
                      style={{ height: `${heightPct}%` }}
                      title={`${b.count} posición${b.count === 1 ? '' : 'es'} en ${b.bin}`}
                    />
                    <div className={styles.histoCount}>{b.count}</div>
                    <div className={styles.histoBin}>{b.bin}</div>
                  </div>
                );
              })}
            </div>
            {bannerHisto.visible && (
              <div className={styles.banner} role="status">
                <div>{analisisHistogramaCopy(histograma)}</div>
                <button
                  type="button"
                  className={styles.bannerClose}
                  onClick={bannerHisto.cerrar}
                  aria-label="Cerrar análisis del histograma"
                >
                  <Icons.Close size={14} strokeWidth={2} />
                </button>
              </div>
            )}
          </section>

          {/* ─── C5 · Ranking por tipo (§6.4) ──────────────────────────── */}
          <section className={styles.bloque} aria-label="Ranking por tipo">
            <header className={styles.bloqueHd}>
              <div>
                <div className={styles.bloqueSupertitle}>Ranking</div>
                <div className={styles.bloqueTit}>Por tipo de activo</div>
                <div className={styles.bloqueSub}>
                  agrupado · CAGR ponderado descendente
                </div>
              </div>
            </header>
            <RankingTabla items={ranking} />
            {bannerRanking.visible && ranking.length > 0 && (
              <div className={styles.banner} role="status">
                <div>{analisisRankingCopy(ranking)}</div>
                <button
                  type="button"
                  className={styles.bannerClose}
                  onClick={bannerRanking.cerrar}
                  aria-label="Cerrar análisis del ranking"
                >
                  <Icons.Close size={14} strokeWidth={2} />
                </button>
              </div>
            )}
          </section>

          {/* ─── Detalle de operaciones · listado tabular ─────────────── */}
          <section className={styles.bloque} aria-label="Detalle de operaciones">
            <header className={styles.bloqueHd}>
              <div>
                <div className={styles.bloqueSupertitle}>Detalle</div>
                <div className={styles.bloqueTit}>Operaciones cerradas</div>
                <div className={styles.bloqueSub}>
                  sin foco fiscal · los detalles tributarios viven en{' '}
                  <button
                    type="button"
                    className={styles.linkInline}
                    onClick={() => navigate('/fiscal')}
                  >
                    /fiscal
                  </button>
                </div>
              </div>
            </header>

            <div className={styles.filtrosPill} role="group" aria-label="Filtros y orden">
              <PillBtn
                active={filtroGrupo === 'todos'}
                onClick={() => setFiltroGrupo('todos')}
              >
                Todas
              </PillBtn>
              {tiposPresentes.map((g) => (
                <PillBtn
                  key={g}
                  active={filtroGrupo === g}
                  onClick={() => setFiltroGrupo(g)}
                >
                  {GRUPO_LABEL[g]}
                </PillBtn>
              ))}
              <div className={styles.filtroSpacer} />
              <select
                className={styles.filtroSelect}
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                aria-label="Ordenar resultados"
              >
                {(Object.keys(ORDEN_LABEL) as Orden[]).map((o) => (
                  <option key={o} value={o}>{ORDEN_LABEL[o]}</option>
                ))}
              </select>
              <span className={styles.filtroResultados}>
                {filtradas.length} {filtradas.length === 1 ? 'op' : 'ops'}
              </span>
            </div>

            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Activo</th>
                    <th>Cierre</th>
                    <th style={{ textAlign: 'right' }}>Aportado</th>
                    <th>Tiempo</th>
                    <th style={{ textAlign: 'right' }}>Plusvalía</th>
                    <th style={{ textAlign: 'right' }}>CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => {
                    const positivo = p.resultado >= 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className={styles.celdaActivo}>
                            <span className={styles.tagTipo}>{GRUPO_LABEL_CORTO[clasificarTipo(p.tipo)]}</span>
                            <div className={styles.celdaActivoCol}>
                              <span className={styles.celdaActivoNombre}>{p.nombre}</span>
                              {p.entidad && p.entidad !== '—' && (
                                <span className={styles.celdaActivoMeta}>{p.entidad}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={styles.mono}>{p.fechaCierre.slice(0, 10)}</td>
                        <td className={`${styles.mono} ${styles.alignRight}`}>
                          {fmtEur(p.aportado)}
                        </td>
                        <td className={styles.mono}>{formatDuracion(p.duracionDias)}</td>
                        <td
                          className={`${styles.mono} ${styles.alignRight} ${positivo ? styles.pos : styles.neg}`}
                        >
                          {fmtEur(p.resultado, { sign: true })}
                        </td>
                        <td
                          className={`${styles.mono} ${styles.alignRight} ${(p.cagr ?? 0) >= 0 ? styles.pos : styles.neg}`}
                        >
                          {p.cagr != null ? fmtPct(p.cagr, { sign: true }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtradas.length === 0 && (
              <div className={styles.empty}>
                Ninguna operación cumple los filtros actuales.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

// ── Subcomponentes ──────────────────────────────────────────────────────────

const GRUPO_LABEL: Record<GrupoPosicion, string> = {
  valoracion_simple: 'Fondos / planes / crypto',
  dividendos: 'Acciones / ETFs / REITs',
  rendimiento_periodico: 'Préstamos / depósitos',
  otro: 'Otros',
};

const GRUPO_LABEL_CORTO: Record<GrupoPosicion, string> = {
  valoracion_simple: 'fondo',
  dividendos: 'equity',
  rendimiento_periodico: 'renta fija',
  otro: 'otro',
};

function Kpi({
  lab,
  val,
  sub,
  tone = 'ink',
}: {
  lab: string;
  val: string;
  sub?: string;
  tone?: 'ink' | 'pos' | 'neg';
}) {
  const colorVar =
    tone === 'pos'
      ? 'var(--atlas-v5-pos)'
      : tone === 'neg'
        ? 'var(--atlas-v5-neg)'
        : 'var(--atlas-v5-ink)';
  return (
    <div className={styles.heroKpi}>
      <div className={styles.heroKpiLab}>{lab}</div>
      <div className={styles.heroKpiVal} style={{ color: colorVar }}>{val}</div>
      {sub && <div className={styles.heroKpiSub}>{sub}</div>}
    </div>
  );
}

function BestWorstCard({
  kind,
  posicion,
}: {
  kind: 'mejor' | 'peor';
  posicion: PosicionCerrada;
}) {
  const positivo = posicion.resultado >= 0;
  return (
    <div
      className={`${styles.bestWorstCard} ${kind === 'mejor' ? styles.bestWorstMejor : styles.bestWorstPeor}`}
    >
      <div className={styles.bestWorstLab}>
        {kind === 'mejor' ? 'Mejor cierre' : 'Peor cierre'}
      </div>
      <div className={styles.bestWorstNombre}>{posicion.nombre}</div>
      <div className={styles.bestWorstStats}>
        <div className={styles.bestWorstPct} style={{ color: positivo ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)' }}>
          {fmtPct(posicion.resultadoPercent, { sign: true })}
        </div>
        <div className={styles.bestWorstEur}>{fmtEur(posicion.resultado, { sign: true })}</div>
      </div>
      <div className={styles.bestWorstMeta}>
        cerrado {posicion.fechaCierre.slice(0, 10)} · {formatDuracion(posicion.duracionDias)}
      </div>
    </div>
  );
}

function RankingTabla({ items }: { items: ReadonlyArray<RankingTipoItem> }) {
  if (items.length === 0) {
    return <div className={styles.empty}>Sin tipos cerrados para rankear.</div>;
  }
  return (
    <div className={styles.tablaWrap}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th style={{ textAlign: 'right' }}>Nº ops</th>
            <th style={{ textAlign: 'right' }}>Capital</th>
            <th style={{ textAlign: 'right' }}>Plusvalía</th>
            <th style={{ textAlign: 'right' }}>CAGR medio</th>
            <th style={{ textAlign: 'right' }}>Tiempo medio</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const positivo = it.plusvalia >= 0;
            // "líder" solo si el primer item tiene CAGR calculable
            // (el sort coloca los null al final · si idx 0 es null nadie es líder).
            const esLider = idx === 0 && it.cagrMedio != null;
            const cagrPositivo = (it.cagrMedio ?? 0) >= 0;
            return (
              <tr key={it.tipo}>
                <td>
                  <span className={styles.tagTipo}>{it.tipo}</span>
                  {esLider && <span className={styles.rankingLead}>líder</span>}
                </td>
                <td className={`${styles.mono} ${styles.alignRight}`}>{it.numOps}</td>
                <td className={`${styles.mono} ${styles.alignRight}`}>
                  {fmtEur(it.capital)}
                </td>
                <td className={`${styles.mono} ${styles.alignRight} ${positivo ? styles.pos : styles.neg}`}>
                  {fmtEur(it.plusvalia, { sign: true })}
                </td>
                <td className={`${styles.mono} ${styles.alignRight} ${it.cagrMedio != null && cagrPositivo ? styles.pos : it.cagrMedio != null ? styles.neg : ''}`}>
                  {it.cagrMedio != null ? fmtPct(it.cagrMedio, { sign: true }) : '—'}
                </td>
                <td className={`${styles.mono} ${styles.alignRight}`}>
                  {it.tiempoMedioDias != null ? formatDuracion(it.tiempoMedioDias) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PillBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.pill} ${active ? styles.pillActive : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default PosicionesCerradasPage;
