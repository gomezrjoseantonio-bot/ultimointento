// T23.4 · Vista expandida `/inversiones/cerradas` · § 5 spec.
//
// Narrativa estricta de inversor · NO fiscal. KPIs principales (4) +
// sub-stats (3) + filtros (todos perspectiva inversor · NINGUNO fiscal)
// + listado con `<CartaCerrada>`. Botón "Ver detalles fiscales" en cada
// carta es el ÚNICO puente al módulo Fiscal · § 5.5.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../../design-system/v5';
import {
  calcularKpisCerradas,
  formatDuracion,
  getPosicionesCerradas,
  type KpisCerradas,
  type PosicionCerrada,
} from '../adapters/posicionesCerradas';
import {
  clasificarTipo,
  formatCurrency,
  formatDelta,
  formatPercent,
  signClass,
  type GrupoPosicion,
} from '../helpers';
import CartaCerrada from '../components/CartaCerrada';
import shellStyles from './FichaPosicion.module.css';
import styles from './PosicionesCerradas.module.css';

type FiltroResultado = 'todas' | 'ganancias' | 'perdidas';
type FiltroGrupo = 'todos' | GrupoPosicion;
type Orden =
  | 'recientes'
  | 'mayor_ganancia'
  | 'mayor_perdida'
  | 'mayor_duracion'
  | 'cagr_desc';

const PosicionesCerradasPage: React.FC = () => {
  const navigate = useNavigate();
  const [cerradas, setCerradas] = useState<PosicionCerrada[] | null>(null);

  const [filtroGrupo, setFiltroGrupo] = useState<FiltroGrupo>('todos');
  const [filtroResultado, setFiltroResultado] = useState<FiltroResultado>('todas');
  const [filtroEntidad, setFiltroEntidad] = useState<string>('todas');
  const [orden, setOrden] = useState<Orden>('recientes');

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
          showToastV5('No se pudieron cargar las posiciones cerradas.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entidades = useMemo(() => {
    if (!cerradas) return [];
    const set = new Set<string>();
    for (const p of cerradas) {
      if (p.entidad && p.entidad !== '—') set.add(p.entidad);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [cerradas]);

  const filtradas = useMemo(() => {
    if (!cerradas) return [];
    const filtered = cerradas.filter((p) => {
      if (filtroGrupo !== 'todos' && clasificarTipo(p.tipo) !== filtroGrupo) return false;
      if (filtroResultado === 'ganancias' && p.resultado <= 0) return false;
      if (filtroResultado === 'perdidas' && p.resultado >= 0) return false;
      if (filtroEntidad !== 'todas' && p.entidad !== filtroEntidad) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (orden) {
      case 'mayor_ganancia':
        sorted.sort((a, b) => b.resultado - a.resultado);
        break;
      case 'mayor_perdida':
        sorted.sort((a, b) => a.resultado - b.resultado);
        break;
      case 'mayor_duracion':
        sorted.sort(
          (a, b) =>
            (b.duracionDias ?? -1) - (a.duracionDias ?? -1),
        );
        break;
      case 'cagr_desc':
        sorted.sort((a, b) => (b.cagr ?? -Infinity) - (a.cagr ?? -Infinity));
        break;
      case 'recientes':
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime(),
        );
    }
    return sorted;
  }, [cerradas, filtroGrupo, filtroResultado, filtroEntidad, orden]);

  const kpis: KpisCerradas = useMemo(
    () => calcularKpisCerradas(cerradas || []),
    [cerradas],
  );

  if (cerradas === null) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando posiciones cerradas…</div>
      </div>
    );
  }

  const subtitulo =
    kpis.count === 0
      ? 'tu trayectoria como inversor'
      : `tu trayectoria como inversor · ${kpis.count} ${kpis.count === 1 ? 'posición cerrada' : 'posiciones cerradas'}${kpis.rangoAnios ? ` en ${kpis.rangoAnios}` : ''}`;

  return (
    <div className={styles.page}>
      <PageHead
        title="Posiciones cerradas"
        sub={subtitulo}
        backLabel="Volver a Inversiones"
        onBack={() => navigate('/inversiones')}
      />

      {kpis.count === 0 ? (
        <div className={styles.empty}>
          Aún no tienes posiciones cerradas. Cuando vendas una posición o
          importes una declaración con transmisiones, aparecerán aquí.
        </div>
      ) : (
        <>
          {/* ── KPIs principales · 4 cards (§ 5.3) ────────────────────── */}
          <div className={shellStyles.detailKpis}>
            <div className={shellStyles.detailKpi}>
              <div className={shellStyles.detailKpiLab}>Total invertido</div>
              <div className={shellStyles.detailKpiVal}>
                {formatCurrency(kpis.totalInvertido)}
              </div>
              <div className={shellStyles.detailKpiSub}>
                en {kpis.count} {kpis.count === 1 ? 'cierre' : 'cierres'}
              </div>
            </div>
            <div className={shellStyles.detailKpi}>
              <div className={shellStyles.detailKpiLab}>Resultado neto</div>
              <div
                className={`${shellStyles.detailKpiVal} ${shellStyles[signClass(kpis.resultadoNeto)]}`}
              >
                {formatDelta(kpis.resultadoNeto)}
              </div>
              <div className={shellStyles.detailKpiSub}>
                tasa de acierto {kpis.tasaAcierto.toFixed(0)}%
              </div>
            </div>
            <div className={shellStyles.detailKpi}>
              <div className={shellStyles.detailKpiLab}>Mejor cierre</div>
              <div
                className={`${shellStyles.detailKpiVal} ${kpis.mejor && kpis.mejor.resultado > 0 ? shellStyles.pos : shellStyles.muted}`}
              >
                {kpis.mejor ? formatDelta(kpis.mejor.resultado) : '—'}
              </div>
              <div className={shellStyles.detailKpiSub}>
                {kpis.mejor
                  ? `${kpis.mejor.nombre} · ${formatDuracion(kpis.mejor.duracionDias)}${kpis.mejor.cagr != null ? ` · CAGR ${formatPercent(kpis.mejor.cagr)}` : ''}`
                  : '—'}
              </div>
            </div>
            <div className={shellStyles.detailKpi}>
              <div className={shellStyles.detailKpiLab}>Peor cierre</div>
              <div
                className={`${shellStyles.detailKpiVal} ${kpis.peor && kpis.peor.resultado < 0 ? shellStyles.neg : shellStyles.muted}`}
              >
                {kpis.peor ? formatDelta(kpis.peor.resultado) : '—'}
              </div>
              <div className={shellStyles.detailKpiSub}>
                {kpis.peor
                  ? `${kpis.peor.nombre} · ${formatDuracion(kpis.peor.duracionDias)}`
                  : '—'}
              </div>
            </div>
          </div>

          {/* ── Sub-stats · franja secundaria (§ 5.3) ──────────────────── */}
          <div className={styles.subStats}>
            <div className={styles.subStat}>
              <div className={styles.subStatLab}>Tasa de acierto</div>
              <div className={styles.subStatVal}>
                {kpis.tasaAcierto.toFixed(0)}%
              </div>
              <div className={styles.subStatSub}>
                {Math.round((kpis.tasaAcierto / 100) * kpis.count)} de {kpis.count} con ganancia
              </div>
            </div>
            <div className={styles.subStat}>
              <div className={styles.subStatLab}>Rentabilidad media</div>
              <div className={styles.subStatVal}>
                {kpis.cagrMedio !== 0 ? `CAGR ${formatPercent(kpis.cagrMedio)}` : '—'}
              </div>
              <div className={styles.subStatSub}>ponderada por capital</div>
            </div>
            <div className={styles.subStat}>
              <div className={styles.subStatLab}>Tiempo medio en cartera</div>
              <div className={styles.subStatVal}>
                {kpis.duracionMediaDias > 0
                  ? formatDuracion(kpis.duracionMediaDias)
                  : '—'}
              </div>
              <div className={styles.subStatSub}>desde apertura a cierre</div>
            </div>
          </div>

          {/* ── Filtros (§ 5.3 · narrativa inversor) ───────────────────── */}
          <div className={styles.filtros}>
            <span className={styles.filtroLab}>Tipo</span>
            <select
              className={styles.filtroSelect}
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value as FiltroGrupo)}
              aria-label="Filtrar por tipo de activo"
            >
              <option value="todos">Todos</option>
              <option value="valoracion_simple">Fondos / planes / crypto</option>
              <option value="dividendos">Acciones / ETFs / REITs</option>
              <option value="rendimiento_periodico">Préstamos / cuentas / depósitos</option>
              <option value="otro">Otros</option>
            </select>

            <span className={styles.filtroLab}>Resultado</span>
            <select
              className={styles.filtroSelect}
              value={filtroResultado}
              onChange={(e) => setFiltroResultado(e.target.value as FiltroResultado)}
              aria-label="Filtrar por resultado"
            >
              <option value="todas">Todas</option>
              <option value="ganancias">Solo ganancias</option>
              <option value="perdidas">Solo pérdidas</option>
            </select>

            {entidades.length > 0 && (
              <>
                <span className={styles.filtroLab}>Broker</span>
                <select
                  className={styles.filtroSelect}
                  value={filtroEntidad}
                  onChange={(e) => setFiltroEntidad(e.target.value)}
                  aria-label="Filtrar por broker o entidad"
                >
                  <option value="todas">Todos</option>
                  {entidades.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </>
            )}

            <span className={styles.filtroLab}>Orden</span>
            <select
              className={styles.filtroSelect}
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar"
            >
              <option value="recientes">Más reciente</option>
              <option value="mayor_ganancia">Mayor ganancia</option>
              <option value="mayor_perdida">Mayor pérdida</option>
              <option value="mayor_duracion">Mayor duración</option>
              <option value="cagr_desc">CAGR descendente</option>
            </select>

            <span className={styles.filtroResultados}>
              {filtradas.length} {filtradas.length === 1 ? 'posición' : 'posiciones'}
            </span>
          </div>

          {/* ── Listado ────────────────────────────────────────────────── */}
          {filtradas.length === 0 ? (
            <div className={styles.empty}>
              <Icons.Inbox size={28} strokeWidth={1.5} />
              <div style={{ marginTop: 8 }}>
                Ninguna posición cerrada cumple los filtros actuales.
              </div>
            </div>
          ) : (
            <div className={styles.listado}>
              {filtradas.map((p) => (
                <CartaCerrada key={p.id} posicion={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PosicionesCerradasPage;
