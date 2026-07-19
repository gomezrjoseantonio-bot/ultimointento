import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Icons } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import { exportSnapshot, importSnapshot, resetAllData } from '../../../services/db';
import { confirmDelete } from '../../../services/confirmationService';
import KpiBuilder from '../../../components/kpi/KpiBuilder';
import DashboardConfig from '../../../components/dashboard/DashboardConfig';
import containerStyles from '../AjustesPage.module.css';
import styles from './DatosPage.module.css';

// NOTA · feedback con react-hot-toast (montado app-wide en App.tsx) y NO
// showToastV5: el <ToastHost> v5 sólo se monta en onboarding/dev, así que un
// showToastV5 aquí caería a console.info (feedback invisible). Estas acciones
// (export/import/reset) son reales y necesitan un toast visible.

type PreferencesTab = 'datos' | 'panel' | 'kpis';

const TABS: { key: PreferencesTab; label: string; icon: IconRender }[] = [
  { key: 'datos', label: 'Datos & Snapshots', icon: (p) => <Icons.Archivo {...p} /> },
  { key: 'panel', label: 'Panel', icon: (p) => <Icons.Panel {...p} /> },
  { key: 'kpis', label: 'KPIs & Métricas', icon: (p) => <Icons.Proyeccion {...p} /> },
];

type IconRender = (p: { size: number; strokeWidth: number }) => React.ReactElement;

const DatosPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<PreferencesTab>('datos');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [showAtlasResetConfirm, setShowAtlasResetConfirm] = useState(false);
  const [atlasResetText, setAtlasResetText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Sincroniza pestaña con el hash de la URL (deep-link · #datos/#panel/#kpis).
  useEffect(() => {
    const hash = location.hash.replace('#', '') as PreferencesTab;
    if (['datos', 'panel', 'kpis'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleExportSnapshot = async () => {
    setIsExporting(true);
    try {
      await exportSnapshot();
      toast.success('Snapshot exportado correctamente');
    } catch (error) {
      toast.error(
        'Error al exportar el snapshot: ' +
          (error instanceof Error ? error.message : 'Error desconocido')
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSnapshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error('Por favor selecciona un archivo ZIP válido');
      return;
    }

    const confirmMessage =
      importMode === 'replace'
        ? `archivo ${file.name}? Esto reemplazará TODOS tus datos actuales. Esta acción no se puede deshacer.`
        : `datos del archivo ${file.name} con tus datos actuales?`;

    const confirmed = await confirmDelete(confirmMessage);
    if (!confirmed) {
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      await importSnapshot(file, importMode);
      toast.success(
        `Snapshot importado correctamente (${importMode === 'replace' ? 'reemplazado' : 'fusionado'})`
      );
      window.location.reload();
    } catch (error) {
      toast.error(
        'Error al importar el snapshot: ' +
          (error instanceof Error ? error.message : 'Error desconocido')
      );
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleResetData = async () => {
    if (!showSecondConfirm) {
      setShowSecondConfirm(true);
      return;
    }
    try {
      await resetAllData();
      toast.success('Datos restablecidos correctamente');
      setShowResetConfirm(false);
      setShowSecondConfirm(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        'Error al restablecer los datos: ' +
          (error instanceof Error ? error.message : 'Error desconocido')
      );
    }
  };

  const handleResetAtlas = async () => {
    if (atlasResetText !== 'ELIMINAR DATOS LOCALES') {
      toast.error('Debes escribir exactamente "ELIMINAR DATOS LOCALES" para confirmar');
      return;
    }
    try {
      localStorage.clear();
      if ('indexedDB' in window) {
        const deleteRequest = indexedDB.deleteDatabase('AtlasHorizonDB');
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve(true);
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }
      toast.success('Datos locales eliminados. Recarga para aplicar.');
      setShowAtlasResetConfirm(false);
      setAtlasResetText('');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(
        'Error al limpiar datos locales: ' +
          (error instanceof Error ? error.message : 'Error desconocido')
      );
    }
  };

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Datos y preferencias</h1>
          <div className={containerStyles.contentSub}>
            snapshots · restablecer datos · configuración del panel · KPIs y métricas
          </div>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Secciones de datos y preferencias">
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[styles.tab, isActive ? styles.active : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveTab(t.key)}
            >
              {t.icon({ size: 15, strokeWidth: 1.7 })}
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'datos' && (
        <>
          <SetSection
            title="Gestión de snapshots"
            sub="exporta todos tus datos en un ZIP o importa un snapshot previo para restaurarlos"
          >
            <div className={styles.block}>
              <div className={styles.blockTitle}>Exportar datos (.zip)</div>
              <div className={styles.blockDesc}>
                Descarga un archivo ZIP con todos tus datos y documentos. Incluye inmuebles,
                contratos, gastos, documentos y sus archivos originales.
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={containerStyles.btnGhost}
                  onClick={handleExportSnapshot}
                  disabled={isExporting}
                >
                  <Icons.Archivo size={15} strokeWidth={1.7} />
                  {isExporting ? 'Exportando…' : 'Exportar datos (.zip)'}
                </button>
              </div>
            </div>

            <div className={styles.block}>
              <div className={styles.blockTitle}>Importar datos (.zip)</div>
              <div className={styles.blockDesc}>
                Sube un archivo ZIP exportado previamente para restaurar tus datos.{' '}
                <strong>¡Importante!</strong> Según el modo, puede reemplazar todos tus datos
                actuales.
              </div>
              <div className={styles.radioGroup}>
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value as 'replace')}
                  />
                  <span>
                    <strong>Reemplazar todo</strong> — borra los datos actuales y los sustituye por
                    los del snapshot
                  </span>
                </label>
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value as 'merge')}
                  />
                  <span>
                    <strong>Fusionar</strong> — actualiza/añade los datos del snapshot respetando los
                    existentes
                  </span>
                </label>
              </div>
              <div className={styles.actions}>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleImportSnapshot}
                  disabled={isImporting}
                  className={styles.fileInput}
                />
                {isImporting && <span className={styles.hint}>Importando…</span>}
              </div>
            </div>
          </SetSection>

          <SetSection
            title="Restablecer datos"
            sub="acciones irreversibles · elimina permanentemente tus datos locales"
            danger
          >
            <div className={styles.block}>
              <div className={styles.blockTitle}>Restablecer todos los datos</div>
              <div className={styles.blockDesc}>
                <strong>¡Cuidado!</strong> Elimina permanentemente inmuebles, documentos, contratos,
                gastos y preferencias. No se puede deshacer.
              </div>
              {!showResetConfirm ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={containerStyles.btnNeg}
                    onClick={() => setShowResetConfirm(true)}
                  >
                    <Icons.Delete size={15} strokeWidth={1.7} />
                    Restablecer datos
                  </button>
                </div>
              ) : (
                <div className={styles.confirmBox}>
                  <div className={styles.confirmHead}>
                    <Icons.Warning size={18} strokeWidth={1.7} className={styles.iconNeg} />
                    <div>
                      <div className={styles.confirmTitle}>
                        ¿Seguro que quieres restablecer todos los datos?
                      </div>
                      <div className={styles.confirmText}>
                        Se eliminarán permanentemente todos los inmuebles, documentos, contratos,
                        gastos y preferencias. Esta acción no se puede deshacer.
                      </div>
                    </div>
                  </div>
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      className={containerStyles.btnDanger}
                      onClick={handleResetData}
                    >
                      {showSecondConfirm ? 'Confirmar restablecimiento' : 'Sí, restablecer'}
                    </button>
                    <button
                      type="button"
                      className={containerStyles.btnGhost}
                      onClick={() => {
                        setShowResetConfirm(false);
                        setShowSecondConfirm(false);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                  {showSecondConfirm && (
                    <div className={styles.smallNote}>
                      Pulsa «Confirmar restablecimiento» para proceder definitivamente.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.block}>
              <div className={styles.blockTitle}>Reset Atlas (limpieza local)</div>
              <div className={styles.blockDesc}>
                <strong>¡Atención!</strong> Limpia únicamente el almacenamiento local (localStorage
                e IndexedDB), eliminando cachés y datos temporales.
              </div>
              {!showAtlasResetConfirm ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={containerStyles.btnNeg}
                    onClick={() => setShowAtlasResetConfirm(true)}
                  >
                    <Icons.Delete size={15} strokeWidth={1.7} />
                    Reset Atlas (limpieza local)
                  </button>
                </div>
              ) : (
                <div className={styles.confirmBoxWarn}>
                  <div className={styles.confirmHead}>
                    <Icons.Warning size={18} strokeWidth={1.7} className={styles.iconWarn} />
                    <div>
                      <div className={styles.confirmTitle}>
                        Confirmación requerida para limpieza local
                      </div>
                      <div className={styles.confirmText}>
                        Esta acción eliminará localStorage e IndexedDB. Para confirmar, escribe
                        exactamente <strong>«ELIMINAR DATOS LOCALES»</strong> en el campo de abajo:
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={atlasResetText}
                    onChange={(e) => setAtlasResetText(e.target.value)}
                    placeholder="Escribe: ELIMINAR DATOS LOCALES"
                    className={styles.textInput}
                  />
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      className={containerStyles.btnDanger}
                      onClick={handleResetAtlas}
                      disabled={atlasResetText !== 'ELIMINAR DATOS LOCALES'}
                    >
                      Confirmar limpieza local
                    </button>
                    <button
                      type="button"
                      className={containerStyles.btnGhost}
                      onClick={() => {
                        setShowAtlasResetConfirm(false);
                        setAtlasResetText('');
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className={styles.smallNote}>
                    Tras la limpieza, la página se recargará automáticamente.
                  </div>
                </div>
              )}
            </div>
          </SetSection>

          <SetSection
            title="Información de datos"
            sub="qué incluye un snapshot y dónde se guardan tus datos"
          >
            <div className={styles.block}>
              <div className={styles.blockTitle}>Incluye en snapshots</div>
              <ul className={styles.infoList}>
                <li>Inmuebles con todos sus detalles y costes de adquisición</li>
                <li>Documentos de la bandeja con sus archivos originales (PDF, JPG, PNG, ZIP)</li>
                <li>Contratos y sus metadatos de asignación</li>
                <li>Gastos y movimientos registrados</li>
                <li>Preferencias y configuraciones de la aplicación</li>
              </ul>
              <div className={styles.infoNote}>
                <strong>Almacenamiento:</strong> los datos se guardan localmente en tu navegador y
                solo tú tienes acceso a ellos.
              </div>
            </div>
          </SetSection>
        </>
      )}

      {activeTab === 'panel' && (
        <SetSection
          title="Configuración del panel"
          sub="ordena y activa los bloques de tu panel de inicio"
        >
          <div className={styles.embed}>
            <DashboardConfig />
          </div>
        </SetSection>
      )}

      {activeTab === 'kpis' && (
        <SetSection
          title="KPIs y métricas"
          sub="define qué indicadores ves y cómo se calculan"
        >
          <div className={styles.embed}>
            <KpiBuilder />
          </div>
        </SetSection>
      )}
    </>
  );
};

export default DatosPage;
export { DatosPage };
