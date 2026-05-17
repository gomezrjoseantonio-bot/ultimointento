// Ajustes → Avisos · centro de avisos cerrados.
// T-INVERSIONES-DETALLE-PP-v1 · PR 3 · §7.2.

import { useCallback, useEffect, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './AvisosPage.module.css';
import {
  listarCerrados,
  restaurarAviso,
  restaurarTodos,
} from '../../../services/avisosUsuarioService';
import type { AvisoCerrado } from '../../../types/avisosUsuario';

const AvisosPage = () => {
  const [items, setItems] = useState<AvisoCerrado[]>([]);

  // Carga + manejo de errores en un único lugar · útil tanto en mount como
  // tras acciones (restaurar/restaurar todos). El flag `cancelado` evita
  // setState tras unmount cuando se invoca desde el efecto inicial.
  const recargar = useCallback(
    async (cancelado?: { current: boolean }) => {
      try {
        const lista = await listarCerrados();
        if (!cancelado?.current) setItems(lista);
      } catch (err) {
        if (!cancelado?.current) {
          showToastV5(
            `No se pudo cargar el centro de avisos · ${(err as Error).message}`,
            'error',
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    const ref = { current: false };
    recargar(ref);
    return () => {
      ref.current = true;
    };
  }, [recargar]);

  const onRestaurar = async (avisoId: string) => {
    try {
      await restaurarAviso(avisoId);
      showToastV5(`Aviso "${avisoId}" restaurado · volverá a mostrarse`, 'success');
      await recargar();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  const onRestaurarTodos = async () => {
    if (items.length === 0) return;
    if (
      !window.confirm(
        `Restaurar ${items.length} aviso${items.length === 1 ? '' : 's'} · volverán a aparecer en sus pantallas correspondientes. ¿Continuar?`,
      )
    )
      return;
    try {
      const n = await restaurarTodos();
      showToastV5(`Restaurados ${n} avisos`, 'success');
      await recargar();
    } catch (err) {
      showToastV5((err as Error).message, 'error');
    }
  };

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Avisos</h1>
          <div className={containerStyles.contentSub}>
            avisos que has cerrado con la X · puedes restaurarlos individualmente o todos a la vez
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={onRestaurarTodos}
          disabled={items.length === 0}
        >
          <Icons.Refresh size={14} strokeWidth={1.8} />
          Restaurar todos
        </button>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          No has cerrado ningún aviso · cuando cierres avisos en otras pantallas aparecerán aquí
          para restaurarlos.
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((a) => (
            <div key={a.avisoId} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.avisoId}>{a.avisoId}</span>
                {a.etiqueta && <span className={styles.avisoEtiqueta}>{a.etiqueta}</span>}
                <span className={styles.avisoMeta}>
                  cerrado · {a.fechaCierre.slice(0, 10)}
                  {a.ubicacionContexto && ` · ${a.ubicacionContexto}`}
                </span>
              </div>
              <button
                type="button"
                className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
                onClick={() => onRestaurar(a.avisoId)}
                aria-label={`Restaurar aviso ${a.avisoId}`}
              >
                <Icons.Refresh size={13} strokeWidth={1.8} />
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AvisosPage;
