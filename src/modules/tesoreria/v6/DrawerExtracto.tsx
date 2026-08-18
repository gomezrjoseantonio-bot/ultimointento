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
import { candidatosDeLinea } from './conciliacionCandidatos';
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
import { esPdf } from '../../../services/personal/extractoTarjeta';
import PanelExtractoTarjeta from './PanelExtractoTarjeta';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { colorDeBanco } from './bancoColores';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { pareceRetiradaDeCajero } from '../../../services/retiradaCajero';
import { convertirEnTraspaso } from '../../../services/traspasoDesdeMovimiento';
import { importeConSigno, fechaLarga } from './formatoV6';
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
  const [previstos, setPrevistos] = useState<TreasuryEvent[]>([]);
  const [ignoradasPlegadas, setIgnoradasPlegadas] = useState(true);
  const [cerradosPlegados, setCerradosPlegados] = useState(true);

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
        const abiertos = (todosEventos ?? []).filter(
          (e) => e.accountId === destino.id && e.status !== 'executed'
        );
        // Los meses ya cerrados no se cargan · se apartan (§ cerrar el mes).
        const setCerrados = new Set((mesesCerrados ?? []).map((c) => c.mes));

        setResultado(res);
        setPrevistos(abiertos);
        setLineas(construirLineas(delLote, res.matchResult, abiertos, ignoradasPrevias, setCerrados, confirmados));
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

  // "Es efectivo" · el cargo pasa a un traspaso a Efectivo al guardar (sacar del
  // cajero no es gasto: el dinero cambia de sitio).
  const marcarEfectivo = (movementId: number) =>
    conDecisiones((d) => {
      d.aEfectivo.add(movementId);
      d.ignorados.delete(movementId);
      d.asignados.delete(movementId);
    });

  const desmarcarEfectivo = (movementId: number) =>
    conDecisiones((d) => d.aEfectivo.delete(movementId));

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

  const visibles = lineas.filter((l) => {
    const v = veredictoEfectivo(l, decisiones);
    return v !== 'ignorada' && v !== 'mes_cerrado';
  });
  const ignoradas = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'ignorada');
  const deMesesCerrados = lineas.filter((l) => veredictoEfectivo(l, decisiones) === 'mes_cerrado');

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

              {visibles.map((l) => {
                const v = veredictoEfectivo(l, decisiones);
                const asignado = decisiones.asignados.get(l.movementId);
                const previstoMostrado =
                  asignado != null
                    ? previstos.find((p) => p.id === asignado)
                    : undefined;
                // Candidatos para asignar · una entrada por serie, por cercanía.
                const candidatos = candidatosDeLinea(
                  { fecha: l.fecha, importe: l.importe },
                  previstos,
                );
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
                          {previstoMostrado
                            ? nombrarPrevisto(previstoMostrado)
                            : l.previsto?.descripcion
                              ?? (l.confirmado ? 'lo que ya tenías anotado' : 'un previsto')}
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
                            {candidatos.map((c) => (
                              <option key={c.id} value={c.id}>
                                {nombrarPrevistoPorId(c.id, c.descripcion)} · {importeConSigno(c.importe)}
                                {c.exacto ? '' : ' · no cuadra'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            {/* Asignar solo si hay algún previsto que pueda ser. */}
                            {candidatos.length > 0 && (
                              <button
                                type="button"
                                className={styles.btnLinea}
                                onClick={() => setAsignando(l.movementId)}
                              >
                                Asignar a un previsto
                              </button>
                            )}
                            <button
                              type="button"
                              className={styles.btnLinea}
                              onClick={() => setCreando(l)}
                            >
                              Crear movimiento
                            </button>
                            {/* Retirada de cajero · se PROPONE pasarla a Efectivo
                                (no es gasto, el dinero cambia de sitio), no se adivina. */}
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

              {/* Meses ya cerrados · no se cargan (reabre el mes para cargarlos). */}
              {deMesesCerrados.length > 0 && (
                <GrupoPlegableExtracto
                  plegado={cerradosPlegados}
                  onToggle={() => setCerradosPlegados((v) => !v)}
                  titulo={`${deMesesCerrados.length} de meses cerrados · no se cargan`}
                  intro="Estos cargos son de meses que ya cerraste. Para cargarlos, reabre el mes en «Cerrar el mes»."
                  lineas={deMesesCerrados}
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
