// Panel · "En diez segundos" · cuatro acciones rápidas con destino real
// verificado (informe FASE A §4). "Registrar una mejora" abre el listado de
// inmuebles porque la mejora requiere un inmueble seleccionado (no hay ruta
// sin :id).

import React from 'react';
import { Icons } from '../../../design-system/v5';
import styles from './AccionesRapidas.module.css';

export interface AccionesRapidasProps {
  onNavigate: (ruta: string) => void;
}

const AccionesRapidas: React.FC<AccionesRapidasProps> = ({ onNavigate }) => (
  <section className={styles.sec}>
    <div className={styles.head}>
      <div className={styles.tit}>En diez segundos</div>
      <div className={styles.sub}>cada cosa que entras hoy es una menos en la declaración</div>
    </div>
    <div className={styles.grid}>
      <button className={styles.btn} onClick={() => onNavigate('/inbox')}>
        <span className={styles.ic}>
          <Icons.Upload size={18} strokeWidth={1.8} />
        </span>
        <span>
          <span className={styles.t}>Subir una factura</span>
          <span className={styles.s}>foto o PDF · se clasifica solo</span>
        </span>
      </button>
      <button className={styles.btn} onClick={() => onNavigate('/personal/gastos/nuevo')}>
        <span className={styles.ic}>
          <Icons.PlusCircle size={18} strokeWidth={1.8} />
        </span>
        <span>
          <span className={styles.t}>Anotar un gasto</span>
          <span className={styles.s}>sin justificante todavía</span>
        </span>
      </button>
      <button className={styles.btn} onClick={() => onNavigate('/conciliacion')}>
        <span className={styles.ic}>
          <Icons.Refresh size={18} strokeWidth={1.8} />
        </span>
        <span>
          <span className={styles.t}>Conciliar banco</span>
          <span className={styles.s}>cuadra tus movimientos</span>
        </span>
      </button>
      <button className={styles.btn} onClick={() => onNavigate('/inmuebles')}>
        <span className={styles.ic}>
          <Icons.Reforma size={18} strokeWidth={1.8} />
        </span>
        <span>
          <span className={styles.t}>Registrar una mejora</span>
          <span className={styles.s}>elige el inmueble · se amortiza sola</span>
        </span>
      </button>
    </div>
  </section>
);

export default AccionesRapidas;
