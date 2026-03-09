import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { useTheme } from '../../../../contexts/ThemeContext';
import { exportSnapshot, importSnapshot, resetAllData } from '../../../../services/db';
import { Download, Trash2, AlertTriangle, BarChart3, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import KpiBuilder from '../../../../components/kpi/KpiBuilder';
import DashboardConfig from '../../../../components/dashboard/DashboardConfig';
import { confirmDelete } from '../../../../services/confirmationService';

type PreferencesTab = 'datos' | 'kpis' | 'panel';

const PreferenciasDatos: React.FC = () => {
  const { currentModule } = useTheme();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<PreferencesTab>('datos');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [showAtlasResetConfirm, setShowAtlasResetConfirm] = useState(false);
  const [atlasResetText, setAtlasResetText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Handle URL hash for tab navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '') as PreferencesTab;
    if (['datos', 'kpis', 'panel'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);
  
  const subtitle = currentModule === 'horizon' 
    ? 'Configuración de preferencias y datos del módulo Horizon.'
    : 'Configuración de preferencias y datos del módulo Pulse.';

  const handleExportSnapshot = async () => {
    setIsExporting(true);
    try {
      await exportSnapshot();
      toast.success('Snapshot exportado correctamente');
    } catch (error) {
      toast.error('Error al exportar el snapshot: ' + (error instanceof Error ? error.message : 'Error desconocido'));
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

    // Add confirmation as required by H1
    const confirmMessage = importMode === 'replace' 
      ? `archivo ${file.name}? Esto reemplazará TODOS tus datos actuales. Esta acción no se puede deshacer.`
      : `datos del archivo ${file.name} con tus datos actuales?`;
    
    const confirmed = await confirmDelete(confirmMessage);
    if (!confirmed) {
      event.target.value = ''; // Reset file input
      return;
    }

    setIsImporting(true);
    try {
      await importSnapshot(file, importMode);
      toast.success(`Snapshot importado correctamente (${importMode === 'replace' ? 'reemplazado' : 'fusionado'})`);
      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      toast.error('Error al importar el snapshot: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsImporting(false);
      // Reset the file input
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
      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      toast.error('Error al restablecer los datos: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleResetAtlas = async () => {
    // Require exact confirmation text per problem statement
    if (atlasResetText !== 'ELIMINAR DATOS LOCALES') {
      toast.error('Debes escribir exactamente "ELIMINAR DATOS LOCALES" para confirmar');
      return;
    }

    try {
      // Clear localStorage
      localStorage.clear();
      
      // Delete IndexedDB per problem statement
      if ('indexedDB' in window) {
        const deleteRequest = indexedDB.deleteDatabase('AtlasHorizonDB');
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve(true);
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }
      
      // Show confirmation toast per problem statement
      toast.success('Datos locales eliminados. Recarga para aplicar.');
      
      // Close modal
      setShowAtlasResetConfirm(false);
      setAtlasResetText('');
      
      // Hard reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      toast.error('Error al limpiar datos locales: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const accentColor = currentModule === 'horizon' ? 'brand-navy' : 'brand-teal';
  
  return (
    <PageLayout title="Preferencias & Datos" subtitle={subtitle}>
      {/* Sub-tabs for Preferencias & Datos */}
      <div className="mb-8">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('datos')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 relative ${
              activeTab === 'datos'
                ? `text-${accentColor} bg-transparent`
                : 'text-neutral-600 bg-transparent hover:bg-neutral-50'
            }`}
          >
            Datos & Snapshots
            {activeTab === 'datos' && (
              <div className={`absolute -bottom-px left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-${accentColor}`} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('panel')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 relative flex items-center gap-2 ${
              activeTab === 'panel'
                ? `text-${accentColor} bg-transparent`
                : 'text-neutral-600 bg-transparent hover:bg-neutral-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Panel
            {activeTab === 'panel' && (
              <div className={`absolute -bottom-px left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-${accentColor}`} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 relative flex items-center gap-2 ${
              activeTab === 'kpis'
                ? `text-${accentColor} bg-transparent`
                : 'text-neutral-600 bg-transparent hover:bg-neutral-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            KPIs & Métricas
            {activeTab === 'kpis' && (
              <div className={`absolute -bottom-px left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-${accentColor}`} />
            )}
          </button>
        </div>
      </div>

      {activeTab === 'datos' && (
        <div className="space-y-8">
          {/* Snapshot Management Section */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Gestión de Snapshots</h2>
            <p className="text-neutral-600 mb-6">
              Exporta todos tus datos (inmuebles, documentos, movimientos, etc.) en un archivo ZIP o 
              importa un snapshot previo para restaurar tu información.
            </p>
            
            {/* Export Snapshot */}
            <div className="space-y-4">
              <div className="border border-neutral-200 rounded-lg p-4">
                <h3 className="font-medium text-neutral-900 mb-2">Exportar datos (.zip)</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Descarga un archivo ZIP con todos tus datos y documentos. 
                  Incluye inmuebles, contratos, gastos, documentos y sus archivos originales.
                </p>
                <button
                  onClick={handleExportSnapshot}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exportando...' : 'Exportar datos (.zip)'}
                </button>
              </div>

              {/* Import Snapshot */}
              <div className="border border-neutral-200 rounded-lg p-4">
                <h3 className="font-medium text-neutral-900 mb-2">Importar datos (.zip)</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Sube un archivo ZIP exportado previamente para restaurar tus datos.
                  <strong> ¡Importante!</strong> Esto reemplazará todos tus datos actuales.
                </p>
                
                {/* Import Mode Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Modo de importación:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={(e) => setImportMode(e.target.value as 'replace')}
                        className="mr-2"
                      />
                      <span className="text-sm text-neutral-700">
                        <strong>Reemplazar todo</strong> - Borra los datos actuales y los sustituye por los del snapshot
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={(e) => setImportMode(e.target.value as 'merge')}
                        className="mr-2"
                      />
                      <span className="text-sm text-neutral-700">
                        <strong>Fusionar</strong> - Actualiza/añade los datos del snapshot respetando los existentes
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleImportSnapshot}
                    disabled={isImporting}
                    className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 disabled:opacity-50"
                  />
                  {isImporting && (
                    <span className="text-sm text-neutral-600">Importando...</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reset Data Section */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Restablecer Datos</h2>
            <p className="text-neutral-600 mb-6">
              <strong className="text-error-600">¡Cuidado!</strong> Esta acción eliminará permanentemente todos tus datos locales 
              (inmuebles, documentos, contratos, gastos, etc.) y no se puede deshacer.
            </p>
            
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Restablecer Datos
              </button>
            ) : (
              <div className="border border-error-200 rounded-lg p-4 bg-error-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-error-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-error-900 mb-2">
                      ¿Estás seguro de que quieres restablecer todos los datos?
                    </h4>
                    <p className="text-sm text-error-700 mb-4">
                      Se eliminarán permanentemente todos los inmuebles, documentos, contratos, gastos y preferencias. 
                      Esta acción no se puede deshacer.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetData}
                        className="px-4 py-2 bg-error-600 text-white text-sm rounded-lg hover:bg-error-700 transition-colors"
                      >
                        {showSecondConfirm ? 'Confirmar Restablecimiento' : 'Sí, Restablecer'}
                      </button>
                      <button
                        onClick={() => {
                          setShowResetConfirm(false);
                          setShowSecondConfirm(false);
                        }}
                        className="px-4 py-2 bg-neutral-200 text-neutral-700 text-sm rounded-lg hover:bg-neutral-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                    {showSecondConfirm && (
                      <p className="text-xs text-error-600 mt-2">
                        Haz clic en "Confirmar Restablecimiento" para proceder definitivamente.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reset Atlas Section - per problem statement */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Reset Atlas (limpieza local)</h2>
            <p className="text-neutral-600 mb-6">
              <strong className="text-error-600">¡Atención!</strong> Esta acción limpia únicamente el almacenamiento local 
              (localStorage e IndexedDB) eliminando cachés y datos temporales. No afecta a tus datos principales.
            </p>
            
            {!showAtlasResetConfirm ? (
              <button
                onClick={() => setShowAtlasResetConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset Atlas (limpieza local)
              </button>
            ) : (
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-orange-900 mb-2">
                      Confirmación requerida para limpieza local
                    </h4>
                    <p className="text-sm text-orange-700 mb-4">
                      Esta acción eliminará localStorage e IndexedDB. Para confirmar, 
                      escribe exactamente <strong>"ELIMINAR DATOS LOCALES"</strong> en el campo de abajo:
                    </p>
                    <input
                      type="text"
                      value={atlasResetText}
                      onChange={(e) => setAtlasResetText(e.target.value)}
                      placeholder="Escribe: ELIMINAR DATOS LOCALES"
                      className="w-full p-2 border border-orange-300 rounded mb-4 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetAtlas}
                        disabled={atlasResetText !== 'ELIMINAR DATOS LOCALES'}
                        className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Confirmar Limpieza Local
                      </button>
                      <button
                        onClick={() => {
                          setShowAtlasResetConfirm(false);
                          setAtlasResetText('');
                        }}
                        className="px-4 py-2 bg-neutral-200 text-neutral-700 text-sm rounded-lg hover:bg-neutral-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-xs text-warning-600 mt-2">
                      Tras la limpieza, la página se recargará automáticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Information */}
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Información de Datos</h2>
            <div className="space-y-2 text-sm text-neutral-600">
              <p><strong>Incluye en snapshots:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Inmuebles con todos sus detalles y costes de adquisición</li>
                <li>Documentos de la bandeja con sus archivos originales (PDF, JPG, PNG, ZIP)</li>
                <li>Contratos y sus metadatos de asignación</li>
                <li>Gastos y movimientos registrados</li>
                <li>Preferencias y configuraciones de la aplicación</li>
              </ul>
              <p className="mt-4">
                <strong>Almacenamiento:</strong> Los datos se guardan localmente en tu navegador 
                y solo tú tienes acceso a ellos.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'panel' && (
        <div>
          <DashboardConfig />
        </div>
      )}

      {activeTab === 'kpis' && (
        <div>
          <KpiBuilder />
        </div>
      )}
    </PageLayout>
  );
};

export default PreferenciasDatos;