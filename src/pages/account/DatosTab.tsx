// src/pages/account/DatosTab.tsx
// ATLAS HORIZON: Datos & Snapshots tab for Account page
// Permite exportar/importar la base de datos completa (ZIP) y descargar
// un snapshot JSON ligero para inspección manual.

import React, { useState } from 'react';
import { Download, Upload, FileJson, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  exportSnapshot,
  exportSnapshotJSON,
  importSnapshot,
  resetAllData,
} from '../../services/db';
import { confirmDelete } from '../../services/confirmationService';

const DatosTab: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const handleExportSnapshot = async () => {
    setIsExporting(true);
    try {
      await exportSnapshot();
      toast.success('Backup ZIP exportado correctamente');
    } catch (error) {
      toast.error(
        'Error al exportar: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExportingJson(true);
    try {
      const snapshot = await exportSnapshotJSON();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      a.download = `atlas-snapshot-${ts[0].replace(/-/g, '')}-${ts[1]
        .split('-')[0]
        .replace(/-/g, '')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Snapshot JSON exportado · ${snapshot.metadata.storeCount} stores · DB v${snapshot.metadata.dbVersion}`,
      );
    } catch (error) {
      toast.error(
        'Error al exportar JSON: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
      );
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleImportSnapshot = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error('Por favor selecciona un archivo ZIP válido');
      event.target.value = '';
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
        `Snapshot importado correctamente (${
          importMode === 'replace' ? 'reemplazado' : 'fusionado'
        })`,
      );
      window.location.reload();
    } catch (error) {
      toast.error(
        'Error al importar: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
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
        'Error al restablecer: ' +
          (error instanceof Error ? error.message : 'Error desconocido'),
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">
          Exportar copia de seguridad
        </h2>
        <p className="text-neutral-600 mb-6">
          Descarga toda tu base de datos local. Usa el formato ZIP para un
          backup completo (incluye documentos y blobs); usa el JSON ligero
          para inspección o auditoría manual.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-neutral-200 rounded-lg p-4">
            <h3 className="font-medium text-neutral-900 mb-2">
              Exportar copia completa (.zip)
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Archivo ZIP con todos los stores y los blobs originales
              (PDF, JPG, etc.). Recomendado para snapshots de respaldo.
            </p>
            <button
              onClick={handleExportSnapshot}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-atlas-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exportando...' : 'Exportar copia completa (.zip)'}
            </button>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4">
            <h3 className="font-medium text-neutral-900 mb-2">
              Exportar snapshot JSON
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Snapshot ligero en JSON con metadata (versión DB, conteo de
              stores, fecha). Sin blobs. Ideal para inspeccionar datos a mano.
            </p>
            <button
              onClick={handleExportJSON}
              disabled={isExportingJson}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileJson className="w-4 h-4" />
              {isExportingJson ? 'Exportando...' : 'Exportar snapshot (.json)'}
            </button>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">
          Importar copia de seguridad
        </h2>
        <p className="text-neutral-600 mb-6">
          Restaura un snapshot ZIP exportado previamente.
          <strong className="text-error-600"> Importante:</strong> en modo
          "Reemplazar todo", esto sobrescribe tus datos actuales.
        </p>

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
                <strong>Reemplazar todo</strong> · borra los datos actuales
                y los sustituye por los del snapshot
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
                <strong>Fusionar</strong> · añade/actualiza respetando los
                existentes
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-200 transition-colors">
            <Upload className="w-4 h-4" />
            <span>{isImporting ? 'Importando...' : 'Seleccionar archivo .zip'}</span>
            <input
              type="file"
              accept=".zip"
              onChange={handleImportSnapshot}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Reset Section */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">
          Restablecer datos
        </h2>
        <p className="text-neutral-600 mb-6">
          <strong className="text-error-600">¡Cuidado!</strong> Esta acción
          eliminará permanentemente todos tus datos locales (inmuebles,
          documentos, contratos, gastos, etc.) y no se puede deshacer.
        </p>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Restablecer datos
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
                  Se eliminarán permanentemente todos los inmuebles,
                  documentos, contratos, gastos y preferencias. Esta acción
                  no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetData}
                    className="px-4 py-2 bg-error-600 text-white text-sm rounded-lg hover:bg-error-700 transition-colors"
                  >
                    {showSecondConfirm
                      ? 'Confirmar restablecimiento'
                      : 'Sí, restablecer'}
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
                    Haz clic en "Confirmar restablecimiento" para proceder
                    definitivamente.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          ¿Qué se incluye en los snapshots?
        </h2>
        <div className="space-y-2 text-sm text-neutral-600">
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Inmuebles con todos sus detalles y costes de adquisición</li>
            <li>Documentos de la bandeja con sus archivos originales (PDF, JPG, PNG, ZIP) — sólo en formato ZIP</li>
            <li>Contratos y sus metadatos de asignación</li>
            <li>Movimientos bancarios, presupuestos, conciliación</li>
            <li>Datos personales · ingresos · pensiones · planes</li>
            <li>Datos fiscales · ejercicios · arrastres · snapshots</li>
            <li>Configuración Mi Plan v3 · escenarios · objetivos · fondos · retos</li>
          </ul>
          <p className="mt-4">
            <strong>Almacenamiento:</strong> los datos viven sólo en tu
            navegador (IndexedDB). Solo tú tienes acceso a ellos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DatosTab;
