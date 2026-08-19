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
import { Icons } from '../../../design-system/v5';
import { initDB, type Account, type Movement, type TreasuryEvent } from '../../../services/db';
import { calculateAccountBalanceAtDate, corteParaSaldoVivo } from '../../../services/accountBalanceService';
import {
  calcularKpisHero,
  calcularRealidad,
  estadoDeCuenta,
  proyectarMeses,
  type EstadoCuenta,
  type MesProyectado,
} from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { importeConSigno, importeSaldo, nombreMes, rangoMeses, diaYMes } from './formatoV6';
import HeroTesoreria from './HeroTesoreria';
import { leerOrdenCuentas, guardarOrdenCuentas, aplicarOrden } from './ordenCuentas';
import DrawerCuenta from './DrawerCuenta';
import DrawerTarjeta from './DrawerTarjeta';
import DrawerExtracto from './DrawerExtracto';
import DrawerCalendario from './DrawerCalendario';
import CerrarElMes from './CerrarElMes';
import TesoreriaMovil from './TesoreriaMovil';
import { useEsMovil } from './useEsMovil';
import CuentaWizard from '../../../components/cuenta/CuentaWizard';
import TarjetaWizard from '../../../components/tarjeta/TarjetaWizard';
import { listarTarjetas } from '../../../services/tarjetasService';
import { regenerarRecibosDeTarjeta } from '../../../services/personal/compromisosRecurrentesService';
import { confirmarPieza, despuntearPieza, descartarPieza } from '../../../services/personal/puntearPieza';
import {
  contarDuplicadosPunteados,
  reconciliarDuplicadosExistentes,
} from '../../../services/reconciliarDuplicadosExistentes';
import type { Tarjeta } from '../../../types/tarjetas';
import { describirTarjeta } from './textoTarjeta';
import { gastoDeMovimientos, gastoPorTarjeta, gastoAbiertoPorTarjeta } from '../../../services/gastoPorTarjeta';
import {
  confirmTreasuryEvent,
  revertTreasuryConfirmation,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import { descartarPrevisto } from '../../../services/treasuryDiscardService';
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

/** Tarjetas visibles según ancho · 5 ≥1240px · 4 ≥1000px · 3 por debajo (§4.2). */
function tarjetasVisibles(ancho: number): number {
  if (ancho >= 1240) return 5;
  if (ancho >= 1000) return 4;
  return 3;
}

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
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(() =>
    tarjetasVisibles(typeof window === 'undefined' ? 1280 : window.innerWidth)
  );
  const [orden, setOrden] = useState<number[]>([]);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [encima, setEncima] = useState<number | null>(null);
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

  const hoy = hoyISO();
  const ahora = useMemo(() => new Date(`${hoy}T12:00:00`), [hoy]);
  const year = ahora.getFullYear();
  const month0 = ahora.getMonth();

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

  useEffect(() => {
    const onResize = () => setPorPagina(tarjetasVisibles(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  const meses = useMemo(
    () => proyectarMeses({ saldoHoy: kpis.saldo, eventos: estado.eventos, year, month0, hoy }),
    [kpis.saldo, estado.eventos, year, month0, hoy]
  );

  const realidad = useMemo(
    () => calcularRealidad({ eventos: estado.eventos, movimientos: estado.movimientos, year, month0 }),
    [estado.eventos, estado.movimientos, year, month0]
  );

  // Sin el `+1` de la tarjeta fantasma de "Añadir cuenta": ya no está en la
  // tira, así que la paginación cuenta solo cuentas de verdad y el rótulo
  // "1–5 de N" dice la verdad.
  const totalPaginas = Math.max(1, Math.ceil(cuentasVivas.length / porPagina));
  const pageSafe = Math.min(pagina, totalPaginas - 1);

  // Si al redimensionar (cambia `porPagina`) o al borrar cuentas la página
  // actual se queda fuera de rango, hay que corregir el ESTADO y no solo el
  // render: si no, "anterior" decrementa un número invisible y hacen falta
  // varios clics para que se mueva algo.
  useEffect(() => {
    setPagina((p) => (p > totalPaginas - 1 ? Math.max(0, totalPaginas - 1) : p));
  }, [totalPaginas]);

  // ── Reordenar cuentas · se persiste el orden del usuario (§4.2) ──────────

  const soltarSobre = async (destinoId: number) => {
    if (arrastrando == null || arrastrando === destinoId) return;
    const ids = cuentasVivas.map((c) => c.id!).filter((x) => x != null);
    const from = ids.indexOf(arrastrando);
    const to = ids.indexOf(destinoId);
    if (from < 0 || to < 0) return;
    const nuevo = [...ids];
    nuevo.splice(to, 0, ...nuevo.splice(from, 1));
    setOrden(nuevo);
    setArrastrando(null);
    setEncima(null);
    try {
      await guardarOrdenCuentas(nuevo);
    } catch (err) {
      // El orden ya se ha aplicado en pantalla; que no se haya podido guardar
      // es una preferencia perdida, no un motivo para romper la interacción.
      console.warn('[TesoreriaV6] no se pudo guardar el orden de las cuentas', err);
    }
  };

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
  const mesActual = nombreMes(month0);

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

      {/* ── §4.2 · Carrusel de cuentas ──────────────────────────────────── */}
      <section className={styles.sec}>
        <div className={styles.secHd}>
          <div>
            <div className={styles.secK}>Saldo actual en mis cuentas</div>
            <div className={styles.secT}>entra en una cuenta para ver el detalle de movimientos</div>
          </div>
          <button
            type="button"
            className={styles.secAdd}
            onClick={() => setFichaCuenta({ cuenta: null })}
          >
            <Icons.Plus size={14} strokeWidth={2} /> Añadir cuenta
          </button>
          {cuentasVivas.length > porPagina && (
            <span className={styles.rngRight}>
              {pageSafe * porPagina + 1}–{Math.min((pageSafe + 1) * porPagina, cuentasVivas.length)} de{' '}
              {cuentasVivas.length}
            </span>
          )}
        </div>

        <div className={styles.carr}>
          {/* La flecha deshabilitada es INVISIBLE, no un hueco gris (§4.2). */}
          <button
            type="button"
            aria-label="Cuentas anteriores"
            className={`${styles.pager} ${styles.pagerPrev} ${pageSafe === 0 ? styles.pagerOff : ''}`}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <Icons.ChevronLeft size={18} strokeWidth={2.2} />
          </button>

          <div className={styles.viewport}>
            <div
              className={styles.track}
              style={
                {
                  '--pp': porPagina,
                  transform: `translateX(calc(-${pageSafe} * (100% + 12px)))`,
                } as React.CSSProperties
              }
            >
              {cuentasVivas.map((c) => (
                <TarjetaCuenta
                  key={c.id}
                  cuenta={c}
                  saldo={saldoPorCuenta.get(c.id!) ?? 0}
                  estado={estadoDeCuenta({
                    saldoHoy: saldoPorCuenta.get(c.id!) ?? 0,
                    eventos: porCuenta.eventos.get(c.id!) ?? [],
                    year,
                    month0,
                    hoy,
                  })}
                  arrastrando={arrastrando === c.id}
                  encima={encima === c.id}
                  onDragStart={() => setArrastrando(c.id!)}
                  onDragEnter={() => setEncima(c.id!)}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setEncima(null);
                  }}
                  onDrop={() => void soltarSobre(c.id!)}
                  onAbrir={() => abrirCuenta(c.id!)}
                  onEditar={() => setFichaCuenta({ cuenta: c })}
                />
              ))}
              {/* §4.2 · "Añadir cuenta" NO va dentro del carrusel.
                  Ya está arriba, junto al rótulo de la sección, y repetirlo
                  aquí lo mete en la paginación: una tarjeta fantasma que hace
                  que la tira diga "1–5 de 9" contando algo que no es una
                  cuenta, y que empuja las de verdad a la página siguiente. */}
            </div>
          </div>

          <button
            type="button"
            aria-label="Cuentas siguientes"
            className={`${styles.pager} ${styles.pagerNext} ${pageSafe >= totalPaginas - 1 ? styles.pagerOff : ''}`}
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          >
            <Icons.ChevronRight size={18} strokeWidth={2.2} />
          </button>
        </div>
      </section>

      {/* ── VOCABULARIO §3 · Tarjetas ────────────────────────────────────
          Van debajo de las cuentas y NO dentro del carrusel: una tarjeta no
          tiene saldo, tiene un ciclo. Meterla entre las cuentas es lo que
          llevaba a creer que era una cuenta más. */}
      <section className={styles.sec}>
        <div className={styles.secHd}>
          <div>
            <div className={styles.secK}>Mis tarjetas</div>
            <div className={styles.secT}>
              lo que gastas con una de crédito sale entero el día de cargo, en su cuenta
            </div>
          </div>
          <button
            type="button"
            className={styles.secAdd}
            onClick={() => setFichaTarjeta({ tarjeta: null })}
          >
            <Icons.Plus size={14} strokeWidth={2} /> Añadir tarjeta
          </button>
        </div>

        {tarjetas.length === 0 ? (
          <div className={styles.tjVacio}>
            Todavía no has dado de alta ninguna tarjeta.
          </div>
        ) : (
          <div className={styles.tjLista}>
            {tarjetas.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.tjItem}
                onClick={() => setTarjetaAbierta(t)}
              >
                <span className={styles.tjAlias}>{t.alias}</span>
                <span className={styles.tjSub}>{describirTarjeta(t, cuentasVivas)}</span>
                {/* §3.5 · lo que llevas gastado con ella en el periodo que aún
                    no ha cerrado · es una cifra VIVA, crece con cada compra. */}
                {gastoAbierto.get(t.id!) != null && (
                  <span className={styles.tjGasto}>
                    Llevas {importeSaldo(gastoAbierto.get(t.id!)!)} este periodo
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className={styles.cols}>
        {/* ── §4.3 · Rejilla de 6 meses ─────────────────────────────────── */}
        <section className={styles.sec}>
          <div className={styles.secHd}>
            <div>
              <div className={styles.secK}>
                {/* "Previstos" y no "próximos 6 meses": el cuántos ya lo dicen
                    las seis tarjetas de debajo, y el desde-hasta lo dice el
                    rango que va al lado. Lo que no se sabía es que esto son
                    previsiones y no lo que ya ha pasado. */}
                Movimientos bancarios previstos
                <span className={styles.rng}>{rangoMeses(meses[0], meses[meses.length - 1])}</span>
              </div>
              <div className={styles.secT}>
                concilia lo previsto contra lo real · toca un mes para ver los días
              </div>
            </div>
          </div>
          <div className={styles.mesgrid}>
            {meses.map((m) => (
              <TarjetaMes
                key={`${m.year}-${m.month0}`}
                mes={m}
                onAbrir={() => setCalendario({ year: m.year, month0: m.month0 })}
              />
            ))}
          </div>
        </section>

        {/* ── §4.10 · Cómo va {mes} ─────────────────────────────────────── */}
        <section className={styles.sec}>
          <div className={styles.secHd}>
            <div>
              <div className={styles.secK}>Cómo va {mesActual}</div>
              <div className={styles.secT}>cuánto llevas de lo previsto para {mesActual}</div>
            </div>
          </div>
          <BloqueRealidad realidad={realidad} />
        </section>
      </div>

      {/* ── VOCABULARIO §6 quater · cerrar el mes ─────────────────────────
          Va al final y detrás de lo que viene: mirar hacia delante es el
          trabajo de todos los días, y cerrar es el de una vez al mes. Pero
          tiene que estar AQUÍ, en tesorería, porque lo que se cierra son las
          previsiones de tesorería — y de que un mes esté cerrado depende que
          una bonificación se pueda perder. */}
      <CerrarElMes hoy={hoy} onCambio={trasEscribir} />

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
    </div>
  );
};

// ─── Sub-componentes ────────────────────────────────────────────────────────

const TarjetaCuenta: React.FC<{
  cuenta: Account;
  saldo: number;
  estado: EstadoCuenta;
  arrastrando: boolean;
  encima: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onAbrir: () => void;
  onEditar: () => void;
}> = ({ cuenta, saldo, estado, arrastrando, encima, onDragStart, onDragEnter, onDragEnd, onDrop, onAbrir, onEditar }) => {
  const nombre = cuenta.alias || cuenta.name || cuenta.banco?.name || 'Cuenta';
  const mask = (cuenta.ultimosCuatro || cuenta.iban?.slice(-4)) ?? '';

  return (
    <div
      className={`${styles.acc} ${estado.tipo === 'se-queda-corta' ? styles.accCorta : ''} ${
        arrastrando ? styles.accDragging : ''
      } ${encima ? styles.accOver : ''}`}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAbrir();
        }
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <div className={styles.accTop}>
        <span className={styles.bankDot} style={{ background: colorDeBanco(cuenta) }} />
        <div className={styles.accId}>
          <div className={styles.accNm}>{nombre}</div>
          {mask && <div className={styles.accMask}>···· {mask}</div>}
        </div>
        {/* stopPropagation obligatorio: la tarjeta entera es clicable (§4.2). */}
        <button
          type="button"
          className={styles.accEd}
          aria-label={`Editar ${nombre}`}
          onClick={(e) => {
            e.stopPropagation();
            onEditar();
          }}
        >
          <Icons.Edit size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className={styles.accBal}>{importeSaldo(saldo)}</div>

      <div className={styles.accFoot}>
        <EstadoTarjeta estado={estado} />
      </div>
    </div>
  );
};

/** Un solo estado por tarjeta · el color solo aparece si hay que actuar (§4.2). */
const EstadoTarjeta: React.FC<{ estado: EstadoCuenta }> = ({ estado }) => {
  if (estado.tipo === 'se-queda-corta') {
    return (
      <span className={`${styles.state} ${styles.stateAlerta}`}>
        <span className={styles.stateDot} />
        se queda en <span className={styles.stateVal}>{importeSaldo(estado.minimo)}</span> el {diaYMes(estado.dia)}
      </span>
    );
  }
  if (estado.tipo === 'por-confirmar') {
    // Texto gris, sin chip de fondo (§4.2).
    return <span className={styles.state}>{estado.n} por confirmar</span>;
  }
  return <span className={styles.state}>al día</span>;
};

const TarjetaMes: React.FC<{ mes: MesProyectado; onAbrir: () => void }> = ({ mes, onAbrir }) => {
  const nombre = nombreMes(mes.month0);
  const titulo = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return (
    <button
      type="button"
      className={`${styles.mes} ${mes.enCurso ? styles.mesNow : ''}`}
      onClick={onAbrir}
      aria-label={`Ver los días de ${titulo}`}
    >
      <div className={styles.mesTop}>
        <span className={styles.mesNm}>{titulo}</span>
        {mes.enCurso && <span className={styles.mesChip}>en curso</span>}
      </div>
      {/* Vocabulario único: "Cierre" en todo el módulo (§4.3). */}
      <div className={styles.mesLab}>Cierre</div>
      <div className={styles.mesBal}>{importeSaldo(mes.cierre)}</div>
      {/* §4.3 · el pie lleva SIGNO como el resto de la pantalla (§2.2): la
          flecha dice la dirección de un vistazo, pero el importe se escribe
          igual aquí que en el hero o en el drawer.

          Y en el mes en curso la etiqueta es texto VISIBLE, no un `title`: los
          táctiles no enseñan tooltips, y no es lo mismo lo que entra en el mes
          que lo que QUEDA por entrar. */}
      {/* §4.3 · en el mes en curso, cada columna lleva SU etiqueta encima.
          Iban las dos juntas en una línea debajo ("queda entrar · queda salir"),
          y así no se sabía cuál era cuál: la etiqueta tiene que estar sobre su
          cifra, no al lado de la otra. */}
      <div className={styles.mesFlow}>
        <span className={styles.ff}>
          {mes.enCurso && <span className={styles.ffLab}>queda entrar</span>}
          <span className={styles.ffVal}>
            <Icons.ArrowUp size={14} strokeWidth={1.8} />
            <span className={styles.fv}>{importeConSigno(mes.entra)}</span>
          </span>
        </span>
        <span className={styles.ff}>
          {mes.enCurso && <span className={styles.ffLab}>queda salir</span>}
          <span className={styles.ffVal}>
            <Icons.ArrowDown size={14} strokeWidth={1.8} />
            <span className={styles.fv}>{importeConSigno(-Math.abs(mes.sale))}</span>
          </span>
        </span>
      </div>
    </button>
  );
};

/* §4.10 · ¿cabe el importe DENTRO del relleno de la barra?
 *
 * Si el relleno no da para el texto, el importe sale FUERA, a su derecha.
 * Ensanchar el relleno para que quepa sería falsear la proporción, que es justo
 * lo que la barra viene a decir.
 *
 * El umbral es 40 % y no 22 %: con 22 el texto entraba pero se salía del
 * relleno por la derecha, que es exactamente el aspecto que se quería evitar.
 * Un importe con miles y dos decimales necesita más de un tercio de la barra.
 *
 * Se exporta para que el candado apriete sobre ESTA función y no sobre una
 * copia del número escrita en el test. */
export const importeCabeEnLaBarra = (anchoPct: number): boolean => anchoPct >= 40;

/* Dónde empieza el importe que NO cabe dentro del relleno: justo detrás de él.
 *
 * Probé a toparlo por la derecha —`min(…, calc(100% - 78px))`— para que no se
 * saliera de la barra, y en barras estrechas el tope lo devolvía ENCIMA del
 * relleno: tinta oscura sobre navy, ilegible. Que un importe asome por la
 * derecha se lee; que se monte sobre el relleno, no. Quien le da sitio es la
 * rejilla de `.rvline`, que estrecha sus columnas fijas antes que la barra. */
export const posicionImporteFuera = (anchoPct: number): string =>
  `calc(${anchoPct}% + 8px)`;

const BloqueRealidad: React.FC<{ realidad: ReturnType<typeof calcularRealidad> }> = ({ realidad }) => {
  const mejor = realidad.desviacion >= 0;
  return (
    <div className={styles.rvcard}>
      {realidad.lineas.map((l) => {
        // §3.4 · el Neto pierde la barra SOLO cuando es negativo.
        //
        // Me pasé de largo y la quité siempre. Lo que no funciona con
        // magnitudes negativas es el porcentaje de avance: "128 % lleno" se lee
        // como mejor cuando significa haber gastado de más. Pero con un neto
        // positivo la barra dice justo lo que tiene que decir —cuánto llevas de
        // lo previsto— y el mockup la mantiene.
        // §3.4 · la fila pierde la barra cuando NO hay porcentaje que pintar:
        // eso pasa con el Neto en negativo, que es justo el caso en que un
        // avance engaña. Con porcentaje, barra.
        const sinBarra = l.porcentaje == null;
        // Barra escalada contra SU PROPIO previsto, no contra el máximo global.
        const ancho =
          l.porcentaje == null ? 0 : Math.min(100, Math.max(2, Math.abs(l.porcentaje)));
        return (
          <div key={l.clave} className={styles.rvline}>
            <div className={styles.rvlab}>{l.clave}</div>
            {/* Las TRES filas dicen lo mismo: lo que llevas, a la izquierda, y
                lo previsto del mes, a la derecha. Con porcentaje, la cifra va
                dentro de la barra; sin porcentaje —el Neto en negativo— va
                sola, en el hueco de la barra.

                Aquí la fila del Neto enseñaba otra cosa: la resta contra el
                previsto del MES ENTERO, rotulada "mejor/peor de lo previsto".
                Dos problemas. Uno, el número gordo de la fila "Neto" no era el
                neto (+935,74 € cuando el neto eran 487,30 €). Y dos, ese
                veredicto contradecía al del pie —"acabarás −38 € peor de lo
                previsto"— porque comparaba medio mes contra un mes entero, y
                así a primeros SIEMPRE sale "mejor". El veredicto es uno y está
                en el pie, que sí compara iguales. */}
            {sinBarra ? (
              <div className={styles.rvsolo}>
                <span>{importeSaldo(l.real)}</span>
                <small>llevas</small>
              </div>
            ) : (
              /* El importe REAL va dentro de la barra, sobre lo que lleva
                 recorrido: la cifra y su proporción se leen de una sola mirada
                 en vez de saltar de la barra a una columna.

                 Cuándo cabe dentro lo decide `importeCabeEnLaBarra`. */
              <div className={styles.rvbar}>
                <div
                  className={`${styles.rvfill} ${l.clave === 'Neto' ? styles.rvfillNet : styles.rvfillIn}`}
                  style={{ width: `${ancho}%` }}
                >
                  {importeCabeEnLaBarra(ancho) && (
                    <span className={styles.rvenBarra}>{importeSaldo(l.real)}</span>
                  )}
                </div>
                {!importeCabeEnLaBarra(ancho) && (
                  <span className={styles.rvFueraBarra} style={{ left: posicionImporteFuera(ancho) }}>
                    {importeSaldo(l.real)}
                  </span>
                )}
              </div>
            )}
            {/* Sin porcentaje no se pinta un "%" suelto: un signo sin
                número delante no dice nada y parece un dato que falta. Pero la
                celda se queda: es lo que mantiene los importes de las tres
                filas en la misma vertical. */}
            {/* El % en el color de SU barra · el Neto va en oro, como su
                relleno: si la barra es dorada y el número azul, parecen
                dos datos distintos. */}
            <span className={`${styles.rvpct} ${l.clave === 'Neto' ? styles.rvpctNet : ''}`}>
              {l.porcentaje != null ? `${l.porcentaje}%` : ''}
            </span>
            <div className={styles.rvnum}>
              {importeSaldo(l.previsto)}
              <small>previsto</small>
            </div>
          </div>
        );
      })}

      <div className={styles.rvsep} />

      {/* El cierre del bloque es la DESVIACIÓN, no el cierre: ese ya está en
          el hero y repetirlo no aporta (§4.10). */}
      <div className={styles.rvend}>
        <div className={styles.rvendIc}>
          {mejor ? <Icons.ArrowUp size={18} strokeWidth={2.2} /> : <Icons.ArrowDown size={18} strokeWidth={2.2} />}
        </div>
        <div>
          <div className={styles.rvendTt}>
            {/* Con 0 no es ni mejor ni peor · el mismo caso que la línea del
                Neto, que también decía "mejor" sobre una diferencia nula. */}
            {realidad.desviacion === 0 ? (
              <>Acabarás <b>igual que lo previsto</b></>
            ) : (
              <>
                Acabarás <b>{importeConSigno(realidad.desviacion)}</b>{' '}
                {mejor ? 'mejor' : 'peor'} de lo previsto
              </>
            )}
          </div>
          <div className={styles.rvendSs}>
            de lo ya confirmado, habías previsto pagar <b>{importeSaldo(realidad.previstoDeLoConfirmado)}</b> y has
            pagado <b>{importeSaldo(realidad.pagadoReal)}</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TesoreriaV6Page;
