// Importador de declaración AEAT · ruta `/fiscal/importar/:anio`.
//
// Wrapper v5 que monta el `ImportarDeclaracionWizard` legacy de
// `horizon/fiscalidad/historico/`. Ese wizard usa el parser real
// (`parseIrpfXml`) + `distribuirDeclaracion` que pobla los stores
// con todos los datos · NO sólo casillas. Es la implementación que
// estaba probada y funcionando en producción.
//
// El wrapper proporciona la navegación v5 (volver al detalle del
// ejercicio · breadcrumb implícito) · todo lo demás se delega al
// wizard legacy hasta que se migre profundamente.

import React, { useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import ImportarDeclaracionWizard from '../../horizon/fiscalidad/historico/ImportarDeclaracionWizard';
import type { FiscalOutletContext } from '../FiscalContext';
import styles from './ImportarFiscalPage.module.css';

interface ImportNavState {
  /** Lista de archivos pasada desde F6 dropzone (multi-archivo). */
  archivosImportados?: File[];
  /** Primer archivo · compat backward para consumidores legacy. */
  archivoImportado?: File;
  nombres?: string[];
  nombre?: string;
}

const ImportarFiscalPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { anio } = useParams<{ anio: string }>();
  const { reload } = useOutletContext<FiscalOutletContext>();

  // Lee los archivos pre-seleccionados desde F6 (sub-tarea 6) · si
  // venimos de `/fiscal/acciones` con drag&drop, el wizard arranca
  // directamente con el archivo cargado.
  const navState = (location.state ?? {}) as ImportNavState;
  const archivos = useMemo<File[]>(() => {
    if (Array.isArray(navState.archivosImportados) && navState.archivosImportados.length > 0) {
      return navState.archivosImportados;
    }
    if (navState.archivoImportado) return [navState.archivoImportado];
    return [];
  }, [navState.archivosImportados, navState.archivoImportado]);

  const initialFile = archivos[0] ?? null;
  const archivosExtra = archivos.length - 1;

  // Si el usuario soltó varios archivos en la dropzone de F6, informamos
  // que solo se procesa el primero en este wizard (los demás se pueden
  // subir uno a uno tras este). Sin esta nota la UX sería confusa.
  useEffect(() => {
    if (archivosExtra > 0) {
      toast(`Procesando el primer archivo · los otros ${archivosExtra} podrás subirlos tras éste.`, {
        icon: 'ℹ️',
      });
    }
    // run-once on mount with the navigation state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El wizard llama `onImported` tras distribuir y luego `onClose`. Para
  // evitar doble navegación · `onImported` sólo recarga el contexto y
  // muestra el toast · `onClose` se encarga del navigate.
  const handleImported = async () => {
    toast.success('Declaración importada · datos distribuidos en los módulos.');
    await reload();
  };

  const handleClose = () => {
    if (anio) navigate(`/fiscal/ejercicio/${anio}`);
    else navigate('/fiscal/ejercicios');
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={handleClose}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </button>
        <button type="button" className={styles.crumbBtn} onClick={() => navigate('/fiscal')}>
          Fiscal
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        {anio && (
          <>
            <button
              type="button"
              className={styles.crumbBtn}
              onClick={() => navigate(`/fiscal/ejercicio/${anio}`)}
            >
              Ejercicio {anio}
            </button>
            <Icons.ChevronRight size={10} strokeWidth={2} />
          </>
        )}
        <span className={styles.current} aria-current="page">
          Importar declaración
        </span>
      </div>

      <div className={`${styles.banner} ${styles.info}`}>
        <Icons.Info size={18} strokeWidth={1.8} />
        <div>
          Sube el <strong>XML del Modelo 100</strong> (Sede Electrónica AEAT ·
          DeclaVisor / Renta Web). Atlas extrae automáticamente inmuebles ·
          contratos · gastos · arrendamientos · plan pensiones · arrastres y
          casillas · y los distribuye en los módulos correspondientes. La
          importación por PDF llegará en una iteración posterior · si tu
          ejercicio sólo lo tienes en PDF · usa el wizard de Corrección desde
          el detalle del ejercicio para introducir los valores manualmente.
        </div>
      </div>

      <ImportarDeclaracionWizard
        onClose={handleClose}
        onImported={handleImported}
        defaultMethod="xml"
        embedded
        initialFile={initialFile}
      />
    </div>
  );
};

export default ImportarFiscalPage;
