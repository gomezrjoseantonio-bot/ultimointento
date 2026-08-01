// ============================================================================
// Tesorería V6 · §4.5 · ficha de movimiento (editar / anotar)
// ============================================================================
//
// Formulario PLANO: etiqueta + campo. Sin iconos decorativos, sin chips, sin
// frases de ayuda innecesarias — confirmar tiene que ser rápido.
//
// Reglas de §4.5 que el código cumple y los tests fijan:
//   · Familia y concepto vienen PREFIJADOS por la clasificación automática de
//     ATLAS. El usuario solo corrige si se equivocó.
//   · NUNCA se le pide elegir "categoría fiscal": el mapeo a la casilla de
//     Hacienda es responsabilidad de ATLAS, no suya. Por eso la ficha enseña
//     familia/concepto (presentación) y guarda `categoryKey` (persistencia),
//     traduciendo por dentro.
//   · Transferencia oculta familia/concepto/inmueble y pide cuenta destino.
//     No es gasto fiscal.
//   · NO hay campo de documento: la factura vive en el Archivo (§4.5).
//   · Tipo solo en alta. Al editar, el tipo ya está decidido.
//
// La única pregunta fiscal es la derrama (D3), y solo aparece cuando el
// concepto elegido de verdad la necesita.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { TIPOS_GASTO_INMUEBLE_V2 } from '../../inmuebles/wizards/utils/tiposDeGastoInmueble';
import { traducirInmueble } from '../../../services/catalogoPresentacionPersistencia';
import type { Account } from '../../../services/db';
import { importeSaldo } from './formatoV6';
import styles from './FichaMovimiento.module.css';

export type TipoMovimiento = 'gasto' | 'ingreso' | 'transferencia';

/** Qué hacer con una derrama · lo decide el usuario, ATLAS no puede saberlo. */
export type NaturalezaDerrama = 'conservacion' | 'mejora';

export interface ValoresFicha {
  tipo: TipoMovimiento;
  concepto: string;
  importe: number;
  fecha: string;
  cuentaId: number | null;
  /** Familia del catálogo de presentación (`tipoId`). */
  familia?: string;
  /** Concepto del catálogo de presentación (`subtipoId`). */
  subtipo?: string;
  inmuebleId?: number | null;
  /** Solo en transferencia · `null` = externa, fuera de mis cuentas. */
  cuentaDestinoId?: number | null;
  naturalezaDerrama?: NaturalezaDerrama;
}

/** Lo que sale al guardar: los valores + lo que hay que persistir. */
export interface GuardadoFicha extends ValoresFicha {
  /**
   * Traducido desde familia/concepto.
   *   · `string`    → clasificar así.
   *   · `null`      → limpiar la clasificación (transferencia · derrama-mejora,
   *                   que no lleva key de gasto porque se amortiza).
   *   · `undefined` → NO tocar lo que ya hubiera. Pasa cuando la ficha abrió
   *                   sin conocer la clasificación del registro y el usuario no
   *                   la eligió: sobrescribirla con la primera del catálogo
   *                   sería reclasificar a su espalda.
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
  /** Importe previsto, para el hint al editar (§4.5). */
  importePrevisto?: number;
  cuentas: Account[];
  inmuebles: Array<{ id: number; alias: string }>;
  onCerrar: () => void;
  onGuardar: (v: GuardadoFicha) => void | Promise<void>;
  /** Solo en edición · el pie muestra Eliminar a la izquierda. */
  onEliminar?: () => void | Promise<void>;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Familias que ofrece el selector · Financiación y Traspaso NO son categoría (D3). */
const FAMILIAS = TIPOS_GASTO_INMUEBLE_V2;

/**
 * Valor del selector cuando ATLAS no sabe cómo está clasificado el registro.
 * No es una familia: es la ausencia de elección, y guardar con ella deja la
 * clasificación existente intacta.
 */
const SIN_CLASIFICAR = '';

const FichaMovimiento: React.FC<FichaMovimientoProps> = ({
  abierta,
  inicial,
  importePrevisto,
  cuentas,
  inmuebles,
  onCerrar,
  onGuardar,
  onEliminar,
}) => {
  const esEdicion = inicial != null;

  const [tipo, setTipo] = useState<TipoMovimiento>('gasto');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [familia, setFamilia] = useState<string>(FAMILIAS[0]?.id ?? '');
  const [subtipo, setSubtipo] = useState<string>('');
  const [inmuebleId, setInmuebleId] = useState<number | null>(null);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [derrama, setDerrama] = useState<NaturalezaDerrama | null>(null);
  const [tocado, setTocado] = useState(false);

  // Al abrir, los campos se rellenan con la clasificación automática. El
  // usuario NO parte de un formulario vacío que tenga que completar.
  useEffect(() => {
    if (!abierta) return;
    setTipo(inicial?.tipo ?? 'gasto');
    setConcepto(inicial?.concepto ?? '');
    setImporte(inicial?.importe != null ? String(Math.abs(inicial.importe)).replace('.', ',') : '');
    setFecha(inicial?.fecha ?? hoyISO());
    setCuentaId(inicial?.cuentaId ?? cuentas[0]?.id ?? null);
    // En ALTA se parte de la primera familia, que es una elección del usuario
    // desde el primer momento. Al EDITAR, si no se conoce la clasificación del
    // registro, se abre SIN CLASIFICAR en vez de fingir una: así guardar no
    // reclasifica nada que el usuario no haya tocado.
    const fam = inicial?.familia ?? (esEdicion ? SIN_CLASIFICAR : FAMILIAS[0]?.id ?? '');
    setFamilia(fam);
    setSubtipo(inicial?.subtipo ?? subtiposDe(fam)[0]?.id ?? '');
    setInmuebleId(inicial?.inmuebleId ?? null);
    setCuentaDestinoId(inicial?.cuentaDestinoId ?? null);
    setDerrama(inicial?.naturalezaDerrama ?? null);
    setTocado(false);
  }, [abierta, inicial, cuentas, esEdicion]);

  const subtipos = useMemo(() => subtiposDe(familia), [familia]);
  const esTransferencia = tipo === 'transferencia';
  const clasificable = !esTransferencia;

  const traduccion = clasificable ? traducirInmueble(familia, subtipo) : undefined;
  const necesitaPregunta = traduccion?.estado === 'pregunta';

  const importeNum = parseImporte(importe);
  const errorImporte = tocado && (importeNum == null || importeNum <= 0);
  const errorDestino = tocado && esTransferencia && cuentaDestinoId === undefined;
  const faltaDerrama = necesitaPregunta && derrama == null;
  const puedeGuardar = importeNum != null && importeNum > 0 && !faltaDerrama;

  const guardar = () => {
    setTocado(true);
    if (!puedeGuardar || importeNum == null) return;

    // Una mejora NO es gasto: se capitaliza y amortiza, así que no lleva
    // `categoryKey` de gasto sino alta en `mejorasInmueble` (D3).
    // La respuesta a la pregunta decide la key: la tabla no puede fijarla, pero
    // sí sabe a dónde va cada opción.
    const opcion = necesitaPregunta && derrama ? traduccion?.opciones?.[derrama] : undefined;
    const esMejora = Boolean(opcion?.esMejora);

    // `undefined` = "no toques la clasificación". Solo cuando se edita algo que
    // abrió sin clasificar y el usuario tampoco eligió familia.
    const sinElegir = clasificable && familia === SIN_CLASIFICAR;
    const keyElegida = necesitaPregunta
      ? opcion?.categoryKey ?? null
      : traduccion?.categoryKey ?? null;

    const resultado = onGuardar({
      tipo,
      concepto,
      // El signo lo marca el tipo, no lo que teclee el usuario.
      importe: tipo === 'ingreso' ? Math.abs(importeNum) : -Math.abs(importeNum),
      fecha,
      cuentaId,
      ...(clasificable ? { familia, subtipo } : {}),
      inmuebleId: clasificable ? inmuebleId : null,
      ...(esTransferencia ? { cuentaDestinoId } : {}),
      ...(necesitaPregunta && derrama ? { naturalezaDerrama: derrama } : {}),
      categoryKey: sinElegir ? undefined : keyElegida,
      // `null` (no `undefined`) para que reclasificar a un concepto sin
      // variante borre el subtipo viejo en vez de dejarlo pegado.
      subtypeKey: sinElegir ? undefined : traduccion?.subtypeKey ?? null,
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
                  aria-pressed={tipo === t}
                  className={`${styles.tipoBtn} ${tipo === t ? styles.tipoOn : ''}`}
                  onClick={() => setTipo(t)}
                >
                  {t === 'gasto' ? 'Gasto' : t === 'ingreso' ? 'Ingreso' : 'Transferencia'}
                </button>
              ))}
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

          {/* Transferencia: sin familia, concepto ni inmueble · no es gasto fiscal. */}
          {clasificable ? (
            <>
              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-familia">Familia</label>
                <select
                  id="fm-familia"
                  className={styles.select}
                  value={familia}
                  onChange={(e) => {
                    setFamilia(e.target.value);
                    setSubtipo(subtiposDe(e.target.value)[0]?.id ?? '');
                    setDerrama(null);
                  }}
                >
                  {/* Solo mientras siga sin clasificar · en cuanto el usuario
                      elige algo, no hay vuelta a "no sé". */}
                  {familia === SIN_CLASIFICAR && (
                    <option value={SIN_CLASIFICAR}>Sin clasificar</option>
                  )}
                  {FAMILIAS.map((f) => (
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
                  {subtipos.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
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
                    {Object.entries(traduccion?.opciones ?? {}).map(([clave, opt]) => (
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

              <div className={styles.fld}>
                <label className={styles.lab} htmlFor="fm-inmueble">Inmueble</label>
                <select
                  id="fm-inmueble"
                  className={styles.select}
                  value={inmuebleId ?? ''}
                  onChange={(e) => setInmuebleId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin inmueble · personal</option>
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.id}>{i.alias}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
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
          )}
        </div>

        <div className={styles.ft}>
          {esEdicion && onEliminar && (
            <button type="button" className={styles.del} onClick={() => void onEliminar()}>
              Eliminar
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

// ─── Auxiliares ─────────────────────────────────────────────────────────────

function subtiposDe(familiaId: string): Array<{ id: string; label: string }> {
  return FAMILIAS.find((f) => f.id === familiaId)?.subtipos ?? [];
}

function etiquetaCuenta(c: Account): string {
  const nombre = c.alias || c.name || c.banco?.name || 'Cuenta';
  const mask = c.ultimosCuatro || c.iban?.slice(-4);
  return mask ? `${nombre} ···· ${mask}` : nombre;
}

/** Acepta coma o punto decimal · devuelve `null` si no es un importe válido. */
export function parseImporte(raw: string): number | null {
  const sinAdornos = raw.replace(/[€\s]/g, '');
  if (!sinAdornos) return null;
  // Con coma, el punto es separador de miles ("1.234,50"). Sin coma, un punto
  // es decimal ("74.09"): quitarlo siempre convertiría 74.09 en 7409.
  const normalizado = sinAdornos.includes(',')
    ? sinAdornos.replace(/\./g, '').replace(',', '.')
    : sinAdornos;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export default FichaMovimiento;
