// Tesorería V6 · §4.5 · ficha de movimiento (editar / anotar). Formulario PLANO:
// etiqueta + campo. Reglas que los tests fijan: familia/concepto salen del
// catálogo unificado filtrado por ámbito (personal vs inmueble) y la ficha guarda
// `categoryKey` por dentro —el usuario NUNCA elige «categoría fiscal»—; el ingreso
// tiene sus propios conceptos (el alquiler exige inmueble); la transferencia oculta
// familia/concepto/inmueble; no hay campo de documento (la factura vive en el
// Archivo); el tipo solo se elige en alta. La única pregunta fiscal es la derrama
// (D3), y solo en inmueble cuando el concepto la necesita.

import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import {
  familiasDeAmbito,
  conceptosDe,
  proyectar,
  type Ambito,
  type FamiliaId,
  type ProyeccionInmueble,
} from '../../../services/conceptos/catalogoConceptos';
import {
  traducirInmueble,
  keyPersonalDeFamilia,
} from '../../../services/catalogoPresentacionPersistencia';
import { INGRESO_CATEGORIES } from '../../../services/categoryCatalog';
import type { Account } from '../../../services/db';
import { importeSaldo } from './formatoV6';
import styles from './FichaMovimiento.module.css';
import { etiquetaCuenta, parseImporte } from './fichaAuxiliares';
import { toISODateLocal } from '../../../utils/recurrenceDateUtils';
import { cuentasQuePuedenPagar } from '../../../services/cuentasPorMetodoPago';

/**
 * Cómo se paga un GASTO (§ VOCABULARIO-dinero). Un único selector decide qué se
 * pregunta después: con tarjeta no se elige cuenta —la pone la tarjeta—, y en
 * efectivo o Bizum la cuenta la decide el método, no el usuario.
 */
type MetodoDePago = 'cuenta' | 'efectivo' | 'bizum' | 'tarjeta_credito' | 'tarjeta_debito';

// Default ESTABLE · un `= []` inline crea un array nuevo por render y, al estar en
// las deps del efecto de apertura, lo re-dispararía borrando lo tecleado.
const SIN_TARJETAS: Array<{ id: number; alias: string; modalidad?: 'debito' | 'credito' }> = [];

export type TipoMovimiento = 'gasto' | 'ingreso' | 'transferencia';

/** Qué hacer con una derrama · lo decide el usuario, ATLAS no puede saberlo. */
export type NaturalezaDerrama = 'conservacion' | 'mejora';

export interface ValoresFicha {
  tipo: TipoMovimiento;
  concepto: string;
  importe: number;
  fecha: string;
  cuentaId: number | null;
  /** Familia del catálogo unificado (`FamiliaId`). */
  familia?: string;
  /** Concepto del catálogo unificado (`id` del concepto). */
  subtipo?: string;
  /** Clasificación persistida que se conserva si el catálogo no puede invertirla. */
  categoryKey?: string | null;
  subtypeKey?: string | null;
  inmuebleId?: number | null;
  /** Con qué tarjeta se pagó · `null` = ninguna (§3.5). */
  tarjetaId?: number | null;
  /** Solo en transferencia · `null` = externa, fuera de mis cuentas. */
  cuentaDestinoId?: number | null;
  naturalezaDerrama?: NaturalezaDerrama;
}

/** Lo que sale al guardar: los valores + lo que hay que persistir. */
export interface GuardadoFicha extends ValoresFicha {
  /**
   * Traducido desde familia/concepto. `string` clasifica; `null` limpia
   * (transferencia · derrama-mejora, que se amortiza y no lleva key de gasto);
   * `undefined` NO toca lo que hubiera (ficha abierta sin clasificación conocida
   * y el usuario no la eligió · sobrescribir sería reclasificar a su espalda).
   */
  categoryKey?: string | null;
  subtypeKey?: string | null;
  /** true si el movimiento debe darse de alta en `mejorasInmueble`. */
  esMejora: boolean;
}

export interface FichaMovimientoProps {
  abierta: boolean;
  /** `undefined` = alta ("Anotar") · con valores = edición. */
  inicial?: Partial<ValoresFicha>;
  /**
   * Permite prefijar campos en un alta sin convertirla en edición.
   *
   * Tesorería necesita pasar la cuenta y/o la fecha de origen al anotar, pero
   * esos valores no significan que exista todavía un movimiento que editar.
   */
  esEdicion?: boolean;
  /** Importe previsto, para el hint al editar (§4.5). */
  importePrevisto?: number;
  cuentas: Account[];
  inmuebles: Array<{ id: number; alias: string }>;
  /**
   * Las tarjetas entre las que elegir · vacío esconde el selector.
   *
   * Sin ninguna dada de alta, preguntar «¿con qué tarjeta?» es una casilla que
   * solo puede quedarse vacía.
   */
  tarjetas?: Array<{ id: number; alias: string; modalidad?: 'debito' | 'credito' }>;
  onCerrar: () => void;
  onGuardar: (v: GuardadoFicha) => void | Promise<void>;
  /** Solo en edición · el pie muestra la baja a la izquierda. */
  onEliminar?: () => void | Promise<void>;
  /**
   * T4 · cómo se llama esa baja · «Eliminar» o «Descartar».
   *
   * Decía «Eliminar» siempre y solo era verdad la mitad de las veces: sobre una
   * previsión llamaba a descartar —el evento sigue ahí, marcado como que no va
   * a ocurrir— y quien lo pulsaba creía haber borrado algo. Lo decide
   * `etiquetaDeBaja` con lo mismo que decide la ACCIÓN, para que un rótulo
   * suelto no pueda quedarse mintiendo.
   */
  etiquetaEliminar?: string;
  /**
   * §7 · documentos del Archivo que respaldan este movimiento.
   *
   * Enlace discreto, no dropzone: aquí se corrige un importe o una fecha, y
   * poner una zona de subida en medio invita a arrastrar ficheros en la
   * pantalla donde menos toca. Si no hay papel, no se pinta nada.
   */
  documentIds?: number[];
  /**
   * Qué hacer al pulsar ese enlace.
   *
   * Va como callback y no con `useNavigate` aquí dentro a propósito: la ficha
   * es un formulario, no tiene por qué saber que existe un enrutador. Atarla a
   * él la vuelve irrenderizable fuera de un `<Router>` —empezando por sus
   * propios tests— a cambio de nada.
   */
  onAbrirDocumento?: (documentId: number) => void;
}

// Fecha LOCAL, no UTC · a medianoche en España `toISOString()` da el día anterior.
const hoyISO = () => toISODateLocal(new Date());

/** El ámbito de un gasto lo decide si hay inmueble detrás · nada más. */
const ambitoDe = (inmuebleId: number | null): Ambito =>
  inmuebleId != null ? 'inmueble' : 'personal';

/**
 * Valor del selector cuando ATLAS no sabe cómo está clasificado el registro.
 * No es una familia: es la ausencia de elección, y guardar con ella deja la
 * clasificación existente intacta.
 */
const SIN_CLASIFICAR = '';

/** Las keys de ingreso que exigen inmueble (hoy solo el alquiler). */
const INGRESO_CON_INMUEBLE = new Set(
  INGRESO_CATEGORIES.filter((c) => c.requiereInmueble).map((c) => c.key),
);
const INGRESO_KEY_DEFECTO =
  INGRESO_CATEGORIES.find((c) => !c.requiereInmueble)?.key ?? INGRESO_CATEGORIES[0]?.key ?? '';

const FichaMovimiento: React.FC<FichaMovimientoProps> = ({
  abierta,
  inicial,
  importePrevisto,
  cuentas,
  inmuebles,
  tarjetas = SIN_TARJETAS,
  onCerrar,
  onGuardar,
  onEliminar,
  etiquetaEliminar = 'Eliminar',
  documentIds,
  onAbrirDocumento,
  esEdicion: esEdicionProp,
}) => {
  const esEdicion = esEdicionProp ?? inicial != null;

  const [tipo, setTipo] = useState<TipoMovimiento>('gasto');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [familia, setFamilia] = useState<string>('');
  const [subtipo, setSubtipo] = useState<string>('');
  /** Concepto de INGRESO · key del catálogo de ingresos. */
  const [ingresoKey, setIngresoKey] = useState<string>(INGRESO_KEY_DEFECTO);
  const [inmuebleId, setInmuebleId] = useState<number | null>(null);
  const [tarjetaId, setTarjetaId] = useState<number | null>(null);
  const [metodo, setMetodo] = useState<MetodoDePago>('cuenta');
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [derrama, setDerrama] = useState<NaturalezaDerrama | null>(null);
  const [tocado, setTocado] = useState(false);

  // Al abrir, los campos se rellenan con la clasificación automática. El
  // usuario NO parte de un formulario vacío que tenga que completar.
  useEffect(() => {
    if (!abierta) return;
    const tipoIni = inicial?.tipo ?? 'gasto';
    setTipo(tipoIni);
    setConcepto(inicial?.concepto ?? '');
    setImporte(inicial?.importe != null ? String(Math.abs(inicial.importe)).replace('.', ',') : '');
    setFecha(inicial?.fecha ?? hoyISO());
    setCuentaId(inicial?.cuentaId ?? cuentas[0]?.id ?? null);
    setInmuebleId(inicial?.inmuebleId ?? null);
    setTarjetaId(inicial?.tarjetaId ?? null);
    // Método de pago deducido de lo que traiga: con tarjeta, su modalidad; si no,
    // «Cuenta bancaria» (efectivo/Bizum no se reconstruyen aquí).
    const tarIni =
      inicial?.tarjetaId != null ? tarjetas.find((t) => t.id === inicial.tarjetaId) : undefined;
    setMetodo(
      tarIni ? (tarIni.modalidad === 'debito' ? 'tarjeta_debito' : 'tarjeta_credito') : 'cuenta',
    );
    setCuentaDestinoId(inicial?.cuentaDestinoId ?? null);
    setDerrama(inicial?.naturalezaDerrama ?? null);
    setTocado(false);

    // El ingreso parte de su propia clasificación · si el registro traía una
    // key de ingreso, se respeta; si no, la primera que no exige inmueble.
    const keyIni = inicial?.categoryKey;
    setIngresoKey(
      keyIni && INGRESO_CATEGORIES.some((c) => c.key === keyIni) ? keyIni : INGRESO_KEY_DEFECTO,
    );

    // Gasto: familia/concepto del ámbito que toca. En ALTA se parte de la
    // primera familia (una elección desde el primer momento). Al EDITAR sin
    // clasificación conocida se abre SIN CLASIFICAR en vez de fingir una, para
    // que guardar no reclasifique nada que el usuario no haya tocado.
    const amb = ambitoDe(inicial?.inmuebleId ?? null);
    const fam = inicial?.familia ?? (esEdicion ? SIN_CLASIFICAR : familiasDeAmbito(amb)[0]?.id ?? '');
    setFamilia(fam);
    setSubtipo(inicial?.subtipo ?? (fam ? conceptosDe(fam as FamiliaId, amb)[0]?.id ?? '' : ''));
  }, [abierta, inicial, cuentas, tarjetas, esEdicion]);

  const esTransferencia = tipo === 'transferencia';
  const esIngreso = tipo === 'ingreso';
  const esGasto = tipo === 'gasto';
  const ambito = ambitoDe(inmuebleId);

  // ── Método de pago (solo GASTO) · un único selector decide el resto ──────────
  const tarjetasCredito = useMemo(() => tarjetas.filter((t) => t.modalidad === 'credito'), [tarjetas]);
  const tarjetasDebito = useMemo(() => tarjetas.filter((t) => t.modalidad === 'debito'), [tarjetas]);
  const ctaEfectivoPago = useMemo(() => cuentasQuePuedenPagar('efectivo', cuentas)[0], [cuentas]);
  const ctaBizumPago = useMemo(() => cuentasQuePuedenPagar('bizum', cuentas)[0], [cuentas]);
  const metodosDisponibles = useMemo(() => {
    // «Cuenta bancaria» siempre; el resto solo si HAY con qué: sin tarjeta de
    // débito dada de alta no se ofrece «Tarjeta de débito», etc.
    const out: Array<{ id: MetodoDePago; label: string }> = [
      { id: 'cuenta', label: 'Cuenta bancaria' },
    ];
    if (ctaEfectivoPago) out.push({ id: 'efectivo', label: 'Efectivo' });
    if (ctaBizumPago) out.push({ id: 'bizum', label: 'Bizum' });
    if (tarjetasCredito.length > 0) out.push({ id: 'tarjeta_credito', label: 'Tarjeta de crédito' });
    if (tarjetasDebito.length > 0) out.push({ id: 'tarjeta_debito', label: 'Tarjeta de débito' });
    return out;
  }, [ctaEfectivoPago, ctaBizumPago, tarjetasCredito, tarjetasDebito]);

  // Al elegir método se recoloca la cuenta/tarjeta que toca, para que lo que se
  // guarda case con lo que se ve (nada de una cuenta pegada de un método viejo).
  const cambiarMetodo = (m: MetodoDePago) => {
    setMetodo(m);
    if (m === 'tarjeta_credito') {
      setTarjetaId(tarjetasCredito[0]?.id ?? null);
    } else if (m === 'tarjeta_debito') {
      setTarjetaId(tarjetasDebito[0]?.id ?? null);
    } else {
      setTarjetaId(null);
      if (m === 'efectivo' && ctaEfectivoPago?.id != null) setCuentaId(ctaEfectivoPago.id);
      else if (m === 'bizum' && ctaBizumPago?.id != null) setCuentaId(ctaBizumPago.id);
      else setCuentaId((prev) => prev ?? cuentas[0]?.id ?? null);
    }
  };
  const tarjetasDelMetodo = metodo === 'tarjeta_debito' ? tarjetasDebito : tarjetasCredito;

  const familias = useMemo(() => (esGasto ? familiasDeAmbito(ambito) : []), [esGasto, ambito]);
  const conceptos = useMemo(
    () => (esGasto && familia !== SIN_CLASIFICAR ? conceptosDe(familia as FamiliaId, ambito) : []),
    [esGasto, familia, ambito],
  );

  /**
   * Sacar del cajero es una TRANSFERENCIA INTERNA a la cuenta de Efectivo · el
   * dinero no se gasta, cambia de sitio.
   *
   * El botón no estrena ningún concepto nuevo: rellena el formulario —tipo
   * transferencia, destino la cuenta de efectivo y la descripción puesta— para
   * que la retirada no haya que armarla a mano cada vez. Y si no hay cuenta de
   * efectivo se dice, en vez de ofrecer un botón que no puede hacer nada.
   */
  const cuentaEfectivo = useMemo(() => cuentas.find((c) => c.tipo === 'EFECTIVO'), [cuentas]);
  const esCajero =
    esTransferencia && cuentaEfectivo?.id != null && cuentaDestinoId === cuentaEfectivo.id;

  // La proyección del concepto elegido · de aquí sale la key que se persiste y
  // si el concepto obliga a preguntar (derrama).
  const proyeccion = useMemo(
    () => (esGasto && familia !== SIN_CLASIFICAR ? proyectar(subtipo, ambito) : undefined),
    [esGasto, familia, subtipo, ambito],
  );
  const necesitaPregunta =
    ambito === 'inmueble' && (proyeccion as ProyeccionInmueble | undefined)?.estado === 'pregunta';
  // Las salidas de la pregunta viven en la tabla de traducción (fuente única de
  // la decisión fiscal de la derrama). Hoy la única `pregunta` es
  // `comunidad:derrama`, cuyos ids coinciden en los dos catálogos.
  const opcionesDerrama = necesitaPregunta
    ? traducirInmueble(familia, subtipo)?.opciones
    : undefined;

  const faltaInmuebleIngreso = esIngreso && INGRESO_CON_INMUEBLE.has(ingresoKey) && inmuebleId == null;

  const importeNum = parseImporte(importe);
  const errorImporte = tocado && (importeNum == null || importeNum <= 0);
  const errorDestino = tocado && esTransferencia && cuentaDestinoId === undefined;
  const errorInmuebleIngreso = tocado && faltaInmuebleIngreso;
  const faltaDerrama = necesitaPregunta && derrama == null;
  const puedeGuardar =
    importeNum != null && importeNum > 0 && !faltaDerrama && !faltaInmuebleIngreso;

  /** Cambiar de inmueble mueve el ámbito · el gasto reajusta familia/concepto. */
  const cambiarInmueble = (nuevo: number | null) => {
    setInmuebleId(nuevo);
    if (!esGasto || familia === SIN_CLASIFICAR) return;
    const amb = ambitoDe(nuevo);
    const fams = familiasDeAmbito(amb);
    const fam = fams.some((f) => f.id === familia) ? familia : fams[0]?.id ?? '';
    const cs = conceptosDe(fam as FamiliaId, amb);
    const sub = fam === familia && cs.some((c) => c.id === subtipo) ? subtipo : cs[0]?.id ?? '';
    if (fam !== familia) setFamilia(fam);
    if (sub !== subtipo) setSubtipo(sub);
    setDerrama(null);
  };

  const guardar = () => {
    setTocado(true);
    if (!puedeGuardar || importeNum == null) return;

    // Traducción PRESENTACIÓN → PERSISTENCIA, por tipo:
    let categoryKey: string | null | undefined;
    let subtypeKey: string | null | undefined = null;
    let esMejora = false;
    let naturaleza: NaturalezaDerrama | undefined;

    if (esTransferencia) {
      // Un traspaso no es gasto fiscal · sin clasificación.
      categoryKey = null;
      subtypeKey = null;
    } else if (esIngreso) {
      // El ingreso lleva su propia key · nunca una familia de gasto.
      categoryKey = ingresoKey || null;
      subtypeKey = null;
    } else if (familia === SIN_CLASIFICAR) {
      // Se editaba algo que abrió sin clasificar y el usuario no eligió: no se
      // toca (`undefined`), no se sobreescribe con la primera del catálogo.
      categoryKey = inicial?.categoryKey;
      subtypeKey = inicial?.subtypeKey;
    } else if (ambito === 'inmueble') {
      const proy = proyeccion as ProyeccionInmueble | undefined;
      if (necesitaPregunta) {
        // Derrama · la respuesta decide la key. Una mejora NO es gasto: se
        // capitaliza y amortiza, así que no lleva key de gasto sino alta en
        // `mejorasInmueble`.
        const opt = derrama ? opcionesDerrama?.[derrama] : undefined;
        esMejora = Boolean(opt?.esMejora);
        categoryKey = opt?.categoryKey ?? null;
        naturaleza = derrama ?? undefined;
        subtypeKey = null;
      } else {
        categoryKey = proy?.categoryKey ?? null;
        // `null` (no `undefined`) para que reclasificar a un concepto sin
        // variante borre el subtipo viejo en vez de dejarlo pegado.
        subtypeKey = proy?.subtypeKey ?? null;
      }
    } else {
      // Personal · las trece familias colapsan en las cinco macro-categorías
      // `gasto_personal_*`; sin casilla AEAT (no se declara).
      categoryKey = keyPersonalDeFamilia(familia);
      subtypeKey = null;
    }

    const resultado = onGuardar({
      tipo,
      concepto,
      // El signo lo marca el tipo, no lo que teclee el usuario.
      importe: esIngreso ? Math.abs(importeNum) : -Math.abs(importeNum),
      fecha,
      cuentaId,
      ...(esGasto ? { familia, subtipo } : {}),
      // El inmueble viaja en gasto (ámbito) y en ingreso (alquiler); un traspaso
      // entre cuentas propias no tiene inmueble.
      inmuebleId: esTransferencia ? null : inmuebleId,
      // Solo un gasto se paga con tarjeta · dejarla puesta en un ingreso o un
      // traspaso la atribuiría a algo que no es un gasto suyo.
      tarjetaId: esGasto ? tarjetaId : null,
      ...(esTransferencia ? { cuentaDestinoId } : {}),
      ...(naturaleza ? { naturalezaDerrama: naturaleza } : {}),
      categoryKey,
      subtypeKey,
      esMejora,
    });

    // El guardado real es asíncrono y puede fallar. La ficha no puede dejar la
    // promesa suelta: un rechazo aquí sería un unhandled rejection.
    if (resultado && typeof (resultado as Promise<void>).catch === 'function') {
      (resultado as Promise<void>).catch((err) => {
        console.error('[FichaMovimiento] el guardado falló', err);
      });
    }
  };

  if (!abierta) return null;

  return (
    <>
      <div className={`${styles.back} ${styles.backOpen}`} onClick={onCerrar} aria-hidden="true" />
      <div
        className={`${styles.sheet} ${styles.sheetOpen}`}
        role="dialog"
        aria-modal="true"
        aria-label={esEdicion ? 'Editar movimiento' : 'Anotar movimiento'}
      >
        <div className={styles.hd}>
          <div>
            {/* §7 · el título dice de QUÉ movimiento se trata. "Movimiento" a
                secas no identifica nada: abriendo desde una lista de doscientos
                no hay forma de saber si es el que se quería tocar. */}
            <div className={styles.kicker}>
              {esEdicion ? 'Editar previsión' : 'Anotar movimiento'}
            </div>
            <h3 className={styles.title}>{concepto?.trim() || 'Movimiento'}</h3>
          </div>
          <button type="button" className={styles.close} onClick={onCerrar} aria-label="Cerrar">
            <Icons.Close size={17} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
          {/* El tipo solo se elige al dar de alta: al editar ya está decidido. */}
          {!esEdicion && (
            <div className={styles.tipoTg} role="group" aria-label="Tipo de movimiento">
              {(['gasto', 'ingreso', 'transferencia'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t && !esCajero}
                  className={`${styles.tipoBtn} ${tipo === t && !esCajero ? styles.tipoOn : ''}`}
                  onClick={() => {
                    setTipo(t);
                    // Salir de "Cajero" SUELTA el destino que puso el atajo: si
                    // no, una transferencia normal nacía apuntando a la cuenta
                    // de efectivo sin que nadie lo hubiera pedido. Se queda en
                    // "externa", que es de donde partía la ficha.
                    if (esCajero) setCuentaDestinoId(null);
                  }}
                >
                  {t === 'gasto' ? 'Gasto' : t === 'ingreso' ? 'Ingreso' : 'Transferencia'}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={esCajero}
                className={`${styles.tipoBtn} ${esCajero ? styles.tipoOn : ''}`}
                disabled={cuentaEfectivo?.id == null}
                title={
                  cuentaEfectivo?.id == null
                    ? 'Necesitas una cuenta de Efectivo · créala en Cuentas'
                    : `Sacar dinero a ${cuentaEfectivo.alias || 'Efectivo'}`
                }
                onClick={() => {
                  if (cuentaEfectivo?.id == null) return;
                  setTipo('transferencia');
                  setCuentaDestinoId(cuentaEfectivo.id);
                  if (!concepto.trim()) setConcepto('Retirada de cajero');
                }}
              >
                Cajero
              </button>
            </div>
          )}

          {/* §7 · el texto libre es DESCRIPCIÓN.
              Se llamaba "Concepto" igual que el campo del catálogo que hay más
              abajo: dos campos con el mismo nombre en el mismo formulario, y
              ninguna forma de saber cuál pide qué. El de arriba lo escribe el
              usuario; el de abajo se elige de una lista. */}
          <div className={styles.fld}>
            <label className={styles.lab} htmlFor="fm-concepto">Descripción</label>
            <input
              id="fm-concepto"
              className={styles.input}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className={styles.fld2}>
            <div className={styles.fld}>
              <label className={styles.lab} htmlFor="fm-importe">Importe real</label>
              <input
                id="fm-importe"
                className={`${styles.input} ${styles.mono} ${errorImporte ? styles.inputError : ''}`}
                value={importe}
                inputMode="decimal"
                onChange={(e) => setImporte(e.target.value)}
              />
              {/* El único hint del formulario (§4.5). */}
              {importePrevisto != null && (
                <div className={styles.hint}>previsto {importeSaldo(importePrevisto)}</div>
              )}
              {errorImporte && <div className={styles.error}>Escribe un importe mayor que cero</div>}
              {documentIds && documentIds.length > 0 && onAbrirDocumento && (
                <button
                  type="button"
                  className={styles.docLink}
                  onClick={() => onAbrirDocumento(documentIds[0])}
                >
                  <Icons.Contratos size={11} strokeWidth={1.8} />
                  {/* Se abre el primero, así que el texto no promete los N:
                      decir "ver los 3" y llevar a uno es una promesa rota. Se
                      dice cuántos hay, que es información útil, sin ofrecer
                      algo que este enlace no hace. */}
                  {documentIds.length === 1
                    ? 'Ver el documento'
                    : `Ver el documento (hay ${documentIds.length})`}
                </button>
              )}
            </div>
            <div className={styles.fld}>
              <label className={styles.lab} htmlFor="fm-fecha">Fecha</label>
              <input
                id="fm-fecha"
                type="date"
                className={`${styles.input} ${styles.mono}`}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {esGasto ? (
            /* Un GASTO se paga de una forma · el método decide qué se pregunta:
               con tarjeta no hay cuenta que elegir, y en efectivo/Bizum la cuenta
               la pone el método, no el usuario. */
            <div className={styles.fld}>
              <label className={styles.lab} htmlFor="fm-metodo">Método de pago</label>
              <select
                id="fm-metodo"
                className={styles.select}
                value={metodo}
                onChange={(e) => cambiarMetodo(e.target.value as MetodoDePago)}
              >
                {metodosDisponibles.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>

              {metodo === 'cuenta' && (
                <select
                  aria-label="Cuenta de cargo"
                  className={styles.select}
                  style={{ marginTop: 8 }}
                  value={cuentaId ?? ''}
                  onChange={(e) => setCuentaId(e.target.value ? Number(e.target.value) : null)}
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>{etiquetaCuenta(c)}</option>
                  ))}
                </select>
              )}

              {(metodo === 'efectivo' || metodo === 'bizum') && (
                <div className={styles.hint}>
                  Sale de {etiquetaCuenta((metodo === 'efectivo' ? ctaEfectivoPago : ctaBizumPago)!)}
                </div>
              )}

              {(metodo === 'tarjeta_credito' || metodo === 'tarjeta_debito') && (
                <>
                  <select
                    aria-label="Tarjeta"
                    className={styles.select}
                    style={{ marginTop: 8 }}
                    value={tarjetaId ?? ''}
                    onChange={(e) => setTarjetaId(e.target.value ? Number(e.target.value) : null)}
                  >
                    {tarjetasDelMetodo.map((t) => (
                      <option key={t.id} value={t.id}>{t.alias}</option>
                    ))}
                  </select>
                  {metodo === 'tarjeta_credito' && (
                    <div className={styles.hint}>
                      Crédito · el cargo no sale de la cuenta ahora; engorda el recibo de la
                      tarjeta y la cuenta se mueve cuando llega.
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className={styles.fld}>
              <label className={styles.lab} htmlFor="fm-cuenta">Cuenta</label>
              <select
                id="fm-cuenta"
                className={styles.select}
                value={cuentaId ?? ''}
                onChange={(e) => setCuentaId(e.target.value ? Number(e.target.value) : null)}
              >
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {etiquetaCuenta(c)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {esTransferencia ? (
            /* Transferencia: sin familia, concepto ni inmueble · no es gasto fiscal. */
            <div className={styles.fld}>
              <label className={styles.lab} htmlFor="fm-destino">Cuenta destino</label>
              <select
                id="fm-destino"
                className={`${styles.select} ${errorDestino ? styles.inputError : ''}`}
                value={cuentaDestinoId ?? ''}
                onChange={(e) => setCuentaDestinoId(e.target.value ? Number(e.target.value) : null)}
              >
                {cuentas
                  .filter((c) => c.id !== cuentaId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{etiquetaCuenta(c)}</option>
                  ))}
                <option value="">Externa · fuera de mis cuentas</option>
              </select>
            </div>
          ) : esIngreso ? (
            /* Ingreso: concepto propio (no familias de gasto) + inmueble para la renta. */
            <>
              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-ingreso">Concepto</label>
                <select
                  id="fm-ingreso"
                  aria-label="Concepto del ingreso"
                  className={styles.select}
                  value={ingresoKey}
                  onChange={(e) => setIngresoKey(e.target.value)}
                >
                  {INGRESO_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-inmueble">Inmueble</label>
                <select
                  id="fm-inmueble"
                  className={`${styles.select} ${errorInmuebleIngreso ? styles.inputError : ''}`}
                  value={inmuebleId ?? ''}
                  onChange={(e) => cambiarInmueble(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin inmueble · personal</option>
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.id}>{i.alias}</option>
                  ))}
                </select>
                {faltaInmuebleIngreso && (
                  <div className={styles.error}>El alquiler necesita un inmueble</div>
                )}
              </div>
            </>
          ) : (
            /* Gasto: familia + concepto del catálogo unificado, filtrados por ámbito. */
            <>
              {/* El inmueble va PRIMERO: decide el ÁMBITO (personal vs inmueble) y,
                  con él, qué familias y conceptos se ofrecen (los enseres del piso
                  solo existen en ámbito inmueble). Tenerlo al final obligaba a
                  adivinar la familia antes de decir de qué es el gasto. */}
              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-inmueble">Inmueble</label>
                <select
                  id="fm-inmueble"
                  className={styles.select}
                  value={inmuebleId ?? ''}
                  onChange={(e) => cambiarInmueble(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin inmueble · personal</option>
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.id}>{i.alias}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-familia">Familia</label>
                <select
                  id="fm-familia"
                  className={styles.select}
                  value={familia}
                  onChange={(e) => {
                    const f = e.target.value;
                    setFamilia(f);
                    setSubtipo(f ? conceptosDe(f as FamiliaId, ambito)[0]?.id ?? '' : '');
                    setDerrama(null);
                  }}
                >
                  {/* Solo mientras siga sin clasificar · en cuanto el usuario
                      elige algo, no hay vuelta a "no sé". */}
                  {familia === SIN_CLASIFICAR && (
                    <option value={SIN_CLASIFICAR}>Sin clasificar</option>
                  )}
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-subtipo">Concepto</label>
                <select
                  id="fm-subtipo"
                  aria-label="Concepto del gasto"
                  className={styles.select}
                  value={subtipo}
                  onChange={(e) => {
                    setSubtipo(e.target.value);
                    setDerrama(null);
                  }}
                  disabled={familia === SIN_CLASIFICAR}
                >
                  {familia === SIN_CLASIFICAR && (
                    <option value="">Elige antes la familia</option>
                  )}
                  {conceptos.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* La ÚNICA pregunta fiscal de la ficha, y solo cuando toca. */}
              {necesitaPregunta && (
                <div className={styles.pregunta}>
                  <div className={styles.preguntaT}>¿Conservación o mejora?</div>
                  <div className={styles.preguntaS}>
                    Una derrama de conservación se deduce este año. Una mejora se suma al valor del
                    inmueble y se amortiza. No podemos saberlo por ti.
                  </div>
                  <div className={styles.preguntaOpts}>
                    {Object.entries(opcionesDerrama ?? {}).map(([clave, opt]) => (
                      <button
                        key={clave}
                        type="button"
                        aria-pressed={derrama === clave}
                        className={`${styles.preguntaOpt} ${derrama === clave ? styles.preguntaOn : ''}`}
                        onClick={() => setDerrama(clave as NaturalezaDerrama)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* La tarjeta ya no vive aquí: es parte del «Método de pago» de
                  arriba (§3.5), que decide cuenta vs tarjeta en un solo sitio. */}
            </>
          )}
        </div>

        <div className={styles.ft}>
          {esEdicion && onEliminar && (
            <button type="button" className={styles.del} onClick={() => void onEliminar()}>
              {etiquetaEliminar}
            </button>
          )}
          {!(esEdicion && onEliminar) && <span style={{ marginRight: 'auto' }} />}
          <button type="button" className={styles.btn} onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            onClick={guardar}
            disabled={faltaDerrama}
            title={faltaDerrama ? 'Dinos si la derrama es conservación o mejora' : undefined}
          >
            Guardar
          </button>
        </div>
      </div>
    </>
  );
};

export { parseImporte };
export default FichaMovimiento;
