import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  User,
  Home,
  CreditCard,
  TrendingUp,
  FileText,
  Calculator,
  AlertTriangle
} from 'lucide-react';
import { FEINProcessingResult, FEINData, FEINToLoanMapping } from '../../types/fein';
import { PrestamoFinanciacion, CalculoLive } from '../../types/financiacion';
import { LiveCalculationService } from '../../services/liveCalculationService';

interface FEINValidationProps {
  feinResult: FEINProcessingResult;
  onContinue: (loanData: Partial<PrestamoFinanciacion>) => void;
  onBack: () => void;
}

const FEINValidation = ({ feinResult, onContinue, onBack }: FEINValidationProps) => {
  // Use rawData for editing (legacy format) and data for canonical display
  const [editableData, setEditableData] = useState<FEINData>(feinResult.rawData || {});
  // Note: canonicalData (feinResult.data) is available for display if needed
  const [mapping, setMapping] = useState<FEINToLoanMapping>({
    ambito: 'PERSONAL',
    cuentaCargoId: ''
  });

  // Live calculations state
  const [liveCalculation, setLiveCalculation] = useState<CalculoLive | null>(null);
  const [validationStatus, setValidationStatus] = useState<{ isValid: boolean; missing: string[] }>({ 
    isValid: false, 
    missing: [] 
  });

  // Accordion sections state
  const [openSections, setOpenSections] = useState({
    identificacion: true,
    estructura: false,
    condiciones: false,
    bonificaciones: false,
    comisiones: false,
    resumen: false
  });

  // Update calculations whenever data changes
  useEffect(() => {
    const calculation = LiveCalculationService.calculateFromFEIN(editableData);
    const validation = LiveCalculationService.validateLoanData(editableData);
    
    setLiveCalculation(calculation);
    setValidationStatus(validation);
  }, [editableData]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Mock account data (in real implementation, this would come from a service)
  const mockAccounts = [
    { id: 'acc1', iban: 'ES91 2100 0418 4502 0005 1332', entidad: 'CaixaBank', logo: '/logos/caixabank.png' },
    { id: 'acc2', iban: 'ES79 0049 0001 5025 1610 1005', entidad: 'Santander', logo: '/logos/santander.png' },
    { id: 'acc3', iban: 'ES15 0081 0346 1100 0123 4567', entidad: 'Sabadell', logo: '/logos/sabadell.png' }
  ];

  const handleContinue = () => {
    // Enhanced conversion with all accordion data
    const loanData: Partial<PrestamoFinanciacion> = {
      alias: mapping.alias || 'Préstamo FEIN',
      ambito: mapping.ambito,
      cuentaCargoId: mapping.cuentaCargoId || '1',
      capitalInicial: editableData.capitalInicial || 100000,
      tipo: editableData.tipo || 'FIJO',
      sistema: 'FRANCES',
      fechaFirma: editableData.fechaEmisionFEIN || new Date().toISOString().split('T')[0],
      fechaPrimerCargo: editableData.fechaPrimerPago || new Date().toISOString().split('T')[0],
      diaCobroMes: 1,
      esquemaPrimerRecibo: 'NORMAL',
      carencia: 'NINGUNA',
      plazoTotal: editableData.plazoAnos || 25,
      plazoPeriodo: 'AÑOS',
      revision: (editableData.periodicidadRevision === 6 || editableData.periodicidadRevision === 12) 
        ? editableData.periodicidadRevision as (6 | 12) : 12,
      bonificaciones: []
    };

    onContinue(loanData);
  };

  // Helper component for accordion section header
  const AccordionHeader = ({ 
    title, 
    icon: Icon, 
    section, 
    isOpen, 
    itemCount 
  }: { 
    title: string; 
    icon: any; 
    section: keyof typeof openSections; 
    isOpen: boolean;
    itemCount?: number;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" style={{ color: 'var(--atlas-blue)' }} />
        <span className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
          {title}
        </span>
        {itemCount && (
          <span 
            className="text-xs px-2 py-1 rounded-full"
            >
            style={{ 
              backgroundColor: 'var(--bg)', 
              color: 'var(--text-gray)' 
            }}
          >
            {itemCount} campos
          </span>
        )}
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-gray)' }} />
      ) : (
        <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-gray)' }} />
      )}
    </button>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-atlas transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                Validar datos FEIN
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
                Revise y complete los datos extraídos del documento
              </p>
            </div>
          </div>
          
          <button
            onClick={handleContinue}
            className="px-6 py-2 text-white rounded-atlas font-medium transition-colors"
            >
            style={{ backgroundColor: 'var(--atlas-blue)' }}
          >
            Crear Préstamo
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Processing Status */}
          <div className="bg-white rounded-atlas border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              {feinResult.success ? (
                <CheckCircle className="h-6 w-6" style={{ color: 'var(--ok)' }} />
              ) : (
                <XCircle className="h-6 w-6" style={{ color: 'var(--error)' }} />
              )}
              <h2 className="text-lg font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                {feinResult.success ? 'Documento procesado correctamente' : 'Error al procesar documento'}
              </h2>
            </div>

            {feinResult.confidence && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-gray)' }}>
                    Confianza de extracción
                  </span>
                  <span className="text-sm" style={{ color: 'var(--atlas-navy-1)' }}>
                    {Math.round(feinResult.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all"
                    >
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

          {/* Live Calculations Panel */}
          {liveCalculation && (
            <div className="bg-white rounded-atlas border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Calculator className="h-5 w-5" style={{ color: 'var(--atlas-blue)' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                  Cálculo en tiempo real
                </h2>
                {!validationStatus.isValid && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--warn)' }}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>Datos incompletos</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: 'var(--atlas-blue)' }}>
                    {LiveCalculationService.formatCurrency(liveCalculation.cuotaEstimada)}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
                    Cuota mensual estimada
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: 'var(--atlas-blue)' }}>
                    {liveCalculation.taeAproximada.toFixed(2)}%
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
                    TAE aproximada
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: 'var(--atlas-blue)' }}>
                    {liveCalculation.tinEfectivo.toFixed(2)}%
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
                    TIN efectivo
                  </div>
                </div>

                {liveCalculation.ahorroMensual && liveCalculation.ahorroMensual > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1" style={{ color: 'var(--ok)' }}>
                      {LiveCalculationService.formatCurrency(liveCalculation.ahorroMensual)}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
                      Ahorro mensual
                    </div>
                  </div>
                )}
              </div>

              {liveCalculation.proximaFechaRevision && (
                <div className="mt-4 p-3 rounded-atlas" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="text-sm">
                    <span style={{ color: 'var(--text-gray)' }}>Próxima revisión: </span>
                    <span className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
                      {new Date(liveCalculation.proximaFechaRevision).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </div>
              )}

              {!validationStatus.isValid && validationStatus.missing.length > 0 && (
                <div className="mt-4 p-3 rounded-atlas border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--warn)' }}>
                  <div className="text-sm">
                    <span style={{ color: 'var(--warn)' }}>Campos pendientes: </span>
                    <span style={{ color: 'var(--atlas-navy-1)' }}>
                      {validationStatus.missing.join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comprehensive Accordion Form */}
          <div className="bg-white rounded-atlas border border-gray-200">
            {/* Section 1: Identificación */}
            <div className="border-b border-gray-200">
              <AccordionHeader 
                title="Identificación del préstamo"
                icon={User}
                section="identificacion"
                isOpen={openSections.identificacion}
                itemCount={4}
              />
              {openSections.identificacion && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Alias del préstamo *
                      </label>
                      <input
                        type="text"
                        value={mapping.alias || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, alias: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Nombre del préstamo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Entidad bancaria
                      </label>
                      <input
                        type="text"
                        value={editableData.bancoEntidad || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, bancoEntidad: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Nombre del banco"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Ámbito *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMapping(prev => ({ ...prev, ambito: 'PERSONAL' }))}
                          className={`p-3 text-left rounded-atlas border transition-all ${
                            mapping.ambito === 'PERSONAL'
                              ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            <span className="text-sm font-medium">Personal</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapping(prev => ({ ...prev, ambito: 'INMUEBLE' }))}
                          className={`p-3 text-left rounded-atlas border transition-all ${
                            mapping.ambito === 'INMUEBLE'
                              ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <Home className="h-4 w-4 mr-2" />
                            <span className="text-sm font-medium">Inmueble</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Cuenta de cargo *
                      </label>
                      <select
                        value={mapping.cuentaCargoId}
                        onChange={(e) => setMapping(prev => ({ ...prev, cuentaCargoId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Seleccionar cuenta...</option>
                        {mockAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.entidad} - {account.iban}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Estructura financiera */}
            <div className="border-b border-gray-200">
              <AccordionHeader 
                title="Estructura financiera"
                icon={TrendingUp}
                section="estructura"
                isOpen={openSections.estructura}
                itemCount={4}
              />
              {openSections.estructura && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Capital inicial *
                      </label>
                      <input
                        type="number"
                        value={editableData.capitalInicial || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, capitalInicial: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Capital inicial en €"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Tipo de préstamo *
                      </label>
                      <select
                        value={editableData.tipo || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, tipo: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="FIJO">Fijo</option>
                        <option value="VARIABLE">Variable</option>
                        <option value="MIXTO">Mixto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Plazo (años)
                      </label>
                      <input
                        type="number"
                        value={editableData.plazoAnos || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, plazoAnos: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Plazo en años"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Plazo (meses)
                      </label>
                      <input
                        type="number"
                        value={editableData.plazoMeses || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, plazoMeses: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Plazo adicional en meses"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Condiciones de tipos */}
            <div className="border-b border-gray-200">
              <AccordionHeader 
                title="Condiciones de tipos de interés"
                icon={Calculator}
                section="condiciones"
                isOpen={openSections.condiciones}
                itemCount={6}
              />
              {openSections.condiciones && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        TIN (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.tin || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, tin: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="TIN en %"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        TAE (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.tae || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, tae: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="TAE en %"
                      />
                    </div>

                    {(editableData.tipo === 'VARIABLE' || editableData.tipo === 'MIXTO') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                            Índice de referencia
                          </label>
                          <input
                            type="text"
                            value={editableData.indice || ''}
                            onChange={(e) => setEditableData(prev => ({ ...prev, indice: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                            placeholder="ej. EURIBOR 12M"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                            Diferencial (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editableData.diferencial || ''}
                            onChange={(e) => setEditableData(prev => ({ ...prev, diferencial: Number(e.target.value) }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                            placeholder="Diferencial en %"
                          />
                        </div>
                      </>
                    )}

                    {editableData.tipo === 'MIXTO' && (
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                          Tramo fijo (años)
                        </label>
                        <input
                          type="number"
                          value={editableData.tramoFijoAnos || ''}
                          onChange={(e) => setEditableData(prev => ({ ...prev, tramoFijoAnos: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                          placeholder="Años del tramo fijo"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Periodicidad de revisión
                      </label>
                      <select
                        value={editableData.periodicidadRevision || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, periodicidadRevision: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value={6}>Semestral (6 meses)</option>
                        <option value={12}>Anual (12 meses)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Bonificaciones */}
            <div className="border-b border-gray-200">
              <AccordionHeader 
                title="Bonificaciones"
                icon={TrendingUp}
                section="bonificaciones"
                isOpen={openSections.bonificaciones}
                itemCount={editableData.bonificaciones?.length || 0}
              />
              {openSections.bonificaciones && (
                <div className="p-6 border-t border-gray-100">
                  <div className="space-y-4">
                    <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
                      Bonificaciones detectadas en el documento FEIN
                    </p>
                    
                    {editableData.bonificaciones && editableData.bonificaciones.length > 0 ? (
                      <div className="space-y-3">
                        {editableData.bonificaciones.map((bonif, index) => (
                          <div key={index} className="p-4 border border-gray-200 rounded-atlas">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                                <select
                                  value={bonif.tipo}
                                  onChange={(e) => {
                                    const newBonif = [...(editableData.bonificaciones || [])];
                                    newBonif[index] = { ...bonif, tipo: e.target.value as any };
                                    setEditableData(prev => ({ ...prev, bonificaciones: newBonif }));
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                                >
                                  <option value="NOMINA">Nómina</option>
                                  <option value="RECIBOS">Recibos</option>
                                  <option value="TARJETA">Tarjeta</option>
                                  <option value="SEGURO_HOGAR">Seguro Hogar</option>
                                  <option value="SEGURO_VIDA">Seguro Vida</option>
                                  <option value="PLAN_PENSIONES">Plan Pensiones</option>
                                  <option value="ALARMA">Alarma</option>
                                  <option value="INGRESOS_RECURRENTES">Ingresos Recurrentes</option>
                                  <option value="OTROS">Otros</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                                <input
                                  type="text"
                                  value={bonif.descripcion}
                                  onChange={(e) => {
                                    const newBonif = [...(editableData.bonificaciones || [])];
                                    newBonif[index] = { ...bonif, descripcion: e.target.value };
                                    setEditableData(prev => ({ ...prev, bonificaciones: newBonif }));
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          >
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Descuento (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={bonif.descuento || ''}
                                  onChange={(e) => {
                                    const newBonif = [...(editableData.bonificaciones || [])];
                                    newBonif[index] = { ...bonif, descuento: Number(e.target.value) };
                                    setEditableData(prev => ({ ...prev, bonificaciones: newBonif }));
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          >
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No se detectaron bonificaciones en el documento</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Comisiones */}
            <div className="border-b border-gray-200">
              <AccordionHeader 
                title="Comisiones"
                icon={CreditCard}
                section="comisiones"
                isOpen={openSections.comisiones}
                itemCount={4}
              />
              {openSections.comisiones && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Comisión de apertura (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.comisionApertura || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, comisionApertura: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Comisión de apertura"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Comisión amortización parcial (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.comisionAmortizacionParcial || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, comisionAmortizacionParcial: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Comisión amortización parcial"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Comisión cancelación total (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.comisionCancelacionTotal || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, comisionCancelacionTotal: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Comisión cancelación total"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Comisión subrogación (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editableData.comisionSubrogacion || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, comisionSubrogacion: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="Comisión subrogación"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 6: Resumen y fechas */}
            <div>
              <AccordionHeader 
                title="Resumen y fechas"
                icon={FileText}
                section="resumen"
                isOpen={openSections.resumen}
                itemCount={3}
              />
              {openSections.resumen && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Fecha emisión FEIN
                      </label>
                      <input
                        type="date"
                        value={editableData.fechaEmisionFEIN || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, fechaEmisionFEIN: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Fecha primer pago prevista
                      </label>
                      <input
                        type="date"
                        value={editableData.fechaPrimerPago || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, fechaPrimerPago: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
                        Cuenta de cargo (IBAN)
                      </label>
                      <input
                        type="text"
                        value={editableData.cuentaCargoIban || ''}
                        onChange={(e) => setEditableData(prev => ({ ...prev, cuentaCargoIban: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-atlas focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                        placeholder="IBAN de la cuenta de cargo"
                      />
                      {editableData.ibanMascarado && (
                        <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
                          ⚠️ IBAN parcialmente oculto en el documento original
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Enhanced summary calculation preview */}
                  <div className="mt-6 p-4 rounded-atlas" style={{ backgroundColor: 'var(--bg)' }}>
                    <h4 className="font-medium mb-3" style={{ color: 'var(--atlas-navy-1)' }}>
                      Resumen del préstamo
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Capital:</span>
                        <p className="font-medium">{editableData.capitalInicial?.toLocaleString('es-ES')}€</p>
                      </div>
                      <div>
                        <span className="text-gray-500">TIN:</span>
                        <p className="font-medium">{editableData.tin || 0}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">TAE:</span>
                        <p className="font-medium">{editableData.tae || liveCalculation?.taeAproximada || 0}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Plazo:</span>
                        <p className="font-medium">{editableData.plazoAnos || 0} años</p>
                      </div>
                    </div>
                    
                    {liveCalculation && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Cuota estimada:</span>
                            <p className="font-bold text-lg" style={{ color: 'var(--atlas-blue)' }}>
                              {LiveCalculationService.formatCurrency(liveCalculation.cuotaEstimada)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">TIN efectivo:</span>
                            <p className="font-medium">{liveCalculation.tinEfectivo}%</p>
                          </div>
                          {liveCalculation.ahorroMensual && liveCalculation.ahorroMensual > 0 && (
                            <div>
                              <span className="text-gray-500">Ahorro mensual:</span>
                              <p className="font-medium" style={{ color: 'var(--ok)' }}>
                                {LiveCalculationService.formatCurrency(liveCalculation.ahorroMensual)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-atlas border border-gray-200 transition-colors hover:bg-gray-50"
              >
              style={{ color: 'var(--text-gray)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al documento
            </button>
            
            <button
              onClick={handleContinue}
              disabled={!validationStatus.isValid || !mapping.cuentaCargoId}
              className={`px-6 py-2 text-white rounded-atlas font-medium transition-colors ${
                validationStatus.isValid && mapping.cuentaCargoId
                  ? 'hover:opacity-90'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ backgroundColor: 'var(--atlas-blue)' }}
            >
              Crear préstamo con estos datos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINValidation;