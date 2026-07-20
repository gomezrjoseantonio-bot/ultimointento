// Panel · home · versión C. Pantalla de SUPERVISIÓN.
//
// Referencia de composición · `docs/audit-inputs/atlas-panel-v3-version-c.html`
// Autoridad de diseño · `docs/audit-inputs/GUIA-DISENO-V5-atlas.md`
// Fuentes verificadas · `docs/audits/T-CC-PANEL-VERSION-C-FASE-A-INFORME.md`
//
// Estructura (§B.1):
//   1. Cabecera blanca · saludo según la hora + fecha
//   2. Héroe navy · patrimonio · composición · activos/deuda/cuota · anillo libertad
//      (la curva de patrimonio a 20 años es FASE C · motor C-PROY-5 no existe → vacío)
//   3. Cómo va el mes · cinco celdas (split cobrado/pendiente por `type` + `status`)
//   4. Puedes estar tranquilo · cuatro tarjetas (callado cuando todo va bien · §B.2)
//   5. Acciones rápidas · cuatro botones
//
// Principio de honestidad (§1): si un dato no tiene fuente fiable, lleva estado
// vacío, nunca un valor de ejemplo ni un cero que parezca real.
//
// PanelPage centraliza la carga y el CÁLCULO de datos; los componentes de
// sección (HeroPatrimonio · ComoVaElMes · PuedesEstarTranquilo · AccionesRapidas)
// son presentacionales.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { PageHead } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import { initDB } from '../../services/db';
import type { Property, Account, TreasuryEvent, Contract } from '../../services/db';
import type { Prestamo } from '../../types/prestamos';
import { getAllCartaItems } from '../inversiones/adapters/galeriaAdapter';
import type { CartaItem } from '../inversiones/types/cartaItem';
import type { Escenario } from '../../types/miPlan';
import { effectiveTIN } from '../financiacion/helpers';
import { getFiscalContextSafe } from '../../services/fiscalContextService';
import { valoracionesService, type ValoracionMatcher } from '../../services/valoracionesService';
import { obtenerDeclaracionParaEjercicio } from '../../services/declaracionResolverService';
import { getEjercicio } from '../../services/ejercicioResolverService';
import {
  generarAlertasFiscales,
  type AlertaFiscal,
} from '../../services/alertasFiscalesService';
import {
  calcularEstimacionEnCurso,
  type EstimacionEjercicioEnCurso,
} from '../../services/estimacionFiscalEnCursoService';
import FotoActualWidget from './components/FotoActualWidget';
import HeroPatrimonio from './components/HeroPatrimonio';
import ComoVaElMes from './components/ComoVaElMes';
import PuedesEstarTranquilo from './components/PuedesEstarTranquilo';
import AccionesRapidas from './components/AccionesRapidas';
import type { AnilloState } from './components/types';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { costeMensualRecurrente, importeRecurrenteEnMes } from './compromisosMensual';
import { decideFirstRun } from '../onboarding/empezar/FirstRunRedirect';
import { useProyeccionLibertad } from '../../hooks/useProyeccionLibertad';
import styles from './PanelPage.module.css';

/**
 * Saludo según hora del día · § Z.6
 * 00-12 → Buenos días · 12-20 → Buenas tardes · 20-24 → Buenas noches
 */
const saludo = (d: Date): string => {
  const h = d.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

/** ¿La fecha ISO cae en el mismo mes/año que `ref`? */
const mismoMes = (iso: string | undefined, ref: Date): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

const esSalida = (ev: TreasuryEvent): boolean =>
  ev.type === 'expense' || ev.type === 'financing';

/** Magnitud del evento en positivo · robusto ante datos con signo heredado. */
const magnitud = (ev: TreasuryEvent, usarActual = false): number =>
  Math.abs((usarActual ? ev.actualAmount ?? ev.amount : ev.amount) ?? 0);

const PanelPage: React.FC = () => {
  const navigate = useNavigate();

  // Puerta de entrada onboarding día 0: si el usuario aterriza sin datos y sin
  // progreso, lo llevamos a `/empezar`. Reentrante · nunca interrumpe a quien ya empezó.
  useEffect(() => {
    let alive = true;
    void decideFirstRun().then((target) => {
      if (alive && target === 'empezar') navigate('/empezar', { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  // Proyección libertad financiera real (renta pasiva neta vs gasto objetivo).
  const { data: libertadData, loading: libertadLoading, error: libertadError } =
    useProyeccionLibertad();

  const [properties, setProperties] = useState<Property[]>([]);
  const [cartaItems, setCartaItems] = useState<CartaItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [treasuryEvents, setTreasuryEvents] = useState<TreasuryEvent[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [compromisos, setCompromisos] = useState<CompromisoRecurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState<string>('usuario');
  const [valoracionMatcher, setValoracionMatcher] = useState<ValoracionMatcher | null>(null);
  const [alertasFiscales, setAlertasFiscales] = useState<AlertaFiscal[]>([]);
  const [estimacionFiscal, setEstimacionFiscal] = useState<EstimacionEjercicioEnCurso | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [db, ctx] = await Promise.all([initDB(), getFiscalContextSafe()]);
        const [props, items, accs, prest, tevents, conts, comps] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          getAllCartaItems(),
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          db.getAll('contracts') as Promise<Contract[]>,
          db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
        ]);
        if (cancelled) return;
        setProperties(props);
        setCartaItems(items);
        setAccounts(accs);
        setPrestamos(prest.filter((p) => p.activo !== false && p.estado !== 'cancelado'));
        setTreasuryEvents(tevents);
        setContracts(conts);
        setCompromisos(comps);
        if (ctx?.nombre) setNombreUsuario(ctx.nombre);

        const escenarios = (await db.getAll('escenarios')) as Escenario[];
        if (!cancelled) setEscenario(escenarios[0] ?? null);

        try {
          const matcher =
            await valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre('inmueble');
          if (!cancelled) setValoracionMatcher(matcher);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[panel] no se pudo cargar matcher de valoraciones', e);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[panel] error cargando datos', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Alertas fiscales del ejercicio en curso · alimentan "Próximos 30 días" (modelo 130).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const año = new Date().getFullYear();
        const ejercicio = await getEjercicio(año);
        if (ejercicio?.estado === 'declarado' || ejercicio?.estado === 'prescrito') {
          if (!cancelled) setAlertasFiscales([]);
          return;
        }
        const { declaracion } = await obtenerDeclaracionParaEjercicio(año);
        if (!declaracion) {
          if (!cancelled) setAlertasFiscales([]);
          return;
        }
        const lista = await generarAlertasFiscales(declaracion, año);
        if (!cancelled) setAlertasFiscales(lista);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[panel] no se pudieron cargar alertas fiscales', err);
        if (!cancelled) setAlertasFiscales([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Impuesto acumulado · IRPF devengado del ejercicio en curso.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const est = await calcularEstimacionEnCurso();
        if (!cancelled) setEstimacionFiscal(est);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[panel] no se pudo calcular la estimación fiscal en curso', err);
        if (!cancelled) setEstimacionFiscal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => new Date(), []);

  // ── Patrimonio · composición · deuda ────────────────────────────────────
  const valorInmuebles = useMemo(() => {
    return properties.reduce((s, p) => {
      const pv = p as Property & {
        currentValue?: number;
        acquisitionCosts?: { price?: number; currentValue?: number };
        valor_actual?: number;
        marketValue?: number;
        estimatedValue?: number;
        valuation?: number;
      };
      const propNombre = p.alias || p.address || '';
      const match = valoracionMatcher?.getByIdOrNombre(p.id ?? '', propNombre);
      const fallback =
        pv.valor_actual ??
        pv.currentValue ??
        pv.marketValue ??
        pv.estimatedValue ??
        pv.valuation ??
        pv.acquisitionCosts?.currentValue ??
        pv.acquisitionCosts?.price ??
        0;
      return s + (match?.valor ?? fallback);
    }, 0);
  }, [properties, valoracionMatcher]);

  const valorInversiones = useMemo(
    () => cartaItems.reduce((s, p) => s + (p.valor_actual ?? 0), 0),
    [cartaItems],
  );

  const saldoTesoreria = useMemo(
    () => accounts.reduce((s, a) => s + ((a as Account).balance ?? a.openingBalance ?? 0), 0),
    [accounts],
  );

  const deudaViva = useMemo(
    () => prestamos.reduce((s, p) => s + (p.principalVivo ?? 0), 0),
    [prestamos],
  );

  const cuotaMensualPrestamos = useMemo(() => {
    return prestamos.reduce((s, p) => {
      const i = effectiveTIN(p) / 100 / 12;
      const n = Math.max(1, p.plazoMesesTotal - p.cuotasPagadas);
      const C = p.principalVivo;
      if (i === 0) return s + C / n;
      return s + (C * i) / (1 - Math.pow(1 + i, -n));
    }, 0);
  }, [prestamos]);

  const activosTotales = valorInmuebles + valorInversiones + saldoTesoreria;
  const patrimonioNeto = activosTotales - deudaViva;

  // ── Cómo va el mes · split cobrado/pendiente por `type` + `status` ───────
  // Partimos por `type` (no por el signo de `amount`, que se guarda en positivo).
  const mes = useMemo(() => {
    const enMes = treasuryEvents.filter(
      (ev) =>
        mismoMes(ev.actualDate ?? ev.predictedDate, today) || mismoMes(ev.predictedDate, today),
    );
    const inicioHoy = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const ejecutado = (ev: TreasuryEvent) => ev.status === 'executed';
    const pendienteFuturo = (ev: TreasuryEvent) =>
      ev.status !== 'executed' &&
      mismoMes(ev.predictedDate, today) &&
      new Date(ev.predictedDate) >= inicioHoy;
    const ejecutadoEnMes = (ev: TreasuryEvent) =>
      ejecutado(ev) && mismoMes(ev.actualDate ?? ev.predictedDate, today);

    const ingresosCobrados = enMes.filter((ev) => ev.type === 'income' && ejecutadoEnMes(ev));
    const ingresosPendientes = enMes.filter((ev) => ev.type === 'income' && pendienteFuturo(ev));
    const salidasHechas = enMes.filter((ev) => esSalida(ev) && ejecutadoEnMes(ev));
    const salidasPendientes = enMes.filter((ev) => esSalida(ev) && pendienteFuturo(ev));

    const haEntrado = ingresosCobrados.reduce((s, ev) => s + magnitud(ev, true), 0);
    const quedaEntrar = ingresosPendientes.reduce((s, ev) => s + magnitud(ev), 0);
    const haSalido = salidasHechas.reduce((s, ev) => s + magnitud(ev, true), 0);
    const quedaSalir = salidasPendientes.reduce((s, ev) => s + magnitud(ev), 0);

    // Saldo a fin de mes = saldo actual + lo que aún debe entrar − lo que aún debe salir.
    const saldoFin = saldoTesoreria + quedaEntrar - quedaSalir;

    // Fiabilidad del saldo · la regla opex regenera treasuryEvents de forma
    // perezosa (al visitar Tesorería/Gastos/Inmueble). Si hay compromisos que
    // deberían descargar gasto ESTE mes pero no se generó NINGÚN evento
    // recurrente, al saldo le falta gasto → no es fiable (decisión Jose).
    const esperadoRecurrenteMes = importeRecurrenteEnMes(compromisos, today);
    const generadoRecurrenteMes = enMes
      .filter(
        (ev) =>
          esSalida(ev) &&
          (ev.sourceType === 'opex_rule' || ev.sourceType === 'gasto_recurrente'),
      )
      .reduce((s, ev) => s + magnitud(ev), 0);
    const saldoFinFiable = !(esperadoRecurrenteMes > 0 && generadoRecurrenteMes === 0);

    return {
      haEntrado,
      nEntrado: ingresosCobrados.length,
      quedaEntrar,
      nQuedaEntrar: ingresosPendientes.length,
      haSalido,
      nSalido: salidasHechas.length,
      quedaSalir,
      nQuedaSalir: salidasPendientes.length,
      saldoFin,
      saldoFinFiable,
    };
  }, [treasuryEvents, today, saldoTesoreria, compromisos]);

  // ── Puedes estar tranquilo ───────────────────────────────────────────────

  // Colchón · "si no entrara ningún ingreso (ni alquileres ni nómina), ¿cuánto
  // aguanta la cartera?". Divisor = TODO lo que sale al mes (decisión Jose):
  //   · cuota de préstamos ................. cuotaMensualPrestamos (fiable)
  //   · gastos fijos recurrentes + de vida . compromisosRecurrentes prorrateados
  //   · comunidad/IBI de inmuebles de inversión → NO modelados como compromiso
  //     (types/compromisosRecurrentes.ts:56-58) → NO se cuentan → se declara.
  // Como puede faltar parte del divisor, el número es optimista y el subtítulo
  // dice expresamente qué no está contando.
  const gastoFijoRecurrenteMensual = useMemo(
    () => costeMensualRecurrente(compromisos, today),
    [compromisos, today],
  );
  const colchon = useMemo(() => {
    const divisor = cuotaMensualPrestamos + gastoFijoRecurrenteMensual;
    if (divisor <= 0) return { estado: 'sin-datos' as const };
    return {
      estado: 'ok' as const,
      meses: saldoTesoreria / divisor,
      cuentaVida: gastoFijoRecurrenteMensual > 0,
      hayInmuebles: properties.length > 0,
    };
  }, [saldoTesoreria, cuotaMensualPrestamos, gastoFijoRecurrenteMensual, properties]);

  // Sin conciliar · ingreso previsto ya vencido y sin cuadrar con el banco (de
  // cualquier periodo). NO afirma impago (FASE A §3, gate 2).
  const sinConciliar = useMemo(() => {
    const inicioHoy = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const pendientes = treasuryEvents.filter((ev) => {
      if (ev.type !== 'income') return false;
      if (ev.status === 'executed' || ev.movementId !== undefined) return false;
      return new Date(ev.actualDate ?? ev.predictedDate) < inicioHoy;
    });
    return {
      count: pendientes.length,
      total: pendientes.reduce((s, ev) => s + magnitud(ev), 0),
    };
  }, [treasuryEvents, today]);

  // Próximos 30 días · alcance LIMITADO Y DECLARADO: contratos + modelo 130.
  // Seguros e IBI no se vigilan (no existe fuente · FASE A §3, gate 3).
  const proximos30 = useMemo(() => {
    const en30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contratosVencen = contracts.filter((c) => {
      if (c.estadoContrato !== 'activo') return false;
      const fechaFin = c.fechaFin ?? c.endDate;
      if (!fechaFin) return false;
      const d = new Date(fechaFin);
      return d >= today && d <= en30;
    });
    const m130 = alertasFiscales.filter((a) => a.tipo === 'm130_pendiente');
    const primero =
      contratosVencen.length > 0
        ? 'contrato próximo a vencer'
        : m130.length > 0
          ? 'modelo 130 por presentar'
          : null;
    return { count: contratosVencen.length + m130.length, primero };
  }, [contracts, alertasFiscales, today]);

  // Impuesto acumulado · IRPF devengado del ejercicio en curso.
  const irpf = useMemo(() => {
    if (!estimacionFiscal) return null;
    return {
      cuota: estimacionFiscal.resultadoEstimado.cuotaLiquida,
      ejercicio: estimacionFiscal.ejercicio,
      mesesConDatos: estimacionFiscal.cobertura.mesesConDatos,
    };
  }, [estimacionFiscal]);

  // ── Anillo de libertad · solo con objetivo de gasto REAL (Mi Plan) ───────
  const objetivoDefinido = (escenario?.gastosVidaLibertadMensual ?? 0) > 0;
  const anillo = useMemo<AnilloState>(() => {
    if (!objetivoDefinido) return { estado: 'sin-objetivo' };
    if (libertadLoading) return { estado: 'cargando' };
    if (libertadError || !libertadData) return { estado: 'error' };
    const punto = libertadData.serie[0];
    const pct = Math.max(0, Math.min(100, Math.round(libertadData.pctCoberturaActual)));
    const anioLibertad = libertadData.cruceLibertad?.anio ?? null;
    return {
      estado: 'ok',
      pct,
      rentaActual: punto?.rentaPasiva ?? 0,
      objetivo: punto?.gastosVida ?? escenario?.gastosVidaLibertadMensual ?? 0,
      anioLibertad,
      añosRestantes: anioLibertad != null ? Math.max(0, anioLibertad - today.getFullYear()) : null,
    };
  }, [objetivoDefinido, libertadLoading, libertadError, libertadData, escenario, today]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando panel…</div>
      </div>
    );
  }

  const fechaLabel = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const mesNombre = today.toLocaleDateString('es-ES', { month: 'long' });
  const empty = activosTotales === 0 && deudaViva === 0;

  return (
    <div className={styles.page}>
      {/* 1 · Cabecera blanca · saludo + fecha (sin subtítulos de estado) */}
      <PageHead title={`${saludo(today)}, ${nombreUsuario}`} sub={fechaLabel} />

      {empty ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Aún no hay datos en tu Atlas"
          subtitle="Cuéntale a Atlas tu foto actual · inmuebles, cuentas, contratos · y genera tu año previsto."
          cta={{ label: 'Empezar mi foto actual', onClick: () => navigate('/empezar') }}
          size="large"
        />
      ) : (
        <>
          <HeroPatrimonio
            patrimonioNeto={patrimonioNeto}
            activosTotales={activosTotales}
            deudaViva={deudaViva}
            cuotaMensual={cuotaMensualPrestamos}
            valorInmuebles={valorInmuebles}
            saldoTesoreria={saldoTesoreria}
            valorInversiones={valorInversiones}
            anillo={anillo}
            onNavigate={navigate}
          />

          <ComoVaElMes
            mesNombre={mesNombre}
            hayDatos={treasuryEvents.length > 0}
            mes={mes}
            saldoActual={saldoTesoreria}
            onIrTesoreria={() => navigate('/tesoreria')}
          />

          <PuedesEstarTranquilo
            colchon={colchon}
            sinConciliar={sinConciliar}
            proximos30={proximos30}
            irpf={irpf}
          />

          <AccionesRapidas onNavigate={navigate} />

          {/* Semáforo onboarding · andamio de arranque · va al final, después de
              acciones rápidas (decisión Jose) · se auto-oculta al 100%. */}
          <div className={styles.fotoWrap}>
            <FotoActualWidget />
          </div>
        </>
      )}
    </div>
  );
};

export default PanelPage;
