/**
 * Universal Bank Importer Integration Example
 * Demonstrates how to use the new universal bank importer
 */

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { universalBankImporter, UniversalImportResult } from '../../services/universalBankImporter/universalBankImporter';
import { BankMappingAssistant } from '../../components/treasury/BankMappingAssistant';
import { ColumnRole } from '../../services/universalBankImporter/columnRoleDetector';

export const UniversalBankImportExample: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<UniversalImportResult | null>(null);
  const [showMappingAssistant, setShowMappingAssistant] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const importResult = await universalBankImporter.importBankFile({
        accountId: 1, // Example account ID
        file,
        skipDuplicates: true,
        toleranceAmount: 0.01
      });

      setResult(importResult);

      if (importResult.needsManualMapping && importResult.mappingAssistantData) {
        setShowMappingAssistant(true);
      }
    } catch (error) {
      setResult({
        success: false,
        movements: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        statistics: {
          fileFormat: 'CSV',
          totalRows: 0,
          dataRows: 0,
          successfulParsed: 0,
          skippedRows: 0,
          duplicatesDetected: 0,
          processingTimeMs: 0,
          locale: { decimalSep: ',', thousandSep: '.', confidence: 0, samples: [] },
          dateFormat: 'DD/MM/YYYY',
          overallConfidence: 0
        }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingComplete = async (
    mapping: { [columnIndex: number]: ColumnRole },
    profileName?: string
  ) => {
    if (!file) return;

    setShowMappingAssistant(false);
    setIsProcessing(true);

    try {
      // In a real implementation, this would call the manual mapping process
      console.log('Manual mapping completed:', mapping, profileName);
      
      // For demo purposes, show success
      setResult({
        success: true,
        movements: [], // Would be actual movements
        errors: [],
        warnings: ['Manual mapping applied successfully'],
        statistics: {
          fileFormat: 'CSV',
          totalRows: 10,
          dataRows: 9,
          successfulParsed: 9,
          skippedRows: 1,
          duplicatesDetected: 0,
          processingTimeMs: 1500,
          locale: { decimalSep: ',', thousandSep: '.', confidence: 0.9, samples: [] },
          dateFormat: 'DD/MM/YYYY',
          overallConfidence: 0.95
        },
        profileSaved: !!profileName
      });
    } catch (error) {
      console.error('Manual mapping failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Importador Bancario Universal</h1>
          <p className="text-gray-600">
            Soporta CSV, XLS, XLSX, OFX, QIF con auto-detección inteligente
          </p>
        </div>
      </div>

      {/* File Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium">Seleccione archivo bancario</p>
          <p className="text-gray-500">CSV, XLS, XLSX, OFX, QIF (max 10MB)</p>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.ofx,.qif"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
          >
            Examinar archivos
          </label>
        </div>
      </div>

      {/* Selected File */}
      {file && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB • {file.type || 'Tipo desconocido'}
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className={`px-6 py-2 rounded-lg font-medium ${
                isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isProcessing ? 'Procesando...' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Status */}
          <div className={`border rounded-lg p-4 ${
            result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? 'Importación exitosa' : 'Error en importación'}
              </span>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-600">Formato</div>
              <div className="text-lg font-bold text-blue-800">
                {result.statistics.fileFormat}
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm text-green-600">Movimientos</div>
              <div className="text-lg font-bold text-green-800">
                {result.statistics.successfulParsed}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-sm text-orange-600">Duplicados</div>
              <div className="text-lg font-bold text-orange-800">
                {result.statistics.duplicatesDetected}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-sm text-purple-600">Confianza</div>
              <div className="text-lg font-bold text-purple-800">
                {Math.round(result.statistics.overallConfidence * 100)}%
              </div>
            </div>
          </div>

          {/* Errors and Warnings */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-800 mb-2">Errores:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {result.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-2">Advertencias:</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Profile Info */}
          {(result.profileUsed || result.profileSaved) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Perfil de Banco:</h3>
              <div className="text-sm text-blue-700">
                {result.profileUsed && <p>✓ Perfil existente utilizado: {result.profileUsed}</p>}
                {result.profileSaved && <p>✓ Nuevo perfil guardado para futuros imports</p>}
              </div>
            </div>
          )}

          {/* Ledger Summary */}
          {result.ledgerSummary && (
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="font-medium mb-3">Resumen del Periodo:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Ingresos:</span>
                  <div className="font-medium text-green-600">
                    +{result.ledgerSummary.totalInflows.toFixed(2)}€
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Gastos:</span>
                  <div className="font-medium text-red-600">
                    -{result.ledgerSummary.totalOutflows.toFixed(2)}€
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Neto:</span>
                  <div className={`font-medium ${
                    result.ledgerSummary.netMovement >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {result.ledgerSummary.netMovement >= 0 ? '+' : ''}{result.ledgerSummary.netMovement.toFixed(2)}€
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Saldo final:</span>
                  <div className="font-medium">
                    {result.ledgerSummary.closingBalance?.toFixed(2) || 'N/A'}€
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mapping Assistant */}
      {showMappingAssistant && result?.mappingAssistantData && (
        <BankMappingAssistant
          isOpen={showMappingAssistant}
          onClose={() => setShowMappingAssistant(false)}
          data={result.mappingAssistantData}
          onComplete={handleMappingComplete}
        />
      )}
    </div>
  );
};