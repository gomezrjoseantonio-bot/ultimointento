// Tesorería V6 · §4.7 · drawer · subir extracto · ÚNICO sitio para subirlos.
//
// La cuenta se detecta por IBAN (o ya viene fijada); un PDF de banco lo lee la
// IA; un extracto de TARJETA se concilia aparte (§3, `PanelExtractoTarjeta`).
// Paso 1 · dropzone. Paso 2 · emparejamiento (asignar · crear · ignorar). Un solo
// botón Guardar consolida; el aspa sale SIN guardar y borra el batch.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { initDB } from '../../../services/db';
import { nombrarPrevisto as nombrarPrevistoModelo } from './nombrarPrevisto';
import {
  processFile,
  processPdf,
  confirmDecisions,
  cancelImportBatch,
  StatementAlreadyImportedError,
  type OrchestratorResult,
} from '../../../services/bankStatementOrchestrator';
import { getIgnoredLineHashes, ignoreLine, recoverLine } from '../../../services/statementIgnoredLinesService';
import { confirmadosPorLinea } from '../../../services/conciliacionConfirmados';
import { consolidarSesion, archivarExtracto } from '../../../services/statementSessionService';
import { cierres } from '../../../services/cierreDeMes';
import {
  AVISO_GASTO_FISCAL,
  gastoDesdeMovimiento,
  mejoraDesdeMovimiento,
  origenIdRecurrenteDelGasto,
} from '../../../services/altaMovimientoService';
import {
  construirLineas,
  veredictoEfectivo,
  resumir,
  payloadDeConfirmacion,
  seOfrecePara,
  lineasAIgnorar,
  movimientosAEfectivo,
  movimientosATraspaso,
  contarIgualesSinResolver, idsIgualesAResolver, claveDeLineaIgual,
  lineasPendientes,
  hashesARecuperar,
  decisionesVacias,
  type LineaExtracto,
  type DecisionesSesion,
} from './extractoSesion';
import LineaExtractoItem from './LineaExtractoItem';
import { detectarCuenta, type DeteccionCuenta } from './detectarCuenta';
import { esPdf } from '../../../services/personal/extractoTarjeta';
import PanelExtractoTarjeta from './PanelExtractoTarjeta';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { colorDeBanco } from './bancoColores';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { convertirEnTraspaso } from '../../../services/traspasoDesdeMovimiento';
import GrupoPlegableExtracto from './GrupoPlegableExtracto';
import chasis from './DrawerV6.module.css';
import styles from './DrawerExtracto.module.css';

type Paso = 'soltar' | 'procesando' | 'resolver' | 'guardando';

export interface DrawerExtractoProps {
  abierto: boolean;
  /** Fijada al entrar desde una cuenta · `null` = puerta global (hero). */
  cuenta: Account | null;
  cuentas: Account[];
  /** Para la ficha de §4.5 que abre "Crear movimiento". */
  inmuebles: Array<{ id: number; alias: string }>;
  /** Las tarjetas, para el selector de la ficha (§3.5). */
  tarjetas?: Array<{ id: number; alias: string }>;
  onCerrar: () => void;
  /** Tras guardar · la pantalla recarga saldos. */
  onGuardado: () => void | Promise<void>;
}

const DrawerExtracto: React.FC<DrawerExtractoProps> = ({
  abierto,
  cuenta,
  cuentas,
  inmuebles,
  tarjetas = [],
  onCerrar,
  onGuardado,
}) => {
  const [paso, setPaso] = useState<Paso>('soltar');
  const [error, setError] = useState<string | null>(null);
  const [avisoReimport, setAvisoReimport] = useState<{ mensaje: string; file: File } | null>(null);
  const [cuentaElegida, setCuentaElegida] = useState<Account | null>(cuenta);
  const [deteccion, setDeteccion] = useState<DeteccionCuenta | null>(null);
  // Fichero de TARJETA · el destino no es una cuenta, se concilia aparte (§3).
  const [tarjetaDestino, setTarjetaDestino] = useState<{ id: number; alias: string } | null>(null);
  const [resultado, setResultado] = useState<OrchestratorResult | null>(null);
  const [lineas, setLineas] = useState<LineaExtracto[]>([]);
  const [decisiones, setDecisiones] = useState<DecisionesSesion>(decisionesVacias);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [traspasando, setTraspasando] = useState<number | null>(null);
  const [previstos, setPrevistos] = useState<TreasuryEvent[]>([]);
  const [ignoradasPlegadas, setIgnoradasPlegadas] = useState(true);
  const [cerradosPlegados, setCerradosPlegados] = useState(true);
  const [anterioresPlegados, setAnterioresPlegados] = useState(true);

  // El previsto se nombra con el MISMO adaptador que el resto de la app: título
  // = quién · qué es · inmueble (no su `description` en crudo).
  const aliasInmueble = useCallback(
    (id: number | string) => inmuebles.find((i) => String(i.id) === String(id))?.alias,
    [inmuebles],
  );
  const nombrarPrevisto = useCallback(
    (ev: TreasuryEvent): string => nombrarPrevistoModelo(ev, aliasInmueble),
    [aliasInmueble],
  );
  const nombrarPrevistoPorId = useCallback(
    (id: number | null | undefined, respaldo: string): string => {
      const ev = id != null ? previstos.find((p) => p.id === id) : undefined;
      return ev ? nombrarPrevisto(ev) : respaldo;
    },
    [previstos, nombrarPrevisto],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  /** Fichero a la espera de que el usuario elija destino (puerta global). */
  const pendienteRef = useRef<File | null>(null);
  /** El fichero de la sesión en curso · se archiva al guardar. */
  const ficheroRef = useRef<File | null>(null);
  /** Línea para la que se ha abierto la ficha con "Crear movimiento". */
  const [creando, setCreando] = useState<LineaExtracto | null>(null);

  const cuentaActiva = cuenta ?? cuentaElegida;
  const resumen = useMemo(() => resumir(lineas, decisiones), [lineas, decisiones]);

  // ── Reiniciar ──────────────────────────────────────────────────────────────
  const reiniciar = useCallback(() => {
    setPaso('soltar');
    setError(null);
    setAvisoReimport(null);
    setResultado(null);
    setLineas([]);
    setDecisiones(decisionesVacias());
    setDeteccion(null);
    setTarjetaDestino(null);
    setAsignando(null);
    setTraspasando(null);
    setCreando(null);
    ficheroRef.current = null;
    pendienteRef.current = null;
    setIgnoradasPlegadas(true);
    if (!cuenta) setCuentaElegida(null);
  }, [cuenta]);

  // ── Procesar ───────────────────────────────────────────────────────────────
  const procesar = useCallback(
    async (file: File, destino: Account, allowReimport = false) => {
      if (destino.id == null) return;
      setPaso('procesando');
      setError(null);
      setAvisoReimport(null);
      try {
        // PDF de banco → IA; xls/csv/N43 → SheetJS. Misma revisión (Paso 2).
        const opc = { accountId: destino.id, allowReimport };
        const res = esPdf(file) ? await processPdf(file, opc) : await processFile(file, opc);
        ficheroRef.current = file;
        const db = await initDB();
        const [todosMovs, todosEventos, ignoradasPrevias, mesesCerrados] = await Promise.all([
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          getIgnoredLineHashes(destino.id),
          cierres(),
        ]);
        const delLote = (todosMovs ?? []).filter((m) => m.importBatch === res.importBatchId);
        // "Las dos cosas" · lo que ya anotaste a mano sube a Conciliado, no duplica.
        const confirmados = confirmadosPorLinea(delLote, todosMovs ?? [], destino.id);
        const abiertos = (todosEventos ?? []).filter((e) => seOfrecePara(e, destino.id));
        // Los meses ya cerrados no se cargan · se apartan (§ cerrar el mes).
        const setCerrados = new Set((mesesCerrados ?? []).map((c) => c.mes));
        // Mes en curso · las líneas de meses anteriores (no cerrados) que no
        // cuadran se apartan por defecto (A1), para no ahogar la sesión con lo
        // viejo al subir un extracto largo. Recuperables una a una.
        const mesActual = new Date().toISOString().slice(0, 7);

        setResultado(res);
        setPrevistos(abiertos);
        setLineas(
          construirLineas(delLote, res.matchResult, abiertos, ignoradasPrevias, setCerrados, confirmados, mesActual)
        );
        setDecisiones(decisionesVacias());
        setPaso('resolver');
      } catch (err) {
        if (err instanceof StatementAlreadyImportedError) {
          // Idempotencia (D1 bis) · se enseña cuándo se importó y se deja decidir.
          setAvisoReimport({ mensaje: err.message, file });
          setPaso('soltar');
          return;
        }
        setError(err instanceof Error ? err.message : 'No se pudo leer el extracto.');
        setPaso('soltar');
      }
    },
    []
  );

  const recibirFichero = useCallback(
    async (file: File) => {
      if (cuenta) {
        await procesar(file, cuenta);
        return;
      }
      // Un PDF no trae IBAN: se salta la detección y se pide destino (cuenta o tarjeta).
      if (esPdf(file)) {
        setAvisoReimport(null);
        setDeteccion({ estado: 'sin-iban' });
        pendienteRef.current = file;
        return;
      }
      // Puerta global · §4.7 dice que la cuenta se detecta por el IBAN.
      const d = await detectarCuenta(file, cuentas);
      setDeteccion(d);
      if (d.estado === 'detectada') {
        setCuentaElegida(d.cuenta);
        await procesar(file, d.cuenta);
        return;
      }
      // Sin certeza no se adivina (importar en la cuenta equivocada falsea saldos).
      setAvisoReimport(null);
      pendienteRef.current = file;
    },
    [cuenta, cuentas, procesar]
  );

  // La cuenta de Efectivo · sin ella no se ofrece "Es efectivo" (un traspaso la necesita).
  const cuentaEfectivo = useMemo(
    () => cuentasEnUso(cuentas).find((c) => c.tipo === 'EFECTIVO'),
    [cuentas]
  );

  // ── Guardar · el único botón que consolida ────────────────────────────────
  const guardar = useCallback(async () => {
    if (!resultado || !cuentaActiva?.id) return;
    setPaso('guardando');
    try {
      await confirmDecisions(resultado.importBatchId, payloadDeConfirmacion(lineas, decisiones));

      // El ignorado se persiste por hash de línea (D4 · vive en el fichero).
      for (const l of lineasAIgnorar(lineas, decisiones)) {
        await ignoreLine(resultado.importBatchId, {
          date: l.fecha,
          amount: l.importe,
          description: l.textoBanco,
        });
      }
      for (const hash of hashesARecuperar(lineas, decisiones)) {
        await recoverLine(cuentaActiva.id, hash);
      }

      // Retiradas de efectivo · el cargo YA existe, se transforma en la pata de
      // salida y nace su espejo en Efectivo (crearlo de cero duplicaría el saldo).
      if (cuentaEfectivo?.id != null) {
        for (const movementId of movimientosAEfectivo(lineas, decisiones)) {
          await convertirEnTraspaso(movementId, cuentaEfectivo.id);
        }
      }

      // Traspasos a otra cuenta propia (P1) · mismo mecanismo que efectivo: el
      // cargo importado pasa a ser la pata de salida y nace su espejo en la
      // cuenta destino. Así netea en el saldo y sale del gráfico (P2/P4).
      for (const { movementId, cuentaDestinoId } of movimientosATraspaso(lineas, decisiones)) {
        await convertirEnTraspaso(movementId, cuentaDestinoId);
      }

      // §4.7 · el fichero se archiva por cuenta y periodo (traga sus errores).
      if (ficheroRef.current) {
        await archivarExtracto(
          ficheroRef.current,
          cuentaActiva,
          lineas.map((l) => l.fecha)
        );
      }

      // Lo último · `consolidarSesion` DESMATERIALIZA (D4) las líneas sin resolver:
      // borra sus movimientos para que no cuenten como conciliados en el saldo.
      await consolidarSesion(resultado.importBatchId, lineasPendientes(lineas, decisiones));
      await onGuardado();
      reiniciar();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el extracto.');
      setPaso('resolver');
    }
  }, [resultado, cuentaActiva, cuentaEfectivo, lineas, decisiones, onGuardado, reiniciar, onCerrar]);

  // ── Salir sin guardar ─────────────────────────────────────────────────────
  const salirSinGuardar = useCallback(async () => {
    // `processFile` ya insertó los movimientos · cerrar es descartarlos.
    if (resultado) {
      try {
        await cancelImportBatch(resultado.importBatchId);
      } catch (err) {
        console.error('[DrawerExtracto] no se pudo descartar la sesión', err);
      }
    }
    reiniciar();
    onCerrar();
  }, [resultado, reiniciar, onCerrar]);

  // ── Acciones por línea ────────────────────────────────────────────────────
  const conDecisiones = (mut: (d: DecisionesSesion) => void) =>
    setDecisiones((prev) => {
      const d: DecisionesSesion = {
        asignados: new Map(prev.asignados),
        ignorados: new Set(prev.ignorados),
        creados: new Set(prev.creados),
        recuperados: new Set(prev.recuperados),
        aEfectivo: new Set(prev.aEfectivo),
        aTraspaso: new Map(prev.aTraspaso),
      };
      mut(d);
      return d;
    });

  const ignorar = (movementId: number) =>
    conDecisiones((d) => {
      d.ignorados.add(movementId);
      d.asignados.delete(movementId);
      d.aTraspaso.delete(movementId);
    });

  const recuperar = (movementId: number) =>
    conDecisiones((d) => {
      d.ignorados.delete(movementId);
      d.recuperados.add(movementId);
    });

  const asignar = (movementId: number, eventoId: number) =>
    conDecisiones((d) => {
      d.asignados.set(movementId, eventoId);
      d.ignorados.delete(movementId);
      d.aEfectivo.delete(movementId);
      d.aTraspaso.delete(movementId);
    });

  // "Es efectivo" · el cargo pasa a un traspaso a Efectivo al guardar (sacar del
  // cajero no es gasto: el dinero cambia de sitio).
  const marcarEfectivo = (movementId: number) =>
    conDecisiones((d) => {
      d.aEfectivo.add(movementId);
      d.ignorados.delete(movementId);
      d.asignados.delete(movementId);
      d.aTraspaso.delete(movementId);
    });

  const desmarcarEfectivo = (movementId: number) =>
    conDecisiones((d) => d.aEfectivo.delete(movementId));

  // "Es traspaso" · el cargo pasa a un traspaso a la cuenta destino al guardar
  // (P1) · el dinero no se gasta, cambia de sitio.
  const marcarTraspaso = (movementId: number, cuentaDestinoId: number) =>
    conDecisiones((d) => {
      d.aTraspaso.set(movementId, cuentaDestinoId);
      d.ignorados.delete(movementId);
      d.asignados.delete(movementId);
      d.aEfectivo.delete(movementId);
    });

  const desmarcarTraspaso = (movementId: number) =>
    conDecisiones((d) => d.aTraspaso.delete(movementId));

  // A2 · las iguales sin resolver como traspaso a la misma cuenta (28 Revolut de un clic).
  const marcarTraspasoLote = (linea: LineaExtracto) => {
    const destino = decisiones.aTraspaso.get(linea.movementId);
    if (destino == null) return;
    const ids = idsIgualesAResolver(lineas, decisiones, linea);
    conDecisiones((d) => {
      for (const id of ids) {
        d.aTraspaso.set(id, destino);
        d.ignorados.delete(id);
        d.asignados.delete(id);
        d.aEfectivo.delete(id);
      }
    });
  };

  /**
   * "Crear movimiento" de §4.7 · la línea no responde a ningún previsto. El
   * `Movement` YA existe (`processFile` lo insertó), así que crear aquí es
   * clasificarlo: familia, concepto e inmueble, sobre la ficha prerrellenada.
   */
  const crearDesdeFicha = useCallback(
    async (linea: LineaExtracto, v: GuardadoFicha) => {
      // Una derrama que resultó ser MEJORA no es gasto: el apunte se queda (el
      // dinero salió) pero la deducción va por amortización (`mejorasInmueble`).
      if (v.esMejora) {
        if (v.inmuebleId == null) {
          setError('Una mejora se suma al valor de un inmueble: elige a cuál.');
          return;
        }
        try {
          await mejoraDesdeMovimiento({
            movementId: linea.movementId,
            inmuebleId: v.inmuebleId,
            concepto: v.concepto,
            importe: v.importe,
            fecha: v.fecha,
          });
          conDecisiones((d) => {
            d.creados.add(linea.movementId);
            d.ignorados.delete(linea.movementId);
          });
          setCreando(null);
        } catch (err) {
          console.error('[DrawerExtracto] no se pudo registrar la mejora', err);
          setError('No se pudo registrar la mejora.');
        }
        return;
      }
      // Clasificar una línea de un piso tiene consecuencia FISCAL, y aquí solo se
      // escribía el `Movement`: el gasto quedaba impecable en Tesorería y no existía
      // para la declaración. Lo escribe `gastoDesdeMovimiento`.
      try {
        const origenIdRecurrente = await origenIdRecurrenteDelGasto(v.inmuebleId, v.categoryKey, v.fecha);
        const r = await gastoDesdeMovimiento({
          movementId: linea.movementId,
          inmuebleId: v.inmuebleId,
          concepto: v.concepto,
          importe: v.importe,
          fecha: v.fecha,
          categoryKey: v.categoryKey,
          subtypeKey: v.subtypeKey,
          origenIdRecurrente,
        });
        // Sin casilla no se guarda la fila y la ficha sigue abierta; con fecha
        // futura el apunte se queda pero no se declara. Los textos, en el servicio.
        const aviso = AVISO_GASTO_FISCAL[r.resultado];
        if (aviso) setError(aviso);
        if (r.resultado === 'falta_casilla') return;
        conDecisiones((d) => {
          d.creados.add(linea.movementId);
          d.ignorados.delete(linea.movementId);
        });
        setCreando(null);
      } catch (err) {
        console.error('[DrawerExtracto] no se pudo clasificar la línea', err);
      }
    },
    []
  );

  if (!abierto) return null;

  const visibles = lineas.filter((l) => {
    const v = veredictoEfectivo(l, decisiones);
    return v !== 'ignorada' && v !== 'mes_cerrado' && v !== 'mes_anterior';
  });
  const ignoradas = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'ignorada');
  const deMesesCerrados = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'mes_cerrado');
  const deMesesAnteriores = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'mes_anterior');

  const igualesSinResolver = contarIgualesSinResolver(visibles, decisiones);

  return (
    <>
      <div
        className={`${chasis.back} ${chasis.backOpen}`}
        onClick={salirSinGuardar}
        aria-hidden="true"
      />
      <aside
        className={`${chasis.drw} ${chasis.drwOpen}`}
        role="dialog"
        aria-modal="true"
        aria-label="Subir extracto"
      >
        <div className={chasis.hd}>
          <div className={chasis.hdTop}>
            {cuentaActiva && (
              <span
                className={chasis.hdDot}
                style={{ background: colorDeBanco(cuentaActiva) }}
                aria-hidden="true"
              />
            )}
            <div>
              <h2 className={chasis.hdTitle}>Subir extracto</h2>
              <div className={chasis.hdMask}>
                {cuentaActiva
                  ? `${cuentaActiva.alias} · ****${cuentaActiva.ultimosCuatro ?? ''}`
                  : 'La cuenta se detecta por el IBAN del fichero'}
              </div>
            </div>
            <button
              type="button"
              className={chasis.hdClose}
              onClick={salirSinGuardar}
              aria-label="Cerrar sin guardar"
            >
              <Icons.Close size={17} strokeWidth={2} />
            </button>
          </div>

          {paso === 'resolver' && (
            <div className={chasis.kpis}>
              <div className={chasis.ak}>
                <div className={chasis.akl}>Líneas</div>
                <div className={chasis.akv}>{resumen.lineas}</div>
              </div>
              <div className={chasis.ak}>
                <div className={chasis.akl}>Cuadran</div>
                <div className={chasis.akv}>{resumen.cuadran}</div>
              </div>
              <div className={chasis.ak}>
                <div className={chasis.akl}>A resolver</div>
                <div className={chasis.akv}>{resumen.resolver}</div>
              </div>
              <div className={chasis.ak}>
                <div className={chasis.akl}>Ignoradas</div>
                <div className={chasis.akv}>{resumen.ignoradas}</div>
              </div>
              {resumen.mesesCerrados > 0 && (
                <div className={chasis.ak}>
                  <div className={chasis.akl}>Meses cerrados</div>
                  <div className={chasis.akv}>{resumen.mesesCerrados}</div>
                </div>
              )}
              {resumen.mesesAnteriores > 0 && (
                <div className={chasis.ak}>
                  <div className={chasis.akl}>Meses anteriores</div>
                  <div className={chasis.akv}>{resumen.mesesAnteriores}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={chasis.body}>
          {/* Fichero de TARJETA · se lee y concilia aparte (§3). */}
          {tarjetaDestino && pendienteRef.current && (
            <PanelExtractoTarjeta
              tarjeta={tarjetaDestino}
              file={pendienteRef.current}
              onGuardado={onGuardado}
              onCerrar={salirSinGuardar}
            />
          )}

          {/* ── Paso 1 · dropzone ───────────────────────────────────────── */}
          {!tarjetaDestino && (paso === 'soltar' || paso === 'procesando') && (
            <div className={styles.zonaWrap}>
              {!cuenta && deteccion && deteccion.estado !== 'detectada' && (
                <div className={styles.avisoCuenta}>
                  <div className={styles.avisoT}>
                    {deteccion.estado === 'ambigua'
                      ? 'El fichero menciona más de una de tus cuentas'
                      : deteccion.estado === 'iban-desconocido'
                        ? `El IBAN del fichero (${deteccion.iban.slice(0, 8)}…) no es de ninguna cuenta tuya`
                        : 'No se ha encontrado el IBAN en el fichero'}
                  </div>
                  <div className={styles.avisoS}>
                    Elige la cuenta o la tarjeta de este extracto. Importar en el sitio
                    equivocado mueve saldos que no son.
                  </div>
                  <select
                    className={styles.selectCuenta}
                    aria-label="Destino del extracto"
                    // Cambiar de destino a mitad de una importación lanzaría un
                    // segundo `processFile` y dejaría el batch anterior huérfano.
                    disabled={paso === 'procesando'}
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      const f = pendienteRef.current;
                      if (!v || !f) return;
                      // `t:ID` una tarjeta (se concilia aparte) · `c:ID` una cuenta.
                      if (v.startsWith('t:')) {
                        const t = tarjetas.find((x) => x.id === Number(v.slice(2)));
                        if (t) setTarjetaDestino({ id: t.id, alias: t.alias });
                        return;
                      }
                      const elegida = cuentas.find((c) => c.id === Number(v.slice(2))) ?? null;
                      setCuentaElegida(elegida);
                      if (elegida) void procesar(f, elegida);
                    }}
                  >
                    <option value="">Elige cuenta o tarjeta…</option>
                    {cuentasEnUso(cuentas).map((c) => (
                      <option key={`c${c.id}`} value={`c:${c.id}`}>
                        {c.alias} · ****{c.ultimosCuatro}
                      </option>
                    ))}
                    {tarjetas.map((t) => (
                      <option key={`t${t.id}`} value={`t:${t.id}`}>
                        {t.alias} · tarjeta
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {avisoReimport && (
                <div className={styles.avisoCuenta}>
                  <div className={styles.avisoT}>Este extracto ya se importó</div>
                  <div className={styles.avisoS}>{avisoReimport.mensaje}</div>
                  <div className={styles.avisoAcciones}>
                    <button
                      type="button"
                      className={styles.btnLinea}
                      onClick={() => {
                        const destino = cuentaActiva;
                        if (destino) void procesar(avisoReimport.file, destino, true);
                      }}
                    >
                      Importar de todas formas
                    </button>
                    <button type="button" className={styles.btnLinea} onClick={reiniciar}>
                      Elegir otro fichero
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className={`${styles.zona} ${arrastrando ? styles.zonaOn : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  if (paso === 'procesando') return;
                  const f = e.dataTransfer.files?.[0];
                  if (f) void recibirFichero(f);
                }}
                disabled={paso === 'procesando'}
              >
                <Icons.Upload size={26} className={styles.zonaIc} />
                <div className={styles.zonaT}>
                  {paso === 'procesando'
                    ? 'Leyendo el extracto…'
                    : 'Arrastra aquí el extracto o haz clic para elegir'}
                </div>
                <div className={styles.zonaS}>Excel, CSV, Norma 43 o PDF</div>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx,.txt,.n43,.csb,.pdf"
                className={styles.inputFile}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void recibirFichero(f);
                  e.target.value = '';
                }}
              />

              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {/* ── Paso 2 · resultado del emparejamiento ───────────────────── */}
          {(paso === 'resolver' || paso === 'guardando') && (
            <div className={styles.lista}>
              {resultado?.warnings.map((w, i) => (
                <div key={i} className={styles.warning}>
                  {w}
                </div>
              ))}

              {visibles.map((l) => (
                <LineaExtractoItem
                  key={l.movementId}
                  linea={l}
                  decisiones={decisiones}
                  previstos={previstos}
                  cuentas={cuentas}
                  cuentaActivaId={cuentaActiva?.id}
                  cuentaEfectivo={cuentaEfectivo}
                  asignando={asignando}
                  setAsignando={setAsignando}
                  traspasando={traspasando}
                  setTraspasando={setTraspasando}
                  asignar={asignar}
                  ignorar={ignorar}
                  marcarEfectivo={marcarEfectivo}
                  desmarcarEfectivo={desmarcarEfectivo}
                  marcarTraspaso={marcarTraspaso}
                  desmarcarTraspaso={desmarcarTraspaso}
                  igualesSinResolver={igualesSinResolver.get(claveDeLineaIgual(l)) ?? 0}
                  onMarcarIguales={() => marcarTraspasoLote(l)}
                  abrirCrear={setCreando}
                  nombrarPrevisto={nombrarPrevisto}
                  nombrarPrevistoPorId={nombrarPrevistoPorId}
                />
              ))}

              {/* Ignoradas · agrupadas y plegadas (D1). */}
              {ignoradas.length > 0 && (
                <GrupoPlegableExtracto
                  plegado={ignoradasPlegadas}
                  onToggle={() => setIgnoradasPlegadas((v) => !v)}
                  titulo={`${ignoradas.length} ignoradas`}
                  lineas={ignoradas}
                  accion={(l) => (
                    <button
                      type="button"
                      className={styles.recuperar}
                      onClick={() => recuperar(l.movementId)}
                    >
                      recuperar
                    </button>
                  )}
                />
              )}

              {/* Meses ya cerrados · no se cargan. Sigue bloqueando `cierreDeMes`; lo que cambió (F2) es a dónde se remite. */}
              {deMesesCerrados.length > 0 && (
                <GrupoPlegableExtracto
                  plegado={cerradosPlegados}
                  onToggle={() => setCerradosPlegados((v) => !v)}
                  titulo={`${deMesesCerrados.length} de meses cerrados · no se cargan`}
                  intro="Estos cargos son de un mes que ya diste por cerrado, así que se quedan fuera para no mover un saldo que ya diste por bueno. Si alguno hace falta, anótalo desde el punteo de su cuenta."
                  lineas={deMesesCerrados}
                />
              )}

              {/* Meses anteriores al actual · apartados por defecto (A1) ·
                  recuperables uno a uno, sin reabrir nada. */}
              {deMesesAnteriores.length > 0 && (
                <GrupoPlegableExtracto
                  plegado={anterioresPlegados}
                  onToggle={() => setAnterioresPlegados((v) => !v)}
                  titulo={`${deMesesAnteriores.length} de meses anteriores · no se cargan`}
                  intro="Son de meses anteriores al actual. Se apartan para no ahogar la sesión; si quieres tratar alguno, recupéralo."
                  lineas={deMesesAnteriores}
                  accion={(l) => (
                    <button
                      type="button"
                      className={styles.recuperar}
                      onClick={() => recuperar(l.movementId)}
                    >
                      recuperar
                    </button>
                  )}
                />
              )}

              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}
        </div>

        {/* ── Pie · UN SOLO Guardar (§4.7) ─────────────────────────────── */}
        {(paso === 'resolver' || paso === 'guardando') && (
          <div className={styles.pie}>
            <div className={styles.pieNota}>
              {resumen.resolver > 0
                ? `${resumen.resolver} sin resolver · esperan en el extracto`
                : 'Todo resuelto'}
            </div>
            <button
              type="button"
              className={styles.btnGuardar}
              onClick={guardar}
              disabled={paso === 'guardando'}
            >
              {paso === 'guardando' ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </aside>

      {/* §4.5 prerrellenada · "Crear movimiento" desde una línea sin cuadre. */}
      <FichaMovimiento
        abierta={creando != null}
        esEdicion={false}
        inicial={
          creando
            ? {
                tipo: creando.importe >= 0 ? 'ingreso' : 'gasto',
                concepto: creando.textoBanco,
                importe: creando.importe,
                fecha: creando.fecha,
                cuentaId: cuentaActiva?.id ?? null,
              }
            : undefined
        }
        cuentas={cuentaActiva ? [cuentaActiva] : cuentas}
        inmuebles={inmuebles}
        tarjetas={tarjetas}
        onCerrar={() => setCreando(null)}
        onGuardar={(v) => (creando ? crearDesdeFicha(creando, v) : undefined)}
      />
    </>
  );
};

export default DrawerExtracto;
