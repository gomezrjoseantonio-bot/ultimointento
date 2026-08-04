// ============================================================================
// Lo que dicen tus movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// «Las bonificaciones de una hipoteca o un préstamo no se cumplen por
// declararlas: se cumplen porque los movimientos lo demuestran.» Hasta aquí se
// declaraban en el alta y nadie las volvía a mirar — y lo que hay en juego es
// el TIN, o sea la cuota de todos los meses que quedan.
//
// Las que todavía no se pueden mirar salen igual, dichas como lo que son. Una
// lista donde solo aparecen las verificables se leería como que las demás están
// bien.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { initDB, type TreasuryEvent } from '../../services/db';
import { gastoPorTarjeta } from '../../services/gastoPorTarjeta';
import { listarTarjetas } from '../../services/tarjetasService';
import { verificarBonificaciones } from '../../services/bonificaciones/verificarBonificaciones';
import type { MovimientosQuePrueban } from '../../services/bonificaciones/verificarBonificaciones';
import type { Bonificacion } from '../../types/prestamos';
import { textoDeCumplimiento } from './textoBonificacion';
import styles from './BonificacionesVerificadas.module.css';

const ETIQUETA = {
  cumple: 'Cumple',
  no_cumple: 'No cumple',
  no_verificable: 'Sin comprobar',
} as const;

interface Props {
  bonificaciones?: Bonificacion[];
}

const BonificacionesVerificadas: React.FC<Props> = ({ bonificaciones }) => {
  const [movimientos, setMovimientos] = useState<MovimientosQuePrueban | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const db = await initDB();
      const [eventos, tarjetas] = await Promise.all([
        db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
        listarTarjetas(),
      ]);
      if (cancelado) return;
      setMovimientos({ tarjetas, periodosDeTarjeta: gastoPorTarjeta(eventos) });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!bonificaciones?.length) return null;

  // Hoy, en ISO. La ventana se cuenta hacia atrás desde el día en que se mira,
  // no desde el cierre de un periodo: la pregunta es «¿la tengo ahora?».
  const hoy = new Date().toISOString().slice(0, 10);
  const cumplimientos = movimientos
    ? verificarBonificaciones(bonificaciones, movimientos, hoy)
    : [];

  return (
    <div className={styles.card}>
      <div className={styles.hd}>
        <div className={styles.title}>Bonificaciones · lo que dicen tus movimientos</div>
        <div className={styles.sub}>se comprueban con lo ya cobrado, no con lo previsto</div>
      </div>

      {!movimientos && <div className={styles.vacio}>Mirando los movimientos…</div>}

      {cumplimientos.map((c) => (
        <div key={c.bonificacionId} className={styles.item}>
          <div className={styles.nombre}>{c.nombre}</div>
          <span className={`${styles.chip} ${styles[c.veredicto]}`}>{ETIQUETA[c.veredicto]}</span>
          <div className={styles.detalle}>{textoDeCumplimiento(c)}</div>
        </div>
      ))}

      {movimientos && cumplimientos.length === 0 && (
        <div className={styles.vacio}>Ninguna bonificación contratada en este préstamo.</div>
      )}
    </div>
  );
};

export default BonificacionesVerificadas;
