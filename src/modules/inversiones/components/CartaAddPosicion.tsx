// T23.1 · Carta "Añadir posición" · § Z.5 spec.
// Última carta de la grid · dispara el wizard de nueva posición (que en
// 23.1 es un placeholder · 23.2 lo construye).

import React from 'react';
import { Icons } from '../../../design-system/v5';
import styles from '../InversionesGaleria.module.css';

interface CartaAddPosicionProps {
  onClick: () => void;
}

const CartaAddPosicion: React.FC<CartaAddPosicionProps> = ({ onClick }) => (
  <button type="button" className={styles.cartaAdd} onClick={onClick} aria-label="Añadir nueva posición">
    <Icons.PlusCircle size={40} strokeWidth={1.5} />
    <div className={styles.cartaAddTitle}>Añadir posición</div>
    <div className={styles.cartaAddSub}>
      Crea una posición desde cero o importa tu cartera (IndexaCapital · aportaciones).
    </div>
  </button>
);

export default CartaAddPosicion;
