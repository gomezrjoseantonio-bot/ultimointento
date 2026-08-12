import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { initDB } from '../../../services/db';
import type { Contract, Property } from '../../../services/db';
import { TIPO_ACTIVO_LABELS, getTipoActivoEffective } from '../../../types/tipoActivo';
import { referenciaInmueble } from '../utils/referenciaInmueble';
import {
  calcularCosteAdquisicion,
  calcularMejorasAcumuladas,
} from '../adapters/patrimonioInmuebleAdapter';
import type { InmueblesOutletContext } from '../InmueblesContext';
import { valoracionesService } from '../../../services/valoracionesService';
import { subscribeFinancialValuesUpdated } from '../../../services/financialValuesService';
import { gastosInmuebleService } from '../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../services/mejorasInmuebleService';
import { prestamosService, getAllocationFactor } from '../../../services/prestamosService';
import { getLatestConfirmedSaleForProperty } from '../../../services/propertySaleService';
import CarteraHero, { CarteraAgregados } from '../components/CarteraHero';
import {
  PropiedadFotoCard,
  PropiedadIconoRow,
  PropiedadVM,
} from '../components/PropiedadCards';
import VendidosSection, { VendidoVM } from '../components/VendidosSection';
import styles from './ListadoPage.module.css';

type SegFilter = 'todos' | 'pisos' | 'garajes' | 'alquiler';
type Vista = 'foto' | 'icono';

const isContractActiveAtDate = (c: Contract, today: Date): boolean => {
  if (!c.fechaInicio || !c.fechaFin) return false;
  const ini = new Date(c.fechaInicio);
  const fin = new Date(c.fechaFin);
  return (
    !Number.isNaN(ini.getTime()) &&
    !Number.isNaN(fin.getTime()) &&
    ini <= today &&
    today <= fin
  );
};

/** "YYYY-MM-DD" → "mar 2024" en es-ES. */
const formatMesCorto = (fecha: string | undefined): string => {
  if (!fecha) return '—';
  const parts = fecha.slice(0, 7).split('-');
  if (parts.length < 2) return '—';
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '—';
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
};

const ListadoPage: React.FC = () => {
  const navigate = useNavigate();
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();

  const [search, setSearch] = useState('');
  const [seg, setSeg] = useState<SegFilter>('todos');
  const [vista, setVista] = useState<Vista>('foto');
  const [menuOpen, setMenuOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  const [valoracionMatcher, setValoracionMatcher] = useState<
    import('../../../services/valoracionesService').ValoracionMatcher | null
  >(null);
  const [opexMap, setOpexMap] = useState<Map<number, number>>(new Map());
  const [cuotaMap, setCuotaMap] = useState<Map<number, number>>(new Map());
  const [deudaMap, setDeudaMap] = useState<Map<number, number>>(new Map());
  const [mejorasMap, setMejorasMap] = useState<Map<number, number>>(new Map());
  const [vendidos, setVendidos] = useState<VendidoVM[]>([]);

  const today = useMemo(() => new Date(), []);

  // ── Valoraciones (matcher id+nombre) ──
  const loadValoracionMatcher = useCallback(() => {
    valoracionesService
      .getMapValoracionesMasRecientesConMatchingPorNombre('inmueble')
      .then((m) => setValoracionMatcher(m))
      .catch(() => {
        /* sin valoraciones */
      });
  }, []);

  useEffect(() => loadValoracionMatcher(), [loadValoracionMatcher]);
  useEffect(() => subscribeFinancialValuesUpdated(loadValoracionMatcher), [loadValoracionMatcher]);

  // ── OPEX + cuota + deuda + mejoras por inmueble ──
  useEffect(() => {
    let mounted = true;
    const ejercicio = today.getFullYear();
    const propIds = properties
      .map((p) => p.id)
      .filter((id): id is number => typeof id === 'number');

    const load = async (): Promise<void> => {
      const opex = new Map<number, number>();
      const cuota = new Map<number, number>();
      const deuda = new Map<number, number>();
      const mejoras = new Map<number, number>();

      await Promise.all(
        propIds.map(async (id) => {
          // OPEX año en curso
          try {
            const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(id, ejercicio);
            opex.set(id, gastos.reduce((s, g) => s + (g.importe ?? 0), 0));
          } catch {
            opex.set(id, 0);
          }

          // Préstamos vivos → cuota anual + deuda pendiente imputada
          try {
            const idStr = String(id);
            const prestamos = await prestamosService.getPrestamosByProperty(idStr);
            const vivos = prestamos.filter(
              (p) => p.activo !== false && p.estado !== 'cancelado',
            );
            let cuotaMensual = 0;
            let deudaViva = 0;
            for (const p of vivos) {
              const factor = getAllocationFactor(p, idStr);
              deudaViva += (p.principalVivo ?? 0) * factor;
              const principal = p.principalInicial ?? 0;
              if (principal > 0 && p.plazoMesesTotal) {
                let tasaAnual: number;
                if (p.tipo === 'FIJO' && p.tipoNominalAnualFijo != null) {
                  tasaAnual = p.tipoNominalAnualFijo / 100;
                } else if (p.tipo === 'MIXTO' && p.tipoNominalAnualMixtoFijo != null) {
                  tasaAnual = p.tipoNominalAnualMixtoFijo / 100;
                } else {
                  tasaAnual = (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0);
                }
                const r = tasaAnual / 12;
                const n = p.plazoMesesTotal;
                const cuotaP = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;
                if (Number.isFinite(cuotaP) && cuotaP > 0) cuotaMensual += cuotaP * factor;
              }
            }
            cuota.set(id, cuotaMensual * 12);
            deuda.set(id, deudaViva);
          } catch {
            cuota.set(id, 0);
            deuda.set(id, 0);
          }

          // Mejoras acumuladas (CAPEX)
          try {
            const m = await mejorasInmuebleService.getPorInmueble(id);
            mejoras.set(id, calcularMejorasAcumuladas(m));
          } catch {
            mejoras.set(id, 0);
          }
        }),
      );

      if (!mounted) return;
      setOpexMap(opex);
      setCuotaMap(cuota);
      setDeudaMap(deuda);
      setMejorasMap(mejoras);
    };

    load().catch(() => {
      /* sin datos · se degrada a — */
    });

    return () => {
      mounted = false;
    };
  }, [properties, today]);

  // ── Vendidos · el outlet solo trae activos; se cargan aparte ──
  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      const db = await initDB();
      const all = (await db.getAll('properties')) as Property[];
      const vendidas = all.filter((p) => p.state === 'vendido');
      const vms = await Promise.all(
        vendidas.map(async (p): Promise<VendidoVM> => {
          let venta: number | null = null;
          let plusvalia: number | null = null;
          let saleDateLabel = 'vendido —';
          if (typeof p.id === 'number') {
            try {
              const sale = await getLatestConfirmedSaleForProperty(p.id);
              if (sale) {
                venta = sale.salePrice ?? null;
                plusvalia = sale.fiscalSnapshot?.gananciaPatrimonial ?? null;
                saleDateLabel = `vendido ${formatMesCorto(sale.saleDate)}`;
              }
            } catch {
              /* sin venta registrada */
            }
          }
          return {
            id: p.id ?? 0,
            alias: p.alias || p.address || '—',
            astId: referenciaInmueble(p),
            tipoLabel: TIPO_ACTIVO_LABELS[getTipoActivoEffective(p)],
            municipio: p.municipality || p.province || '—',
            saleDateLabel,
            venta,
            plusvalia,
          };
        }),
      );
      if (mounted) setVendidos(vms);
    };
    load().catch(() => {
      /* sin vendidos · sección oculta */
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ── Cierre del menú "Nuevo" al hacer click fuera ──
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

  // ── View-models por inmueble ──
  const items = useMemo<PropiedadVM[]>(() => {
    return properties.map((p) => {
      const id = p.id ?? 0;
      const tipoActivo = getTipoActivoEffective(p);
      const nombre = p.alias || p.address || '';
      const val = valoracionMatcher?.getByIdOrNombre(p.id ?? '', nombre);
      const valorHoy = val ? val.valor : null;
      const adquisicion = p.acquisitionCosts?.price ?? 0;
      const costeTotal = calcularCosteAdquisicion(p.acquisitionCosts);
      const mejoras = mejorasMap.get(id) ?? 0;

      const propContracts = contracts.filter(
        (c) => c.inmuebleId === p.id && isContractActiveAtDate(c, today),
      );
      const rentaMensual = propContracts.reduce((s, c) => s + (c.rentaMensual ?? 0), 0);
      const enAlquiler = propContracts.length > 0;

      const revalPct =
        valorHoy !== null && costeTotal > 0
          ? ((valorHoy - costeTotal) / costeTotal) * 100
          : null;

      const opex = opexMap.get(id) ?? 0;
      const cuota = cuotaMap.get(id) ?? 0;
      const rentaAnual = rentaMensual * 12;
      const rentabNetaPct =
        enAlquiler && costeTotal > 0
          ? ((rentaAnual - opex - cuota) / costeTotal) * 100
          : null;

      const location = [p.municipality, p.province].filter(Boolean).join(' · ') || '—';

      return {
        id,
        astId: referenciaInmueble(p),
        alias: p.alias || p.address || '—',
        location,
        municipio: p.municipality || p.province || '—',
        tipoActivo,
        tipoLabel: TIPO_ACTIVO_LABELS[tipoActivo],
        squareMeters: p.squareMeters,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        foto: p.foto,
        tieneParking: !!p.anexos?.tieneParking,
        tieneTrastero: !!p.anexos?.tieneTrastero,
        certificado: p.certificadoEnergetico,
        valorHoy,
        costeTotal,
        adquisicion,
        mejoras,
        revalPct,
        rentaMensual,
        enAlquiler,
        rentabNetaPct,
      };
    });
  }, [properties, contracts, valoracionMatcher, mejorasMap, opexMap, cuotaMap, today]);

  // ── Agregados del hero (sobre TODA la cartera activa) ──
  const agregados = useMemo<CarteraAgregados>(() => {
    let valorTotal = 0;
    let baseCoste = 0;
    let deuda = 0;
    let rentaMensualTotal = 0;
    let enAlquiler = 0;
    for (const it of items) {
      valorTotal += it.valorHoy ?? 0;
      baseCoste += it.costeTotal + it.mejoras;
      deuda += deudaMap.get(it.id) ?? 0;
      rentaMensualTotal += it.rentaMensual;
      if (it.enAlquiler) enAlquiler += 1;
    }
    const revalorizacion = valorTotal - baseCoste;
    const revalorizacionPct = baseCoste > 0 ? (revalorizacion / baseCoste) * 100 : null;
    const patrimonioNeto = valorTotal - deuda;
    const ltv = valorTotal > 0 ? (deuda / valorTotal) * 100 : null;
    return {
      valorTotal,
      baseCoste,
      revalorizacion,
      revalorizacionPct,
      deuda,
      patrimonioNeto,
      ltv,
      rentaMensualTotal,
      enAlquiler,
    };
  }, [items, deudaMap]);

  // ── Contadores de segmentos ──
  const counts = useMemo(
    () => ({
      todos: items.length,
      pisos: items.filter((i) => i.tipoActivo === 'piso').length,
      garajes: items.filter((i) => i.tipoActivo === 'parking' || i.tipoActivo === 'trastero').length,
      alquiler: items.filter((i) => i.enAlquiler).length,
    }),
    [items],
  );

  // ── Aplicar filtro + búsqueda ──
  const visibles = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      if (seg === 'pisos' && i.tipoActivo !== 'piso') return false;
      if (seg === 'garajes' && i.tipoActivo !== 'parking' && i.tipoActivo !== 'trastero') return false;
      if (seg === 'alquiler' && !i.enAlquiler) return false;
      if (!s) return true;
      return (
        i.alias.toLowerCase().includes(s) ||
        i.location.toLowerCase().includes(s) ||
        i.astId.toLowerCase().includes(s) ||
        i.tipoLabel.toLowerCase().includes(s)
      );
    });
  }, [items, seg, search]);

  const openDetail = useCallback((id: number) => navigate(`/inmuebles/${id}`), [navigate]);

  const segButton = (id: SegFilter, label: string, n: number): React.ReactNode => (
    <button
      type="button"
      className={styles.seg}
      role="tab"
      aria-selected={seg === id}
      onClick={() => setSeg(id)}
    >
      {label}
      <span className={styles.segN}>{n}</span>
    </button>
  );

  return (
    <div className={styles.screen}>
      {/* Cabecera */}
      <div className={styles.pageHd}>
        <div>
          <h1 className={styles.pageTitle}>Inmuebles</h1>
          <div className={styles.pageSub}>
            tu patrimonio inmobiliario · lo que vale y cómo evoluciona
          </div>
        </div>
        <div className={styles.split} ref={splitRef}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo inmueble
            <span className={styles.caret}>
              <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => navigate('/inmuebles/nuevo')}
              >
                <svg className={`${styles.icon} ${styles.menuIcon}`} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>
                  <span className={styles.mt}>Crear manualmente</span>
                  <span className={styles.md}>alta guiada de un inmueble</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => navigate('/inmuebles/importar')}
              >
                <svg className={`${styles.icon} ${styles.menuIcon}`} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <span>
                  <span className={styles.mt}>Importar desde archivo</span>
                  <span className={styles.md}>Excel / XML AEAT · varios a la vez</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero */}
      <CarteraHero agregados={agregados} />

      {/* Toolbar */}
      <div className={styles.filters}>
        <div className={styles.segs} role="tablist" aria-label="Filtro">
          {segButton('todos', 'Todos', counts.todos)}
          {segButton('pisos', 'Pisos', counts.pisos)}
          {segButton('garajes', 'Garajes / trasteros', counts.garajes)}
          {segButton('alquiler', 'En alquiler', counts.alquiler)}
        </div>
        <div className={styles.search}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre, AST, dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar inmuebles"
          />
        </div>
        <div className={`${styles.segs} ${styles.viewToggle}`} role="tablist" aria-label="Vista">
          <button
            type="button"
            className={styles.seg}
            role="tab"
            aria-selected={vista === 'foto'}
            onClick={() => setVista('foto')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Foto
          </button>
          <button
            type="button"
            className={styles.seg}
            role="tab"
            aria-selected={vista === 'icono'}
            onClick={() => setVista('icono')}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            Icono
          </button>
        </div>
      </div>

      {/* Galerías */}
      {items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin inmuebles aún"
          subtitle="Añade tu primer inmueble para empezar a ver tu cartera consolidada."
          cta={{ label: 'Añadir inmueble', onClick: () => navigate('/inmuebles/nuevo') }}
        />
      ) : visibles.length === 0 ? (
        <div className={styles.resultsEmpty}>Sin resultados con los filtros aplicados.</div>
      ) : vista === 'foto' ? (
        <div className={styles.galleryFoto}>
          {visibles.map((p) => (
            <PropiedadFotoCard key={p.id} p={p} onOpen={openDetail} />
          ))}
        </div>
      ) : (
        <div className={styles.galIcono}>
          <div className={styles.itHead}>
            <span />
            <span className={styles.itHeadH}>Propiedad</span>
            <span className={`${styles.itHeadH} ${styles.itHeadNum} ${styles.hideS}`}>Coste total</span>
            <span className={`${styles.itHeadH} ${styles.itHeadNum} ${styles.hideS}`}>Mejoras</span>
            <span className={`${styles.itHeadH} ${styles.itHeadNum}`}>Valor hoy</span>
            <span className={`${styles.itHeadH} ${styles.itHeadNum}`}>Revaloriz.</span>
          </div>
          <div className={styles.itList}>
            {visibles.map((p) => (
              <PropiedadIconoRow key={p.id} p={p} onOpen={openDetail} />
            ))}
          </div>
        </div>
      )}

      {/* Vendidos */}
      <VendidosSection vendidos={vendidos} />
    </div>
  );
};

export default ListadoPage;
