import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  PageHead,
  MoneyValue,
  EmptyState,
  Icons,
} from '../../../design-system/v5';
import type { Contract, Property } from '../../../services/db';
import {
  TIPO_ACTIVO_LABELS,
  TIPO_ACTIVO_VALUES,
  TipoActivo,
  getTipoActivoEffective,
} from '../../../types/tipoActivo';
import InmuebleCard, {
  InmuebleState,
  InmuebleType,
} from '../components/InmuebleCard';
import PortfolioMap from '../components/PortfolioMap';
import type { InmueblesOutletContext } from '../InmueblesContext';
import styles from './ListadoPage.module.css';
import { valoracionesService } from '../../../services/valoracionesService';
import { gastosInmuebleService } from '../../../services/gastosInmuebleService';
import { prestamosService, getAllocationFactor } from '../../../services/prestamosService';
import { computeRentabilidadNeta } from '../utils/computeRentabilidadNeta';

type EstadoFilter = 'todos' | 'habitaciones' | 'completos' | 'reforma' | 'alertas';
type TipoFilter = 'todos' | TipoActivo;

interface DerivedInmueble {
  property: Property;
  astId: string;
  tipoActivo: TipoActivo;
  type: InmuebleType;
  state: InmuebleState;
  stateLabel: string;
  rentaMensual: number;
  contratosActivos: Contract[];
  habitaciones: number;
  ocupadas: number;
  hasAlert: boolean;
}

/** Formatea "YYYY-MM" → "abr 2026" en locale es-ES */
const formatFechaMes = (fechaMes: string): string => {
  const parts = fechaMes.split('-');
  if (parts.length < 2) return fechaMes;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return fechaMes;
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(d);
};

/** Formatea "YYYY-MM-DD" o "YYYY-MM" → "abr 2026" en locale es-ES */
const formatFechaCompra = (fecha: string | undefined): string | undefined => {
  if (!fecha) return undefined;
  const parts = fecha.slice(0, 7).split('-');
  if (parts.length < 2) return undefined;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return undefined;
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(d);
};

const isContractActiveAtDate = (c: Contract, today: Date): boolean => {
  if (!c.fechaInicio || !c.fechaFin) return false;
  const ini = new Date(c.fechaInicio);
  const fin = new Date(c.fechaFin);
  return !Number.isNaN(ini.getTime()) && !Number.isNaN(fin.getTime()) && ini <= today && today <= fin;
};

const deriveInmueble = (
  property: Property,
  contracts: Contract[],
  today: Date,
  index: number,
): DerivedInmueble => {
  const tipoActivo = getTipoActivoEffective(property);
  const propContracts = contracts.filter((c) => c.inmuebleId === property.id);
  const activos = propContracts.filter((c) => isContractActiveAtDate(c, today));
  const habitaciones = property.bedrooms || 1;
  const ocupadas = activos.length;
  const rentaMensual = activos.reduce((sum, c) => sum + (c.rentaMensual ?? 0), 0);

  // Tipos no-piso · siempre 'completo' (ningún concepto de habitaciones).
  let type: InmuebleType =
    tipoActivo === 'piso' ? (habitaciones > 1 ? 'habitaciones' : 'completo') : 'completo';

  // Para tipos no-piso, ocupación es binaria · 1 unidad.
  const unidadesParaEstado = tipoActivo === 'piso' ? habitaciones : 1;
  const ocupadasParaEstado = Math.min(ocupadas, unidadesParaEstado);

  let state: InmuebleState = 'vacant';
  let stateLabel = 'Vacante';
  let hasAlert = false;
  if (ocupadasParaEstado === 0) {
    state = 'vacant';
    stateLabel = 'Vacante';
  } else if (ocupadasParaEstado < unidadesParaEstado) {
    state = 'attention';
    stateLabel = 'Atención';
    hasAlert = true;
  } else {
    state = 'occupied';
    stateLabel = 'Ocupado';
  }

  const astId = `AST-${String(index + 1).padStart(2, '0')}`;

  return {
    property,
    astId,
    tipoActivo,
    type,
    state,
    stateLabel,
    rentaMensual,
    contratosActivos: activos,
    habitaciones,
    ocupadas,
    hasAlert,
  };
};

const ListadoPage: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EstadoFilter>('todos');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [opexAnualPorInmueble, setOpexAnualPorInmueble] = useState<Map<number, number>>(new Map());
  const [cuotaAnualPorInmueble, setCuotaAnualPorInmueble] = useState<Map<number, number>>(new Map());

  /** Matcher con fallback por nombre — T25.1 · cargado una sola vez */
  const [valoracionMatcher, setValoracionMatcher] = useState<import('../../../services/valoracionesService').ValoracionMatcher | null>(null);

  const today = useMemo(() => new Date(), []);

  // Carga de valoraciones: una sola query al store, resultado en matcher
  useEffect(() => {
    let mounted = true;
    valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre('inmueble')
      .then((m) => { if (mounted) setValoracionMatcher(m); })
      .catch(() => { /* sin valoraciones disponibles */ });
    return () => { mounted = false; };
  }, []);

  // T29 · Carga inputs para KPI Rentabilidad neta · OPEX año actual + cuota anual préstamos vivos.
  useEffect(() => {
    let mounted = true;
    const ejercicio = today.getFullYear();
    const propIds = properties
      .map((p) => p.id)
      .filter((id): id is number => typeof id === 'number');

    const loadOpex = async () => {
      const map = new Map<number, number>();
      const all = await Promise.all(
        propIds.map(async (id) => {
          try {
            const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(id, ejercicio);
            const total = gastos.reduce((sum, g) => sum + (g.importe ?? 0), 0);
            return [id, total] as const;
          } catch {
            return [id, 0] as const;
          }
        }),
      );
      for (const [id, total] of all) map.set(id, total);
      return map;
    };

    const loadCuotas = async () => {
      const map = new Map<number, number>();
      const all = await Promise.all(
        propIds.map(async (id) => {
          try {
            const inmuebleIdStr = String(id);
            const prestamos = await prestamosService.getPrestamosByProperty(inmuebleIdStr);
            // Canónico repo (loanInterestService / prestamosService.savePrestamo) ·
            // vivo = activo !== false && estado !== 'cancelado'.
            const vivos = prestamos.filter(
              (p) => p.activo !== false && p.estado !== 'cancelado',
            );
            const cuotaMensual = vivos.reduce((sum, p) => {
              // En amortización francesa la cuota es constante: usar principal
              // inicial + plazo total da la cuota correcta · usar principalVivo
              // con plazoMesesTotal infraestima la cuota tras amortización parcial.
              const principal = p.principalInicial ?? 0;
              if (principal <= 0 || !p.plazoMesesTotal) return sum;
              // tipoNominalAnualFijo viene en % (3.2 = 3.2%) · valorIndiceActual y
              // diferencial vienen en decimal (0.025 = 2.5%) · normalizar a fracción
              // mensual.
              let tasaAnualFraccion: number;
              if (p.tipo === 'FIJO' && p.tipoNominalAnualFijo != null) {
                tasaAnualFraccion = p.tipoNominalAnualFijo / 100;
              } else if (p.tipo === 'MIXTO' && p.tipoNominalAnualMixtoFijo != null) {
                tasaAnualFraccion = p.tipoNominalAnualMixtoFijo / 100;
              } else {
                tasaAnualFraccion = (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0);
              }
              const r = tasaAnualFraccion / 12;
              const n = p.plazoMesesTotal;
              const cuota =
                r > 0
                  ? (principal * r) / (1 - Math.pow(1 + r, -n))
                  : principal / n;
              if (!Number.isFinite(cuota) || cuota <= 0) return sum;
              // Préstamos repartidos entre varios inmuebles · imputar solo la
              // fracción correspondiente a este inmueble.
              const factor = getAllocationFactor(p, inmuebleIdStr);
              return sum + cuota * factor;
            }, 0);
            return [id, cuotaMensual * 12] as const;
          } catch {
            return [id, 0] as const;
          }
        }),
      );
      for (const [id, total] of all) map.set(id, total);
      return map;
    };

    Promise.all([loadOpex(), loadCuotas()])
      .then(([opex, cuota]) => {
        if (!mounted) return;
        setOpexAnualPorInmueble(opex);
        setCuotaAnualPorInmueble(cuota);
      })
      .catch(() => { /* sin datos · KPI mostrará — */ });

    return () => { mounted = false; };
  }, [properties, today]);

  const derived = useMemo(
    () => properties.map((p, i) => deriveInmueble(p, contracts, today, i)),
    [properties, contracts, today],
  );

  const filtered = useMemo(() => {
    return derived.filter((d) => {
      if (tipoFilter !== 'todos' && d.tipoActivo !== tipoFilter) return false;
      if (filter === 'habitaciones' && d.type !== 'habitaciones') return false;
      if (filter === 'completos' && d.type !== 'completo') return false;
      if (filter === 'alertas' && !d.hasAlert) return false;
      // 'reforma' · sin store de reforma todavía · siempre 0 hasta T20.3a follow-up
      if (filter === 'reforma') return false;

      if (!search) return true;
      const s = search.toLowerCase();
      return (
        d.property.alias.toLowerCase().includes(s) ||
        d.property.address.toLowerCase().includes(s) ||
        d.astId.toLowerCase().includes(s) ||
        d.contratosActivos.some(
          (c) =>
            c.inquilino.nombre.toLowerCase().includes(s) ||
            c.inquilino.apellidos.toLowerCase().includes(s),
        )
      );
    });
  }, [derived, filter, tipoFilter, search]);

  // T29 · Counts por tipología · solo aparece el filtro si hay ≥1 no-piso.
  const tipoCounts = useMemo(() => {
    const map = new Map<TipoActivo, number>();
    for (const d of derived) {
      map.set(d.tipoActivo, (map.get(d.tipoActivo) ?? 0) + 1);
    }
    return map;
  }, [derived]);
  const hasNonPisoActivos = useMemo(
    () => derived.some((d) => d.tipoActivo !== 'piso'),
    [derived],
  );

  // KPIs agregados
  // totalValor usa suma de valoraciones reales (0 para los sin valorar) · T24.2 · matching id+nombre T25.1
  const { totalValor, countSinValorar } = useMemo(() => {
    let sum = 0;
    let sinValorar = 0;
    for (const p of properties) {
      const propNombre = p.alias || p.address || '';
      const val = valoracionMatcher?.getByIdOrNombre(p.id ?? '', propNombre);
      if (val) {
        sum += val.valor;
      } else {
        sinValorar++;
      }
    }
    return { totalValor: sum, countSinValorar: sinValorar };
  }, [properties, valoracionMatcher]);
  const rentaMensualTotal = derived.reduce((sum, d) => sum + d.rentaMensual, 0);
  const totalUnidades = derived.reduce((sum, d) => sum + d.habitaciones, 0);
  const totalOcupadas = derived.reduce((sum, d) => sum + d.ocupadas, 0);
  const ocupacionPct =
    totalUnidades > 0 ? Math.round((totalOcupadas / totalUnidades) * 100) : 0;

  // T29 · KPI Rentabilidad neta · cableado real (renta − OPEX − cuota préstamo) / valor inversión.
  const rentaMensualPorInmueble = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of derived) {
      if (d.property.id != null) map.set(d.property.id, d.rentaMensual);
    }
    return map;
  }, [derived]);
  const rentabilidad = useMemo(
    () => computeRentabilidadNeta({
      properties,
      rentaMensualPorInmueble,
      opexAnualPorInmueble,
      cuotaAnualPrestamoPorInmueble: cuotaAnualPorInmueble,
    }),
    [properties, rentaMensualPorInmueble, opexAnualPorInmueble, cuotaAnualPorInmueble],
  );

  // Counts por filtro
  const countAll = derived.length;
  const countHab = derived.filter((d) => d.type === 'habitaciones').length;
  const countCompletos = derived.filter((d) => d.type === 'completo').length;
  const countAlertas = derived.filter((d) => d.hasAlert).length;

  return (
    <>
      <PageHead
        title="Inmuebles"
        sub={
          <>
            <strong>{properties.length}</strong> activos <span> · </span>
            <strong>{countHab}</strong> por habitaciones · <strong>{countCompletos}</strong> completos
            <span> · </span>
            valoración total{' '}
            <strong>
              <MoneyValue value={totalValor} decimals={0} tone="ink" />
            </strong>
            {countSinValorar > 0 && (
              <span> · <strong>{countSinValorar}</strong> sin valorar</span>
            )}
          </>
        }
        actions={[
          {
            label: 'Importar inmuebles',
            variant: 'ghost',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/inmuebles/importar'),
          },
          {
            label: 'Importar valoraciones',
            variant: 'ghost',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/inmuebles/importar-valoraciones'),
          },
          {
            label: 'Nuevo inmueble',
            variant: 'gold',
            icon: <Icons.Plus size={14} strokeWidth={2} />,
            onClick: () => navigate('/inmuebles/nuevo'),
          },
        ]}
      />

      <div className={styles.kpiStrip}>
        <div className={`${styles.kpi} ${styles.emph}`}>
          <div className={styles.kpiLab}>Valor cartera</div>
          <div className={styles.kpiVal}>
            <MoneyValue value={totalValor} decimals={0} tone="ink" />
          </div>
          <div className={styles.kpiHint}>
            {properties.length} inmuebles{countSinValorar > 0 ? ` · ${countSinValorar} sin valorar` : ''}
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Renta mensual</div>
          <div className={styles.kpiVal}>
            <MoneyValue value={rentaMensualTotal} decimals={0} tone="ink" />
          </div>
          <div className={styles.kpiHint}>
            <MoneyValue value={rentaMensualTotal * 12} decimals={0} tone="muted" /> anual bruto
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Ocupación media</div>
          <div className={styles.kpiVal}>
            {ocupacionPct}
            <span className={styles.kpiUnit}>%</span>
          </div>
          <div className={styles.kpiHint}>
            {totalOcupadas} / {totalUnidades} unidades
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Rentabilidad neta</div>
          {rentabilidad.rentabilidadNetaPct !== undefined ? (
            <>
              <div
                className={`${styles.kpiVal} ${
                  rentabilidad.rentabilidadNetaPct > 0
                    ? styles.pos
                    : rentabilidad.rentabilidadNetaPct < 0
                      ? styles.neg
                      : ''
                }`}
              >
                {rentabilidad.rentabilidadNetaPct.toLocaleString('es-ES', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
                <span className={styles.kpiUnit}>%</span>
              </div>
              <div className={styles.kpiHint}>
                cashflow{' '}
                <MoneyValue
                  value={rentabilidad.cashflowAnualNeto}
                  decimals={0}
                  tone={rentabilidad.cashflowAnualNeto >= 0 ? 'pos' : 'neg'}
                />{' '}
                / año
              </div>
            </>
          ) : (
            <>
              <div className={styles.kpiVal}>—</div>
              <div className={styles.kpiHint}>datos insuficientes</div>
            </>
          )}
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Cashflow anual</div>
          <div
            className={`${styles.kpiVal} ${
              rentabilidad.cashflowAnualNeto >= 0 ? styles.pos : styles.neg
            }`}
          >
            <MoneyValue
              value={rentabilidad.cashflowAnualNeto}
              decimals={0}
              showSign
              tone={rentabilidad.cashflowAnualNeto >= 0 ? 'pos' : 'neg'}
            />
          </div>
          <div className={styles.kpiHint}>
            <MoneyValue value={rentabilidad.rentaAnualBruta} decimals={0} /> bruto
            {' · '}
            <MoneyValue value={rentabilidad.opexAnual + rentabilidad.cuotaAnualPrestamo} decimals={0} /> gastos
          </div>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterSearch}>
          <Icons.Search size={13} strokeWidth={1.8} />
          <input
            type="search"
            placeholder="Buscar por nombre, AST, inquilino, dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar inmuebles"
          />
        </div>
        <span className={styles.filterDivider} />
        <button
          type="button"
          className={`${styles.filterChip} ${filter === 'todos' ? styles.active : ''}`}
          onClick={() => setFilter('todos')}
        >
          Todos · {countAll}
        </button>
        <button
          type="button"
          className={`${styles.filterChip} ${filter === 'habitaciones' ? styles.active : ''}`}
          onClick={() => setFilter('habitaciones')}
        >
          Por habitaciones · {countHab}
        </button>
        <button
          type="button"
          className={`${styles.filterChip} ${filter === 'completos' ? styles.active : ''}`}
          onClick={() => setFilter('completos')}
        >
          Completos · {countCompletos}
        </button>
        <button
          type="button"
          className={`${styles.filterChip} ${filter === 'alertas' ? styles.active : ''}`}
          onClick={() => setFilter('alertas')}
        >
          Con alertas · {countAlertas}
        </button>

        {hasNonPisoActivos && (
          <>
            <span className={styles.filterDivider} />
            <button
              type="button"
              className={`${styles.filterChip} ${tipoFilter === 'todos' ? styles.active : ''}`}
              onClick={() => setTipoFilter('todos')}
            >
              Todos los tipos
            </button>
            {TIPO_ACTIVO_VALUES.filter((t) => (tipoCounts.get(t) ?? 0) > 0).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.filterChip} ${tipoFilter === t ? styles.active : ''}`}
                onClick={() => setTipoFilter(t)}
              >
                {TIPO_ACTIVO_LABELS[t]} · {tipoCounts.get(t) ?? 0}
              </button>
            ))}
          </>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.grid}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Icons.Inmuebles size={20} />}
              title={
                derived.length === 0
                  ? 'Sin inmuebles registrados'
                  : 'Sin resultados con los filtros aplicados'
              }
              sub={
                derived.length === 0
                  ? 'Añade tu primer inmueble para empezar a ver tu cartera.'
                  : 'Limpia los filtros o cambia la búsqueda.'
              }
              ctaLabel={derived.length === 0 ? '+ añadir inmueble' : undefined}
              onCtaClick={() => navigate('/inmuebles/nuevo')}
            />
          ) : (
            filtered.map((d) => {
                const compradoPor = d.property.acquisitionCosts?.price ?? 0;
                const valHoy = valoracionMatcher?.getByIdOrNombre(
                  d.property.id ?? '',
                  d.property.alias || d.property.address || '',
                );
                const hayValoracion = valHoy !== undefined;
                const valorTone = hayValoracion
                  ? valHoy.valor > compradoPor
                    ? 'pos' as const
                    : valHoy.valor < compradoPor
                      ? 'neg' as const
                      : undefined
                  : undefined;
                const fechaCompraFmt = formatFechaCompra(d.property.purchaseDate);
                const fechaValFmt = hayValoracion ? formatFechaMes(valHoy.fecha_valoracion) : undefined;

                const tipoLabel =
                  d.tipoActivo === 'piso'
                    ? d.type === 'habitaciones' ? 'Habitaciones' : 'Piso completo'
                    : TIPO_ACTIVO_LABELS[d.tipoActivo];
                const showHabChip = d.tipoActivo === 'piso';
                return (
                  <InmuebleCard
                    key={d.property.id}
                    astId={d.astId}
                    state={d.state}
                    stateLabel={d.stateLabel}
                    name={d.property.alias}
                    photoUrl={d.property.foto}
                    location={`${d.property.municipality}${
                      d.property.province ? ' · ' + d.property.province : ''
                    }`}
                    chips={[
                      { label: tipoLabel, isType: true },
                      ...(showHabChip ? [{ label: `${d.habitaciones} hab` }] : []),
                      ...(d.property.squareMeters
                        ? [{ label: `${d.property.squareMeters} m²` }]
                        : []),
                    ]}
                    metrics={[
                      {
                        label: 'Comprado por',
                        value: <MoneyValue value={compradoPor} decimals={0} />,
                        sub: fechaCompraFmt,
                      },
                      {
                        label: 'Vale hoy',
                        value: hayValoracion
                          ? <MoneyValue value={valHoy.valor} decimals={0} />
                          : <span>—</span>,
                        sub: hayValoracion ? fechaValFmt : 'sin valoración',
                        tone: valorTone,
                      },
                      {
                        label: 'Renta mes',
                        value: <MoneyValue value={d.rentaMensual} decimals={0} />,
                      },
                    ]}
                    type={d.type}
                    rooms={
                      d.type === 'habitaciones'
                        ? {
                            occupied: d.ocupadas,
                            total: d.habitaciones,
                            contextLabel:
                              d.ocupadas < d.habitaciones
                                ? `${d.habitaciones - d.ocupadas} hab libre(s)`
                                : 'Todo al día',
                            contextTone:
                              d.ocupadas < d.habitaciones ? 'gold' : 'pos',
                            items: Array.from({ length: d.habitaciones }, (_, i) => ({
                              label: i + 1,
                              color: (i < d.ocupadas
                                ? (['green', 'red', 'yellow', 'blue', 'bw'] as const)[i % 5]
                                : 'vacant') as
                                | 'green'
                                | 'red'
                                | 'yellow'
                                | 'blue'
                                | 'bw'
                                | 'vacant',
                            })),
                          }
                        : undefined
                    }
                tenant={
                  d.type === 'completo' && d.contratosActivos.length > 0
                    ? {
                        initials: `${d.contratosActivos[0].inquilino.nombre[0] ?? ''}${
                          d.contratosActivos[0].inquilino.apellidos[0] ?? ''
                        }`.toUpperCase(),
                        name: `${d.contratosActivos[0].inquilino.nombre} ${d.contratosActivos[0].inquilino.apellidos}`,
                        dateLabel: d.contratosActivos[0].fechaFin
                          ? new Intl.DateTimeFormat('es-ES', {
                              month: 'short',
                              year: 'numeric',
                            }).format(new Date(d.contratosActivos[0].fechaFin))
                          : '—',
                      }
                    : undefined
                }
                onClick={() => navigate(`/inmuebles/${d.property.id}`)}
              />
                );
              })
          )}
        </div>

        <aside className={styles.aside}>
          <PortfolioMap
            title="Mapa cartera"
            sub={`${properties.length} ubicaciones`}
            legend={[
              { label: 'Ocupado', color: 'var(--atlas-v5-brand)', count: derived.filter((d) => d.state === 'occupied').length },
              { label: 'Atención', color: 'var(--atlas-v5-gold)', count: derived.filter((d) => d.state === 'attention').length },
              { label: 'Impago', color: 'var(--atlas-v5-neg)', count: derived.filter((d) => d.state === 'overdue').length },
              { label: 'Vacante', color: 'var(--atlas-v5-ink-4)', count: derived.filter((d) => d.state === 'vacant').length },
            ]}
          />
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>Resumen cartera</div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Total inmuebles</span>
              <span className={styles.summaryVal}>{properties.length}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Unidades arrendables</span>
              <span className={styles.summaryVal}>{totalUnidades}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Unidades ocupadas</span>
              <span className={styles.summaryVal}>{totalOcupadas}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Renta mensual</span>
              <span className={`${styles.summaryVal} ${styles.pos}`}>
                <MoneyValue value={rentaMensualTotal} decimals={0} tone="pos" />
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Renta anual bruta</span>
              <span className={`${styles.summaryVal} ${styles.pos}`}>
                <MoneyValue value={rentaMensualTotal * 12} decimals={0} tone="pos" />
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLab}>Valoración total</span>
              <span className={styles.summaryVal}>
                <MoneyValue value={totalValor} decimals={0} />
              </span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};

export default ListadoPage;
