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
//   5. Acciones rápidas · accesos de acción
//
// Principio de honestidad (§1): si un dato no tiene fuente fiable, lleva estado
// vacío, nunca un valor de ejemplo ni un cero que parezca real.
//
// PanelPage centraliza la carga y el CÁLCULO de datos; los componentes de
// sección (HeroPatrimonio · ComoVaElMes · PuedesEstarTranquilo · AccionesRapidas)
// son presentacionales.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { PageHead } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import { initDB } from '../../services/db';
import type { Property, Account, TreasuryEvent, Contract, Movement } from '../../services/db';
import {
  calculateAccountBalanceAtDate,
  corteParaSaldoVivo,
} from '../../services/accountBalanceService';
import {
  calcularKpisHero,
  esPendiente,
  importeConSigno,
  rangoDelMes,
} from '../../services/tesoreriaV6Metrics';
import { cuentasEnUso } from '../../services/cuentasEnUso';
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
import ActualizarValoresModal from './components/ActualizarValoresModal';
import type { AnilloState, FlujosMes, FlujoRow } from './components/types';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { costeMensualRecurrente, importeRecurrenteEnMes } from './compromisosMensual';
import { decideFirstRun } from '../onboarding/empezar/FirstRunRedirect';
import { useProyeccionLibertad } from '../../hooks/useProyeccionLibertad';
import { getSeriePatrimonio } from '../horizon/proyeccion/mensual/services/proyeccionMensualService';
import type { PuntoPatrimonioAnual } from '../horizon/proyeccion/mensual/types/proyeccionMensual';
import { useAutoFitHeight } from './useAutoFitHeight';
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
  const isMountedRef = useRef(true);

  // El Panel NO hace scroll (requisito duro) · el par outer/inner escala el
  // contenido si no cabe en la altura disponible. Los wrappers se montan
  // SIEMPRE (también en carga) para que las refs midan desde el primer render.
  const fit = useAutoFitHeight();

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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Proyección libertad financiera real (renta pasiva neta vs gasto objetivo).
  const { data: libertadData, loading: libertadLoading, error: libertadError } =
    useProyeccionLibertad();

  const [properties, setProperties] = useState<Property[]>([]);
  const [cartaItems, setCartaItems] = useState<CartaItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [treasuryEvents, setTreasuryEvents] = useState<TreasuryEvent[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [compromisos, setCompromisos] = useState<CompromisoRecurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState<string>('usuario');
  const [valoracionMatcher, setValoracionMatcher] = useState<ValoracionMatcher | null>(null);
  const [alertasFiscales, setAlertasFiscales] = useState<AlertaFiscal[]>([]);
  const [estimacionFiscal, setEstimacionFiscal] = useState<EstimacionEjercicioEnCurso | null>(null);
  const [seriePatrimonio, setSeriePatrimonio] = useState<PuntoPatrimonioAnual[] | null>(null);
  const [showUpdateValuesModal, setShowUpdateValuesModal] = useState(false);

  // Curva del héroe (B4) · salida canónica del motor · carga no bloqueante:
  // el Panel pinta sus escalares al instante y la curva llega cuando llega.
  useEffect(() => {
    let cancelled = false;
    getSeriePatrimonio()
      .then((serie) => {
        if (!cancelled) setSeriePatrimonio(serie);
      })
      .catch(() => {
        if (!cancelled) setSeriePatrimonio(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Todo lo que el panel necesita, en UNA ronda de lecturas.
   *
   * Eran tres, en serie: las siete tablas de golpe, después los escenarios, y
   * después el matcher de valoraciones —que por dentro son cuatro lecturas
   * más—. Ninguna de las dos últimas depende de la primera, así que esperar a
   * que acabara era tiempo regalado, y se notaba: Panel tardaba en abrir como
   * Financiación *(Jose · 9 ago 2026)*.
   *
   * Lo que NO se hace es pintar antes de tener el matcher, aunque se podría:
   * de él sale el valor de los inmuebles, y de ahí el patrimonio neto. Pintar
   * primero el valor de compra y cambiarlo medio segundo después es enseñar
   * dos patrimonios distintos en la misma visita.
   */
  const loadPanelData = useCallback(async () => {
    try {
      const [db, ctx] = await Promise.all([initDB(), getFiscalContextSafe()]);
      const [props, items, accs, prest, tevents, movs, conts, comps, escenarios, matcher] =
        await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          getAllCartaItems(),
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          // Movimientos reales · el saldo VIVO se calcula, no se lee de
          // `account.balance` (que es solo una foto a principio de mes · ver
          // `rollForwardAccountBalancesToMonth`). Igual que hace Tesorería.
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('contracts') as Promise<Contract[]>,
          db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
          db.getAll('escenarios') as Promise<Escenario[]>,
          // Sin valoraciones el panel sigue sirviendo, así que el fallo se
          // atrapa aquí y no tumba la tanda entera. A qué se cae depende de si
          // ya había valoraciones cargadas, y las dos respuestas son las que
          // queremos:
          //
          //   · en la primera carga no hay ninguna · cada inmueble vale su
          //     precio de compra, que es lo que hacía antes al fallar;
          //   · al recargar se CONSERVAN las de antes · son valoraciones
          //     reales de hace un momento, y tirarlas por un fallo pasajero
          //     haría bajar el patrimonio en pantalla por algo que no ha
          //     pasado. Una cifra vieja es mejor que una cifra falsa.
          valoracionesService
            .getMapValoracionesMasRecientesConMatchingPorNombre('inmueble')
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.warn('[panel] no se pudo cargar matcher de valoraciones', e);
              return null;
            }),
        ]);
      if (!isMountedRef.current) return;
      // Solo inmuebles ACTIVOS suman al patrimonio. Un inmueble VENDIDO ya no
      // es tuyo —su dinero está en tesorería— y uno de BAJA tampoco cuenta.
      // El Panel los metía a todos y por eso enseñaba más patrimonio inmobiliario
      // que la propia pantalla Inmuebles, que ya filtra `state === 'activo'`
      // (`InmueblesPage`). Misma regla aquí para que cuadren.
      setProperties(props.filter((p) => p.state === 'activo'));
      setCartaItems(items);
      setAccounts(accs);
      setPrestamos(prest.filter((p) => p.activo !== false && p.estado !== 'cancelado'));
      setTreasuryEvents(tevents);
      setMovements(movs);
      setContracts(conts);
      setCompromisos(comps);
      setEscenario(escenarios[0] ?? null);
      if (matcher) setValoracionMatcher(matcher);
      if (ctx?.nombre) setNombreUsuario(ctx.nombre);
    } catch (err) {
      // eslint-disable-next-line no-console
      if (isMountedRef.current) console.error('[panel] error cargando datos', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelData();
  }, [loadPanelData]);

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

  // Resultado de la renta · estimación en curso de la declaración (cuota
  // líquida menos lo ya pagado a cuenta), para la tarjeta "Resultado renta".
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

  // ── Saldo VIVO de tesorería · MISMA fuente que la pantalla Tesorería ─────
  // El saldo NO se lee de `account.balance` —que es solo una foto a principio
  // de mes (`rollForwardAccountBalancesToMonth`)—: se calcula con los
  // movimientos y eventos reales hasta el corte de hoy, exactamente como
  // Tesorería. Con la foto de mes, el "hoy tienes" del Panel salía por debajo
  // del "SALDO" de Tesorería (le faltaba todo lo movido desde el día 1).
  const cuentasVivas = useMemo(() => cuentasEnUso(accounts), [accounts]);

  const saldoPorCuenta = useMemo(() => {
    const corte = corteParaSaldoVivo(today.toISOString().slice(0, 10));
    const m = new Map<number, number>();
    for (const c of cuentasVivas) {
      if (c.id == null) continue;
      m.set(
        c.id,
        calculateAccountBalanceAtDate({
          account: c,
          cutoffDate: corte,
          treasuryEvents,
          movements,
        }),
      );
    }
    return m;
  }, [cuentasVivas, treasuryEvents, movements, today]);

  // KPIs del hero de Tesorería (§4.1) · calculados con SU propia función, para
  // que el Panel no pueda desviarse: el saldo de hoy, lo que queda por
  // entrar/salir este mes y el cierre proyectado salen todos de aquí.
  const kpisTesoreria = useMemo(
    () =>
      calcularKpisHero({
        cuentas: cuentasVivas,
        saldoPorCuenta,
        eventos: treasuryEvents,
        year: today.getFullYear(),
        month0: today.getMonth(),
      }),
    [cuentasVivas, saldoPorCuenta, treasuryEvents, today],
  );

  const saldoTesoreria = kpisTesoreria.saldo;

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

  // ── Cómo va el mes ───────────────────────────────────────────────────────
  // Dos lados:
  //   · lo que YA pasó (ejecutado) → "ha entrado / ha salido", con su importe
  //     real (`actualAmount`). Es propio del Panel · Tesorería no lo desglosa.
  //   · lo que QUEDA por entrar/salir y el cierre → salen del HERO de Tesorería
  //     (`calcularKpisHero`), para que sean EL MISMO número en las dos
  //     pantallas. Su definición incluye lo previsto/confirmado del mes que aún
  //     no se ha ejecutado, TAMBIÉN lo ya vencido sin confirmar (por eso "queda
  //     por salir" puede llevar fecha ya pasada). Antes el Panel solo contaba
  //     lo FUTURO (fecha ≥ hoy) y se dejaba fuera lo vencido sin confirmar, así
  //     que ni "queda por salir" ni el cierre cuadraban con Tesorería.
  const mes = useMemo(() => {
    const enMes = treasuryEvents.filter(
      (ev) =>
        mismoMes(ev.actualDate ?? ev.predictedDate, today) || mismoMes(ev.predictedDate, today),
    );
    const ejecutadoEnMes = (ev: TreasuryEvent) =>
      ev.status === 'executed' && mismoMes(ev.actualDate ?? ev.predictedDate, today);

    const ingresosCobrados = enMes.filter((ev) => ev.type === 'income' && ejecutadoEnMes(ev));
    const salidasHechas = enMes.filter((ev) => esSalida(ev) && ejecutadoEnMes(ev));
    const haEntrado = ingresosCobrados.reduce((s, ev) => s + magnitud(ev, true), 0);
    const haSalido = salidasHechas.reduce((s, ev) => s + magnitud(ev, true), 0);

    // Lo que queda y el cierre · calcados del hero de Tesorería.
    const quedaEntrar = kpisTesoreria.pendienteEntrar;
    const quedaSalir = Math.abs(kpisTesoreria.pendienteSalir);
    const saldoFin = kpisTesoreria.cierre;

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
      nQuedaEntrar: kpisTesoreria.movimientosEntrar,
      haSalido,
      nSalido: salidasHechas.length,
      quedaSalir,
      nQuedaSalir: kpisTesoreria.movimientosSalir,
      saldoFin,
      saldoFinFiable,
    };
  }, [treasuryEvents, today, compromisos, kpisTesoreria]);

  // Detalle de cada flujo · las MISMAS poblaciones que alimentan las cuatro
  // cifras de "Cómo va el mes", para que al abrir una tarjeta se vea justo lo
  // que la compone (y se pueda cuadrar a mano). Los pendientes usan el mismo
  // criterio que `calcularKpisHero` (esPendiente + en rango del mes + signo por
  // `type`), así que la lista y el número no pueden discrepar.
  const flujos = useMemo<FlujosMes>(() => {
    const { desde, hasta } = rangoDelMes(today.getFullYear(), today.getMonth());
    const nombreCuenta = (id?: number) => accounts.find((a) => a.id === id)?.name || undefined;
    const soloDia = (iso?: string) => (iso ?? '').slice(0, 10);
    const toRow = (ev: TreasuryEvent, usarReal: boolean): FlujoRow => ({
      id: String(ev.id ?? `${ev.predictedDate}-${ev.amount}-${ev.description ?? ''}`),
      fecha: soloDia(usarReal ? ev.actualDate ?? ev.predictedDate : ev.predictedDate),
      concepto: ev.description || ev.proveedor || ev.categoryLabel || 'Movimiento previsto',
      importe: magnitud(ev, usarReal),
      cuenta: nombreCuenta(ev.accountId),
    });
    const ejecutadoEnMes = (ev: TreasuryEvent) =>
      ev.status === 'executed' && mismoMes(ev.actualDate ?? ev.predictedDate, today);
    const pendienteEnMes = (ev: TreasuryEvent) => {
      if (!esPendiente(ev)) return false;
      const f = soloDia(ev.predictedDate);
      return f >= desde && f <= hasta;
    };
    const porDia = (a: FlujoRow, b: FlujoRow) => a.fecha.localeCompare(b.fecha);

    return {
      haEntrado: treasuryEvents
        .filter((ev) => ev.type === 'income' && ejecutadoEnMes(ev))
        .map((ev) => toRow(ev, true))
        .sort(porDia),
      haSalido: treasuryEvents
        .filter((ev) => esSalida(ev) && ejecutadoEnMes(ev))
        .map((ev) => toRow(ev, true))
        .sort(porDia),
      quedaEntrar: treasuryEvents
        .filter((ev) => pendienteEnMes(ev) && importeConSigno(ev) > 0)
        .map((ev) => toRow(ev, false))
        .sort(porDia),
      quedaSalir: treasuryEvents
        .filter((ev) => pendienteEnMes(ev) && importeConSigno(ev) < 0)
        .map((ev) => toRow(ev, false))
        .sort(porDia),
    };
  }, [treasuryEvents, accounts, today]);

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

  // Por confirmar · ingreso previsto cuya fecha ya pasó y que sigue SIN
  // confirmar (de cualquier periodo). NO afirma impago (FASE A §3, gate 2).
  //
  // NO es conciliación. Conciliar es cuadrar contra un extracto importado
  // (VOCABULARIO-dinero §6 ter · treasuryConfirmationService); aquí no se ha
  // subido ningún extracto, así que nada se puede "conciliar". Lo que falta es
  // que el usuario CONFIRME (puntee) que el cobro entró. Y como avisa el
  // vocabulario, un previsto vencido puede estar por confirmar o sencillamente
  // no haber pasado aún, y desde aquí no se distingue: por eso no se dice impago.
  //
  // Mismo criterio que la bandeja "por confirmar" de Tesorería
  // (tesoreriaV6Metrics · estadoDeCuenta) para que las dos pantallas cuadren:
  //   · solo `predicted` — los `confirmed` están decididos y esperan al banco,
  //     no al usuario, así que no son una tarea "por confirmar";
  //   · descartado nunca cuenta (no ocurrió);
  //   · fecha ya vencida, comparando `YYYY-MM-DD` como cadenas igual que allí
  //     (`f !== '' && f <= hoy`, hoy incluido).
  const porConfirmar = useMemo(() => {
    const hoy = today.toISOString().slice(0, 10);
    const pendientes = treasuryEvents.filter((ev) => {
      if (ev.type !== 'income') return false;
      if (ev.descartado) return false;
      if (ev.status !== 'predicted') return false;
      const f = (ev.predictedDate ?? '').slice(0, 10);
      return f !== '' && f <= hoy;
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

  // Resultado de la renta · lo que TOCARÍA liquidar en la declaración del año
  // siguiente, NO el IRPF bruto del ejercicio.
  //
  // Antes se pintaba `cuotaLiquida` (la cuota bruta), y eso contaba como "a
  // pagar" el IRPF que el usuario YA está pagando vía retención de nómina: la
  // cifra era imposible. Lo que se declara y se liquida es el RESULTADO =
  // cuota líquida − pagos a cuenta (retención de trabajo + M130 + retenciones
  // de capital). El servicio ya lo calcula (`resultadoEstimado.resultadoEstimado`,
  // "+ pagar / − devolver"), que es exactamente `declaracion.resultado`.
  const irpf = useMemo(() => {
    if (!estimacionFiscal) return null;
    return {
      resultado: estimacionFiscal.resultadoEstimado.resultadoEstimado,
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
        <div ref={fit.outerRef} style={fit.outerStyle}>
          <div ref={fit.innerRef} style={fit.innerStyle}>
            <div className={styles.loading}>Cargando panel…</div>
          </div>
        </div>
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
      <div ref={fit.outerRef} style={fit.outerStyle}>
      <div ref={fit.innerRef} style={fit.innerStyle}>
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
            seriePatrimonio={seriePatrimonio}
          />

          <ComoVaElMes
            mesNombre={mesNombre}
            hayDatos={treasuryEvents.length > 0}
            mes={mes}
            flujos={flujos}
            saldoActual={saldoTesoreria}
            onIrTesoreria={() => navigate('/tesoreria')}
          />

          <PuedesEstarTranquilo
            colchon={colchon}
            porConfirmar={porConfirmar}
            proximos30={proximos30}
            irpf={irpf}
          />

          <AccionesRapidas
            onNavigate={navigate}
            onOpenUpdateValues={() => setShowUpdateValuesModal(true)}
          />

          {showUpdateValuesModal ? (
            <ActualizarValoresModal
              onClose={() => setShowUpdateValuesModal(false)}
              onSaved={async () => {
                setLoading(true);
                await loadPanelData();
              }}
            />
          ) : null}

          {/* Semáforo onboarding · andamio de arranque · va al final, después de
              acciones rápidas (decisión Jose) · se auto-oculta al 100%. */}
          <div className={styles.fotoWrap}>
            <FotoActualWidget />
          </div>
        </>
      )}
      </div>
      </div>
    </div>
  );
};

export default PanelPage;
