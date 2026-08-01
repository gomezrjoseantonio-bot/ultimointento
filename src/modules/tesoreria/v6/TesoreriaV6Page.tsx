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
import { calculateAccountBalanceAtDate } from '../../../services/accountBalanceService';
import {
  calcularKpisHero,
  calcularRealidad,
  estadoDeCuenta,
  proyectarMeses,
  type EstadoCuenta,
  type MesProyectado,
} from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo, nombreMes, rangoMeses, fechaLarga, diaYMes } from './formatoV6';
import { leerOrdenCuentas, guardarOrdenCuentas, aplicarOrden } from './ordenCuentas';
import DrawerCuenta from './DrawerCuenta';
import DrawerExtracto from './DrawerExtracto';
import DrawerCalendario from './DrawerCalendario';
import TesoreriaMovil from './TesoreriaMovil';
import { useEsMovil } from './useEsMovil';
import CuentaWizard from '../../../components/cuenta/CuentaWizard';
import {
  confirmTreasuryEvent,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import { descartarPrevisto } from '../../../services/treasuryDiscardService';
import { altaMovimiento } from '../../../services/altaMovimientoService';
import { batchesEnBorrador, sinBorradores } from '../../../services/statementSessionService';
import { registrarDiagnosticoEnConsola } from '../../../services/duplicadosPrevisionService';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import styles from './TesoreriaV6Page.module.css';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

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
    const db = await initDB();
    const [cuentas, eventos, movimientos, properties, ordenGuardado, borradores] =
      await Promise.all([
        db.getAll('accounts') as Promise<Account[]>,
        db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
        db.getAll('movements') as Promise<Movement[]>,
        db.getAll('properties') as Promise<Array<{ id?: number; alias?: string; address?: string }>>,
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

  // FASE 0 · deja `atlasDiagnostico.duplicados()` en la consola. Solo lectura:
  // cuenta previsiones repetidas y dice cuánto distorsionan el cierre. Hace
  // falta porque los datos viven en el navegador y las páginas /dev están
  // apagadas en producción.
  useEffect(() => {
    registrarDiagnosticoEnConsola();
  }, []);

  useEffect(() => {
    const onResize = () => setPorPagina(tarjetasVisibles(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Derivados ────────────────────────────────────────────────────────────

  const cuentasVivas = useMemo(
    () => aplicarOrden(estado.cuentas.filter((c) => c.status !== 'DELETED'), orden),
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
    for (const c of cuentasVivas) {
      if (c.id == null) continue;
      m.set(
        c.id,
        calculateAccountBalanceAtDate({
          account: c,
          cutoffDate: hoy,
          treasuryEvents: porCuenta.eventos.get(c.id) ?? [],
          movements: porCuenta.movimientos.get(c.id) ?? [],
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

  const totalPaginas = Math.max(1, Math.ceil((cuentasVivas.length + 1) / porPagina));
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

  const descartarItem = useCallback(
    async (item: ItemPunteo) => {
      if (item.kind !== 'evento') return;
      try {
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
        if (item == null || item.kind !== 'evento' || v.esMejora) {
          // La previsión que dio origen a la mejora deja de estar pendiente: si
          // se quedara, seguiría proyectando un gasto que ya se registró como
          // inversión, y el cierre saldría dos veces peor de lo que es.
          if (item?.kind === 'evento' && v.esMejora) {
            await descartarPrevisto(item.refId, 'registrada como mejora del inmueble');
          }
          await altaMovimiento({
            tipo: v.tipo,
            concepto: v.concepto,
            importe: v.importe,
            fecha: v.fecha,
            cuentaId: v.cuentaId,
            inmuebleId: v.inmuebleId ?? null,
            categoryKey: v.categoryKey ?? null,
            subtypeKey: v.subtypeKey ?? null,
            esMejora: v.esMejora,
            cuentaDestinoId: v.cuentaDestinoId,
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
    [trasEscribir]
  );

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
          onGuardarFicha={guardarFicha}
          onEliminar={descartarItem}
          cuentas={cuentasVivas}
          inmuebles={inmuebles}
          onSubirExtracto={(c) => setExtracto({ cuenta: c })}
        />
        {extracto && (
          <DrawerExtracto
            abierto
            cuenta={extracto.cuenta}
            cuentas={cuentasVivas}
            inmuebles={inmuebles}
            onCerrar={cerrarExtracto}
            onGuardado={trasEscribir}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {/* ── §4.1 · Hero ─────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroLab}>
          <div className={styles.heroTitle}>
            <span className={styles.heroDot} /> Mi tesorería
          </div>
          <div className={styles.heroDate}>{fechaLarga(hoy)}</div>
        </div>

        <Kpi
          lab="Saldo"
          val={importeSaldo(kpis.saldo)}
          sub={`${kpis.numCuentas} ${kpis.numCuentas === 1 ? 'cuenta' : 'cuentas'} · hoy`}
        />
        <Kpi
          lab="Queda entrar"
          val={importeConSigno(kpis.pendienteEntrar)}
          sub={`${kpis.movimientosEntrar} ${kpis.movimientosEntrar === 1 ? 'movimiento' : 'movimientos'} · ${mesActual}`}
        />
        <Kpi
          lab="Queda salir"
          val={importeConSigno(kpis.pendienteSalir)}
          sub={`${kpis.movimientosSalir} ${kpis.movimientosSalir === 1 ? 'movimiento' : 'movimientos'} · ${mesActual}`}
        />
        <Kpi
          lab={`Cierre · ${mesActual}`}
          val={importeSaldo(kpis.cierre)}
          sub={`proyectado a día ${kpis.ultimoDia}`}
          gold
        />

        <div className={styles.heroAct}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            onClick={() => setExtracto({ cuenta: null })}
          >
            <Icons.Upload size={15} strokeWidth={1.8} /> Subir extracto
          </button>
        </div>
      </div>

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
              <button
                type="button"
                className={styles.accAdd}
                onClick={() => setFichaCuenta({ cuenta: null })}
              >
                <Icons.Plus size={16} strokeWidth={2} /> Añadir cuenta
              </button>
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

      <div className={styles.cols}>
        {/* ── §4.3 · Rejilla de 6 meses ─────────────────────────────────── */}
        <section className={styles.sec}>
          <div className={styles.secHd}>
            <div>
              <div className={styles.secK}>
                Movimientos bancarios · próximos 6 meses
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
        onGuardarFicha={guardarFicha}
        onEliminar={descartarItem}
        cuentas={cuentasVivas}
        inmuebles={inmuebles}
        onSubirExtracto={(c) => setExtracto({ cuenta: c })}
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

      {/* §4.7 · drawer de extracto · dos puertas, un solo flujo */}
      {extracto && (
        <DrawerExtracto
          abierto
          cuenta={extracto.cuenta}
          cuentas={cuentasVivas}
          inmuebles={inmuebles}
          onCerrar={cerrarExtracto}
          onGuardado={trasEscribir}
        />
      )}
    </div>
  );
};

// ─── Sub-componentes ────────────────────────────────────────────────────────

const Kpi: React.FC<{ lab: string; val: string; sub: string; gold?: boolean }> = ({ lab, val, sub, gold }) => (
  <div className={styles.hk}>
    <div className={styles.hkLab}>{lab}</div>
    <div className={`${styles.hkVal} ${gold ? styles.hkValGold : ''}`}>{val}</div>
    <div className={styles.hkSub}>{sub}</div>
  </div>
);

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
      <div className={styles.mesFlow}>
        <span className={styles.ff}>
          <Icons.ArrowUp size={14} strokeWidth={1.8} />
          <span className={styles.fv}>{importeConSigno(mes.entra)}</span>
        </span>
        <span className={styles.ff}>
          <Icons.ArrowDown size={14} strokeWidth={1.8} />
          <span className={styles.fv}>{importeConSigno(-Math.abs(mes.sale))}</span>
        </span>
      </div>
      {mes.enCurso && <div className={styles.mesQueda}>queda entrar · queda salir</div>}
    </button>
  );
};

const BloqueRealidad: React.FC<{ realidad: ReturnType<typeof calcularRealidad> }> = ({ realidad }) => {
  const mejor = realidad.desviacion >= 0;
  return (
    <div className={styles.rvcard}>
      {realidad.lineas.map((l) => {
        const neto = l.clave === 'Neto';
        // A3 · el Neto NO lleva barra: puede ser negativo, y "más lleno" se
        // leería como "mejor" cuando significa que se ha gastado de más. En su
        // lugar enseña real, previsto y la diferencia con signo.
        const diferencia = Math.round((l.real - l.previsto) * 100) / 100;
        // Barra escalada contra SU PROPIO previsto, no contra el máximo global.
        const ancho =
          l.porcentaje == null ? 0 : Math.min(100, Math.max(2, Math.abs(l.porcentaje)));
        return (
          <div key={l.clave} className={styles.rvline}>
            <div className={styles.rvlab}>{l.clave}</div>
            {neto ? (
              <div className={styles.rvdelta}>
                <span className={l.peorQuePrevisto ? styles.rvdeltaWarn : ''}>
                  {importeConSigno(diferencia)}
                </span>
                {/* Cuando real y previsto coinciden no es ni mejor ni peor:
                    decir "mejor" sobre una diferencia de 0 € se lee como que se
                    ha ganado algo que no existe. */}
                <small>
                  {diferencia === 0
                    ? 'igual que lo previsto'
                    : l.peorQuePrevisto
                      ? 'peor de lo previsto'
                      : 'mejor de lo previsto'}
                </small>
              </div>
            ) : (
              <>
                <div className={styles.rvbar}>
                  <div
                    className={`${styles.rvfill} ${styles.rvfillIn}`}
                    style={{ width: `${ancho}%` }}
                  />
                </div>
                <span className={styles.rvpct}>{l.porcentaje}%</span>
              </>
            )}
            <div className={styles.rvnum}>
              {importeSaldo(l.real)}
              <small>de {importeSaldo(l.previsto)} previsto</small>
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
            Acabarás <b>{importeConSigno(realidad.desviacion)}</b> {mejor ? 'mejor' : 'peor'} de lo previsto
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
