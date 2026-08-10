// ============================================================================
// Tesorería V6 · §4.7 · drawer · subir extracto
// ============================================================================
//
// Dos puertas, un solo flujo:
//   · desde el hero → la cuenta se detecta por el IBAN del fichero;
//   · desde una cuenta → la cuenta ya viene fijada.
//
// Paso 1 · dropzone. Paso 2 · resultado del emparejamiento, con las tres
// acciones por línea sin cuadre (asignar · crear · ignorar).
//
// **Un solo botón Guardar** al pie, que consolida la sesión entera. No hay
// botón intermedio de conciliar. El aspa sale SIN guardar, y eso significa
// borrar el batch: `processFile` ya insertó los movimientos al procesar, así
// que "no guardar" tiene que deshacerlos de verdad (`cancelImportBatch`), no
// solo cerrar la ventana.
// ============================================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { initDB } from '../../../services/db';
import {
  processFile,
  confirmDecisions,
  cancelImportBatch,
  StatementAlreadyImportedError,
  type OrchestratorResult,
} from '../../../services/bankStatementOrchestrator';
import { getIgnoredLineHashes, ignoreLine, recoverLine } from '../../../services/statementIgnoredLinesService';
import { consolidarSesion, archivarExtracto } from '../../../services/statementSessionService';
import { mejoraDesdeMovimiento } from '../../../services/altaMovimientoService';
import {
  construirLineas,
  veredictoEfectivo,
  resumir,
  payloadDeConfirmacion,
  lineasAIgnorar,
  movimientosAEfectivo,
  lineasPendientes,
  hashesARecuperar,
  decisionesVacias,
  type LineaExtracto,
  type DecisionesSesion,
} from './extractoSesion';
import { detectarCuenta, type DeteccionCuenta } from './detectarCuenta';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { colorDeBanco } from './bancoColores';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { pareceRetiradaDeCajero } from '../../../services/retiradaCajero';
import { convertirEnTraspaso } from '../../../services/traspasoDesdeMovimiento';
import { importeConSigno, fechaLarga } from './formatoV6';
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
  const [resultado, setResultado] = useState<OrchestratorResult | null>(null);
  const [lineas, setLineas] = useState<LineaExtracto[]>([]);
  const [decisiones, setDecisiones] = useState<DecisionesSesion>(decisionesVacias);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [previstos, setPrevistos] = useState<TreasuryEvent[]>([]);
  const [ignoradasPlegadas, setIgnoradasPlegadas] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  /** Fichero a la espera de que el usuario diga a qué cuenta va (puerta global). */
  const pendienteRef = useRef<File | null>(null);
  /** El fichero de la sesión en curso · se archiva en el Archivo al guardar. */
  const ficheroRef = useRef<File | null>(null);
  /** Línea para la que se ha abierto la ficha de §4.5 con "Crear movimiento". */
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
    setAsignando(null);
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
        const res = await processFile(file, { accountId: destino.id, allowReimport });
        ficheroRef.current = file;
        const db = await initDB();
        const [todosMovs, todosEventos, ignoradasPrevias] = await Promise.all([
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          getIgnoredLineHashes(destino.id),
        ]);
        const delLote = (todosMovs ?? []).filter((m) => m.importBatch === res.importBatchId);
        const abiertos = (todosEventos ?? []).filter(
          (e) => e.accountId === destino.id && e.status !== 'executed'
        );

        setResultado(res);
        setPrevistos(abiertos);
        setLineas(construirLineas(delLote, res.matchResult, abiertos, ignoradasPrevias));
        setDecisiones(decisionesVacias());
        setPaso('resolver');
      } catch (err) {
        if (err instanceof StatementAlreadyImportedError) {
          // No es un error del usuario: es la protección de idempotencia. Se le
          // enseña cuándo se importó y se le deja decidir (D1 bis).
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
      // Puerta global · §4.7 dice que la cuenta se detecta por el IBAN.
      const d = await detectarCuenta(file, cuentas);
      setDeteccion(d);
      if (d.estado === 'detectada') {
        setCuentaElegida(d.cuenta);
        await procesar(file, d.cuenta);
        return;
      }
      // Sin certeza no se adivina: importar en la cuenta equivocada falsea
      // todos los saldos. Se guarda el fichero y se pide elegir.
      setAvisoReimport(null);
      pendienteRef.current = file;
    },
    [cuenta, cuentas, procesar]
  );

  /**
   * La cuenta de Efectivo · sin ella no se puede ofrecer nada.
   *
   * Sacar del cajero es un traspaso, y un traspaso necesita una cuenta al otro
   * lado. Si el usuario no la tiene creada, el botón no aparece: prometer una
   * acción que no se puede completar es peor que no ofrecerla.
   */
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

      // El ignorado se persiste por hash de línea, no por movimiento: por D4 lo
      // no resuelto no se materializa, así que el registro vive en el fichero.
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

      // Las retiradas de efectivo · el movimiento del cargo YA existe, así que
      // se transforma en la pata de salida y nace su espejo en la cuenta de
      // efectivo. Crear el traspaso desde cero duplicaría el apunte y el saldo
      // dejaría de cuadrar con el banco.
      if (cuentaEfectivo?.id != null) {
        for (const movementId of movimientosAEfectivo(lineas, decisiones)) {
          await convertirEnTraspaso(movementId, cuentaEfectivo.id);
        }
      }

      // §4.7 · el fichero se archiva vinculado a cuenta y periodo. Va antes de
      // consolidar pero no puede tumbarla: `archivarExtracto` traga sus errores.
      if (ficheroRef.current) {
        await archivarExtracto(
          ficheroRef.current,
          cuentaActiva,
          lineas.map((l) => l.fecha)
        );
      }

      // Lo último: hasta aquí la sesión era un borrador invisible. Si algo de
      // lo anterior falla, mejor que siga siéndolo.
      //
      // Las líneas sin resolver viajan aquí para que `consolidarSesion` las
      // DESMATERIALICE (D4): borra sus movimientos y guarda su identidad en el
      // batch. Si se quedasen en el store, al dejar de ser borrador aparecerían
      // en la lista de la cuenta como conciliadas y moverían el saldo.
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
    // `processFile` ya insertó los movimientos, así que cerrar sin más los
    // dejaría en la base de datos. Cerrar es descartar de verdad.
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
      };
      mut(d);
      return d;
    });

  const ignorar = (movementId: number) =>
    conDecisiones((d) => {
      d.ignorados.add(movementId);
      d.asignados.delete(movementId);
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
    });

  /**
   * "Es efectivo" · el cargo se convierte en un traspaso a la cuenta de
   * Efectivo al guardar. Sacar del cajero no es un gasto: el dinero no se va,
   * cambia de sitio.
   */
  const marcarEfectivo = (movementId: number) =>
    conDecisiones((d) => {
      d.aEfectivo.add(movementId);
      d.ignorados.delete(movementId);
      d.asignados.delete(movementId);
    });

  const desmarcarEfectivo = (movementId: number) =>
    conDecisiones((d) => d.aEfectivo.delete(movementId));

  /**
   * "Crear movimiento" de §4.7 · la línea no responde a ningún previsto, así
   * que se queda como gasto/ingreso suelto.
   *
   * El `Movement` YA existe —`processFile` lo insertó al procesar—, de modo que
   * crear aquí es clasificarlo: ponerle familia, concepto e inmueble. La ficha
   * de §4.5 se abre prerrellenada con lo que dice el banco.
   */
  const crearDesdeFicha = useCallback(
    async (linea: LineaExtracto, v: GuardadoFicha) => {
      // Una derrama que resultó ser MEJORA no se clasifica como gasto: el
      // apunte bancario se queda (el dinero salió) pero la deducción va por
      // amortización, así que la inversión se registra en `mejorasInmueble`.
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
      try {
        const db = await initDB();
        const mov = (await db.get('movements', linea.movementId)) as Movement | undefined;
        if (!mov) return;
        await db.put('movements', {
          ...mov,
          description: v.concepto || mov.description,
          ...(v.categoryKey !== undefined
            ? { categoryKey: v.categoryKey ?? undefined }
            : {}),
          ...(v.subtypeKey !== undefined ? { subtypeKey: v.subtypeKey ?? undefined } : {}),
          // `Movement.inmuebleId` es string; la ficha trabaja con el id numérico.
          ...(v.inmuebleId !== undefined
            ? { inmuebleId: v.inmuebleId == null ? undefined : String(v.inmuebleId) }
            : {}),
          updatedAt: new Date().toISOString(),
        });
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

  const visibles = lineas.filter((l) => veredictoEfectivo(l, decisiones) !== 'ignorada');
  const ignoradas = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'ignorada');

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
            </div>
          )}
        </div>

        <div className={chasis.body}>
          {/* ── Paso 1 · dropzone ───────────────────────────────────────── */}
          {(paso === 'soltar' || paso === 'procesando') && (
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
                    Elige la cuenta. Importar en la equivocada mueve saldos que no son.
                  </div>
                  <select
                    className={styles.selectCuenta}
                    aria-label="Cuenta de destino"
                    // Cambiar de cuenta a mitad de una importación lanzaría un
                    // segundo `processFile` y dejaría el batch anterior huérfano.
                    disabled={paso === 'procesando'}
                    value={cuentaElegida?.id ?? ''}
                    onChange={(e) => {
                      const elegida = cuentas.find((c) => c.id === Number(e.target.value)) ?? null;
                      setCuentaElegida(elegida);
                      const f = pendienteRef.current;
                      if (elegida && f) void procesar(f, elegida);
                    }}
                  >
                    <option value="">Elige una cuenta…</option>
                    {cuentasEnUso(cuentas)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.alias} · ****{c.ultimosCuatro}
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
                <div className={styles.zonaS}>Norma 43, Excel o CSV</div>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx,.txt,.n43,.csb"
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

              {visibles.map((l) => {
                const v = veredictoEfectivo(l, decisiones);
                const asignado = decisiones.asignados.get(l.movementId);
                const previstoMostrado =
                  asignado != null
                    ? previstos.find((p) => p.id === asignado)
                    : undefined;
                return (
                  <div key={l.movementId} className={styles.linea}>
                    <div className={styles.lineaTop}>
                      {/* El texto LITERAL del banco · §4.7. */}
                      <div className={styles.lineaTexto}>{l.textoBanco}</div>
                      <div className={styles.lineaImporte}>{importeConSigno(l.importe)}</div>
                    </div>
                    <div className={styles.lineaFecha}>{fechaLarga(l.fecha)}</div>

                    {decisiones.aEfectivo.has(l.movementId) ? (
                      <div className={styles.veredicto}>
                        <Icons.Check size={13} aria-hidden="true" />
                        <span>
                          pasa a {cuentaEfectivo?.alias || 'Efectivo'} · el dinero no se gasta,
                          cambia de sitio
                        </span>
                        <button
                          type="button"
                          className={styles.btnLinea}
                          onClick={() => desmarcarEfectivo(l.movementId)}
                        >
                          Deshacer
                        </button>
                      </div>
                    ) : v === 'cuadra' ? (
                      <div className={styles.veredicto}>
                        <Icons.Check size={13} aria-hidden="true" />
                        <span>
                          cuadra con{' '}
                          {previstoMostrado?.description ?? l.previsto?.descripcion ?? 'un previsto'}
                        </span>
                      </div>
                    ) : (
                      <div className={styles.acciones}>
                        {asignando === l.movementId ? (
                          <select
                            className={styles.selectPrevisto}
                            aria-label={`Previsto para ${l.textoBanco}`}
                            defaultValue=""
                            onChange={(e) => {
                              const id = Number(e.target.value);
                              if (id) asignar(l.movementId, id);
                              setAsignando(null);
                            }}
                          >
                            <option value="">Elige un previsto…</option>
                            {(l.candidatos ?? []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.descripcion} · {importeConSigno(c.importe)}
                              </option>
                            ))}
                            {previstos
                              .filter((p) => !(l.candidatos ?? []).some((c) => c.id === p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.description} ·{' '}
                                  {importeConSigno(
                                    p.type === 'income' ? Math.abs(p.amount) : -Math.abs(p.amount)
                                  )}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.btnLinea}
                              onClick={() => setAsignando(l.movementId)}
                            >
                              Asignar a un previsto
                            </button>
                            <button
                              type="button"
                              className={styles.btnLinea}
                              onClick={() => setCreando(l)}
                            >
                              Crear movimiento
                            </button>
                            {/* Solo donde encaja · una retirada de cajero llega
                                como un cargo más, y apuntarla como gasto hunde
                                el patrimonio el día que el dinero solo ha
                                cambiado de sitio. Se PROPONE, no se adivina:
                                un reintegro también puede ser dinero que sacas
                                para llevártelo a otro sitio. */}
                            {cuentaEfectivo?.id != null &&
                              pareceRetiradaDeCajero(l.textoBanco, l.importe) && (
                                <button
                                  type="button"
                                  className={styles.btnLinea}
                                  onClick={() => marcarEfectivo(l.movementId)}
                                >
                                  Es efectivo
                                </button>
                              )}
                            <button
                              type="button"
                              className={styles.btnLinea}
                              onClick={() => ignorar(l.movementId)}
                            >
                              Ignorar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ignoradas · agrupadas y plegadas (D1). */}
              {ignoradas.length > 0 && (
                <div className={styles.grupoIgn}>
                  <button
                    type="button"
                    className={styles.grupoIgnHd}
                    onClick={() => setIgnoradasPlegadas((v) => !v)}
                    aria-expanded={!ignoradasPlegadas}
                  >
                    {ignoradasPlegadas ? (
                      <Icons.ChevronRight size={14} aria-hidden="true" />
                    ) : (
                      <Icons.ChevronDown size={14} aria-hidden="true" />
                    )}
                    <span>{ignoradas.length} ignoradas</span>
                  </button>
                  {!ignoradasPlegadas &&
                    ignoradas.map((l) => (
                      <div key={l.movementId} className={styles.lineaIgn}>
                        <div className={styles.lineaTextoIgn}>{l.textoBanco}</div>
                        <div className={styles.lineaImporteIgn}>{importeConSigno(l.importe)}</div>
                        <button
                          type="button"
                          className={styles.recuperar}
                          onClick={() => recuperar(l.movementId)}
                        >
                          recuperar
                        </button>
                      </div>
                    ))}
                </div>
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
