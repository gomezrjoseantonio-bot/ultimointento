// ============================================================================
// Conciliar · Zona 2 · la tarjeta de una ENTIDAD que pide decisión
// ============================================================================
//
// Como el mockup (`mockup-conciliacion_11.html`) · Jose, 12 sep:
//
//   «Iberdrola · luz · CUPS X · 24 recibos · ¿De qué piso es este punto?»
//     [Fuertes Acevedo 32]  [Otro piso]  [Personal]
//   «Víctor Lada · bizums · ¿qué es?»
//     [Es personal]  [Elegir categoría]  [Es un traspaso mío]
//
// UN botón en oro con el piso que ATLAS supone (si lo supone); «Otro piso»
// abre un selector de piso (el mismo `<select>` que la ficha) y ahí se fija;
// «Personal» sin piso. Nunca un botón por cada piso. Ningún botón escribe:
// abren la ficha de siempre UNA vez para todos (P1) o mandan a ignorar /
// traspasar por los manejadores que ya existían. Dentro, al desplegar, cada
// línea es el `LineaExtractoItem` del drawer: el único camino que escribe.
//
// Sin ruido: la banda de propuesta solo cuando ATLAS dice algo real; la ayuda
// va en un icono ⓘ, no en un párrafo.

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { Entidad } from './agruparPorEntidad';
import type { Propuesta } from './propuestaDeLinea';
import GrupoEntidad from './GrupoEntidad';
import type { LineaExtracto } from '../extractoSesion';
import styles from './PanelConciliar.module.css';

export interface TarjetaAccionProps {
  entidad: Entidad;
  propuesta: Propuesta;
  abierta: boolean;
  onAbrir: () => void;
  /** La casilla de elegir · para la barra en bloque. */
  elegible?: { elegida: boolean; onElegir: () => void };
  /** Los pisos entre los que elegir · vacío si el usuario no tiene ninguno. */
  inmuebles?: ReadonlyArray<{ id: number; alias: string }>;
  cuentasTraspaso?: ReadonlyArray<{ id: number; nombre: string }>;
  /** «Elegir categoría» · la ficha una vez para todos. */
  onClasificar: (lineaIds: number[]) => void;
  /** El piso elegido · la ficha prerrellenada con ese piso (`null` = personal). */
  onClasificarEnPiso?: (lineaIds: number[], inmuebleId: number | null) => void;
  onIgnorar: (lineaIds: number[]) => void;
  onTraspasar?: (lineaIds: number[], cuentaDestinoId: number) => void;
  renderLinea: (linea: LineaExtracto) => React.ReactNode;
}

/** El icono habla del TONO, no de la categoría · no adelanta un veredicto. */
function IconoDeTono({ tono }: { tono: Propuesta['tono'] }) {
  if (tono === 'confirma') return <Icons.Warning size={15} />;
  return <Icons.Lightbulb size={15} />;
}

const CLASE_POR_TONO: Record<Propuesta['tono'], string> = {
  propone: '',
  confirma: styles.tonoConfirma,
  pregunta: styles.tonoPregunta,
};

/**
 * La banda solo cuando ATLAS dice algo REAL: propone o confirma con motivo, se
 * va a recordar, o hay un aviso del motor (el IVA). La pregunta abierta es el
 * chip «¿Qué es?» y nada más.
 */
function diceAlgo(p: Propuesta): boolean {
  return p.tono !== 'pregunta' || p.seRecuerda || !p.titular.startsWith('No sé qué es');
}

const TarjetaAccion: React.FC<TarjetaAccionProps> = ({
  entidad: e,
  propuesta,
  abierta,
  onAbrir,
  elegible,
  inmuebles = [],
  cuentasTraspaso = [],
  onClasificar,
  onClasificarEnPiso,
  onIgnorar,
  onTraspasar,
  renderLinea,
}) => {
  // «Otro piso» / «Es un traspaso mío» despliegan su selector al pulsar · no antes.
  const [eligiendo, setEligiendo] = React.useState<'piso' | 'traspaso' | null>(null);

  const ids = e.lineas.map((l) => l.lineaId);
  const n = ids.length;
  // El traspaso en bloque sólo cabe sobre CARGOS: la pata de salida de un
  // traspaso es un cargo; sobre un abono sería crear el traspaso al revés.
  const todoCargos = e.lineas.every((l) => l.importe < 0);
  const cabeTraspaso = todoCargos && cuentasTraspaso.length > 0 && onTraspasar != null;
  const cabePiso = onClasificarEnPiso != null && !e.interno;
  // ¿Sabe QUÉ es pero no DE QUIÉN? · entonces la pregunta es el piso.
  const preguntaPiso = Boolean(e.clasificacion?.familia) && e.clasificacion?.inmuebleId == null && cabePiso;
  const pisoProbable = propuesta.pisoProbable && inmuebles.some((i) => i.id === propuesta.pisoProbable?.id) ? propuesta.pisoProbable : undefined;
  const chip = preguntaPiso ? 'Confirmar piso' : propuesta.tono === 'pregunta' ? '¿Qué es?' : 'Confirmar';

  const btnGhost = `${styles.btn} ${styles.btnGhost}`;
  const btnOro = `${styles.btn} ${styles.btnOro}`;

  return (
    <GrupoEntidad
      entidad={e}
      variante="confirmar"
      chip={chip}
      abierta={abierta}
      onAbrir={onAbrir}
      className={`${CLASE_POR_TONO[propuesta.tono]} ${elegible?.elegida ? styles.entElegida : ''}`}
      banda={
        <div className={styles.entBanda}>
          {diceAlgo(propuesta) && (
            <div className={styles.propuesta}>
              <span className={styles.propIco} aria-hidden="true">
                <IconoDeTono tono={propuesta.tono} />
              </span>
              <span className={styles.propTxt}>
                <span className={styles.propQ}>{propuesta.titular}</span>
              </span>
              {/* El sello solo cuando es verdad · la heurística no escribe regla. */}
              {propuesta.seRecuerda && (
                <span className={styles.sello}>
                  <Icons.Lightbulb size={13} />
                  se recordará
                </span>
              )}
            </div>
          )}
          <div className={styles.entAcciones}>
            {elegible && (
              <input
                type="checkbox"
                className={styles.casilla}
                checked={elegible.elegida}
                onChange={elegible.onElegir}
                aria-label={`Elegir ${e.nombre}`}
              />
            )}
            {preguntaPiso ? (
              <>
                {pisoProbable && (
                  <button type="button" className={btnOro} onClick={() => onClasificarEnPiso?.(ids, pisoProbable.id)}>
                    <Icons.Inmuebles size={14} />
                    {pisoProbable.alias}
                  </button>
                )}
                <button
                  type="button"
                  className={pisoProbable ? btnGhost : btnOro}
                  onClick={() => setEligiendo((v) => (v === 'piso' ? null : 'piso'))}
                  aria-expanded={eligiendo === 'piso'}
                >
                  {pisoProbable ? 'Otro piso' : 'Elegir piso'}
                </button>
                <button type="button" className={btnGhost} onClick={() => onClasificarEnPiso?.(ids, null)}>
                  Personal
                </button>
              </>
            ) : (
              <>
                {cabePiso ? (
                  <button type="button" className={btnOro} onClick={() => onClasificarEnPiso?.(ids, null)}>
                    Es personal
                  </button>
                ) : null}
                <button type="button" className={cabePiso ? btnGhost : btnOro} onClick={() => onClasificar(ids)}>
                  <Icons.Tag size={14} />
                  Elegir categoría
                </button>
                {cabePiso && inmuebles.length > 0 && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setEligiendo((v) => (v === 'piso' ? null : 'piso'))}
                    aria-expanded={eligiendo === 'piso'}
                  >
                    Es de un piso
                  </button>
                )}
              </>
            )}
            {cabeTraspaso && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => setEligiendo((v) => (v === 'traspaso' ? null : 'traspaso'))}
                aria-expanded={eligiendo === 'traspaso'}
              >
                Es un traspaso mío
              </button>
            )}
            <button type="button" className={`${btnGhost} ${styles.btnMini}`} onClick={() => onIgnorar(ids)}>
              <Icons.Minus size={13} />
              Ignorar
            </button>
            {/* La ayuda · discreta · en el título del icono, no en un párrafo. */}
            <span className={styles.ayudaIco} title={propuesta.ayuda} aria-label={propuesta.ayuda} role="img">
              <Icons.Info size={14} />
            </span>
          </div>

          {/* Los selectores · el mismo `<select>` nativo que la ficha · solo al pedirlo. */}
          {eligiendo === 'piso' && cabePiso && (
            <label className={styles.selectorDestino}>
              ¿De qué piso?
              <select
                className={styles.bloqueSelect}
                value=""
                autoFocus
                aria-label={`El piso de ${e.nombre}`}
                onChange={(ev) => {
                  const id = Number(ev.target.value);
                  if (!id) return;
                  setEligiendo(null);
                  onClasificarEnPiso?.(ids, id);
                }}
              >
                <option value="">Elige el piso…</option>
                {inmuebles.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.alias}
                  </option>
                ))}
              </select>
            </label>
          )}
          {eligiendo === 'traspaso' && cabeTraspaso && (
            <label className={styles.selectorDestino}>
              ¿A qué cuenta?
              <select
                className={styles.bloqueSelect}
                value=""
                autoFocus
                aria-label={`Son traspaso a la cuenta · ${e.nombre}`}
                onChange={(ev) => {
                  const destino = Number(ev.target.value);
                  if (!destino) return;
                  setEligiendo(null);
                  onTraspasar?.(ids, destino);
                }}
              >
                <option value="">Elige la cuenta…</option>
                {cuentasTraspaso.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {n > 1 && eligiendo && <div className={styles.entNotaSel}>se aplica a los {n} movimientos de esta entidad</div>}
        </div>
      }
    >
      {e.lineas.map((l) => (
        <div key={l.lineaId} className={styles.entLinea}>
          {renderLinea(l)}
        </div>
      ))}
    </GrupoEntidad>
  );
};

export default TarjetaAccion;
