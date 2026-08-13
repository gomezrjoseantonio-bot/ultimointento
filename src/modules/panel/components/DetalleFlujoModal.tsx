// Panel · detalle de un flujo de "Cómo va el mes".
//
// Se abre al pulsar una tarjeta (ha entrado / queda por entrar / ha salido /
// queda por salir) y enseña, uno a uno, los apuntes que suman a esa cifra —
// para poder CUADRAR a mano lo que el número dice de golpe. Reutiliza el shell
// Modal ATLAS para no inventar un segundo estilo de modal.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import ModalAtlas from '../../inversiones/components/modal/ModalAtlas';
import ModalAtlasHeader from '../../inversiones/components/modal/ModalAtlasHeader';
import atlasStyles from '../../inversiones/styles/atlas-inversiones.module.css';
import { fmtEur } from './format';
import type { FlujoRow } from './types';
import styles from './DetalleFlujoModal.module.css';

export type SignoFlujo = 'pos' | 'neg' | 'neutro';

export interface DetalleFlujoModalProps {
  titulo: string;
  signo: SignoFlujo;
  filas: FlujoRow[];
  onClose: () => void;
}

/** `YYYY-MM-DD` → `05 ago`. Sin tocar zona horaria (mediodía local). */
const fechaCorta = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const conSigno = (importe: number, signo: SignoFlujo): number =>
  signo === 'neg' ? -importe : importe;

const DetalleFlujoModal: React.FC<DetalleFlujoModalProps> = ({
  titulo,
  signo,
  filas,
  onClose,
}) => {
  const total = filas.reduce((s, f) => s + f.importe, 0);

  return (
    <ModalAtlas onClose={onClose} size="narrow" ariaLabel={titulo}>
      <ModalAtlasHeader
        icon={<Icons.Tesoreria size={18} strokeWidth={1.8} />}
        title={titulo}
        subtitle={`${filas.length} ${filas.length === 1 ? 'movimiento' : 'movimientos'}`}
        onClose={onClose}
      />
      <div className={atlasStyles.form}>
        {filas.length === 0 ? (
          <div className={styles.vacio}>No hay movimientos en este apartado.</div>
        ) : (
          <>
            <ul className={styles.lista}>
              {filas.map((f) => (
                <li key={f.id} className={styles.fila}>
                  <div className={styles.filaMain}>
                    <span className={styles.concepto} title={f.concepto}>
                      {f.concepto}
                    </span>
                    <span
                      className={`${styles.importe} ${
                        signo === 'neg' ? styles.neg : signo === 'pos' ? styles.pos : ''
                      } mono`}
                    >
                      {fmtEur(conSigno(f.importe, signo), signo !== 'neutro')}
                    </span>
                  </div>
                  {(() => {
                    // El inmueble NO se dice dos veces: si el título ya lo nombra
                    // ("Alquiler · Fuertes Acevedo 32") o ya está en el detalle,
                    // no se repite al final de la segunda línea.
                    const inmuebleYaVisible =
                      !!f.inmueble &&
                      (f.concepto.includes(f.inmueble) || !!f.detalle?.includes(f.inmueble));
                    const segunda = [f.detalle, inmuebleYaVisible ? null : f.inmueble]
                      .filter(Boolean)
                      .join(' · ');
                    return segunda ? <div className={styles.filaDetalle}>{segunda}</div> : null;
                  })()}
                  <div className={styles.filaSub}>
                    <span>{fechaCorta(f.fecha)}</span>
                    {f.cuenta ? <span>· {f.cuenta}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={`${styles.total} mono`}>
                {fmtEur(conSigno(total, signo), signo !== 'neutro')}
              </span>
            </div>
          </>
        )}
      </div>
    </ModalAtlas>
  );
};

export default DetalleFlujoModal;
