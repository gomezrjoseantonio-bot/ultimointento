import React, { useState } from 'react';
import { 
  Plus, 
  X, 
  CreditCard, 
  DollarSign, 
  Shield, 
  Users, 
  Bell, 
  TrendingUp,
  Check,
  AlertTriangle,
  Calculator
} from 'lucide-react';
import { PrestamoFinanciacion, BonificacionFinanciacion, ValidationError, CalculoLive } from '../../../../../types/financiacion';

interface BonificacionesBlockProps {
  formData: Partial<PrestamoFinanciacion>;
  updateFormData: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: ValidationError[];
  calculoLive?: CalculoLive | null;
}

const BonificacionesBlock: React.FC<BonificacionesBlockProps> = ({ 
  formData, 
  updateFormData, 
  errors,
  calculoLive 
}) => {
  const [showCustomBonification, setShowCustomBonification] = useState(false);
  const [customBonification, setCustomBonification] = useState({
    nombre: '',
    descuentoTIN: 0,
    condicionParametrizable: ''
  });
  const [maxBonificacion, setMaxBonificacion] = useState(1.5); // User-configurable maximum

  // Standard bonification templates (now editable)
  const standardBonifications = [
    {
      tipo: 'NOMINA' as const,
      nombre: 'Nómina',
      icon: DollarSign,
      condicionParametrizable: 'Domiciliación de nómina ≥ 1.200€/mes',
      descuentoTIN: 0.30,
      ventanaEvaluacion: 6,
      fuenteVerificacion: 'TESORERIA' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'RECIBOS' as const,
      nombre: 'Recibos',
      icon: CreditCard,
      condicionParametrizable: 'Domiciliación de ≥ 3 recibos/mes',
      descuentoTIN: 0.15,
      ventanaEvaluacion: 3,
      fuenteVerificacion: 'TESORERIA' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'TARJETA' as const,
      nombre: 'Tarjeta',
      icon: CreditCard,
      condicionParametrizable: 'Uso tarjeta ≥ 300€/mes',
      descuentoTIN: 0.20,
      ventanaEvaluacion: 3,
      fuenteVerificacion: 'TESORERIA' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'SEGURO_HOGAR' as const,
      nombre: 'Seguro Hogar',
      icon: Shield,
      condicionParametrizable: 'Seguro hogar contratado',
      descuentoTIN: 0.25,
      ventanaEvaluacion: 12,
      fuenteVerificacion: 'SEGUROS' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'SEGURO_VIDA' as const,
      nombre: 'Seguro Vida',
      icon: Shield,
      condicionParametrizable: 'Seguro vida contratado',
      descuentoTIN: 0.35,
      ventanaEvaluacion: 12,
      fuenteVerificacion: 'SEGUROS' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'PLAN_PENSIONES' as const,
      nombre: 'Plan Pensiones',
      icon: Users,
      condicionParametrizable: 'Plan pensiones ≥ 100€/mes',
      descuentoTIN: 0.40,
      ventanaEvaluacion: 6,
      fuenteVerificacion: 'MANUAL' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'ALARMA' as const,
      nombre: 'Alarma',
      icon: Bell,
      condicionParametrizable: 'Sistema alarma contratado',
      descuentoTIN: 0.10,
      ventanaEvaluacion: 12,
      fuenteVerificacion: 'MANUAL' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    },
    {
      tipo: 'INGRESOS_RECURRENTES' as const,
      nombre: 'Ingresos Recurrentes',
      icon: TrendingUp,
      condicionParametrizable: 'Ingresos recurrentes ≥ 500€/mes',
      descuentoTIN: 0.25,
      ventanaEvaluacion: 6,
      fuenteVerificacion: 'TESORERIA' as const,
      estadoInicial: 'NO_CUMPLE' as const,
      editable: true
    }
  ];

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse Spanish formatted number
  const parseNumber = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  };

  // Add custom bonification
  const addCustomBonification = () => {
    if (!customBonification.nombre || customBonification.descuentoTIN <= 0) {
      return; // Validation
    }

    const newBonification: BonificacionFinanciacion = {
      id: `custom_bonif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tipo: 'OTROS',
      nombre: customBonification.nombre,
      condicionParametrizable: customBonification.condicionParametrizable || 'Condición personalizada',
      descuentoTIN: customBonification.descuentoTIN,
      impacto: { puntos: customBonification.descuentoTIN },
      aplicaEn: 'FIJO', // Default to FIJO
      ventanaEvaluacion: 12, // Default
      fuenteVerificacion: 'MANUAL',
      estadoInicial: 'NO_CUMPLE',
      seleccionado: false,
      graciaMeses: 0,
      activa: true
    };

    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: [...currentBonifications, newBonification]
    });

    // Reset form
    setCustomBonification({ nombre: '', descuentoTIN: 0, condicionParametrizable: '' });
    setShowCustomBonification(false);
  };



  // Remove bonification
  const removeBonification = (id: string) => {
    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: currentBonifications.filter(b => b.id !== id)
    });
  };

  // Toggle bonification selection (new: seleccionado field)
  const toggleBonificationSelection = (id: string) => {
    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: currentBonifications.map(b => 
        b.id === id ? { ...b, seleccionado: !b.seleccionado } : b
      )
    });
  };

  // Update grace period for bonification
  const updateGracePeriod = (id: string, graciaMeses: 0|6|12) => {
    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: currentBonifications.map(b => 
        b.id === id ? { ...b, graciaMeses } : b
      )
    });
  };

  // Add standard bonification with new fields
  const addStandardBonification = (template: typeof standardBonifications[0]) => {
    const currentBonifications = formData.bonificaciones || [];
    
    // Check if already exists
    if (currentBonifications.some(b => b.tipo === template.tipo)) {
      return; // Don't add duplicates
    }
    
    const newBonification: BonificacionFinanciacion = {
      id: `bonif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tipo: template.tipo,
      nombre: template.nombre,
      condicionParametrizable: template.condicionParametrizable,
      descuentoTIN: template.descuentoTIN,
      impacto: { puntos: template.descuentoTIN },
      aplicaEn: 'FIJO', // Default to FIJO
      ventanaEvaluacion: template.ventanaEvaluacion,
      fuenteVerificacion: template.fuenteVerificacion,
      estadoInicial: template.estadoInicial,
      seleccionado: false, // User needs to select it
      graciaMeses: 0, // Default no grace
      activa: false // Will be activated when selected
    };

    updateFormData({ 
      bonificaciones: [...currentBonifications, newBonification]
    });
  };

  // Calculate total bonifications (based on selected bonifications)
  const totalBonificaciones = (formData.bonificaciones || [])
    .filter(b => b.seleccionado)
    .reduce((sum, b) => sum + b.descuentoTIN, 0);

  // Check if bonification template is already added
  const isBonificationAdded = (tipo: string) => {
    return (formData.bonificaciones || []).some(b => b.tipo === tipo);
  };

  return (
    <div className="space-y-6">
      {/* Maximum Bonification Configuration */}
      <div className="bg-info-50 border border-info-200 p-4">
        <h4 className="font-medium text-atlas-blue mb-3">
          Configuración de Límites
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Bonificación máxima permitida (p.p.)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatPercentage(maxBonificacion)}
                onChange={(e) => setMaxBonificacion(parseNumber(e.target.value))}
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-12" />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-text-gray text-sm">p.p.</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-info-600">
            Límite configurado por el usuario para alertas de validación
          </div>
        </div>
      </div>

      {/* Standard Bonifications Selector */}
      <div>
        <h4 className="font-medium text-atlas-navy-1 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Plantillas de Bonificaciones
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {standardBonifications.map((template) => {
            const isAdded = isBonificationAdded(template.tipo);
            const IconComponent = template.icon;
            
            return (
              <button
                key={template.tipo}
                type="button"
                onClick={() => !isAdded && addStandardBonification(template)}
                disabled={isAdded}
                className={`p-4 border-2 text-left transition-all ${
                  isAdded
                    ? 'border-ok-200 bg-ok-50 text-ok-700 cursor-default'
                    : 'border-gray-200 hover:border-atlas-blue text-atlas-navy-1 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <IconComponent className="h-5 w-5 flex-shrink-0" />
                  {isAdded && <Check className="h-4 w-4 text-ok-600" />}
                </div>
                <div className="font-medium">{template.nombre}</div>
                <div className="text-sm text-text-gray mt-1">{template.condicionParametrizable}</div>
                <div className="text-sm font-medium mt-2">
                  -{formatPercentage(template.descuentoTIN)} p.p.
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Bonification */}
      <div>
        <button
          type="button"
          onClick={() => setShowCustomBonification(!showCustomBonification)}
          className="inline-flex items-center px-4 py-2 border-2 border-dashed border-gray-300 text-atlas-navy-1 hover:border-atlas-blue hover:text-atlas-blue"
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir bonificación personalizada
        </button>

        {showCustomBonification && (
          <div className="mt-4 p-4 border border-gray-200 bg-gray-50">
            <h5 className="font-medium text-atlas-navy-1 mb-3">Nueva Bonificación Personalizada</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Nombre de la bonificación *
                </label>
                <input
                  type="text"
                  value={customBonification.nombre}
                  onChange={(e) => setCustomBonification(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Vinculación especial"
                  className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Descuento (puntos porcentuales) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customBonification.descuentoTIN ? formatPercentage(customBonification.descuentoTIN) : ''}
                    onChange={(e) => setCustomBonification(prev => ({ ...prev, descuentoTIN: parseNumber(e.target.value) }))}
                    placeholder="0,50"
                    className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-12" />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-text-gray text-sm">p.p.</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
                Condición (opcional)
              </label>
              <input
                type="text"
                value={customBonification.condicionParametrizable}
                onChange={(e) => setCustomBonification(prev => ({ ...prev, condicionParametrizable: e.target.value }))}
                placeholder="Descripción de la condición para aplicar la bonificación"
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue" />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowCustomBonification(false);
                  setCustomBonification({ nombre: '', descuentoTIN: 0, condicionParametrizable: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-atlas-navy-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addCustomBonification}
                disabled={!customBonification.nombre || customBonification.descuentoTIN <= 0}
                className="btn-primary-horizon px-4 py-2 bg-atlas-blue hover: disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Añadir Bonificación
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bonifications Checklist - New Simplified UI */}
      {(formData.bonificaciones || []).length > 0 && (
        <div>
          <h4 className="font-medium text-atlas-navy-1 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Bonificaciones Disponibles
          </h4>
          <div className="space-y-4">
            {(formData.bonificaciones || []).map((bonificacion) => (
              <div 
                key={bonificacion.id} 
                className="border border-gray-200 p-4 hover:border-atlas-blue"
              >
                {/* Header with checkbox */}
                <div className="flex items-start space-x-3 mb-3">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bonificacion.seleccionado || false}
                      onChange={() => toggleBonificationSelection(bonificacion.id)}
                      className="h-4 w-4 text-atlas-blue focus:ring-atlas-blue border-gray-300 rounded" />
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      La cumpliré
                    </span>
                  </label>
                  
                  {/* Impact chip */}
                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-atlas-blue">
                    −{formatPercentage(bonificacion.descuentoTIN)} p.p.
                  </span>
                </div>

                {/* Bonification details */}
                <div className="mb-3">
                  <h5 className="font-medium text-gray-900 mb-1">
                    {bonificacion.nombre}
                  </h5>
                  <p className="text-sm text-gray-600">
                    {bonificacion.condicionParametrizable}
                  </p>
                </div>

                {/* Grace period selector - only show if selected */}
                {bonificacion.seleccionado && (
                  <div className="btn-secondary-horizon btn-primary-horizon ">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aplicar como promo durante:
                    </label>
                    <div className="flex space-x-3">
                      {[0, 6, 12].map((meses) => (
                        <label key={meses} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`gracia-${bonificacion.id}`}
                            checked={(bonificacion.graciaMeses || 0) === meses}
                            onChange={() => updateGracePeriod(bonificacion.id, meses as 0|6|12)}
                            className="h-4 w-4 text-atlas-blue focus:ring-atlas-blue border-gray-300" />
                          <span className="ml-2 text-sm text-gray-900">
                            {meses === 0 ? 'Sin promo' : `${meses} meses`}
                          </span>
                        </label>
                      ))}
                    </div>
                    {(bonificacion.graciaMeses || 0) > 0 && (
                      <p className="text-xs text-blue-600 mt-2">
                        Durante la promo, el descuento se aplica aunque aún no verifiquemos el cumplimiento.
                      </p>
                    )}
                  </div>
                )}

                {/* Remove button */}
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => removeBonification(bonificacion.id)}
                    className="text-gray-400 hover:text-red-500"
            title="Eliminar bonificación"
          >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Note about promotional periods */}
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> Las bonificaciones promocionales se aplicarán automáticamente durante 
              el período seleccionado. Tras el período promocional, será necesario verificar el cumplimiento 
              de las condiciones para mantener el descuento.
            </p>
          </div>
        </div>
      )}

      {/* Bonifications Summary */}
      {(formData.bonificaciones || []).length > 0 && (
        <div className="bg-atlas-blue border border-atlas-blue border-opacity-20 p-4">
          <h4 className="font-medium text-atlas-blue mb-3 flex items-center">
            <Calculator className="h-4 w-4 mr-2" />
            Resumen de Bonificaciones
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-text-gray block">Bonificaciones seleccionadas</span>
              <span className="font-semibold text-atlas-navy-1">
                {(formData.bonificaciones || []).filter(b => b.seleccionado).length} de {(formData.bonificaciones || []).length}
              </span>
            </div>
            <div>
              <span className="text-text-gray block">Descuento aplicado</span>
              <span className="font-semibold text-atlas-navy-1">
                -{formatPercentage(calculoLive?.sumaPuntosAplicada || 0)} p.p.
              </span>
            </div>
            <div>
              <span className="text-text-gray block">Tipo efectivo</span>
              <span className="font-semibold text-atlas-navy-1">
                {calculoLive?.tinEfectivo ? formatPercentage(calculoLive.tinEfectivo) : '—'} %
              </span>
            </div>
          </div>

          {/* Next change information */}
          {calculoLive?.proximoCambio && (
            <div className="btn-secondary-horizon btn-primary-horizon mt-4 p-3 ">
              <h5 className="font-medium text-blue-700 mb-1">Próximo cambio</h5>
              <p className="text-sm text-blue-600">
                <strong>{new Date(calculoLive.proximoCambio.fecha).toLocaleDateString('es-ES')}</strong>
                {' — '}
                {calculoLive.proximoCambio.descripcion}
              </p>
            </div>
          )}

          {/* Cap warning */}
          {totalBonificaciones > 1.0 && (
            <div className="mt-3 p-3 bg-warning-50 border border-warning-200">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                <div className="ml-2 text-sm">
                  <p className="text-warning-700 font-medium">Tope de bonificaciones aplicado</p>
                  <p className="text-warning-600">
                    El descuento se limita a -1,00 p.p. según las condiciones del producto.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Savings comparison */}
          {calculoLive && calculoLive.ahorroMensual && calculoLive.ahorroMensual > 0 && (
            <div className="mt-4 pt-4 border-t border-atlas-blue border-opacity-20">
              <h5 className="font-medium text-atlas-blue mb-2">Comparativa de Ahorro</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-gray block">Ahorro mensual</span>
                  <span className="font-semibold text-ok-600">
                    {calculoLive.ahorroMensual.toLocaleString('es-ES', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} €
                  </span>
                </div>
                <div>
                  <span className="text-text-gray block">Ahorro anual</span>
                  <span className="font-semibold text-ok-600">
                    {calculoLive.ahorroAnual?.toLocaleString('es-ES', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} €
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {(formData.bonificaciones || []).length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200">
          <CreditCard className="h-8 w-8 text-text-gray mx-auto mb-2" />
          <p className="text-text-gray">No hay bonificaciones aplicadas</p>
          <p className="text-sm text-text-gray mt-1">
            Selecciona plantillas arriba para añadir bonificaciones al préstamo
          </p>
        </div>
      )}
    </div>
  );
};

export default BonificacionesBlock;