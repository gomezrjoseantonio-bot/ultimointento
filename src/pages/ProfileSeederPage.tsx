import React, { useState } from 'react';
import { Upload, Download, Eye, Plus, X, FileText, AlertCircle } from 'lucide-react';
import { enhancedCSVParser } from '../services/csvParserService';
import { BankProfile } from '../types/bankProfiles';
import toast from 'react-hot-toast';

// This page is only accessible in development mode
if (!(import.meta as any).env?.DEV) {
  throw new Error('Profile Seeder is only available in development mode');
}

interface CapturedProfile {
  bankKey: string;
  fileName: string;
  headers: string[];
  sampleData: any[][];
  mappedFields: Record<string, string>;
}

const ProfileSeederPage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [processingFile, setProcessingFile] = useState<File | null>(null);
  const [capturedProfiles, setCapturedProfiles] = useState<CapturedProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CapturedProfile | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: any[][];
    sheetName?: string;
  } | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const processFile = async (file: File) => {
    setProcessingFile(file);
    setPreviewData(null);
    setCurrentProfile(null);
    setShowMapping(false);

    try {
      // Use the enhanced parser to process the file
      const result = await enhancedCSVParser.parseFile(file);
      
      // Extract headers and sample data for analysis
      const headers = result.metadata.headersOriginal || [];
      const sampleData = (result.preview || []).slice(0, 5).map(movement => 
        Object.values(movement.rawData || {})
      );

      setPreviewData({
        headers,
        rows: sampleData,
        sheetName: result.metadata.sheetName
      });

      // Create initial profile with detected bank or file name
      const bankKey = result.detectedBank?.bankKey || 
        file.name.replace(/\.(csv|xlsx?|pdf)$/i, '').toUpperCase();

      setCurrentProfile({
        bankKey,
        fileName: file.name,
        headers,
        sampleData,
        mappedFields: {
          date: '',
          valueDate: '',
          amount: '',
          description: '',
          counterparty: ''
        }
      });

      setShowMapping(true);
      toast.success(`Archivo procesado: ${headers.length} columnas detectadas`);

    } catch (error) {
      toast.error(`Error procesando archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setProcessingFile(null);
    }
  };

  const updateMapping = (field: string, header: string) => {
    if (currentProfile) {
      setCurrentProfile({
        ...currentProfile,
        mappedFields: {
          ...currentProfile.mappedFields,
          [field]: header
        }
      });
    }
  };

  const addToRegistry = () => {
    if (!currentProfile) return;

    // Validate required fields
    if (!currentProfile.mappedFields.date || !currentProfile.mappedFields.amount) {
      toast.error('Los campos Fecha e Importe son obligatorios');
      return;
    }

    setCapturedProfiles(prev => {
      // Remove existing profile with same bankKey
      const filtered = prev.filter(p => p.bankKey !== currentProfile.bankKey);
      return [...filtered, currentProfile];
    });

    toast.success(`Perfil ${currentProfile.bankKey} añadido al registro`);
    setShowMapping(false);
    setCurrentProfile(null);
    setPreviewData(null);
  };

  const removeFromRegistry = (bankKey: string) => {
    setCapturedProfiles(prev => prev.filter(p => p.bankKey !== bankKey));
    toast.success(`Perfil ${bankKey} eliminado del registro`);
  };

  const exportBankProfiles = () => {
    if (capturedProfiles.length === 0) {
      toast.error('No hay perfiles para exportar');
      return;
    }

    const profiles: BankProfile[] = capturedProfiles.map(captured => ({
      bankKey: captured.bankKey,
      bankVersion: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      headerAliases: {
        date: captured.mappedFields.date ? [captured.mappedFields.date.toLowerCase()] : [],
        valueDate: captured.mappedFields.valueDate ? [captured.mappedFields.valueDate.toLowerCase()] : [],
        amount: captured.mappedFields.amount ? [captured.mappedFields.amount.toLowerCase()] : [],
        description: captured.mappedFields.description ? [captured.mappedFields.description.toLowerCase()] : [],
        counterparty: captured.mappedFields.counterparty ? [captured.mappedFields.counterparty.toLowerCase()] : []
      },
      noisePatterns: [
        'saldo inicial', 'saldo final', 'saldo anterior', 'saldo actual', 
        'subtotal', 'total', 'totales', 'página', 'page', 'extracto', 
        'periodo', 'desde', 'hasta', 'nº de cuenta', 'iban', 'titular', 'oficina'
      ],
      numberFormat: {
        decimal: ',',
        thousand: '.'
      },
      dateHints: ['dd/mm/yyyy', 'dd-mm-yyyy'],
      minScore: 3
    }));

    const exportData = { profiles };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-profiles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`bank-profiles.json exportado con ${profiles.length} perfiles`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-warning-50 border border-yellow-200 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-600" />
          <h1 className="text-xl font-semibold text-yellow-900">
            Profile Seeder - Solo Desarrollo
          </h1>
        </div>
        <p className="text-warning-700 mt-2">
          Herramienta para generar perfiles de banco desde archivos reales. 
          Solo disponible en modo desarrollo.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="bg-white border border-neutral-200 p-6">
        <h2 className="text-lg font-medium text-neutral-900 mb-4">
          Subir Archivos Reales
        </h2>
        
        <div className="border-2 border-dashed border-neutral-300 p-6 text-center">
          <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
          <div className="space-y-2">
            <p className="text-neutral-600">
              Arrastra archivos aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-neutral-500">
              Soporta CSV, XLS, XLSX (máximo 8MB)
            </p>
          </div>
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">
              Archivos cargados ({files.length})
            </h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-neutral-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-700">{file.name}</span>
                    <span className="text-xs text-neutral-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => processFile(file)}
                      disabled={processingFile === file}
                      className="atlas-atlas-atlas-atlas-btn-primary px-3 py-1 text-xs disabled:opacity-50"
                    >
                      {processingFile === file ? 'Procesando...' : 'Procesar'}
                    </button>
                    <button
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                      className="p-1 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview and Mapping Section */}
      {showMapping && previewData && currentProfile && (
        <div className="bg-white border border-neutral-200 p-6">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">
            Mapear Campos - {currentProfile.fileName}
          </h2>

          {previewData.sheetName && (
            <div className="atlas-atlas-atlas-atlas-btn-primary mb-4 p-3">
              <p className="text-sm text-primary-700">
                Hoja detectada: <strong>{previewData.sheetName}</strong>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview Table */}
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-3">
                Vista previa (primeras 5 filas)
              </h3>
              <div className="overflow-x-auto border border-neutral-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      {previewData.headers.map((header, index) => (
                        <th key={index} className="px-2 py-2 text-left text-neutral-700 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-neutral-200">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-2 text-neutral-600">
                            {String(cell).slice(0, 20)}
                            {String(cell).length > 20 && '...'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Field Mapping */}
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-3">
                Mapear campos canónicos
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Banco/Entidad
                  </label>
                  <input
                    type="text"
                    value={currentProfile.bankKey}
                    onChange={(e) => setCurrentProfile({
                      ...currentProfile,
                      bankKey: e.target.value
                    })}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Ej: ING, BBVA, Santander..."
                  />
                </div>

                {['date', 'valueDate', 'amount', 'description', 'counterparty'].map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      {field === 'date' && 'Fecha *'}
                      {field === 'valueDate' && 'Fecha Valor'}
                      {field === 'amount' && 'Importe *'}
                      {field === 'description' && 'Descripción'}
                      {field === 'counterparty' && 'Contraparte'}
                    </label>
                    <select
                      value={currentProfile.mappedFields[field]}
                      onChange={(e) => updateMapping(field, e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="">-- Seleccionar columna --</option>
                      {previewData.headers.map((header, index) => (
                        <option key={index} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={addToRegistry}
                  className="flex items-center gap-2 px-4 py-2 bg-success-600"
              >
                  <Plus className="w-4 h-4" />
                  Añadir al registro
                </button>
                <button
                  onClick={() => setShowMapping(false)}
                  className="px-4 py-2 border border-neutral-300"
                  >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registry Section */}
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-neutral-900">
            Registro de Perfiles ({capturedProfiles.length})
          </h2>
          <button
            onClick={exportBankProfiles}
            disabled={capturedProfiles.length === 0}
            className="atlas-atlas-atlas-atlas-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar bank-profiles.json
          </button>
        </div>

        {capturedProfiles.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Eye className="w-8 h-8 mx-auto mb-3 text-neutral-300" />
            <p>No hay perfiles en el registro</p>
            <p className="text-sm">Procesa archivos para añadir perfiles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {capturedProfiles.map((profile, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-4 border border-neutral-200"
              >
                <div>
                  <h3 className="font-medium text-neutral-900">{profile.bankKey}</h3>
                  <p className="text-sm text-neutral-600">
                    Archivo: {profile.fileName}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Campos: {Object.values(profile.mappedFields).filter(v => v).length}/5 mapeados
                  </p>
                </div>
                <button
                  onClick={() => removeFromRegistry(profile.bankKey)}
                  className="p-1 text-red-400 hover:text-error-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-neutral-50 p-6">
        <h3 className="font-medium text-neutral-900 mb-3">Instrucciones de uso</h3>
        <ol className="text-sm text-neutral-700 space-y-2 list-decimal list-inside">
          <li>Sube archivos reales de diferentes bancos (CSV, XLS, XLSX)</li>
          <li>Procesa cada archivo para detectar cabeceras y datos</li>
          <li>Mapea los campos canónicos (fecha e importe son obligatorios)</li>
          <li>Añade cada perfil al registro</li>
          <li>Exporta el archivo bank-profiles.json</li>
          <li>Copia el archivo a <code className="bg-neutral-200 px-1 rounded">public/assets/bank-profiles.json</code></li>
          <li>Reinicia el servidor para cargar los nuevos perfiles</li>
        </ol>
      </div>
    </div>
  );
};

export default ProfileSeederPage;