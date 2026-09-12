// ============================================================================
// Conciliar · Zona 2 · la tarjeta de una ENTIDAD que pide decisión
// ============================================================================
//
// «Iberdrola · luz · CUPS X · 24 recibos · ¿de qué piso?». Una respuesta
// coloca TODOS los movimientos de la entidad. Los botones no escriben nada:
// abren la ficha de siempre UNA vez para todos (P1 · Jose), o mandan a ignorar
// / traspasar en bloque por los manejadores que ya existían. Dentro, al
// desplegar, cada línea sigue siendo el `LineaExtractoItem` del drawer con sus
// acciones de siempre: ese es el único camino que escribe en la base.
//
// La banda de propuesta traduce la `Propuesta` de la primera línea (tono,
// titular, ayuda, «se recordará»): lo que ATLAS ya sabe, dicho una vez para el
// grupo entero.

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
  /** «Clasificar los N como…» · la ficha una vez para todos. */
  onClasificar: (lineaIds: number[]) => void;
  /** El botón de piso · la ficha prerrellenada con ese piso (`null` = personal). */
  onClasificarEnPiso?: (lineaIds: number[], inmuebleId: number | null) => void;
  onIgnorar: (lineaIds: number[]) => void;
  onTraspasar?: (lineaIds: number[], cuentaDestinoId: number) => void;
  renderLinea: (linea: LineaExtracto) => React.ReactNode;
}

/** El icono habla del TONO, no de la categoría · no adelanta un veredicto. */
function IconoDeTono({ tono }: { tono: Propuesta['tono'] }) {
  if (tono === 'confirma') return <Icons.Warning size={15} />;
  if (tono === 'pregunta') return <Icons.Help size={15} />;
  return <Icons.Lightbulb size={15} />;
}

const CHIP_POR_TONO: Record<Propuesta['tono'], string> = {
  propone: 'Confirmar',
  confirma: 'Confirmar',
  pregunta: '¿Qué es?',
};

const CLASE_POR_TONO: Record<Propuesta['tono'], string> = {
  propone: '',
  confirma: styles.tonoConfirma,
  pregunta: styles.tonoPregunta,
};

/** Cuántos pisos caben como botón antes de mandar a la ficha con «Otro piso». */
const PISOS_A_LA_VISTA = 3;

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
  const ids = e.lineas.map((l) => l.lineaId);
  const n = ids.length;
  const los = n === 1 ? 'el movimiento' : `los ${n}`;
  // El traspaso en bloque sólo cabe sobre CARGOS: la pata de salida de un
  // traspaso es un cargo; sobre un abono sería crear el traspaso al revés.
  const todoCargos = e.lineas.every((l) => l.importe < 0);
  const cabeTraspaso = todoCargos && cuentasTraspaso.length > 0 && onTraspasar != null;
  const pisos = inmuebles.slice(0, PISOS_A_LA_VISTA);
  const chipConPiso = e.clasificacion?.familia && e.clasificacion.inmuebleId == null && e.clasificacion.ambito !== 'personal' && pisos.length > 0;

  return (
    <GrupoEntidad
      entidad={e}
      variante="confirmar"
      chip={chipConPiso ? 'Confirmar piso' : CHIP_POR_TONO[propuesta.tono]}
      abierta={abierta}
      onAbrir={onAbrir}
      className={`${CLASE_POR_TONO[propuesta.tono]} ${elegible?.elegida ? styles.entElegida : ''}`}
      banda={
        <div className={styles.entBanda}>
          <div className={styles.propuesta}>
            {elegible && (
              <input
                type="checkbox"
                className={styles.casilla}
                checked={elegible.elegida}
                onChange={elegible.onElegir}
                aria-label={`Elegir ${e.nombre}`}
              />
            )}
            <span className={styles.propIco} aria-hidden="true">
              <IconoDeTono tono={propuesta.tono} />
            </span>
            <span className={styles.propTxt}>
              <span className={styles.propQ}>{propuesta.titular}</span>
              <span className={styles.propH}>
                {propuesta.ayuda} · lo aplico a <strong>{los}</strong>
              </span>
            </span>
            {/* El sello solo cuando es verdad · la heurística no escribe regla. */}
            {propuesta.seRecuerda && (
              <span className={styles.sello}>
                <Icons.Lightbulb size={13} />
                se recordará
              </span>
            )}
          </div>
          <div className={styles.entAcciones}>
            <button type="button" className={`${styles.btn} ${styles.btnOro}`} onClick={() => onClasificar(ids)}>
              <Icons.Tag size={14} />
              {n === 1 ? 'Clasificar como…' : `Clasificar los ${n} como…`}
            </button>
            {onClasificarEnPiso && !e.interno && pisos.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => onClasificarEnPiso(ids, p.id)}
                title={`Es de ${p.alias} · abre la ficha con ese piso`}
              >
                <Icons.Inmuebles size={14} />
                {p.alias}
              </button>
            ))}
            {onClasificarEnPiso && !e.interno && inmuebles.length > PISOS_A_LA_VISTA && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onClasificar(ids)}>
                Otro piso…
              </button>
            )}
            {onClasificarEnPiso && !e.interno && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onClasificarEnPiso(ids, null)}>
                Es personal
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onIgnorar(ids)}>
              <Icons.Minus size={14} />
              {n === 1 ? 'Ignorar' : `Ignorar los ${n}`}
            </button>
            {cabeTraspaso && (
              <label className={styles.bloqueSel}>
                Son traspaso a
                <select
                  className={styles.bloqueSelect}
                  value=""
                  aria-label={`Son traspaso a la cuenta · ${e.nombre}`}
                  onChange={(ev) => {
                    const destino = Number(ev.target.value);
                    if (destino) onTraspasar?.(ids, destino);
                  }}
                >
                  <option value="">elige la cuenta…</option>
                  {cuentasTraspaso.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
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
