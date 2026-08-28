// ============================================================================
// T4 · la cola de lo descartado · plegada, pero ahí
// ============================================================================
//
// Descartar no borra: el evento sigue existiendo, marcado como que no va a
// ocurrir, y desde T1 tampoco caduca. Pero hasta ahora no se veía por ninguna
// parte, así que un descarte pulsado por error era irreversible en la
// práctica —
// `recuperarPrevisto` llevaba desde V84 sin un solo botón detrás—.
//
// Va PLEGADA y ABAJO a propósito. La bandeja es una lista que se vacía: meter
// ahí lo que ya decidiste que no pasa es volver a llenarla con trabajo que no
// hay que hacer. Se abre cuando se busca, que es lo único para lo que sirve.
// ============================================================================

import React, { useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import PunteoList from './PunteoList';
import type { ItemPunteo } from '../../../../services/punteo/punteoModel';
import styles from './Punteo.module.css';

export interface ColaDescartadasProps {
  items: ItemPunteo[];
  /** Cómo se nombra el periodo · "este mes", "este día". */
  periodo: string;
  onRecuperar: (item: ItemPunteo) => void | Promise<void>;
  /** Compacta la lista dentro de un cajón, igual que sus hermanas. */
  enDrawer?: boolean;
}

const ColaDescartadas: React.FC<ColaDescartadasProps> = ({
  items,
  periodo,
  onRecuperar,
  enDrawer,
}) => {
  const [abierta, setAbierta] = useState(false);
  if (items.length === 0) return null;

  const n = items.length;
  return (
    <>
      <button
        type="button"
        className={styles.colaDescartadas}
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
      >
        <Icons.ChevronRight
          size={13}
          strokeWidth={2.4}
          style={{ transform: abierta ? 'rotate(90deg)' : undefined }}
          aria-hidden
        />
        <span className={styles.colaDescartadasCnt}>
          {n} {n === 1 ? 'descartada' : 'descartadas'} {periodo}
        </span>
        <span className={styles.colaDescartadasVer}>{abierta ? 'ocultar' : 'consultar'}</span>
      </button>
      {abierta && (
        <PunteoList
          items={items}
          chip="todos"
          onChipChange={() => undefined}
          mostrarChips={false}
          cuentas={[]}
          ocultarCuenta
          // Todas vienen del mismo sitio y todas dicen lo mismo: el chip de
          // origen repetido no distingue nada.
          sinOrigen
          variant={enDrawer ? 'drawer' : undefined}
          // La variante que saca las acciones a la fila · aquí solo hay una,
          // «Recuperar», que es lo único que queda por decir de una descartada.
          rowVariant="tesoreria"
          onConfirmar={() => undefined}
          onNoPaso={() => undefined}
          onRecuperar={onRecuperar}
        />
      )}
    </>
  );
};

export default ColaDescartadas;
