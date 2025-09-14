import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft,
  Euro,
  Percent,
  ChevronDown,
  ChevronUp,
  User,
  CreditCard,
  Calculator,
  FileText,
  Info
} from 'lucide-react';
import { FEINProcessingResult, FEINData, FEINToLoanMapping } from '../../types/fein';
import { PrestamoFinanciacion } from '../../types/financiacion';
import { formatSpanishNumber, formatSpanishPercentage, parseSpanishNumber, parseSpanishPercentage, parseSpanishIBAN, formatIBANDisplay } from '../../services/spanishFormattingService';

interface FEINValidationProps {
  feinResult: FEINProcessingResult;
  onContinue: (loanData: Partial<PrestamoFinanciacion>) => void;
  onBack: () => void;
}

const FEINValidation: React.FC<FEINValidationProps> = ({ feinResult, onContinue, onBack }) => {
  const [editableData, setEditableData] = useState<FEINData>(feinResult.data || {});
  const [mapping, setMapping] = useState<FEINToLoanMapping>({
    ambito: 'PERSONAL',
    cuentaCargoId: ''
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Accordion state for sections
  const [visibleSections, setVisibleSections] = useState({
    identificacion: true,
    estructura: true,
    tramoFijo: false,
    tramoVariable: false,
    comisiones: false,
    bonificaciones: false,
    resumen: true
  });

  // Mock accounts for demonstration - in real app would come from service
  const mockAccounts = [
    { id: '1', nombre: 'Cuenta Corriente Principal', iban: 'ES12 3456 7890 1234 5678 9012', entidad: 'CaixaBank', logo: '/logos/caixabank.png' },
    { id: '2', nombre: 'Cuenta Ahorro', iban: 'ES98 7654 3210 9876 5432 1098', entidad: 'Santander', logo: '/logos/santander.png' },
    { id: '3', nombre: 'Cuenta Nómina', iban: 'ES45 1122 3344 5566 7788 9900', entidad: 'BBVA', logo: '/logos/bbva.png' }
  ];

  const validateData = useCallback(() => {
    const newErrors: string[] = [];

    // Mandatory fields validation
    if (!editableData.capitalInicial) newErrors.push('Capital inicial es obligatorio');
    if (!editableData.tin && !editableData.tae) newErrors.push('TIN o TAE es obligatorio');
    if (!editableData.plazoAnos && !editableData.plazoMeses) newErrors.push('Plazo es obligatorio');
    if (!editableData.tipo) newErrors.push('Tipo de interés es obligatorio');
    if (!mapping.cuentaCargoId) newErrors.push('Cuenta de cargo es obligatoria');
    if (!mapping.alias) newErrors.push('Alias del préstamo es obligatorio');

    setErrors(newErrors);
  }, [editableData, mapping]);

  useEffect(() => {
    validateData();
  }, [validateData]);

  const handleFieldEdit = (field: string, value: any) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
    if (editingField === field) {
      setEditingField(null);
    }
  };
    const newErrors: string[] = [];

    // Mandatory fields validation
    if (!editableData.capitalInicial) newErrors.push('Capital inicial es obligatorio');
    if (!editableData.tin && !editableData.tae) newErrors.push('TIN o TAE es obligatorio');
    if (!editableData.plazoAnos && !editableData.plazoMeses) newErrors.push('Plazo es obligatorio');
    if (!editableData.tipo) newErrors.push('Tipo de interés es obligatorio');
    if (!mapping.cuentaCargoId) newErrors.push('Cuenta de cargo es obligatoria');
    if (!mapping.alias) newErrors.push('Alias del préstamo es obligatorio');

    setErrors(newErrors);
  }, [editableData, mapping]);

  useEffect(() => {
    validateData();
  }, [validateData]);

  const handleFieldEdit = (field: string, value: any) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
    if (editingField === field) {
      setEditingField(null);
    }
  };

  const handleContinue = () => {
    if (errors.length > 0) {
      alert('Corrija los errores antes de continuar');
      return;
    }

    // Convert FEIN data to loan format
    const loanData: Partial<PrestamoFinanciacion> = {
      alias: mapping.alias,
      ambito: mapping.ambito,
      inmuebleId: mapping.inmuebleId,
      cuentaCargoId: mapping.cuentaCargoId,
      
      // Financial data from FEIN
      capitalInicial: editableData.capitalInicial,
      plazoTotal: editableData.plazoAnos ? editableData.plazoAnos : (editableData.plazoMeses || 0),
      plazoPeriodo: editableData.plazoAnos ? 'AÑOS' : 'MESES',
      tipo: editableData.tipo,
      tinFijo: editableData.tipo === 'FIJO' ? editableData.tin : undefined,
      indice: editableData.indice === 'EURIBOR' ? 'EURIBOR' : 'OTRO',
      diferencial: editableData.diferencial,
      tramoFijoAnos: editableData.tramoFijoAnos,
      tinTramoFijo: editableData.tipo === 'MIXTO' ? editableData.tin : undefined,
      
      // Commissions
      comisionApertura: editableData.comisionApertura,
      comisionAmortizacionAnticipada: editableData.comisionAmortizacionParcial,
      
      // Dates
      fechaPrimerCargo: editableData.fechaPrimerPago,
      fechaFirma: new Date().toISOString().split('T')[0], // Today as default
      
      // Default values
      esquemaPrimerRecibo: 'NORMAL',
      carencia: 'NINGUNA',
      sistema: 'FRANCES',
      revision: 12,
      diaCobroMes: 1,
      
      // Convert FEIN bonifications to loan bonifications
      bonificaciones: editableData.bonificaciones?.map(b => ({
        id: Math.random().toString(36).substr(2, 9),
        tipo: b.tipo,
        nombre: b.descripcion,
        condicionParametrizable: b.condicion || 'Condición extraída del FEIN',
        descuentoTIN: b.descuento || 0,
        ventanaEvaluacion: 12,
        fuenteVerificacion: 'MANUAL' as const,
        estadoInicial: 'NO_CUMPLE' as const,
        activa: true
      })) || []
    };

    onContinue(loanData);
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (percentage?: number) => {
    if (!percentage) return '';
    return `${(percentage * 100).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-gray-100"
              style={{ color: 'var(--text-gray)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            
            <div>
              <h1 
                className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]" 
                style={{ color: 'var(--hz-text)' }}
              >
                Validar datos del FEIN
              </h1>
              <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
                Revise y complete la información extraída del documento
              </p>
            </div>
          </div>
          
          <button
            onClick={handleContinue}
            disabled={errors.length > 0}
            className="px-6 py-2 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: errors.length > 0 ? '#6C757D' : 'var(--atlas-blue)' }}
          >
            Crear Préstamo
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Processing Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                {feinResult.success ? (
                  <CheckCircle className="h-6 w-6" style={{ color: 'var(--ok)' }} />
                ) : (
                  <XCircle className="h-6 w-6" style={{ color: 'var(--error)' }} />
                )}
                <h3 className="text-lg font-semibold" style={{ color: 'var(--hz-text)' }}>
                  {feinResult.success ? 'Documento procesado' : 'Error procesando documento'}
                </h3>
              </div>
              
              {feinResult.confidence && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-gray)' }}>Confianza</span>
                    <span style={{ color: 'var(--hz-text)' }}>{Math.round(feinResult.confidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${feinResult.confidence * 100}%`,
                        backgroundColor: feinResult.confidence > 0.7 ? 'var(--ok)' : 'var(--warn)'
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
                Campos extraídos: {feinResult.fieldsExtracted?.join(', ') || 'Ninguno'}
              </div>
            </div>

            {/* Loan Identification */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--hz-text)' }}>
                Identificación del Préstamo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Alias del préstamo *
                  </label>
                  <input
                    type="text"
                    value={mapping.alias || ''}
                    onChange={(e) => setMapping(prev => ({ ...prev, alias: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Hipoteca vivienda habitual"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Ámbito *
                  </label>
                  <select
                    value={mapping.ambito}
                    onChange={(e) => setMapping(prev => ({ ...prev, ambito: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="INMUEBLE">Inmueble</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Cuenta de cargo *
                  </label>
                  <select
                    value={mapping.cuentaCargoId}
                    onChange={(e) => setMapping(prev => ({ ...prev, cuentaCargoId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccione una cuenta</option>
                    {mockAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.nombre} - {account.iban}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Financial Conditions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--hz-text)' }}>
                Condiciones Financieras
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Capital inicial *
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={editableData.capitalInicial || ''}
                      onChange={(e) => handleFieldEdit('capitalInicial', parseFloat(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                  {editableData.capitalInicial && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(editableData.capitalInicial)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    TIN *
                  </label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={editableData.tin ? (editableData.tin * 100).toFixed(2) : ''}
                      onChange={(e) => handleFieldEdit('tin', parseFloat(e.target.value) / 100)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="3,45"
                    />
                  </div>
                  {editableData.tin && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatPercentage(editableData.tin)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Plazo (años)
                  </label>
                  <input
                    type="number"
                    value={editableData.plazoAnos || ''}
                    onChange={(e) => handleFieldEdit('plazoAnos', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                    Tipo de interés *
                  </label>
                  <select
                    value={editableData.tipo || ''}
                    onChange={(e) => handleFieldEdit('tipo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccione tipo</option>
                    <option value="FIJO">Fijo</option>
                    <option value="VARIABLE">Variable</option>
                    <option value="MIXTO">Mixto</option>
                  </select>
                </div>

                {editableData.bancoEntidad && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--hz-text)' }}>
                      Entidad bancaria
                    </label>
                    <input
                      type="text"
                      value={editableData.bancoEntidad}
                      onChange={(e) => handleFieldEdit('bancoEntidad', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bonifications */}
            {editableData.bonificaciones && editableData.bonificaciones.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--hz-text)' }}>
                  Bonificaciones detectadas
                </h3>
                
                <div className="space-y-3">
                  {editableData.bonificaciones.map((bonif, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <span className="font-medium">{bonif.descripcion}</span>
                        {bonif.descuento && (
                          <span className="ml-2 text-sm text-green-600">
                            -{formatPercentage(bonif.descuento)} TIN
                          </span>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {bonif.tipo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Errors and Warnings */}
            {(errors.length > 0 || feinResult.warnings.length > 0) && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="font-semibold mb-3" style={{ color: 'var(--hz-text)' }}>
                  Validación
                </h4>
                
                {errors.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4" style={{ color: 'var(--error)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                        Errores ({errors.length})
                      </span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {errors.map((error, index) => (
                        <li key={index} style={{ color: 'var(--error)' }}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {feinResult.warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" style={{ color: 'var(--warn)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--warn)' }}>
                        Advertencias ({feinResult.warnings.length})
                      </span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {feinResult.warnings.map((warning, index) => (
                        <li key={index} style={{ color: 'var(--warn)' }}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Help Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                Ayuda
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Los campos marcados con * son obligatorios</li>
                <li>• Puede editar cualquier valor extraído</li>
                <li>• Las bonificaciones se aplicarán automáticamente</li>
                <li>• El cuadro de amortización se generará al crear el préstamo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINValidation;