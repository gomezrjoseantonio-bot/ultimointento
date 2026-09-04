// Tesorería V6 · §4.7 · drawer · subir extracto · ÚNICO sitio para subirlos.
//
// La cuenta se detecta por IBAN (o ya viene fijada); un PDF de banco lo lee la
// IA; un extracto de TARJETA se concilia aparte (§3, `PanelExtractoTarjeta`).
// Paso 1 · dropzone. Paso 2 · emparejamiento (asignar · crear · ignorar). Un solo
// botón Guardar consolida; el aspa sale SIN guardar y borra el batch.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent, LineaExtractoPersistida } from '../../../services/db';
import { nombrarPrevisto as nombrarPrevistoModelo } from './nombrarPrevisto';
import {
  processFile,
  processPdf,
  confirmDecisions,
  cancelImportBatch,
  StatementAlreadyImportedError,
  type OrchestratorResult,
} from '../../../services/bankStatementOrchestrator';
import { reabrirLote } from '../../../services/reabrirLote';
import { ignoreLine, recoverLine } from '../../../services/statementIgnoredLinesService';
import { consolidarSesion, archivarExtracto } from '../../../services/statementSessionService';
import {
  AVISO_GASTO_FISCAL,
  gastoDesdeMovimiento,
  mejoraDesdeMovimiento,
  origenIdRecurrenteDelGasto,
} from '../../../services/altaMovimientoService';
import {
  veredictoEfectivo,
  payloadDeConfirmacion,
  lineasAIgnorar,
  lineasAEfectivo,
  lineasATraspaso,
  contarIgualesSinResolver, claveDeLineaIgual,
  hashesARecuperar,
  type LineaExtracto,
} from './extractoSesion';
import { useDecisionesDeSesion } from './decisionesDeSesion';
import { decisionesDesdeFilas, type LoteAMedias } from './decisionesPersistidas';
import { leerSesionDelLote, tituloDeLaSesion, persistirCambios, useLotesAMedias } from './montarSesion';
import { valoresPorLinea } from './clasificarEnBloque';
import LineaExtractoItem from './LineaExtractoItem';
import { detectarCuenta, type DeteccionCuenta } from './detectarCuenta';
import { esPdf } from '../../../services/personal/extractoTarjeta';
import PanelExtractoTarjeta from './PanelExtractoTarjeta';
import { cuadre, bucketDeLinea, type Bucket } from './conciliarBuckets';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { colorDeBanco } from './bancoColores';
import { cuentasEnUso } from '../../../services/cuentasEnUso';
import { convertirLineaEnTraspaso } from '../../../services/traspasoDesdeMovimiento';
import { aplicarApertura, type PropuestaDeApertura } from '../../../services/aperturaDerivada';
import PanelConciliar from './conciliar/PanelConciliar';
import ZonaSoltar from './conciliar/ZonaSoltar';
import {
  propuestaDeLinea,
  esPersonalReconocido,
  type Propuesta,
} from './conciliar/propuestaDeLinea';
import { loQueYaReconoce } from './conciliar/loQueYaReconoce';
import { listRules } from '../../../services/movementLearningService';
import type { MovementLearningRule } from '../../../services/db/types-movimientos';
import chasis from './DrawerV6.module.css';

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
  // §31 · la apertura derivada que ATLAS propone y si el usuario la aceptó.
  const [apertura, setApertura] = useState<PropuestaDeApertura | null>(null);
  const [aplicarLaApertura, setAplicarLaApertura] = useState(false);
  const [yaEstaban, setYaEstaban] = useState<LineaExtractoPersistida[]>([]);
  // E1.3 · los lotes sin guardar que se pueden retomar · se enseñan en Paso 1.
  const aMedias = useLotesAMedias(abierto && paso === 'soltar' && !tarjetaDestino);
  // Los doce gestos sobre una línea viven en su propio módulo · lo único que
  // necesitan es saber qué líneas hay (para el lote de las iguales).
  const {
    decisiones,
    reiniciarDecisiones,
    cargarDecisiones,
    ignorar,
    recuperar,
    desemparejar,
    ignorarVarias,
    traspasarVarias,
    asignar,
    marcarEfectivo,
    desmarcarEfectivo,
    marcarTraspaso,
    desmarcarTraspaso,
    marcarTraspasoLote,
    marcarCreado,
  } = useDecisionesDeSesion(lineas, { onCambio: persistirCambios });
  // Las elegidas que se van a clasificar de un gesto · la ficha se abre UNA vez
  // y su concepto se aplica a todas, con el importe y la fecha de cada una.
  const [clasificandoVarias, setClasificandoVarias] = useState<LineaExtracto[] | null>(null);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [traspasando, setTraspasando] = useState<number | null>(null);
  const [previstos, setPrevistos] = useState<TreasuryEvent[]>([]);
  // Lo que ATLAS ya reconoce de esta cuenta · alimenta el panel dorado.
  const [reglas, setReglas] = useState<MovementLearningRule[]>([]);
  // El instante en que se abrió este extracto. Separa lo aprendido HOY de lo que
  // ya sabía, y por eso se fija UNA vez al cargar las líneas: si se recalculara
  // en cada render, todo lo aprendido parecería viejo al segundo siguiente.
  const [abiertoEn, setAbiertoEn] = useState<string>('');

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
  const [arrastrando, setArrastrando] = useState(false);
  /** Fichero a la espera de que el usuario elija destino (puerta global). */
  const pendienteRef = useRef<File | null>(null);
  /** El fichero de la sesión en curso · se archiva al guardar. */
  const ficheroRef = useRef<File | null>(null);
  /** Línea para la que se ha abierto la ficha con "Crear movimiento". */
  const [creando, setCreando] = useState<LineaExtracto | null>(null);

  const cuentaActiva = cuenta ?? cuentaElegida;
  /**
   * El invariante de la pantalla · toda línea del banco en un bucket.
   *
   * No es decorativo: si no cuadra, Guardar se bloquea. Antes las líneas que no
   * encajaban se apartaban y se borraban al guardar; ahora, si alguna quedara
   * fuera, la pantalla lo canta en vez de tragárselo.
   */
  // ── Las sugerencias que el orquestador YA calculaba y nadie leía ────────
  //
  // `bankStatementOrchestrator` llama a `suggestForUnmatched` en cada import y
  // guarda el resultado en `OrchestratorResult.suggestions`. Hasta esta pantalla
  // ese mapa moría ahí: ningún componente lo abría. Aquí se convierte en lo que
  // dice cada tarjeta.
  const propuestas = useMemo(() => {
    const m = new Map<number, Propuesta>();
    const sugs = resultado?.suggestions;
    const atribs = resultado?.reconocido?.atribuciones;
    if (!sugs && !atribs) return m;
    for (const l of lineas) {
      const a = atribs?.get(l.lineaId);
      m.set(
        l.lineaId,
        propuestaDeLinea(
          sugs?.get(l.lineaId) ?? [],
          a
            ? {
                alias: inmuebles.find((i) => i.id === a.inmuebleId)?.alias,
                concepto: a.concepto,
                ejercicio: a.ejercicio,
              }
            : null,
        ),
      );
    }
    return m;
  }, [resultado, lineas, inmuebles]);

  // Quién va al montón «personal» · SOLO lo que el usuario enseñó alguna vez
  // (regla aprendida) o lo que marca un recurrente suyo. La heurística no entra:
  // ver `esPersonalReconocido`.
  const personales = useMemo(() => {
    const s = new Set<number>();
    const sugs = resultado?.suggestions;
    if (!sugs) return s;
    for (const l of lineas) {
      if (esPersonalReconocido(sugs.get(l.lineaId) ?? [])) s.add(l.lineaId);
    }
    return s;
  }, [resultado, lineas]);

  // FASE 2 · lo que ATLAS reconoció mirando los libros del usuario. No casó con
  // una previsión —para el pasado no hay previsiones— pero está igual de
  // resuelto: fecha e importe exactos contra un dato que escribió él.
  const reconocidas = useMemo(
    () => new Set((resultado?.reconocido?.origenes ?? new Map()).keys()),
    [resultado],
  );

  const elCuadre = useMemo(
    () => cuadre(lineas, decisiones, personales, reconocidas),
    [lineas, decisiones, personales, reconocidas],
  );

  const aprendido = useMemo(
    () => loQueYaReconoce(reglas, abiertoEn || new Date().toISOString()),
    [reglas, abiertoEn],
  );

  // ── Reiniciar ──────────────────────────────────────────────────────────────
  const reiniciar = useCallback(() => {
    setPaso('soltar');
    setError(null);
    setAvisoReimport(null);
    setResultado(null);
    setLineas([]);
    setApertura(null);
    setAplicarLaApertura(false);
    setYaEstaban([]);
    reiniciarDecisiones();
    setDeteccion(null);
    setTarjetaDestino(null);
    setAsignando(null);
    setTraspasando(null);
    setClasificandoVarias(null);
    setCreando(null);
    ficheroRef.current = null;
    pendienteRef.current = null;
    setReglas([]);
    setAbiertoEn('');
    if (!cuenta) setCuentaElegida(null);
  }, [cuenta, reiniciarDecisiones]);

  /**
   * Montar la sesión a partir de lo que devuelve el orquestador · vale para
   * un fichero recién procesado y para un lote retomado (E1.3): lee los
   * movimientos y las filas del lote (`leerSesionDelLote`), construye las
   * líneas y deja el drawer en Paso 2. Las decisiones NO se tocan aquí: quien
   * llama decide si parte de cero o carga las persistidas.
   */
  const montarSesion = useCallback(
    async (res: OrchestratorResult, destino: Account): Promise<LineaExtractoPersistida[]> => {
      const sesion = await leerSesionDelLote(res, destino);
      setResultado(res);
      setPrevistos(sesion.previstos);
      setLineas(sesion.lineas);
      setApertura(sesion.apertura);
      setAplicarLaApertura(false);
      setYaEstaban(sesion.yaEstaban);
      // Si falla, el panel dorado sale vacío y el resto de la pantalla
      // funciona igual: no saber qué se aprendió antes no impide conciliar.
      void listRules()
        .then(setReglas)
        .catch(() => setReglas([]));
      setPaso('resolver');
      return sesion.filas;
    },
    []
  );

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
        reiniciarDecisiones();
        setAbiertoEn(new Date().toISOString());
        await montarSesion(res, destino);
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
    [reiniciarDecisiones, montarSesion]
  );

  // ── Retomar un lote a medias (E1.3) ────────────────────────────────────────
  // El fichero ya no está (se perdió con la pestaña), así que al guardar no se
  // archiva; todo lo demás —movimientos, líneas, decisiones— sí está.
  const retomar = useCallback(
    async (lote: LoteAMedias) => {
      const destino = cuentas.find((c) => c.id === lote.accountId);
      if (!destino || destino.id == null) {
        setError('La cuenta de ese extracto ya no existe · no se puede retomar.');
        return;
      }
      setPaso('procesando');
      setError(null);
      setAvisoReimport(null);
      try {
        const res = await reabrirLote(lote.importBatchId);
        ficheroRef.current = null;
        setCuentaElegida(destino);
        setAbiertoEn(lote.timestampImport);
        const filas = await montarSesion(res, destino);
        cargarDecisiones(decisionesDesdeFilas(filas));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo retomar el extracto.');
        setPaso('soltar');
      }
    },
    [cuentas, montarSesion, cargarDecisiones]
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

  // Las cuentas a las que cabe traspasar en bloque · todas las suyas menos la
  // del propio extracto: un traspaso de una cuenta a sí misma no existe.
  const cuentasDestino = useMemo(
    () =>
      cuentasEnUso(cuentas)
        .filter((c) => c.id != null && c.id !== cuentaActiva?.id)
        // Sin nombre se enseña el banco y, en último caso, el id: un
        // desplegable con una opción en blanco no se puede elegir a ciegas.
        .map((c) => ({ id: c.id as number, nombre: c.name || `Cuenta ${c.id}` })),
    [cuentas, cuentaActiva]
  );

  // La cuenta de Efectivo · sin ella no se ofrece "Es efectivo" (un traspaso la necesita).
  const cuentaEfectivo = useMemo(
    () => cuentasEnUso(cuentas).find((c) => c.tipo === 'EFECTIVO'),
    [cuentas]
  );

  // ── Guardar · el único botón que consolida ────────────────────────────────
  const guardar = useCallback(async () => {
    if (!resultado || !cuentaActiva?.id) return;
    // No se guarda «a medias». Con `bucketDeLinea` total esto no debería saltar
    // nunca; se comprueba igualmente porque un invariante que no se comprueba es
    // una intención, no un invariante.
    if (!elCuadre.cuadra) {
      setError(
        `No se guarda: ${elCuadre.delBanco - elCuadre.colocadas} línea(s) del banco no han quedado colocadas.`,
      );
      return;
    }
    setPaso('guardando');
    try {
      await confirmDecisions(resultado.importBatchId, {
        ...payloadDeConfirmacion(lineas, decisiones),
        // Solo lo que sigue sin resolver por otra vía: si el usuario asignó esa
        // línea a un previsto a mano, su decisión manda sobre lo que ATLAS
        // dedujo del cuadro.
        approvedDeterministic: Array.from(
          (resultado.reconocido?.origenes ?? new Map()).values(),
        ).filter((o) => {
          const linea = lineas.find((l) => l.lineaId === o.lineaId);
          // Sin línea no hay nada que cerrar; y si el usuario la asignó,
          // ignoró o resolvió a mano, su decisión manda sobre lo que ATLAS
          // dedujo del cuadro.
          return linea != null && veredictoEfectivo(linea, decisiones) === 'resolver';
        }),
      });

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

      // Retiradas de efectivo · E1.5 · nace el movimiento de la línea como pata
      // de salida y su espejo en Efectivo (`materializarLinea` por dentro).
      if (cuentaEfectivo?.id != null) {
        for (const lineaId of lineasAEfectivo(lineas, decisiones)) {
          await convertirLineaEnTraspaso(lineaId, cuentaEfectivo.id);
        }
      }

      // Traspasos a otra cuenta propia (P1) · mismo mecanismo que efectivo: la
      // línea se materializa como pata de salida y nace su espejo en la cuenta
      // destino. Así netea en el saldo y sale del gráfico (P2/P4).
      for (const { lineaId, cuentaDestinoId } of lineasATraspaso(lineas, decisiones)) {
        await convertirLineaEnTraspaso(lineaId, cuentaDestinoId);
      }

      // §4.7 · el fichero se archiva por cuenta y periodo (traga sus errores).
      if (ficheroRef.current) {
        await archivarExtracto(
          ficheroRef.current,
          cuentaActiva,
          lineas.map((l) => l.fecha)
        );
      }

      // §31 · solo si el usuario lo marcó · se recalcula ahora, con los
      // movimientos que acaban de nacer, y se escribe la apertura derivada.
      if (aplicarLaApertura && apertura?.proponer) {
        await aplicarApertura(cuentaActiva.id, apertura.extremos);
      }

      // Lo último · la sesión deja de estar «a medias». Lo sin resolver no se
      // materializa (D4): sigue siendo línea, y como línea cuenta en el saldo.
      await consolidarSesion(resultado.importBatchId);
      await onGuardado();
      reiniciar();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el extracto.');
      setPaso('resolver');
    }
  }, [resultado, cuentaActiva, cuentaEfectivo, lineas, decisiones, elCuadre, aplicarLaApertura, apertura, onGuardado, reiniciar, onCerrar]);

  // ── Salir sin guardar ─────────────────────────────────────────────────────
  const salirSinGuardar = useCallback(async () => {
    // Cerrar es descartar el lote: sus líneas y lo que el usuario hubiera
    // creado ya en la sesión (movimientos desde la ficha o traspasos, y sus
    // fichas). Sin guardar no queda nada.
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

  // ── Acciones por línea · viven en `decisionesDeSesion` ────────────────────
  /**
   * "Crear movimiento" de §4.7 · la línea no responde a ningún previsto. E1.5 ·
   * el `Movement` NACE aquí desde la línea (`materializarLinea` por dentro de
   * la ficha) con la clasificación que el usuario elige: familia, concepto e
   * inmueble, sobre la ficha prerrellenada.
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
            lineaId: linea.lineaId,
            inmuebleId: v.inmuebleId,
            concepto: v.concepto,
            importe: v.importe,
            fecha: v.fecha,
          });
          marcarCreado(linea.lineaId);
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
          lineaId: linea.lineaId,
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
        marcarCreado(linea.lineaId);
        setCreando(null);
      } catch (err) {
        console.error('[DrawerExtracto] no se pudo clasificar la línea', err);
      }
    },
    [marcarCreado]
  );

  if (!abierto) return null;

  // Los cuatro montones del mockup. `bucketDeLinea` es total, así que esto no
  // puede dejar una línea fuera: la suma de los cuatro es siempre `lineas`.
  const enBucket = (b: Bucket) =>
    lineas.filter((l) => bucketDeLinea(l, decisiones, personales, reconocidas) === b);
  const necesitan = enBucket('te_necesitan');
  const resueltas = enBucket('resueltas');
  const personalesLineas = enBucket('personal');
  const ignoradas = enBucket('ignorados');

  // El aviso de «hay N líneas iguales» se calcula sobre lo que no está ignorado:
  // ofrecer marcar en lote algo que el usuario ya apartó no tiene sentido.
  const visibles = lineas.filter((l) => veredictoEfectivo(l, decisiones) !== 'ignorada');
  const igualesSinResolver = contarIgualesSinResolver(visibles, decisiones);

  /**
   * La línea del banco, con sus acciones de siempre.
   *
   * Se pasa como función a `PanelConciliar` en vez de mover el
   * `LineaExtractoItem` allí dentro: sus manejadores viven aquí, y llevárselos
   * a la pantalla habría significado tocar el único camino que hoy escribe de
   * verdad en la base a cambio de nada.
   */
  const renderLinea = (l: LineaExtracto) => (
    <LineaExtractoItem
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
      sinCaja
    />
  );

  /**
   * «Clasificar las N como…» · la misma ficha, aplicada a todas.
   *
   * Reutiliza `crearDesdeFicha` línea a línea en vez de escribir un camino
   * nuevo: ese es el único sitio que además de guardar el `Movement` crea la
   * fila fiscal del gasto (`gastoDesdeMovimiento`) y da de alta las mejoras.
   * Un atajo que se saltara eso dejaría cinco gastos impecables en Tesorería y
   * ninguno en la declaración, que es el bug que arregló la #1825.
   *
   * En serie y no en paralelo a propósito: `origenIdRecurrenteDelGasto` lee y
   * escribe el mismo origen recurrente para las cinco, y lanzarlas a la vez
   * crearía cinco orígenes distintos para el mismo recibo del agua.
   */
  // Sin `useCallback` a propósito · esto vive después del `return null` de
  // "drawer cerrado", así que un hook aquí se llamaría en unos renders y en
  // otros no. Es un cierre que se usa en un solo sitio; memorizarlo no ahorra
  // nada y romper el orden de los hooks lo rompe todo.
  const clasificarVarias = async (v: GuardadoFicha) => {
    const lineasAClasificar = clasificandoVarias ?? [];
    const valores = valoresPorLinea(v, lineasAClasificar);
    for (let i = 0; i < lineasAClasificar.length; i++) {
      await crearDesdeFicha(lineasAClasificar[i], valores[i]);
    }
    setClasificandoVarias(null);
  };

  // §4.5 prerrellenada · "Crear movimiento" desde una línea sin cuadre. Se monta
  // en las dos ramas del render (pantalla y dropzone), así que vive fuera.
  const fichaDeCreacion = (
    <FichaMovimiento
      abierta={creando != null || clasificandoVarias != null}
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
          : clasificandoVarias?.length
            ? {
                // Se prellena con la primera para que el formulario no salga en
                // blanco; el importe y la fecha de cada una los pone
                // `valoresPorLinea` al guardar, no éstos.
                tipo: clasificandoVarias[0].importe >= 0 ? 'ingreso' : 'gasto',
                concepto: clasificandoVarias[0].textoBanco,
                importe: clasificandoVarias[0].importe,
                fecha: clasificandoVarias[0].fecha,
                cuentaId: cuentaActiva?.id ?? null,
              }
            : undefined
      }
      cuentas={cuentaActiva ? [cuentaActiva] : cuentas}
      inmuebles={inmuebles}
      tarjetas={tarjetas}
      onCerrar={() => {
        setCreando(null);
        setClasificandoVarias(null);
      }}
      onGuardar={(v) =>
        creando ? crearDesdeFicha(creando, v) : clasificandoVarias ? clasificarVarias(v) : undefined
      }
    />
  );

  // Una vez leído el fichero, la conciliación deja de ser un panel lateral y
  // pasa a ocupar la pantalla: son ciento y pico líneas y unas cuantas
  // decisiones, no un formulario de tres campos.
  const enConciliar = paso === 'resolver' || paso === 'guardando';

  if (enConciliar) {
    return (
      <>
        <PanelConciliar
          titularCuenta={tituloDeLaSesion(cuentaActiva, lineas.length)}
          colorBanco={cuentaActiva ? colorDeBanco(cuentaActiva) : undefined}
          elCuadre={elCuadre}
          necesitan={necesitan}
          resueltas={resueltas}
          personales={personalesLineas}
          ignoradas={ignoradas}
          propuestas={propuestas}
          aprendido={aprendido}
          avisos={resultado?.warnings ?? []}
          error={error}
          guardando={paso === 'guardando'}
          apertura={apertura}
          aplicarApertura={aplicarLaApertura}
          onAplicarApertura={setAplicarLaApertura}
          yaEstaban={yaEstaban}
          renderLinea={renderLinea}
          onRecuperar={recuperar}
          onNoEsEsto={desemparejar}
          onIgnorarVarias={ignorarVarias}
          cuentasTraspaso={cuentasDestino}
          onTraspasarVarias={traspasarVarias}
          onClasificarVarias={(ids) =>
            setClasificandoVarias(lineas.filter((l) => ids.includes(l.lineaId)))
          }
          onGuardar={guardar}
          onOtroFichero={salirSinGuardar}
        />
        {fichaDeCreacion}
      </>
    );
  }

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

          {/* ── Paso 1 · soltar el fichero (`ZonaSoltar`) ───────────────── */}
          {!tarjetaDestino && (paso === 'soltar' || paso === 'procesando') && (
            <ZonaSoltar
              cuenta={cuenta}
              cuentas={cuentas}
              tarjetas={tarjetas ?? []}
              deteccion={deteccion}
              procesando={paso === 'procesando'}
              arrastrando={arrastrando}
              setArrastrando={setArrastrando}
              avisoReimport={avisoReimport}
              error={error}
              onElegirCuenta={(elegida) => {
                const f = pendienteRef.current;
                setCuentaElegida(elegida);
                if (f) void procesar(f, elegida);
              }}
              onElegirTarjeta={setTarjetaDestino}
              onFichero={(f) => void recibirFichero(f)}
              onImportarDeTodasFormas={() => {
                const destino = cuentaActiva;
                if (destino && avisoReimport) void procesar(avisoReimport.file, destino, true);
              }}
              onOtroFichero={reiniciar}
              aMedias={aMedias}
              onRetomar={(lote) => void retomar(lote)}
            />
          )}
        </div>
      </aside>

      {fichaDeCreacion}
    </>
  );
};

export default DrawerExtracto;
