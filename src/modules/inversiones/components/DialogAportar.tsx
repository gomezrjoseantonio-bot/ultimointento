// T23.2 · Dialog "Aportar" · § 3.3 spec.
//
// 2 pasos:
//   - Paso 1 · listado de posiciones activas · click selecciona y avanza
//   - Paso 2 · `<AportacionFormDialog>` adaptado para la posición elegida
//
// Si solo hay una posición activa · saltamos el paso 1 y vamos directo a
// la aportación · UX más rápida. El modo de entrada (`directo` vs
// `selector`) se fija al montar y NO se re-deriva de `posiciones.length`,
// para que un refresh externo no cambie el comportamiento de cancelación.

import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import { formatCurrency, getTipoLabel } from '../helpers';
import AportacionFormDialog from './AportacionFormDialog';
import styles from './WizardModal.module.css';

interface Props {
  posiciones: PosicionInversion[];
  onSave: (
    posicion: PosicionInversion,
    aportacion: Omit<Aportacion, 'id'>,
  ) => Promise<void> | void;
  onClose: () => void;
}

const DialogAportar: React.FC<Props> = ({ posiciones, onSave, onClose }) => {
  // Modo de entrada · se fija al montar y persiste durante la vida del
  // diálogo. Si solo había 1 posición al abrir → modo `directo` (cancelar
  // del form cierra el diálogo). Si había >1 → modo `selector` (cancelar
  // del form vuelve al paso 1 para poder elegir otra posición). Esto es
  // estable frente a actualizaciones externas de `posiciones`.
  const openedDirectRef = useRef<boolean>(posiciones.length === 1);
  const [seleccionada, setSeleccionada] = useState<PosicionInversion | null>(
    openedDirectRef.current ? posiciones[0] : null,
  );

  useEffect(() => {
    // Si la lista cambia y la seleccionada ya no está, reset.
    if (seleccionada && !posiciones.some((p) => p.id === seleccionada.id)) {
      setSeleccionada(null);
    }
  }, [posiciones, seleccionada]);

  // Focus trap + Escape · solo activos cuando renderizamos overlay propio
  // (paso 1 selector · estado vacío). El `AportacionFormDialog` ya gestiona
  // su propio chrome cuando `seleccionada` está set.
  const showOverlay = !seleccionada;
  const focusTrapRef = useFocusTrap(showOverlay);
  useEffect(() => {
    const node = focusTrapRef.current;
    if (!node) return;
    const handler = () => onClose();
    node.addEventListener('modal-escape', handler);
    return () => node.removeEventListener('modal-escape', handler);
  }, [focusTrapRef, onClose, showOverlay]);

  if (seleccionada) {
    return (
      <AportacionFormDialog
        posicionNombre={
          seleccionada.nombre || seleccionada.entidad || `Posición #${seleccionada.id}`
        }
        posicion={seleccionada}
        onSave={async (aportacion) => {
          await onSave(seleccionada, aportacion);
        }}
        onClose={() => {
          // Cancelar del form · si abrimos en modo `directo` (1 sola posición
          // al iniciar) cerramos el diálogo entero · si veníamos del selector
          // volvemos al paso 1 para permitir cambiar de posición.
          if (openedDirectRef.current) {
            onClose();
          } else {
            setSeleccionada(null);
          }
        }}
      />
    );
  }

  if (posiciones.length === 0) {
    return (
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-aportar-empty-title"
        onClick={onClose}
      >
        <div ref={focusTrapRef} className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHead}>
            <div>
              <h2 id="dialog-aportar-empty-title" className={styles.modalTitle}>
                Aportar a una posición
              </h2>
              <div className={styles.modalSub}>Aún no tienes posiciones activas.</div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <Icons.Close size={14} strokeWidth={2} />
            </button>
          </div>
          <div className={styles.empty}>
            Crea primero una posición desde "Nueva posición" para poder aportar.
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aportar-title"
      onClick={onClose}
    >
      <div ref={focusTrapRef} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h2 id="aportar-title" className={styles.modalTitle}>
              ¿A qué posición quieres aportar?
            </h2>
            <div className={styles.modalSub}>
              Selecciona una posición activa de tu cartera.
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icons.Close size={14} strokeWidth={2} />
          </button>
        </div>

        <ul className={styles.selectorList}>
          {posiciones.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.selectorItem}
                onClick={() => setSeleccionada(p)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.selectorItemNombre}>
                    {p.nombre || p.entidad || `Posición #${p.id}`}
                  </div>
                  <div className={styles.selectorItemMeta}>
                    {getTipoLabel(p.tipo)}
                    {p.entidad && p.nombre ? ` · ${p.entidad}` : ''}
                  </div>
                </div>
                <span className={styles.selectorItemValor}>
                  {formatCurrency(Number(p.valor_actual ?? 0))}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogAportar;
