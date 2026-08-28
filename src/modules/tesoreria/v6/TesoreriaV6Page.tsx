// ============================================================================
// Tesorería V6 · pantalla única (§4.1 · 4.2 · 4.3 · 4.10)
// ============================================================================
//
// Mockup: `docs/mockups/atlas-tesoreria-v6-escritorio.html`.
//
// La pregunta que responde esta pantalla, y que la diferencia del Panel:
//   ¿tengo para pagar lo que viene, cuenta a cuenta, mes a mes?
//
// Los números NO se calculan aquí: salen de `tesoreriaV6Metrics`, derivación
// pura. Así el "saldo vivo" de §4.6 es recargar el estado y recalcular, sin
// obligar a refrescar la pantalla.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ToastHost, showToastV5 } from '../../../design-system/v5';
import { initDB, type Account, type Movement, type TreasuryEvent } from '../../../services/db';
import { calculateAccountBalanceAtDate, corteParaSaldoVivo } from '../../../services/accountBalanceService';
import {
  calcularKpisHero,
  rangoDelMes,
  cierrePorCuenta,
  estadoDeCuenta,
  serieDiariaConsolidada,
  serieDiariaCuenta,
} from '../../../services/tesoreriaV6Metrics';
import { consumoDeTarjeta, serieDiariaTarjeta } from '../../../services/tarjetaMetrics';
import GraficoTreintaDias from './GraficoTreintaDias';
import GraficoDiarioCuenta from './GraficoDiarioCuenta';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { nombreMes } from './formatoV6';
import HeroTesoreria from './HeroTesoreria';
import MisBancos from './MisBancos';
import type { FilaCuenta } from './TablaCuentas';
import ConfirmaV6 from './ConfirmaV6';
import { darDeBajaCuenta, CuentaConPendientesError } from '../../../services/bajaCuentaService';
import { leerOrdenCuentas, aplicarOrden } from './ordenCuentas';
import DrawerCuenta from './DrawerCuenta';
import DrawerTarjeta from './DrawerTarjeta';
import DrawerExtracto from './DrawerExtracto';
import DrawerCalendario from './DrawerCalendario';
import TesoreriaMovil from './TesoreriaMovil';
import { useEsMovil } from './useEsMovil';
import CuentaWizard from '../../../components/cuenta/CuentaWizard';
import TarjetaWizard from '../../../components/tarjeta/TarjetaWizard';
import { eliminarTarjeta, listarTarjetas } from '../../../services/tarjetasService';
import type { FilaTarjeta } from './ListaTarjetas';
import { regenerarRecibosDeTarjeta } from '../../../services/personal/compromisosRecurrentesService';
import { confirmarPieza, despuntearPieza, descartarPieza } from '../../../services/personal/puntearPieza';
import {
  contarDuplicadosPunteados,
  reconciliarDuplicadosExistentes,
} from '../../../services/reconciliarDuplicadosExistentes';
import type { Tarjeta } from '../../../types/tarjetas';
import {
  gastoDeMovimientos,
  gastoPorTarjeta,
  gastoAbiertoPorTarjeta,
} from '../../../services/gastoPorTarjeta';
import {
  confirmTreasuryEvent,
  revertTreasuryConfirmation,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import { descartarPrevisto, recuperarPrevisto } from '../../../services/treasuryDiscardService';
import {
  editarTraspasoInterno,
  eliminarTraspasoInterno,
} from '../../../services/traspasoInterno';
import {
  altaMovimiento,
  editarMovimiento,
  eliminarMovimiento,
} from '../../../services/altaMovimientoService';
import { batchesEnBorrador, sinBorradores } from '../../../services/statementSessionService';
import { registrarDiagnosticoEnConsola } from '../../../services/duplicadosPrevisionService';
import { registrarBusquedaEnConsola } from '../../../services/__buscarApunteAudit';
import { registrarDiagnosticoTarjetasEnConsola } from '../../../services/__tarjetaDiagnostico';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import styles from './TesoreriaV6Page.module.css';
import { toISODateLocal } from '../../../utils/recurrenceDateUtils';

// «Hoy» en fecha LOCAL, no en UTC. Con `toISOString()` la medianoche local en
// España (UTC+1/+2) cae en el día ANTERIOR: a las 00:50 del 15 el saldo y el
// «Por confirmar» seguían creyendo que era 14, así que la previsión de hoy no
// aparecía para puntear. `toISODateLocal` usa los componentes locales.
const hoyISO = (): string => toISODateLocal(new Date());

// El corte para el saldo vivo (MAÑANA, no hoy) vive en accountBalanceService
// como `corteParaSaldoVivo`, para que el Panel use exactamente el mismo.

interface Estado {
  cuentas: Account[];
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  inmuebles: Array<{ id: number; alias: string }>;
}

const TesoreriaV6Page: React.FC = () => {
  // Puntos de entrada heredados de las rutas que la V6 absorbe:
  //   · /tesoreria/cuenta/:accountId  → abre el drawer de esa cuenta (§4.4)
  //   · /tesoreria?extracto=1         → abre el drawer de extracto (§4.7)
  // Los enlaces antiguos y el atajo del Panel siguen llevando a algo útil en
  // vez de a un 404 o a una pantalla que ya no existe.
  const { accountId: accountIdParam } = useParams<{ accountId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [estado, setEstado] = useState<Estado>({ cuentas: [], eventos: [], movimientos: [], inmuebles: [] });
  const [cargando, setCargando] = useState(true);
  /** Orden guardado de las cuentas (§4.2) · sigue siendo el orden POR DEFECTO
   *  de la tabla; la ordenación por cabecera lo pisa solo en sesión. */
  const [orden, setOrden] = useState<number[]>([]);
  /** V9 · baja de cuenta desde el menú "⋯" de la tabla. */
  const [bajaCuenta, setBajaCuenta] = useState<Account | null>(null);
  const [bajando, setBajando] = useState(false);
  /** V9 · eliminar tarjeta desde el "⋯" de su card. */
  const [bajaTarjeta, setBajaTarjeta] = useState<Tarjeta | null>(null);
  const [borrandoTarjeta, setBorrandoTarjeta] = useState(false);
  /**
   * Qué cuenta está abierta lo dice la URL, no un estado local.
   *
   * Así `/tesoreria/cuenta/5` es un enlace de verdad —se puede guardar y
   * compartir, y el botón atrás del navegador cierra el drawer— en vez de una
   * ruta que solo existe por compatibilidad y a la que nadie llega.
   */
  const cuentaAbierta = useMemo(() => {
    const id = Number(accountIdParam);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [accountIdParam]);
  const abrirCuenta = useCallback((id: number) => navigate(`/tesoreria/cuenta/${id}`), [navigate]);
  /**
   * Cerrar REEMPLAZA la entrada del historial en vez de apilar otra.
   *
   * Con `push`, cerrar el drawer dejaba `/tesoreria/cuenta/N` detrás y el botón
   * atrás del navegador volvía a abrir la cuenta — lo contrario de lo que
   * espera cualquiera al pulsar atrás después de cerrar algo.
   */
  const cerrarCuenta = useCallback(() => navigate('/tesoreria', { replace: true }), [navigate]);
  /**
   * T3 · desde la previsión, a su gasto recurrente.
   *
   * El cargo que sobra en la bandeja casi nunca se arregla en la bandeja: se
   * arregla en el gasto que lo emite —corrigiendo el ciclo o poniéndole fin—.
   * La ruta la resuelve el adaptador y viaja en la fila; aquí solo se navega.
   */
  const irAlGasto = useCallback(
    (item: ItemPunteo) => {
      if (item.gastoRecurrente) navigate(item.gastoRecurrente);
    },
    [navigate],
  );
  /**
   * §4.7 · las dos puertas del extracto. `cuenta: null` es la puerta global del
   * hero (se detecta por IBAN); con cuenta, ya viene fijada desde el drawer.
   * Un objeto y no un booleano porque "cerrado" y "abierto sin cuenta" son
   * estados distintos.
   */
  const [extracto, setExtracto] = useState<{ cuenta: Account | null } | null>(null);
  /**
   * §4.8 · ficha de cuenta. `cuenta: null` = alta. Se reutiliza `CuentaWizard`
   * (adenda §3) en vez de escribir una segunda ficha: ya cubre tipo, tarjeta y
   * saldo inicial a fecha de, y ahora también color de punto y baja.
   */
  const [fichaCuenta, setFichaCuenta] = useState<{ cuenta: Account | null } | null>(null);
  /**
   * VOCABULARIO §3 · las tarjetas viven aparte de las cuentas porque no son
   * cuentas: no tienen saldo, tienen un ciclo. Estado propio y carga propia —
   * no entran en `recargar()`, que reconstruye saldos y previsiones.
   */
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [fichaTarjeta, setFichaTarjeta] = useState<{ tarjeta: Tarjeta | null } | null>(null);
  // §3.5 · el cajón de una tarjeta · sus compras del periodo, como un banco.
  const [tarjetaAbierta, setTarjetaAbierta] = useState<Tarjeta | null>(null);
  /** §9 · alta desde el drawer del día · guarda la fecha para prefijarla. */
  const [altaDelDia, setAltaDelDia] = useState<string | null>(null);
  /**
   * §4.9 · calendario diario. Guarda su propio mes porque navega con ‹ › sin
   * cerrarse, y eso no debe mover el mes de la pantalla de detrás.
   */
  const [calendario, setCalendario] = useState<{ year: number; month0: number } | null>(null);
  /** El extracto sí es estado local · no tiene ruta propia, solo un query. */
  const [extractoAplicado, setExtractoAplicado] = useState(false);
  /**
   * F3 · qué cuenta se está MIRANDO (fila navy + su gráfico diario).
   *
   * Es distinto de `cuentaAbierta`, que es la que tiene el punteo abierto y
   * vive en la URL: aquí se mira, allí se toca. `null` = ninguna, y entonces
   * la tabla se ve entera.
   */
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<number | null>(null);

  const hoy = hoyISO();
  const ahora = useMemo(() => new Date(`${hoy}T12:00:00`), [hoy]);
  const year = ahora.getFullYear();
  const month0 = ahora.getMonth();
  const mesActual = nombreMes(month0);

  // ── Carga · una sola lectura, todo lo demás se deriva ────────────────────
  const recargar = useCallback(async () => {
    // El recibo de tarjeta = lo previsto + las compras manuales del periodo. Se
    // rehace ANTES de leer para que el cargo del banco cuadre siempre con lo que
    // se ve en la tarjeta. Idempotente y tolerante a fallo: si peta, se lee lo
    // que haya y no se tumba la pantalla.
    try {
      await regenerarRecibosDeTarjeta();
    } catch (err) {
      console.warn('[TesoreriaV6] no se pudieron regenerar los recibos de tarjeta', err);
    }
    const db = await initDB();
    const [cuentas, eventos, movimientos, properties, ordenGuardado, borradores] =
      await Promise.all([
        db.getAll('accounts') as Promise<Account[]>,
        db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
        db.getAll('movements') as Promise<Movement[]>,
        db.getAll('properties') as Promise<Array<{ id?: number; alias?: string; address?: string; state?: string }>>,
        leerOrdenCuentas(),
        batchesEnBorrador(),
      ]);
    setEstado({
      cuentas: cuentas ?? [],
      eventos: eventos ?? [],
      // §4.7 · un extracto abierto y sin guardar NO mueve saldos ni asoma por
      // la lista de la cuenta. Se filtra aquí, en el único punto de carga de la
      // V6, y no en cada consumidor: así no hay forma de olvidarlo en uno.
      movimientos: sinBorradores(movimientos ?? [], borradores),
      inmuebles: (properties ?? [])
        // Un inmueble VENDIDO (o de baja) ya no recibe apuntes: sale del selector
        // de la ficha para no poder asignarle un gasto nuevo. Mismo criterio que
        // el resto de la app (`financialValuesService`, Panel).
        .filter((p) => p.state !== 'vendido' && p.state !== 'baja')
        .filter((p): p is { id: number; alias?: string; address?: string } => p.id != null)
        // §2.2 · ningún identificador interno visible. El respaldo era
        // `Inmueble ${id}`, y eso reintroducía por detrás justo lo que el
        // adaptador ya no pinta: un número de fila de base de datos.
        //
        // Pero tampoco se filtran: un inmueble sin nombre existe igual, y
        // quitarlo de aquí lo sacaba del selector de la ficha — el usuario ya
        // no podía asignarle un movimiento, que es peor que un rótulo feo.
        // "Sin nombre" dice la verdad y se puede elegir; el mismo rótulo que
        // usa `punteoAgrupacion` al agrupar.
        .map((p) => ({ id: p.id, alias: p.alias || p.address || 'Sin nombre' })),
    });
    setOrden(ordenGuardado);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const recargarTarjetas = useCallback(async () => {
    setTarjetas(await listarTarjetas());
  }, []);

  /**
   * §3.5 · lo gastado con cada tarjeta en su periodo ABIERTO.
   *
   * Para una de crédito, el gasto de un periodo ES su recibo: el banco carga
   * exactamente eso. Mientras el periodo no cierra la cifra está viva y crece
   * con cada compra, que es justo lo que hay que poder mirar.
   */
  const periodosDeTarjeta = useMemo(
    () => [
      ...gastoPorTarjeta(estado.eventos),
      // El DÉBITO no tiene recibo del que deducir su gasto —cobra al momento—,
      // así que sale de los movimientos que el usuario atribuyó a una tarjeta.
      ...gastoDeMovimientos(estado.movimientos, tarjetas),
      // Las compras MANUALES de crédito YA vienen dentro del recibo (se funden en
      // `regenerarRecibosDeTarjeta`), así que NO se suman aquí otra vez: hacerlo
      // las contaría dos veces en «Llevas X este periodo».
    ],
    [estado.eventos, estado.movimientos, tarjetas]
  );

  /**
   * Las que se pueden elegir en la ficha de un movimiento (§3.5).
   *
   * Una tarjeta sin `id` no se ha guardado todavía y no se puede atribuir nada
   * a ella.
   */
  const tarjetasElegibles = useMemo(
    () =>
      tarjetas
        .filter((t): t is typeof t & { id: number } => t.id != null)
        .map((t) => ({ id: t.id, alias: t.alias, modalidad: t.modalidad })),
    [tarjetas]
  );

  // «Llevas X este periodo» por tarjeta · el corte vigente es el abierto más
  // PRÓXIMO que aún no ha pasado (no el primero de la lista, que es el recibo
  // previsto más lejano). Lógica pura y testeada en `gastoPorTarjeta`.
  const gastoAbierto = useMemo(
    () => gastoAbiertoPorTarjeta(periodosDeTarjeta, hoy),
    [periodosDeTarjeta, hoy]
  );

  useEffect(() => {
    void recargarTarjetas();
  }, [recargarTarjetas]);

  /**
   * Entrar por `/tesoreria/cuenta/:id` además SELECCIONA esa cuenta.
   *
   * Si no, al cerrar el punteo el gráfico visible sería el de otra cuenta —o
   * ninguno— y el usuario acabaría mirando algo que no es lo que estaba
   * tocando.
   */
  useEffect(() => {
    if (cuentaAbierta != null) setCuentaSeleccionada(cuentaAbierta);
  }, [cuentaAbierta]);

  // FASE 0 · deja `atlasDiagnostico.duplicados()` en la consola. Solo lectura:
  // cuenta previsiones repetidas y dice cuánto distorsionan el cierre. Hace
  // falta porque los datos viven en el navegador y las páginas /dev están
  // apagadas en producción.
  // Y `atlasDiagnostico.buscar('seguro')`, que contesta a otra pregunta: dónde
  // vive un apunte concreto, qué pantalla lo enseña (o por qué ninguna) y si
  // está duplicado por una vía que las auditorías de previsiones no ven —dos
  // altas del mismo gasto, o el mismo cargo emitido por dos motores distintos—.
  useEffect(() => {
    registrarDiagnosticoEnConsola();
    registrarBusquedaEnConsola();
    registrarDiagnosticoTarjetasEnConsola();
  }, []);

  // ── Derivados ────────────────────────────────────────────────────────────

  // §4.8 · una cuenta dada de baja deja de salir. Aquí se comprobaba solo
  // `status !== 'DELETED'`, y la baja marca `INACTIVE`: se guardaba de verdad,
  // el aviso decía la verdad, y la tarjeta seguía en la tira como si nada.
  const cuentasVivas = useMemo(
    () => aplicarOrden(cuentasEnUso(estado.cuentas), orden),
    [estado.cuentas, orden]
  );

  // Una sola pasada para repartir eventos y movimientos por cuenta. Sin esto,
  // pasar los arrays completos a cada cuenta escala como
  // O(cuentas × (eventos + movimientos)) —`calculateAccountBalanceAtDate` los
  // vuelve a filtrar por dentro— y con historiales grandes se nota.
  const porCuenta = useMemo(() => {
    const eventos = new Map<number, TreasuryEvent[]>();
    const movimientos = new Map<number, Movement[]>();
    for (const e of estado.eventos) {
      if (e.accountId == null) continue;
      const arr = eventos.get(e.accountId);
      if (arr) arr.push(e);
      else eventos.set(e.accountId, [e]);
    }
    for (const m of estado.movimientos) {
      const arr = movimientos.get(m.accountId);
      if (arr) arr.push(m);
      else movimientos.set(m.accountId, [m]);
    }
    return { eventos, movimientos };
  }, [estado.eventos, estado.movimientos]);

  const saldoPorCuenta = useMemo(() => {
    const m = new Map<number, number>();
    const corte = corteParaSaldoVivo(hoy);
    for (const c of cuentasVivas) {
      if (c.id == null) continue;
      m.set(
        c.id,
        calculateAccountBalanceAtDate({
          account: c,
          cutoffDate: corte,
          treasuryEvents: porCuenta.eventos.get(c.id) ?? [],
          movements: porCuenta.movimientos.get(c.id) ?? [],
          // Saldo VIVO · un cargo/abono real del extracto cuenta aunque el banco
          // lo valore un par de días adelante (la remuneración mensual).
          incluirRealesFuturos: true,
        })
      );
    }
    return m;
  }, [cuentasVivas, porCuenta, hoy]);

  const kpis = useMemo(
    () => calcularKpisHero({ cuentas: cuentasVivas, saldoPorCuenta, eventos: estado.eventos, year, month0 }),
    [cuentasVivas, saldoPorCuenta, estado.eventos, year, month0]
  );

  // Tesorería abre con TODAS las cuentas colapsadas (decisión de Jose).
  //
  // Arrancaba con la primera desplegada para que el patrón se viera solo, pero
  // eso decide por el usuario qué cuenta mira nada más entrar y le mete media
  // pantalla de gráfico antes de que haya pedido nada. La lista entera de un
  // vistazo es mejor primera pregunta. El deep-link `/tesoreria/cuenta/:id`
  // sigue seleccionando la suya, porque ahí sí se pidió una cuenta concreta.

  /** La tarjeta abierta · su día a día se lee igual que el de una cuenta. */
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<number | null>(null);

  const diasTarjeta = useMemo(
    () =>
      tarjetaSeleccionada == null
        ? null
        : serieDiariaTarjeta({
            tarjetaId: tarjetaSeleccionada,
            eventos: estado.eventos,
            movimientos: estado.movimientos,
            year,
            month0,
          }),
    [tarjetaSeleccionada, estado.eventos, estado.movimientos, year, month0]
  );

  /**
   * F3 · el día a día de la cuenta que se está mirando.
   *
   * Fuente doble (`serieDiariaCuenta`): lo confirmado sale de `movements` y lo
   * pendiente de `treasuryEvents`. Se recalcula al escribir, como todo lo
   * demás de la pantalla.
   */
  const diasCuenta = useMemo(
    () =>
      cuentaSeleccionada == null
        ? null
        : serieDiariaCuenta({
            cuentaId: cuentaSeleccionada,
            eventos: porCuenta.eventos.get(cuentaSeleccionada) ?? [],
            movimientos: porCuenta.movimientos.get(cuentaSeleccionada) ?? [],
            year,
            month0,
          }),
    [cuentaSeleccionada, porCuenta, year, month0]
  );

  /** V9 · la serie del gráfico "Lo que viene · próximos 30 días" (fase 1). */
  const serie = useMemo(
    () => serieDiariaConsolidada({ cuentas: cuentasVivas, saldoPorCuenta, eventos: estado.eventos, hoy }),
    [cuentasVivas, saldoPorCuenta, estado.eventos, hoy]
  );

  /**
   * Filas de tarjetas · SOLO las activas (spec: las de baja no se pintan).
   *
   * Enseñaban el importe del RECIBO bajo el rótulo "consumido", y el recibo
   * suma las compras punteadas y las que no: una tarjeta con cinco compras
   * anotadas y ninguna confirmada decía "consumido 1.010,72 €" sin haberse
   * confirmado un euro. Ahora se separan lo real y lo previsto
   * (`consumoDeTarjeta`), y la suma va aparte, dicha por su nombre.
   *
   * El periodo es el MES en curso, el mismo que miran las cuentas y el mismo
   * del gráfico de debajo. El ciclo de facturación sigue viviendo en el cajón
   * de la tarjeta, que es donde se mira un recibo.
   */
  const filasTarjetas = useMemo<FilaTarjeta[]>(() => {
    const { desde, hasta } = rangoDelMes(year, month0);
    return tarjetas
      .filter((t): t is Tarjeta & { id: number } => t.id != null && t.activa !== false)
      .map((t) => {
        const liquida = cuentasVivas.find((c) => c.id === t.cuentaLiquidacionId);
        const c = consumoDeTarjeta({
          tarjetaId: t.id,
          eventos: estado.eventos,
          movimientos: estado.movimientos,
          desde,
          hasta,
        });
        return {
          tarjeta: t,
          sub:
            t.emisora ||
            (liquida ? `liquida en ${liquida.alias || liquida.banco?.name || 'su cuenta'}` : ''),
          gastado: c.confirmado,
          pendiente: c.pendiente,
          total: c.total,
          porConfirmar: c.porConfirmar,
        };
      });
  }, [tarjetas, cuentasVivas, estado.eventos, estado.movimientos, year, month0]);

  /**
   * V9 · las filas de la tabla "Mis cuentas". Cada número sale de la capa
   * canónica: saldo vivo, `cierrePorCuenta` y `estadoDeCuenta`. La fila Total
   * de la tabla pinta los del hero (`kpis`), no una suma propia.
   */
  const filasCuentas = useMemo<FilaCuenta[]>(
    () =>
      cuentasVivas
        .filter((c): c is Account & { id: number } => c.id != null)
        .map((c) => {
          const eventos = porCuenta.eventos.get(c.id) ?? [];
          const saldo = saldoPorCuenta.get(c.id) ?? 0;
          const cierre = cierrePorCuenta({ saldoHoy: saldo, eventos, year, month0 });
          return {
            cuenta: c,
            // Sin color de banco · la fila de cuenta ya no lo pinta (F1). El
            // resto de la V6 (tarjetas, drawers, calendario, móvil) lo sigue
            // usando, así que `bancoColores` se queda.
            nombre: c.alias || c.name || c.banco?.name || 'Cuenta',
            mask: (c.ultimosCuatro || c.iban?.slice(-4)) ?? '',
            saldo,
            entra: cierre.entra,
            sale: cierre.sale,
            cierre: cierre.cierre,
            estado: estadoDeCuenta({ saldoHoy: saldo, eventos, year, month0, hoy }),
          };
        }),
    [cuentasVivas, porCuenta, saldoPorCuenta, year, month0, hoy]
  );


  // ── §4.6 · saldo vivo ────────────────────────────────────────────────────
  // Confirmar y descartar recargan el estado, y de ahí se recalculan KPIs,
  // tarjeta, drawer y bloque de realidad. Nada exige refrescar la pantalla.

  const trasEscribir = useCallback(async () => {
    invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
    await recargar();
  }, [recargar]);

  // Duplicados de previstos punteados que dejó el bug de conciliación · se
  // avisan y se limpian bajo demanda (borra datos, no se hace solo).
  const numDuplicados = useMemo(
    () => contarDuplicadosPunteados(estado.movimientos),
    [estado.movimientos]
  );
  const [limpiandoDup, setLimpiandoDup] = useState(false);
  const limpiarDuplicados = useCallback(async () => {
    setLimpiandoDup(true);
    try {
      await reconciliarDuplicadosExistentes();
      await trasEscribir();
    } catch (err) {
      console.error('[TesoreriaV6] no se pudieron limpiar los duplicados', err);
    } finally {
      setLimpiandoDup(false);
    }
  }, [trasEscribir]);

  /** V9 · dar de baja desde la tabla · la baja es suave y bloqueada con
   *  pendientes (`bajaCuentaService`), igual que desde la ficha. */
  const confirmarBaja = useCallback(async () => {
    if (bajaCuenta?.id == null || bajando) return;
    setBajando(true);
    try {
      await darDeBajaCuenta(bajaCuenta.id);
      showToastV5('Cuenta dada de baja · su histórico se conserva y puede deshacerse desde su ficha', 'success');
      setBajaCuenta(null);
      await trasEscribir();
    } catch (err) {
      if (err instanceof CuentaConPendientesError) {
        showToastV5(err.message, 'warn');
      } else {
        console.error('[TesoreriaV6] no se pudo dar de baja la cuenta', err);
        showToastV5('No se pudo dar de baja la cuenta', 'error');
      }
      setBajaCuenta(null);
    } finally {
      setBajando(false);
    }
  }, [bajaCuenta, bajando, trasEscribir]);

  /**
   * V9 · eliminar una tarjeta desde su "⋯". `eliminarTarjeta` es borrado duro
   * del registro (el saneo referencial es tarea aparte · fuera de alcance);
   * los recibos se regeneran en la recarga.
   */
  const confirmarBajaTarjeta = useCallback(async () => {
    if (bajaTarjeta?.id == null || borrandoTarjeta) return;
    setBorrandoTarjeta(true);
    try {
      await eliminarTarjeta(bajaTarjeta.id);
      showToastV5('Tarjeta eliminada', 'success');
      setBajaTarjeta(null);
      await recargarTarjetas();
      await trasEscribir();
    } catch (err) {
      console.error('[TesoreriaV6] no se pudo eliminar la tarjeta', err);
      showToastV5('No se pudo eliminar la tarjeta', 'error');
      setBajaTarjeta(null);
    } finally {
      setBorrandoTarjeta(false);
    }
  }, [bajaTarjeta, borrandoTarjeta, recargarTarjetas, trasEscribir]);

  /** Confirmar un previsto por id · lo usan la lista de punteo y el móvil. */
  const confirmarPrevisto = useCallback(
    async (eventoId: number) => {
      try {
        await confirmTreasuryEvent(eventoId);
        await trasEscribir();
      } catch (err) {
        console.error('[TesoreriaV6] no se pudo confirmar', err);
      }
    },
    [trasEscribir]
  );

  const confirmarItem = useCallback(
    async (item: ItemPunteo) => {
      if (item.kind !== 'evento') return;
      await confirmarPrevisto(item.refId);
    },
    [confirmarPrevisto]
  );

  /**
   * Despuntear · deshacer un punteo. El movimiento se borra y su previsión
   * vuelve a `predicted`, así que el cargo reaparece en "Por confirmar".
   *
   * Solo sobre movimientos NACIDOS DE UNA PREVISIÓN, que es lo único que tiene
   * adónde volver. `revertTreasuryConfirmation` borra el movimiento siempre y
   * solo devuelve el evento a `predicted` si lo encuentra por la huella
   * `treasury_event:{id}` de su `reference`: sobre un alta a mano o algo
   * llegado del inbox, deshacer sería borrar el dato y no devolverlo a
   * ninguna parte.
   *
   * Un evento `confirmed` —la venta de un piso, la liquidación de un préstamo—
   * tampoco: no se punteó nunca, está decidido y espera al banco.
   */
  const despuntearItem = useCallback(
    async (item: ItemPunteo) => {
      // La misma condición que decide si el círculo es interruptor o marca.
      // Repetida aquí a propósito: esto BORRA un movimiento, y apoyarse en que
      // la lista no lo ofrezca es fiar el dato del usuario a un `if` de otro
      // fichero.
      if (item.kind !== 'movimiento' || item.previsionId == null) return;
      try {
        await revertTreasuryConfirmation(item.refId);
        await trasEscribir();
      } catch (err) {
        console.error('[TesoreriaV6] no se pudo despuntear', err);
      }
    },
    [trasEscribir]
  );

  /**
   * T4 · deshacer un descarte · la previsión vuelve a «Por confirmar».
   *
   * `recuperarPrevisto` existía desde V84 sin un solo botón detrás: descartar
   * es la acción más fácil de pulsar por error de toda la bandeja y no tenía
   * vuelta en ninguna vista.
   */
  const recuperarItem = useCallback(
    async (item: ItemPunteo) => {
      if (item.kind !== 'evento') return;
      try {
        await recuperarPrevisto(item.refId);
        await trasEscribir();
      } catch (err) {
        console.error('[TesoreriaV6] no se pudo recuperar', err);
      }
    },
    [trasEscribir],
  );

  const descartarItem = useCallback(
    async (item: ItemPunteo) => {
      try {
        // Borrar una sola pata dejaría la otra colgada: un ingreso que no viene
        // de ningún sitio, o un cargo que no llega a ninguna cuenta.
        if (item.traspaso) {
          await eliminarTraspasoInterno(item.traspaso.eventId);
          await trasEscribir();
          return;
        }
        // Una previsión se DESCARTA —sigue existiendo, marcada como que no va
        // a ocurrir— y un movimiento anotado a mano se borra: no hay nada que
        // conservar de un apunte que el usuario escribió por error.
        if (item.kind === 'movimiento') {
          await eliminarMovimiento(item.refId);
          await trasEscribir();
          return;
        }
        await descartarPrevisto(item.refId);
        await trasEscribir();
        // El deshacer va DONDE ocurre la acción · mandar al usuario a buscar la
        // cola de descartadas para corregir un clic de más es pedirle que
        // repare a mano lo que la pantalla acaba de hacer sola. Dura más que un
        // aviso normal: es una decisión, no una confirmación.
        const eventId = item.refId;
        showToastV5(
          <span className={styles.toastDeshacer}>
            <span>Descartada · «{item.concepto}»</span>
            <button
              type="button"
              className={styles.toastDeshacerBtn}
              onClick={() => {
                void (async () => {
                  await recuperarPrevisto(eventId);
                  await trasEscribir();
                })();
              }}
            >
              Deshacer
            </button>
          </span>,
          'info',
          6000,
        );
      } catch (err) {
        console.error('[TesoreriaV6] no se pudo descartar', err);
      }
    },
    [trasEscribir]
  );

  /**
   * §4.9 · confirmar de golpe todo lo que queda pendiente de un día.
   *
   * En serie y no en paralelo: cada confirmación materializa un movimiento y
   * recalcula saldo, y lanzarlas a la vez sobre la misma cuenta se pisa. Un día
   * tiene pocos apuntes, así que la espera no se nota.
   */
  const confirmarDia = useCallback(
    async (items: ItemPunteo[]) => {
      let fallos = 0;
      for (const item of items) {
        if (item.kind !== 'evento') continue;
        try {
          await confirmTreasuryEvent(item.refId, {});
        } catch (err) {
          fallos++;
          console.error('[TesoreriaV6] no se pudo confirmar el previsto del día', err);
        }
      }
      // Se recarga aunque alguno falle: los que sí pasaron ya movieron saldo, y
      // dejar la pantalla desfasada sería peor que enseñar el resultado parcial.
      await trasEscribir();
      if (fallos > 0) {
        console.warn(`[TesoreriaV6] ${fallos} de ${items.length} previstos no se pudieron confirmar`);
      }
    },
    [trasEscribir]
  );

  /**
   * §4.5 · guardar desde la ficha.
   *
   * En EDICIÓN de un previsto: primero se corrige la clasificación y luego se
   * confirma con el importe real, que es lo que dice §4.5 ("Guardar en edición
   * → movement confirmado con el importe real").
   *
   * En ALTA ("Anotar") y en una derrama-mejora se escribe por `altaMovimiento`,
   * que decide el destino: `movements` para lo normal, `mejorasInmueble` para
   * la mejora — que se amortiza y por eso no es un gasto de este año.
   */
  const guardarFicha = useCallback(
    async (item: ItemPunteo | null, v: GuardadoFicha) => {
      try {
        // Alta a mano, o una derrama que resultó ser MEJORA. Lo segundo no se
        // puede confirmar como previsto: confirmar materializa un movement de
        // gasto, y una mejora se amortiza. Las dos van al mismo escritor, que
        // ya sabe a qué store corresponde cada una.
        // Un traspaso interno se corrige ENTERO · las dos patas a la vez.
        //
        // Da igual desde cuál se abriera el lápiz: el adaptador ya resolvió
        // quién es el origen. Por cualquiera de los caminos de abajo, la salida
        // se habría quedado con el importe nuevo y la entrada con el viejo —
        // dinero apareciendo de la nada.
        if (item?.traspaso) {
          await editarTraspasoInterno(item.traspaso.eventId, {
            fecha: v.fecha,
            importe: v.importe,
            concepto: v.concepto,
            cuentaOrigenId: v.cuentaId ?? item.traspaso.origenId,
            cuentaDestinoId: v.cuentaDestinoId ?? item.traspaso.destinoId,
          });
          await trasEscribir();
          return;
        }
        // Corregir lo YA anotado · en el sitio, no otra vez.
        //
        // Sin esta rama, editar un movimiento caía en el alta de más abajo y
        // creaba un segundo apunte: el lápiz duplicaba el gasto en vez de
        // arreglarlo, que es peor que no tener lápiz.
        if (item?.kind === 'movimiento' && !v.esMejora) {
          await editarMovimiento(item.refId, {
            tipo: v.tipo,
            concepto: v.concepto,
            importe: v.importe,
            fecha: v.fecha,
            cuentaId: v.cuentaId,
            inmuebleId: v.inmuebleId ?? null,
            categoryKey: v.categoryKey,
            subtypeKey: v.subtypeKey,
            conceptoId: v.subtipo ?? null,
            // Viaja para que el servicio pueda NEGARSE: convertir esto en un
            // traspaso interno pediría una segunda pata que aquí no se puede
            // crear. Tragárselo en silencio dejaría el dinero saliendo de una
            // cuenta y entrando en ninguna.
            cuentaDestinoId: v.cuentaDestinoId,
          });
          await trasEscribir();
          return;
        }
        if (item == null || item.kind !== 'evento' || v.esMejora) {
          // La previsión que dio origen a la mejora deja de estar pendiente: si
          // se quedara, seguiría proyectando un gasto que ya se registró como
          // inversión, y el cierre saldría dos veces peor de lo que es.
          if (item?.kind === 'evento' && v.esMejora) {
            await descartarPrevisto(item.refId, 'registrada como mejora del inmueble');
          }
          // §3.5 · con qué tarjeta se pagó. La ficha se olvidaba de pasarlo, así
          // que un gasto en tarjeta caía como cargo directo a la cuenta. Con una
          // de CRÉDITO no toca la cuenta —sale en el recibo— y el cargo se
          // atribuye a su cuenta de liquidación (donde luego cae el recibo).
          const tarjetaDelGasto =
            v.tarjetaId != null ? tarjetas.find((t) => t.id === v.tarjetaId) : undefined;
          const esCredito = tarjetaDelGasto?.modalidad === 'credito';
          // Cualquier tarjeta se paga con su cuenta de liquidación · el débito
          // la mueve al momento, el crédito cuando llega el recibo.
          const cuentaParaAlta =
            tarjetaDelGasto?.cuentaLiquidacionId != null
              ? tarjetaDelGasto.cuentaLiquidacionId
              : v.cuentaId;
          await altaMovimiento({
            tipo: v.tipo,
            concepto: v.concepto,
            importe: v.importe,
            fecha: v.fecha,
            cuentaId: cuentaParaAlta,
            inmuebleId: v.inmuebleId ?? null,
            categoryKey: v.categoryKey ?? null,
            subtypeKey: v.subtypeKey ?? null,
            conceptoId: v.subtipo ?? null,
            esMejora: v.esMejora,
            cuentaDestinoId: v.cuentaDestinoId,
            tarjetaId: v.tarjetaId ?? null,
            gastoTarjetaCredito: esCredito,
          });
          await trasEscribir();
          return;
        }
        // La descripción va en el override de confirmar, que sí la acepta;
        // `TreasuryEventPatch` es solo para la clasificación.
        //
        // `undefined` se omite (no tocar) y `null` viaja (limpiar): por eso la
        // comprobación es contra `undefined` y no contra falsy — si no, elegir
        // "Sin inmueble" o reclasificar a un concepto sin variante no borraría
        // nada y quedarían restos de la clasificación anterior.
        await updateTreasuryEventFields(item.refId, {
          ...(v.categoryKey !== undefined ? { categoryKey: v.categoryKey } : {}),
          ...(v.subtypeKey !== undefined ? { subtypeKey: v.subtypeKey } : {}),
          // F2b · el concepto fino elegido en la ficha viaja al evento y de ahí
          // al movimiento al confirmar. `?? null` para poder limpiarlo.
          ...(v.subtipo !== undefined ? { conceptoId: v.subtipo ?? null } : {}),
          ...(v.inmuebleId !== undefined ? { inmuebleId: v.inmuebleId } : {}),
        });
        await confirmTreasuryEvent(item.refId, {
          amount: Math.abs(v.importe),
          date: v.fecha,
          ...(v.cuentaId != null ? { accountId: v.cuentaId } : {}),
          description: v.concepto,
        });
        await trasEscribir();
      } catch (err) {
        console.error('[TesoreriaV6] no se pudo guardar el movimiento', err);
      }
    },
    [trasEscribir, tarjetas]
  );

  // §3.5 · puntear una PIEZA de tarjeta · confirma/despunta/descarta en el sitio
  // (sin crear movimiento de caja) y regenera el recibo al recargar.
  const puntearPiezaAccion = useCallback(
    (accion: (id: number, importe?: number) => Promise<void>) =>
      async (item: ItemPunteo, importe?: number) => {
        try {
          await accion(item.refId, importe);
          await trasEscribir();
        } catch (err) {
          console.error('[TesoreriaV6] no se pudo puntear la pieza', err);
        }
      },
    [trasEscribir]
  );
  const confirmarPiezaItem = useMemo(
    () => puntearPiezaAccion((id) => confirmarPieza(id)),
    [puntearPiezaAccion]
  );
  const confirmarPiezaImporteItem = useMemo(
    () => (item: ItemPunteo, importe: number) => puntearPiezaAccion((id, imp) => confirmarPieza(id, imp))(item, Math.abs(importe)),
    [puntearPiezaAccion]
  );
  const despuntearPiezaItem = useMemo(() => puntearPiezaAccion((id) => despuntearPieza(id)), [puntearPiezaAccion]);
  const descartarPiezaItem = useMemo(() => puntearPiezaAccion((id) => descartarPieza(id)), [puntearPiezaAccion]);

  /**
   * `?extracto=1` abre el drawer de §4.7 · lo usan el atajo del Panel y las
   * rutas viejas de importación. Se aplica UNA vez: si no, cerrar el drawer lo
   * reabriría en el siguiente render porque el query sigue en la URL.
   */
  useEffect(() => {
    if (cargando || extractoAplicado) return;
    if (searchParams.get('extracto') == null) return;
    setExtractoAplicado(true);
    setExtracto({ cuenta: null });
  }, [cargando, extractoAplicado, searchParams]);

  /**
   * Cerrar el drawer de extracto limpia también el query que lo abrió.
   *
   * Si no, la URL seguiría diciendo `?extracto=1` con el drawer cerrado:
   * refrescar o compartir ese enlace enseñaría algo distinto de lo que se está
   * viendo. `replace` para no ensuciar el historial con la limpieza.
   */
  const cerrarExtracto = useCallback(() => {
    setExtracto(null);
    if (searchParams.get('extracto') != null) {
      navigate({ pathname: '/tesoreria', search: '' }, { replace: true });
    }
  }, [navigate, searchParams]);

  if (cargando) return null;

  const inmuebles = estado.inmuebles;

  /**
   * De qué inmueble es cada cargo.
   *
   * Los dos drawers declaraban `aliasInmueble` y NADIE se la pasaba nunca, así
   * que `eventoAItem` no podía resolver el nombre y la fila se quedaba sin
   * inmueble en toda la V6: la cuota de una hipoteca no decía de qué piso era.
   * El dato estaba —`inmuebleId` viaja en el evento—, faltaba el puente.
   */
  const aliasInmueble = (id: number | string): string | undefined =>
    inmuebles.find((i) => String(i.id) === String(id))?.alias;

  // §4.11 · en móvil se sirve OTRA pantalla, no esta encogida. Los drawers de
  // extracto y cuenta se comparten: son útiles en las dos y ya son a pantalla
  // casi completa.
  if (esMovil) {
    return (
      <>
        <TesoreriaMovil
          cuentas={cuentasVivas}
          eventos={estado.eventos}
          saldoPorCuenta={saldoPorCuenta}
          saldoHoy={kpis.saldo}
          cierre={kpis.cierre}
          year={year}
          month0={month0}
          onConfirmar={confirmarPrevisto}
          onSubirExtracto={() => setExtracto({ cuenta: null })}
        />
        {/* El deep-link `/tesoreria/cuenta/:id` tiene que funcionar también
            aquí: el drawer ya ocupa casi toda la pantalla y se maneja igual de
            bien con el pulgar, así que se comparte tal cual. */}
        <DrawerCuenta
          cuenta={cuentasVivas.find((c) => c.id === cuentaAbierta) ?? null}
          saldoHoy={cuentaAbierta != null ? saldoPorCuenta.get(cuentaAbierta) ?? 0 : 0}
          eventos={cuentaAbierta != null ? porCuenta.eventos.get(cuentaAbierta) ?? [] : []}
          movimientos={cuentaAbierta != null ? porCuenta.movimientos.get(cuentaAbierta) ?? [] : []}
          year={year}
          month0={month0}
          hoy={hoy}
          onCerrar={cerrarCuenta}
          onIrAlGasto={irAlGasto}
          onRecuperar={recuperarItem}
          onConfirmar={confirmarItem}
          onDescartar={descartarItem}
          onDespuntear={despuntearItem}
          onGuardarFicha={guardarFicha}
        // §7 · el Archivo sabe abrir un documento concreto por `?doc=`.
        onAbrirDocumento={(id) => navigate(`/archivo?doc=${id}`)}
          onEliminar={descartarItem}
          cuentas={cuentasVivas}
          inmuebles={inmuebles}
          tarjetas={tarjetasElegibles}
          onSubirExtracto={(c) => setExtracto({ cuenta: c })}
        />
        {extracto && (
          <DrawerExtracto
            abierto
            cuenta={extracto.cuenta}
            cuentas={cuentasVivas}
            inmuebles={inmuebles}
            tarjetas={tarjetasElegibles}
            onCerrar={cerrarExtracto}
            onGuardado={trasEscribir}
          />
        )}
      </>
    );
  }

  return (
    <div className={styles.pag}>
      {/* ── V9 · héroe navy con el inset del gráfico (P4) ────────────────── */}
      <HeroTesoreria
        kpis={kpis}
        hoy={hoy}
        mesActual={mesActual}
        onSubirExtracto={() => setExtracto({ cuenta: null })}
        grafico={<GraficoTreintaDias serie={serie} />}
      />

      {/* Aviso · duplicados de previstos punteados que dejó el bug (limpieza
          bajo demanda: borra el confirmado suelto, deja la línea del banco). */}
      {numDuplicados > 0 && (
        <div className={styles.dupAviso}>
          <div className={styles.dupText}>
            <strong>{numDuplicados}</strong>{' '}
            {numDuplicados === 1 ? 'movimiento duplicado' : 'movimientos duplicados'} de subidas
            anteriores. Al reconciliarlos, se queda la línea del banco (conciliada) y se borra el
            confirmado repetido.
          </div>
          <button
            type="button"
            className={styles.dupBtn}
            onClick={limpiarDuplicados}
            disabled={limpiandoDup}
          >
            {limpiandoDup ? 'Reconciliando…' : `Reconciliar ${numDuplicados}`}
          </button>
        </div>
      )}

      {/* ── "Mis Bancos" · cuentas y tarjetas comparten espacio (F1) ────── */}
      <MisBancos
        filasCuentas={filasCuentas}
        kpis={kpis}
        mesActual={mesActual}
        onAbrirCuenta={(c) => abrirCuenta(c.id!)}
        onEditarCuenta={(c) => setFichaCuenta({ cuenta: c })}
        onEliminarCuenta={(c) => setBajaCuenta(c)}
        onAnadirCuenta={() => setFichaCuenta({ cuenta: null })}
        onPrevision={() => setCalendario({ year, month0 })}
        cuentaSeleccionada={cuentaSeleccionada}
        onSeleccionarCuenta={setCuentaSeleccionada}
        graficoCuenta={
          diasCuenta && <GraficoDiarioCuenta dias={diasCuenta} hoy={hoy} month0={month0} />
        }
        filasTarjetas={filasTarjetas}
        periodoTarjeta={mesActual}
        tarjetaSeleccionada={tarjetaSeleccionada}
        onSeleccionarTarjeta={setTarjetaSeleccionada}
        graficoTarjeta={
          diasTarjeta && <GraficoDiarioCuenta dias={diasTarjeta} hoy={hoy} month0={month0} />
        }
        onAbrirTarjeta={(t) => setTarjetaAbierta(t)}
        onEditarTarjeta={(t) => setFichaTarjeta({ tarjeta: t })}
        onEliminarTarjeta={(t) => setBajaTarjeta(t)}
        onAnadirTarjeta={() => setFichaTarjeta({ tarjeta: null })}
      />

      {/* Aquí vivían "Cerrar el mes" y "Cómo va {mes}" (F2 · decisión de
          producto): Tesorería mira hacia delante. Cerrar el mes era una
          ceremonia que la pantalla no necesita —el motor sigue ahí, y con él
          el bloqueo de meses cerrados—, y "cómo va" comparaba avance contra el
          mes entero, que a primeros siempre se lee bien y no dice nada.

          Lo que la pantalla contesta —¿tengo para pagar lo que viene?— ya está
          arriba: el hero, la línea de 30 días y "Mis Bancos". */}

      {/* §4.4 · drawer de cuenta · la bandeja de trabajo */}
      <DrawerCuenta
        cuenta={cuentasVivas.find((c) => c.id === cuentaAbierta) ?? null}
        saldoHoy={cuentaAbierta != null ? saldoPorCuenta.get(cuentaAbierta) ?? 0 : 0}
        eventos={cuentaAbierta != null ? porCuenta.eventos.get(cuentaAbierta) ?? [] : []}
        movimientos={cuentaAbierta != null ? porCuenta.movimientos.get(cuentaAbierta) ?? [] : []}
        year={year}
        month0={month0}
        hoy={hoy}
        onCerrar={cerrarCuenta}
        onIrAlGasto={irAlGasto}
        onRecuperar={recuperarItem}
        onConfirmar={confirmarItem}
        onDescartar={descartarItem}
        onDespuntear={despuntearItem}
        onGuardarFicha={guardarFicha}
        onEliminar={descartarItem}
        cuentas={cuentasVivas}
        inmuebles={inmuebles}
        tarjetas={tarjetasElegibles}
        aliasInmueble={aliasInmueble}
        onSubirExtracto={(c) => setExtracto({ cuenta: c })}
      />

      {/* §3.5 · el cajón de una tarjeta · sus compras del periodo en curso y el
          recibo a pagar (que se cobra en su cuenta de liquidación). */}
      <DrawerTarjeta
        tarjeta={tarjetaAbierta}
        banco={
          tarjetaAbierta != null
            ? cuentasVivas.find((c) => c.id === tarjetaAbierta.cuentaLiquidacionId)
            : undefined
        }
        cuentas={cuentasVivas}
        eventos={estado.eventos}
        movimientos={estado.movimientos}
        totalPeriodo={tarjetaAbierta?.id != null ? gastoAbierto.get(tarjetaAbierta.id) ?? 0 : 0}
        hoy={hoy}
        inmuebles={inmuebles}
        tarjetas={tarjetasElegibles}
        onCerrar={() => setTarjetaAbierta(null)}
        onEditarTarjeta={(t) => {
          setTarjetaAbierta(null);
          setFichaTarjeta({ tarjeta: t });
        }}
        onGuardarFicha={guardarFicha}
        onEliminar={descartarItem}
        onConfirmarPieza={confirmarPiezaItem}
        onConfirmarPiezaImporte={confirmarPiezaImporteItem}
        onDespuntearPieza={despuntearPiezaItem}
        onRecuperar={recuperarItem}
        onDescartarPieza={descartarPiezaItem}
      />

      {/* §4.9 · calendario diario · navega entre meses sin cerrarse */}
      {calendario && (
        <DrawerCalendario
          abierto
          year={calendario.year}
          month0={calendario.month0}
          onMes={(y, m) => setCalendario({ year: y, month0: m })}
          eventos={estado.eventos}
          movimientos={estado.movimientos}
          cuentas={cuentasVivas}
          saldoPorCuenta={saldoPorCuenta}
          saldoTotalHoy={kpis.saldo}
          hoy={hoy}
          onIrAlGasto={irAlGasto}
          onRecuperar={recuperarItem}
          onDespuntear={despuntearItem}
          aliasInmueble={aliasInmueble}
          inmuebles={inmuebles}
          tarjetas={tarjetasElegibles}
          onGuardarFicha={guardarFicha}
          onEliminar={descartarItem}
          onCerrar={() => setCalendario(null)}
          onConfirmar={confirmarItem}
          onDescartar={descartarItem}
          onConfirmarDia={confirmarDia}
          // §9 · anotar desde el día · la fecha ya está en pantalla, así que la
          // ficha abre con ella puesta en vez de hacer que se teclee otra vez.
          onAnotar={(fecha) => {
            setCalendario(null);
            setAltaDelDia(fecha);
          }}
        />
      )}

      {/* §9 · alta de movimiento nacida en el drawer del día, con la fecha ya
          puesta: estaba en pantalla, no tiene sentido volver a pedirla. */}
      <FichaMovimiento
        abierta={altaDelDia != null}
        esEdicion={false}
        inicial={
          altaDelDia
            ? {
                tipo: 'gasto',
                concepto: '',
                importe: 0,
                fecha: altaDelDia,
                cuentaId: cuentasVivas[0]?.id ?? null,
              }
            : undefined
        }
        cuentas={cuentasVivas}
        inmuebles={estado.inmuebles}
        tarjetas={tarjetasElegibles}
        onCerrar={() => setAltaDelDia(null)}
        onGuardar={async (v) => {
          await guardarFicha(null, v);
          setAltaDelDia(null);
        }}
      />

      {/* §4.8 · ficha de cuenta · alta, edición y baja */}
      <CuentaWizard
        open={fichaCuenta != null}
        editingAccount={fichaCuenta?.cuenta ?? null}
        onClose={() => setFichaCuenta(null)}
        onSuccess={() => {
          setFichaCuenta(null);
          void trasEscribir();
        }}
      />

      {/* VOCABULARIO §3 · ficha de tarjeta · alta, edición y baja */}
      <TarjetaWizard
        open={fichaTarjeta != null}
        tarjeta={fichaTarjeta?.tarjeta ?? null}
        cuentas={cuentasVivas}
        onClose={() => setFichaTarjeta(null)}
        onSuccess={() => {
          setFichaTarjeta(null);
          void recargarTarjetas();
        }}
      />

      {/* §4.7 · drawer de extracto · dos puertas, un solo flujo */}
      {extracto && (
        <DrawerExtracto
          abierto
          cuenta={extracto.cuenta}
          cuentas={cuentasVivas}
          inmuebles={inmuebles}
          tarjetas={tarjetasElegibles}
          onCerrar={cerrarExtracto}
          onGuardado={trasEscribir}
        />
      )}

      {/* V9 · baja de cuenta desde el "⋯" de la tabla · la baja es SUAVE y se
          bloquea con pendientes (bajaCuentaService), igual que en la ficha. */}
      <ConfirmaV6
        abierto={bajaCuenta != null}
        titulo={`Dar de baja ${bajaCuenta?.alias || bajaCuenta?.banco?.name || 'la cuenta'}`}
        confirmar="Dar de baja"
        trabajando={bajando}
        onConfirmar={() => void confirmarBaja()}
        onCancelar={() => setBajaCuenta(null)}
      >
        La cuenta deja de salir en Tesorería. <b>No se borra nada</b>: su histórico de
        movimientos se conserva y la baja se puede deshacer desde su ficha. Con
        movimientos pendientes, la baja se bloquea hasta confirmarlos o descartarlos.
      </ConfirmaV6>

      {/* V9 · eliminar tarjeta desde el "⋯" de su card. */}
      <ConfirmaV6
        abierto={bajaTarjeta != null}
        titulo={`Eliminar ${bajaTarjeta?.alias ?? 'la tarjeta'}`}
        confirmar="Eliminar tarjeta"
        trabajando={borrandoTarjeta}
        onConfirmar={() => void confirmarBajaTarjeta()}
        onCancelar={() => setBajaTarjeta(null)}
      >
        La tarjeta desaparece de Tesorería. Sus compras y recibos ya anotados{' '}
        <b>no se borran</b>: siguen en sus cuentas y movimientos.
      </ConfirmaV6>

      <ToastHost />
    </div>
  );
};

export default TesoreriaV6Page;
