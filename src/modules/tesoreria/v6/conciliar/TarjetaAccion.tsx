// La tarjeta de «te necesitan» · la propuesta encima de la línea del banco.
//
// Deliberadamente es un ENVOLTORIO, no una línea nueva: dentro va el
// `LineaExtractoItem` de siempre, con sus acciones ya probadas (asignar a un
// previsto, ignorar, marcar traspaso, crear movimiento). Reescribir esos botones
// para que se parecieran al mockup habría puesto en riesgo el único camino que
// hoy escribe de verdad en la base, y a cambio de nada: lo que le falta a la
// pantalla no son botones distintos, es que ATLAS diga lo que ya sabe.
//
// Lo que añade esta tarjeta es exactamente eso: la banda de propuesta que
// traduce la `MovementSuggestion` que el orquestador ya calculaba y nadie leía.

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { Propuesta } from './propuestaDeLinea';
import styles from './PanelConciliar.module.css';

export interface TarjetaAccionProps {
  propuesta: Propuesta;
  children: React.ReactNode;
}

/** El icono habla del TONO, no de la categoría · no adelanta un veredicto. */
function IconoDeTono({ tono }: { tono: Propuesta['tono'] }) {
  if (tono === 'confirma') return <Icons.Warning size={15} />;
  if (tono === 'pregunta') return <Icons.Help size={15} />;
  return <Icons.Lightbulb size={15} />;
}

const CLASE_POR_TONO: Record<Propuesta['tono'], string> = {
  propone: '',
  confirma: styles.tarjetaConfirma,
  pregunta: styles.tarjetaPregunta,
};

const TarjetaAccion: React.FC<TarjetaAccionProps> = ({ propuesta, children }) => (
  <div className={`${styles.tarjeta} ${CLASE_POR_TONO[propuesta.tono]}`}>
    <div className={styles.propuesta}>
      <span className={styles.propIco} aria-hidden="true">
        <IconoDeTono tono={propuesta.tono} />
      </span>
      <span className={styles.propTxt}>
        <span className={styles.propQ}>{propuesta.titular}</span>
        <span className={styles.propH}>{propuesta.ayuda}</span>
      </span>
      {/* El sello solo cuando es verdad · la heurística no escribe regla. */}
      {propuesta.seRecuerda && (
        <span className={styles.sello}>
          <Icons.Lightbulb size={13} />
          se recordará
        </span>
      )}
    </div>
    {children}
  </div>
);

export default TarjetaAccion;
