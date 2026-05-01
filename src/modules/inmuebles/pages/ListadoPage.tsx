import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  PageHead,
  MoneyValue,
  EmptyState,
  Icons,
} from '../../../design-system/v5';
import type { Contract, Property } from '../../../services/db';
import InmuebleCard, {
  InmuebleState,
  InmuebleType,
} from '../components/InmuebleCard';
import PortfolioMap from '../components/PortfolioMap';
import type { InmueblesOutletContext } from '../InmueblesContext';
import styles from './ListadoPage.module.css';
import { valoracionesService } from '../../../services/valoracionesService';

type EstadoFilter = 'todos' | 'habitaciones' | 'completos' | 'reforma' | 'alertas';

interface DerivedInmueble {
  property: Property;
  astId: string;
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
  const [year, month] = fechaMes.split('-');
  if (!year || !month) return fechaMes;
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(d);
};

/** Formatea "YYYY-MM-DD" o "YYYY-MM" → "abr 2026" en locale es-ES */
const formatFechaCompra = (fecha: string | undefined): string | undefined => {
  if (!fecha) return undefined;
  const parts = fecha.slice(0, 7).split('-');
  if (parts.length < 2) return undefined;
  const [year, month] = parts;
  const d = new Date(Number(year), Number(month) - 1, 1);
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
  const propContracts = contracts.filter((c) => c.inmuebleId === property.id);
  const activos = propContracts.filter((c) => isContractActiveAtDate(c, today));
  const habitaciones = property.bedrooms || 1;
  const ocupadas = activos.length;
  const rentaMensual = activos.reduce((sum, c) => sum + (c.rentaMensual ?? 0), 0);

  let type: InmuebleType = 'habitaciones';
  if (habitaciones <= 1) type = 'completo';

  let state: InmuebleState = 'vacant';
  let stateLabel = 'Vacante';
  let hasAlert = false;
  if (ocupadas === 0) {
    state = 'vacant';
    stateLabel = 'Vacante';
  } else if (ocupadas < habitaciones) {
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

  /** Map activo_id (String) → { valor, fecha_valoracion } — cargado una sola vez */
  const [valoracionesMap, setValoracionesMap] = useState<Map<string, { valor: number; fecha_valoracion: string }>>(new Map());

  const today = useMemo(() => new Date(), []);

  // Carga de valoraciones: una sola query al store, resultado en Map
  useEffect(() => {
    let mounted = true;
    valoracionesService.getMapValoracionesMasRecientes('inmueble')
      .then((m) => { if (mounted) setValoracionesMap(m); })
      .catch(() => { /* sin valoraciones disponibles */ });
    return () => { mounted = false; };
  }, []);

  const derived = useMemo(
    () => properties.map((p, i) => deriveInmueble(p, contracts, today, i)),
    [properties, contracts, today],
  );

  const filtered = useMemo(() => {
    return derived.filter((d) => {
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
  }, [derived, filter, search]);

  // KPIs agregados
  // totalValor usa suma de valoraciones reales (0 para los sin valorar) · T24.2
  const { totalValor, countSinValorar } = useMemo(() => {
    let sum = 0;
    let sinValorar = 0;
    for (const p of properties) {
      const val = valoracionesMap.get(String(p.id));
      if (val) {
        sum += val.valor;
      } else {
        sinValorar++;
      }
    }
    return { totalValor: sum, countSinValorar: sinValorar };
  }, [properties, valoracionesMap]);
  const rentaMensualTotal = derived.reduce((sum, d) => sum + d.rentaMensual, 0);
  const totalUnidades = derived.reduce((sum, d) => sum + d.habitaciones, 0);
  const totalOcupadas = derived.reduce((sum, d) => sum + d.ocupadas, 0);
  const ocupacionPct =
    totalUnidades > 0 ? Math.round((totalOcupadas / totalUnidades) * 100) : 0;

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
          <div className={`${styles.kpiVal} ${styles.pos}`}>
            {/* TODO 20.3a follow-up · cálculo real desde gastos del módulo Inmuebles */}
            —
          </div>
          <div className={styles.kpiHint}>pendiente cálculo gastos</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Cashflow anual</div>
          <div className={`${styles.kpiVal} ${styles.pos}`}>
            <MoneyValue value={rentaMensualTotal * 12} decimals={0} showSign tone="pos" />
          </div>
          <div className={styles.kpiHint}>
            <MoneyValue value={rentaMensualTotal} decimals={0} /> / mes bruto
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
                const valHoy = valoracionesMap.get(String(d.property.id));
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

                return (
                  <InmuebleCard
                    key={d.property.id}
                    astId={d.astId}
                    state={d.state}
                    stateLabel={d.stateLabel}
                    name={d.property.alias}
                    location={`${d.property.municipality}${
                      d.property.province ? ' · ' + d.property.province : ''
                    }`}
                    chips={[
                      {
                        label: d.type === 'habitaciones' ? 'Habitaciones' : 'Piso completo',
                        isType: true,
                      },
                      { label: `${d.habitaciones} hab` },
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
