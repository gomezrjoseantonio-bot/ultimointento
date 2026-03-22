import React, { useState } from 'react';
import { Clock, Database, TrendingUp, AlertCircle, CheckCircle, Play, X } from 'lucide-react';
import { 
  processHistoricalDataForProperty, 
  processAllHistoricalData,
  getHistoricalDataStats,
  HistoricalProcessingProgress,
  HistoricalProcessingResult
} from '../../../../services/historicalDataService';
import { initDB, Property } from '../../../../services/db';

interface HistoricalReconstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId?: number; // If not provided, processes all properties
  onComplete: () => void;
}

const HistoricalReconstructionModal: React.FC<HistoricalReconstructionModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  onComplete
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<HistoricalProcessingProgress | null>(null);
  const [result, setResult] = useState<HistoricalProcessingResult | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, propertyId]);

  const loadInitialData = async () => {
    try {
      const db = await initDB();
      const propertiesData = await db.getAll('properties');
      setProperties(propertiesData.filter(p => p.state === 'activo'));

      if (propertyId) {
        const statsData = await getHistoricalDataStats(propertyId);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const handleStartReconstruction = async () => {
    setIsProcessing(true);
    setProgress(null);
    setResult(null);

    try {
      let processingResult: HistoricalProcessingResult;

      if (propertyId) {
        processingResult = await processHistoricalDataForProperty(
          propertyId,
          (progressUpdate) => setProgress(progressUpdate)
        );
      } else {
        processingResult = await processAllHistoricalData(
          (progressUpdate) => setProgress(progressUpdate)
        );
      }

      setResult(processingResult);
    } catch (error) {
      console.error('Error during historical reconstruction:', error);
      setResult({
        success: false,
        contractsProcessed: 0,
        documentsProcessed: 0,
        fiscalSummariesUpdated: 0,
        carryForwardsRecalculated: 0,
        errors: [`Error crítico: ${error}`],
        processingTimeMs: 0
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
    setProgress(null);
    setResult(null);
    setStats(null);
  };

  const formatProcessingTime = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (!isOpen) return null;

  const targetProperty = propertyId ? properties.find(p => p.id === propertyId) : null;
  const targetDescription = targetProperty ? 
    `inmueble "${targetProperty.alias}"` : 
    `todas las propiedades (${properties.length} inmuebles)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Reconstrucción Histórica ≥10 años
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Cerrar reconstrucción histórica"
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-6 space-y-6">
          {/* Scope Info */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
            <div className="flex items-start space-x-3">
              <Database className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-primary-900">Alcance de la reconstrucción</h3>
                <p className="text-sm text-primary-700 mt-1">
                  Se procesará el histórico para {targetDescription}
                </p>
                <ul className="text-xs text-primary-600 mt-2 space-y-1">
                  <li>• Contratos y facturas hasta 10 años atrás</li>
                  <li>• Recálculo de calendarios de amortización</li>
                  <li>• Recálculo de arrastres de pérdidas AEAT</li>
                  <li>• Actualización de resúmenes fiscales</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Historical Stats (if single property) */}
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-600">Datos más antiguos</div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium">Contrato:</span> {
                      stats.oldestContract ? 
                      new Date(stats.oldestContract).toLocaleDateString('es-ES') : 
                      'N/A'
                    }
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Documento:</span> {
                      stats.oldestDocument ? 
                      new Date(stats.oldestDocument).toLocaleDateString('es-ES') : 
                      'N/A'
                    }
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-600">Años históricos</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalHistoricalYears}</div>
                <div className="text-xs text-gray-500">ejercicios disponibles</div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && progress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{progress.phase}</span>
                <span className="text-sm text-gray-500">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 h-3">
                <div 
                  className="h-3 rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {progress.details} ({progress.current}/{progress.total})
              </div>
            </div>
          )}

          {/* Processing Result */}
          {result && (
            <div className={`rounded-2xl p-4 ${
              result.success ? 'bg-cyan-50 border border-cyan-200' : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-start space-x-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-cyan-700 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-blue-700 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-medium ${
                    result.success ? 'text-cyan-900' : 'text-blue-900'
                  }`}>
                    {result.success ? 'Reconstrucción completada' : 'Reconstrucción completada con errores'}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">Contratos:</span> {result.contractsProcessed}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Documentos:</span> {result.documentsProcessed}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">Ejercicios:</span> {result.fiscalSummariesUpdated}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Arrastres:</span> {result.carryForwardsRecalculated}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mt-2">
                    Tiempo de procesamiento: {formatProcessingTime(result.processingTimeMs)}
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-700 font-medium">
                          Ver errores ({result.errors.length})
                        </summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {result.errors.map((error, index) => (
                            <div key={index} className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                              {error}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          {!result && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-atlas-teal mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-gray-800 mb-1">Proceso de reconstrucción histórica</p>
                  <p className="text-gray-600">
                    Este proceso puede tardar varios minutos dependiendo del volumen de datos históricos.
                    Se recomienda realizar esta operación fuera del horario de trabajo activo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {result ? 'Cerrar' : 'Cancelar'}
            </button>
            
            {!result && (
              <button
                onClick={handleStartReconstruction}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-white flex items-center justify-center space-x-2 transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Iniciar Reconstrucción</span>
                  </>
                )}
              </button>
            )}

            {result && result.success && (
              <button
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-cyan-700 px-4 py-2 text-white transition-colors hover:bg-cyan-800"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Finalizar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalReconstructionModal;
