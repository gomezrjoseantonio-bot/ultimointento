// ATLAS HOTFIX: Manual Column Mapping Modal - Fallback when auto-detection fails
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, FileSpreadsheet, Eye } from 'lucide-react';
import { bankParser } from './bankParser';
import { BankParseResult, HeaderDetectionResult } from '../../../types/bankProfiles';

interface MapColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: BankParseResult) => void;
  file: File;
  rawData: string[][];
  sheetName: string;
  headerDetection?: HeaderDetectionResult;
}

interface ColumnMapping {
  [key: string]: number | null;
}

const REQUIRED_COLUMNS = [
  { key: 'date', label: 'Fecha', required: true, description: 'Fecha de la operación' },
  { key: 'amount', label: 'Importe', required: true, description: 'Cantidad en euros' },
];

const OPTIONAL_COLUMNS = [
  { key: 'description', label: 'Descripción', required: false, description: 'Concepto o detalle' },
  { key: 'valueDate', label: 'Fecha valor', required: false, description: 'Fecha de valor (opcional)' },
  { key: 'balance', label: 'Saldo', required: false, description: 'Saldo tras operación' },
  { key: 'reference', label: 'Referencia', required: false, description: 'Número de referencia' },
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const MapColumnsModal: React.FC<MapColumnsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  file,
  rawData,
  sheetName,
  headerDetection
}) => {
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [parsePreview, setParsePreview] = useState<BankParseResult | null>(null);

  // Initialize with detected values if available
  useEffect(() => {
    if (headerDetection && !headerDetection.fallbackRequired) {
      setHeaderRow(headerDetection.headerRow);
      setColumnMapping(headerDetection.detectedColumns);
    } else {
      setHeaderRow(0);
      setColumnMapping({});
    }
  }, [headerDetection]);

  // Update preview data when header row changes
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const startRow = Math.max(0, headerRow);
      const endRow = Math.min(rawData.length, startRow + 10);
      setPreviewData(rawData.slice(startRow, endRow));
    }
  }, [rawData, headerRow]);

  const handleColumnMapping = (columnKey: string, columnIndex: number | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [columnKey]: columnIndex
    }));
  };

  const getAvailableColumns = (): string[] => {
    if (!rawData || headerRow >= rawData.length) return [];
    return rawData[headerRow] || [];
  };

  const isColumnMapped = (columnIndex: number): boolean => {
    return Object.values(columnMapping).includes(columnIndex);
  };

  const canConfirm = (): boolean => {
    return REQUIRED_COLUMNS.every(col => 
      columnMapping[col.key] !== null && columnMapping[col.key] !== undefined
    );
  };

  const handlePreview = async () => {
    if (!canConfirm()) return;
    
    setIsProcessing(true);
    try {
      const validMapping: Record<string, number> = {};
      for (const [key, value] of Object.entries(columnMapping)) {
        if (value !== null && value !== undefined) {
          validMapping[key] = value;
        }
      }

      const result = await bankParser.parseWithManualMapping(
        file,
        sheetName,
        validMapping,
        headerRow
      );
      
      setParsePreview(result);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm()) return;
    
    setIsProcessing(true);
    try {
      const validMapping: Record<string, number> = {};
      for (const [key, value] of Object.entries(columnMapping)) {
        if (value !== null && value !== undefined) {
          validMapping[key] = value;
        }
      }

      const result = await bankParser.parseWithManualMapping(
        file,
        sheetName,
        validMapping,
        headerRow
      );
      
      onConfirm(result);
    } catch (error) {
      console.error('Mapping confirmation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-primary-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Mapear columnas del extracto
              </h3>
              <p className="text-sm text-gray-600">
                Archivo: {file.name} | Hoja: {sheetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {!showPreview ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-full">
              {/* Column Mapping Panel */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fila de cabeceras
                  </label>
                  <select
                    value={headerRow}
                    onChange={(e) => setHeaderRow(parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {Array.from({ length: Math.min(20, rawData.length) }, (_, i) => (
                      <option key={i} value={i}>
                        Fila {i + 1}: {rawData[i]?.slice(0, 3).join(' | ')}...
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Mapear columnas</h4>
                  
                  {ALL_COLUMNS.map((column) => (
                    <div key={column.key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                          {column.label}
                        </label>
                        {column.required && (
                          <span className="text-error-500 text-xs">*</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{column.description}</p>
                      <select
                        value={columnMapping[column.key] ?? ''}
                        onChange={(e) => handleColumnMapping(
                          column.key, 
                          e.target.value === '' ? null : parseInt(e.target.value)
                        )}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">-- Seleccionar columna --</option>
                        {getAvailableColumns().map((header, index) => (
                          <option 
                            key={index} 
                            value={index}
                            disabled={isColumnMapped(index) && columnMapping[column.key] !== index}
                          >
                            {String.fromCharCode(65 + index)}: {header || `Columna ${index + 1}`}
                            {isColumnMapped(index) && columnMapping[column.key] !== index && ' (ya asignada)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handlePreview}
                    disabled={!canConfirm() || isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    {isProcessing ? 'Procesando...' : 'Vista previa'}
                  </button>
                  
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirm() || isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirmar mapeo
                  </button>
                </div>
              </div>

              {/* Data Preview Panel */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Vista previa de datos</h4>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left text-gray-700 font-medium">Fila</th>
                          {getAvailableColumns().map((header, index) => (
                            <th key={index} className="px-2 py-1 text-left text-gray-700 font-medium">
                              <div className="flex flex-col">
                                <span>{String.fromCharCode(65 + index)}</span>
                                <span className="truncate max-w-20" title={header}>
                                  {header || `Col ${index + 1}`}
                                </span>
                                {isColumnMapped(index) && (
                                  <span className="text-primary-600 text-xs">
                                    {Object.entries(columnMapping).find(([_, v]) => v === index)?.[0]}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? 'bg-primary-50' : 'hover:bg-gray-50'}>
                            <td className="px-2 py-1 text-gray-600">
                              {headerRow + rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-2 py-1 text-gray-900 border-l border-gray-100">
                                <div className="truncate max-w-24" title={cell}>
                                  {cell}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {!canConfirm() && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-800">
                        Debes mapear al menos las columnas obligatorias: Fecha e Importe
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Preview Results Panel */
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">Resultado del procesamiento</h4>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Volver al mapeo
                </button>
              </div>

              {parsePreview?.success ? (
                <div className="space-y-4">
                  <div className="bg-success-50 border border-success-200 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-success-600" />
                      <span className="font-medium text-success-800">
                        Procesamiento exitoso
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Movimientos:</span>
                        <span className="font-medium ml-2">{parsePreview.movements.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Filas procesadas:</span>
                        <span className="font-medium ml-2">{parsePreview.metadata.rowsProcessed}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Columnas:</span>
                        <span className="font-medium ml-2">{parsePreview.metadata.columnsDetected}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Confianza:</span>
                        <span className="font-medium ml-2">100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-md">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h5 className="font-medium text-gray-900">
                        Primeros 5 movimientos (vista previa)
                      </h5>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700">Fecha</th>
                            <th className="px-4 py-2 text-left text-gray-700">Importe</th>
                            <th className="px-4 py-2 text-left text-gray-700">Descripción</th>
                            <th className="px-4 py-2 text-left text-gray-700">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsePreview.movements.slice(0, 5).map((movement, index) => (
                            <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2">{formatDate(movement.date)}</td>
                              <td className="px-4 py-2">
                                <span className={movement.amount >= 0 ? 'text-success-600' : 'text-error-600'}>
                                  {formatAmount(movement.amount)}
                                </span>
                              </td>
                              <td className="px-4 py-2 max-w-xs truncate" title={movement.description}>
                                {movement.description}
                              </td>
                              <td className="px-4 py-2">
                                {movement.balance !== undefined ? formatAmount(movement.balance) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleConfirm}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-6 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 disabled:bg-gray-300 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Confirmar importación
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-error-50 border border-error-200 rounded-md p-4">
                  <div className="flex items-center gap-2">
                    <X className="h-5 w-5 text-error-600" />
                    <span className="font-medium text-error-800">Error en el procesamiento</span>
                  </div>
                  <p className="text-sm text-error-700 mt-1">
                    {parsePreview?.error || 'Error desconocido'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapColumnsModal;