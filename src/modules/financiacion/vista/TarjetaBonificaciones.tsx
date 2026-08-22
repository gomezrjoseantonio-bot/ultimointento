// La tarjeta de bonificaciones · lo que estás ganando para el periodo que viene.
//
// Salió de `DetallePrestamoPage` cuando esa página se pasó de las 800 líneas,
// pero el corte no es solo por tamaño: es la única tarjeta con estado propio
// —la revisión pendiente se contesta dentro— y la que más veces ha cambiado de
// forma. *«Cambia el enfoque, el dibujo, lo que sea, pero no hay quien entienda
// absolutamente nada»* *(Jose · 9 ago 2026)*.
//
// Las dos preguntas que la tarjeta tiene que mantener separadas:
//
//   · lo que el banco APLICA hoy · un hecho del contrato, la marca verde
//   · lo que TUS MOVIMIENTOS demuestran · lo que decidirá la próxima revisión
//
// Y una tercera que la ficha se saltaba: sobre QUÉ tramo rebajan. En un mixto
// que solo bonifica el tramo variable, las de hoy no bajan nada — se cobran en
// la primera revisión.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import type { Prestamo } from '../../../types/prestamos';
import type { Revision } from '../../../services/bonificaciones/revisionDelBanco';
import type { ResumenBonificaciones } from './detalleDatos';
import { cuandoSePierde, hayDiscrepancia } from './detalleDatos';
import { diaMesAnio, mesAnio, pct } from './formato';
import styles from './DetallePrestamo.module.css';
import bon from './TarjetaBonificaciones.module.css';
import rev from './RevisionEnBonificaciones.module.css';

export interface TarjetaBonificacionesProps {
  prestamo: Prestamo;
  bonificaciones: ResumenBonificaciones;
  /** La revisión que espera respuesta · lo que devuelve `useRevisionPendiente`. */
  revision: RevisionPendiente;
  /** La próxima revisión del banco · para decir cuándo se pierde una. */
  proximaDelBanco: Revision | null;
  /** El mes publicado del que sale el índice · `null` si no se sabe. */
  publicacion: string | null;
  onEditar: () => void;
}

/** Lo que la tarjeta usa de `useRevisionPendiente` · nada más. */
export interface RevisionPendiente {
  pendiente: { aplicaDesde: string } | null;
  decision: Record<string, string | undefined>;
  responder: (id: string, que: 'CUMPLIDA' | 'PERDIDA') => void;
  pideIndice: boolean;
  indiceRaw: string;
  setIndiceRaw: (v: string) => void;
  indiceSugerido: number | null;
  origenSugerido: 'publicado' | 'manual' | null;
  periodoSugerido: string | null;
  confirmar: () => void;
  descartar: () => void;
  guardando: boolean;
}

const TarjetaBonificaciones: React.FC<TarjetaBonificacionesProps> = ({
  prestamo,
  bonificaciones,
  revision,
  proximaDelBanco,
  publicacion,
  onEditar,
}) => (
  // SIEMPRE, y con la revisión dentro. Eran dos tarjetas enseñando la misma
  // lista, y contestar en una no tenía nada que ver con lo que decía la otra.
  // Son la misma pregunta: qué bonificaciones tienes y cuáles te ha dejado el
  // banco.
  <div className={`${styles.card} ${styles.topGold}`}>
    <div className={styles.cardT}>
      <Icons.Check size={15} strokeWidth={2} aria-hidden />
      Bonificaciones
      {/* Qué estás mirando · «bajan tu diferencial» era una obviedad que
          además no siempre es verdad. Esto dice lo único que hace falta
          saber para leer la lista de abajo. */}
      <span className={styles.cardNota}>
        {revision.pendiente
          ? 'el banco ya ha revisado'
          : !bonificaciones.rebajanHoy && bonificaciones.rebajanDesde
            ? `empiezan a rebajar el ${diaMesAnio(bonificaciones.rebajanDesde)}`
            : bonificaciones.lista.some(hayDiscrepancia)
              ? 'el banco y tus movimientos no dicen lo mismo'
              : 'bajan tu diferencial'}
      </span>
    </div>

    {revision.pendiente && (
      <div className={rev.revAviso}>
        <Icons.Warning size={13} strokeWidth={2} aria-hidden />
        <span>
          Revisión de{' '}
          <strong>{revision.pendiente.aplicaDesde.split('-').reverse().join('/')}</strong> ·
          dinos cuáles te dejó y el cuadro se rehace desde esa fecha.
          <em> ATLAS no ve la carta del banco.</em>
        </span>
      </div>
    )}

    {bonificaciones.lista.length === 0 ? (
      /* Sin ninguna apuntada la tarjeta sigue estando · «este préstamo no
         tiene bonificaciones» es una respuesta, y esconder la tarjeta
         dejaba la ficha diciendo que la pregunta no existe. */
      <div className={rev.bonifVacio}>
        Este préstamo no tiene bonificaciones apuntadas.
        <button
          type="button"
          onClick={onEditar}
        >
          añadir las de tu anexo
        </button>
      </div>
    ) : (
      <div className={bon.bonifLista}>
        {bonificaciones.lista.map((b) => (
          <div key={b.bonificacion.id} className={bon.bonif}>
            <div className={bon.bonifIzq}>
              {/* La marca dice lo que TUS MOVIMIENTOS sostienen, no lo que el
                  banco aplica · eso vive ya en la tarjeta del tipo. Mientras
                  la misma fila contestaba las dos preguntas, un check junto a
                  un «no se cumple» parecía un error de la pantalla. */}
              <div
                className={b.veredicto === 'cumple' ? bon.bonifCheck : bon.bonifPendiente}
                aria-hidden
              >
                {b.veredicto === 'cumple' && <Icons.Check size={11} strokeWidth={3} />}
              </div>
              <span className={b.veredicto === 'cumple' ? undefined : bon.bonifApagada}>
                {b.bonificacion.nombre}
                {b.veredicto === 'no_cumple' && (
                  <span className={bon.bonifAviso} title={b.explicacion}>
                    {/* Perderla y no tenerla no cuestan lo mismo · si hoy te la
                        aplican, la revisión te la quita y la cuota sube. */}
                    {b.alcanzada ? cuandoSePierde(proximaDelBanco) : 'no se cumple'}
                  </span>
                )}
                {b.veredicto === 'no_verificable' && (
                  <span className={bon.bonifDuda} title={b.explicacion}>
                    sin comprobar
                  </span>
                )}
                {/* La única vez que lo que el banco hace ES noticia aquí · la
                    cumples y no te la aplican, así que estás pagando de más y
                    hay algo que reclamar. */}
                {b.veredicto === 'cumple' && !b.alcanzada && (
                  <span className={bon.bonifLogro} title={b.explicacion}>
                    la cumples · no te la aplican
                  </span>
                )}
              </span>
            </div>

            {revision.pendiente ? (
              /* Con revisión abierta, cada fila se contesta aquí mismo ·
                 la lista es la misma, así que preguntar en otra tarjeta
                 obligaba a mirar dos veces lo mismo. Nada marcado de
                 salida: lo que no se conteste se queda como estaba. */
              <div className={rev.revBotones}>
                <button
                  type="button"
                  className={
                    revision.decision[b.bonificacion.id] === 'CUMPLIDA'
                      ? rev.revSiOn
                      : rev.revSi
                  }
                  onClick={() => revision.responder(b.bonificacion.id, 'CUMPLIDA')}
                >
                  me la dejan
                </button>
                <button
                  type="button"
                  className={
                    revision.decision[b.bonificacion.id] === 'PERDIDA'
                      ? rev.revNoOn
                      : rev.revNo
                  }
                  onClick={() => revision.responder(b.bonificacion.id, 'PERDIDA')}
                >
                  la pierdo
                </button>
              </div>
            ) : (
              <div className={b.alcanzada ? bon.bonifVal : bon.bonifValApagado}>
                −{b.puntos.toFixed(2).replace('.', ',')}
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    {revision.pendiente ? (
      <div className={rev.revPie}>
        {revision.pideIndice && (
          <div className={rev.revIndice}>
            <label htmlFor="rev-indice">Índice que aplicó</label>
            <div className={rev.revInpGrupo}>
              <input
                id="rev-indice"
                className={rev.revInp}
                value={revision.indiceRaw}
                onChange={(e) => revision.setIndiceRaw(e.target.value)}
              />
              <span>%</span>
            </div>
            {/* De QUÉ euríbor se habla · ver `indicePublicado`. Aquí
                ponía «el que tienes en Actualizar valores», que es el de
                HOY, y ofrecerlo invita a aceptarlo.

                Cuando el número escrito sale de la serie oficial del mes que
                manda, se dice: ya no hay que ir a buscarlo, solo comprobar que
                la carta dice lo mismo. Pedir que lo busque quien ya lo tiene
                delante es mandarle a hacer un trabajo hecho. */}
            <span className={rev.revPista}>
              {revision.origenSugerido === 'publicado' && revision.periodoSugerido
                ? `euríbor publicado de ${mesAnio(`${revision.periodoSugerido}-01`)} · comprueba que tu carta dice lo mismo`
                : publicacion
                  ? `el euríbor publicado de ${mesAnio(`${publicacion}-01`)} · lo dice tu carta`
                  : revision.indiceSugerido != null
                    ? 'el de Actualizar valores es el de HOY · escribe el de tu carta'
                    : 'sin diferencial · vacío si la carta no lo dice'}
            </span>
          </div>
        )}
        <div className={rev.revAcciones}>
          <button
            type="button"
            className={rev.revConfirmar}
            onClick={revision.confirmar}
            disabled={revision.guardando}
          >
            {revision.guardando ? 'Apuntando…' : 'Apuntar lo que dijo el banco'}
          </button>
          <button type="button" className={rev.revLuego} onClick={revision.descartar}>
            ahora no
          </button>
        </div>
      </div>
    ) : (
      bonificaciones.lista.length > 0 && (
        <div className={bon.bonifPie}>
          <div className={bon.bonifPieFila}>
            <span>
              alcanzas{' '}
              <span className={styles.monoInk}>
                −{bonificaciones.rebajaTotal.toFixed(2).replace('.', ',')}
              </span>
              {bonificaciones.tope != null && (
                <>
                  {' de '}
                  <span className={styles.monoInk}>
                    {bonificaciones.tope.toFixed(2).replace('.', ',')}
                  </span>
                  {' de tope'}
                </>
              )}
            </span>
          </div>
          {/* Sobre QUÉ tipo rebajan · en un mixto que bonifica solo el
              tramo variable, decir «tu tipo de hoy» es falso por los dos
              lados: ni paga el tipo tachado ni las bonificaciones le
              bajan nada todavía. Lo que se juega ahí se cobra en la
              primera revisión, y eso es lo que hay que enseñar. */}
          {bonificaciones.tinConLasQueTienes != null &&
            bonificaciones.tinSinBonificar != null &&
            bonificaciones.rebajaTotal > 0 && (
              <div className={bon.bonifEfecto}>
                {/* La fecha ya está en la nota de la cabecera de esta misma
                    tarjeta · repetirla aquí era decir dos veces la misma frase
                    con dos renglones de separación. */}
                <span>
                  {bonificaciones.rebajanHoy ? 'tu tipo de hoy' : 'tu tipo cuando empiecen'}
                </span>
                <span>
                  <span className={styles.teorico}>
                    {pct(bonificaciones.tinSinBonificar).replace(' %', '')}
                  </span>{' '}
                  <span className={styles.flecha}>→</span>{' '}
                  <span className={styles.mono}>
                    {pct(bonificaciones.tinConLasQueTienes)}
                  </span>
                </span>
              </div>
            )}
          {/* Y lo que de verdad vas a pagar si nada cambia · el titular
              daba la rebaja entera por hecha mientras sus propias filas
              decían que dos se pierden. La cifra se recalcula entera, no
              se restan «los puntos en riesgo»: con un tope, perder una
              bonificación puede no costar ni un céntimo. */}
          {bonificaciones.tinSiRevisaranHoy != null &&
            bonificaciones.tinConLasQueTienes != null &&
            bonificaciones.tinSiRevisaranHoy - bonificaciones.tinConLasQueTienes >= 0.005 && (
              <div className={bon.bonifEfecto}>
                <span>si el banco revisara hoy con lo que demuestras</span>
                <span className={styles.mono}>{pct(bonificaciones.tinSiRevisaranHoy)}</span>
              </div>
            )}
        </div>
      )
    )}
  </div>

);

export default TarjetaBonificaciones;
