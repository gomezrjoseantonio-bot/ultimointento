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

  // Add bonification
  const addBonification = (template: typeof standardBonifications[0]) => {
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
      seleccionado: false,
      graciaMeses: 0,
      activa: true
    };

    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: [...currentBonifications, newBonification]
    });
  };

  // Remove bonification
  const removeBonification = (id: string) => {
    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: currentBonifications.filter(b => b.id !== id)
    });
  };

  // Toggle bonification active state
  const toggleBonificationActive = (id: string) => {
    const currentBonifications = formData.bonificaciones || [];
    updateFormData({ 
      bonificaciones: currentBonifications.map(b => 
        b.id === id ? { ...b, activa: !b.activa } : b
      )
    });
  };

  // Calculate total bonifications
  const totalBonificaciones = (formData.bonificaciones || [])
    .filter(b => b.activa)
    .reduce((sum, b) => sum + b.descuentoTIN, 0);

  // Check if bonification template is already added
  const isBonificationAdded = (tipo: string) => {
    return (formData.bonificaciones || []).some(b => b.tipo === tipo);
  };

  return (
    <div className="space-y-6">
      {/* Maximum Bonification Configuration */}
      <div className="bg-info-50 border border-info-200 rounded-atlas p-4">
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
                className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-12"
              />
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
                onClick={() => !isAdded && addBonification(template)}
                disabled={isAdded}
                className={`p-4 rounded-atlas border-2 text-left transition-all ${
                  isAdded
                    ? 'border-ok-200 bg-ok-50 text-ok-700 cursor-default'
                    : 'border-gray-200 hover:border-atlas-blue hover:bg-primary-50 text-atlas-navy-1 cursor-pointer'
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
          className="inline-flex items-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-atlas text-atlas-navy-1 hover:border-atlas-blue hover:text-atlas-blue transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir bonificación personalizada
        </button>

        {showCustomBonification && (
          <div className="mt-4 p-4 border border-gray-200 rounded-atlas bg-gray-50">
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
                  className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                />
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
                    className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-12"
                  />
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
                className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowCustomBonification(false);
                  setCustomBonification({ nombre: '', descuentoTIN: 0, condicionParametrizable: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-atlas text-atlas-navy-1 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addCustomBonification}
                disabled={!customBonification.nombre || customBonification.descuentoTIN <= 0}
                className="px-4 py-2 bg-atlas-blue text-white rounded-atlas hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Añadir Bonificación
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Applied Bonifications */}
      {(formData.bonificaciones || []).length > 0 && (
        <div>
          <h4 className="font-medium text-atlas-navy-1 mb-4">Bonificaciones Aplicadas</h4>
          <div className="space-y-3">
            {(formData.bonificaciones || []).map((bonificacion) => (
              <div 
                key={bonificacion.id} 
                className={`p-4 rounded-atlas border transition-all ${
                  bonificacion.activa 
                    ? 'border-ok-200 bg-ok-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h5 className={`font-medium ${bonificacion.activa ? 'text-ok-700' : 'text-text-gray'}`}>
                        {bonificacion.nombre}
                      </h5>
                      <span className={`ml-2 text-sm font-medium ${
                        bonificacion.activa ? 'text-ok-600' : 'text-text-gray'
                      }`}>
                        -{formatPercentage(bonificacion.descuentoTIN)} p.p.
                      </span>
                    </div>
                    <p className="text-sm text-text-gray mb-2">
                      {bonificacion.condicionParametrizable}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-text-gray">
                      <span>Evaluación: {bonificacion.ventanaEvaluacion} meses</span>
                      <span>Fuente: {bonificacion.fuenteVerificacion}</span>
                      <span className={`px-2 py-1 rounded ${
                        bonificacion.estadoInicial === 'CUMPLE' ? 'bg-ok-100 text-ok-700' :
                        bonificacion.estadoInicial === 'GRACIA_ACTIVA' ? 'bg-warning-100 text-warning-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {bonificacion.estadoInicial === 'CUMPLE' ? 'Cumple' :
                         bonificacion.estadoInicial === 'GRACIA_ACTIVA' ? 'Gracia activa' :
                         'No cumple'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      type="button"
                      onClick={() => toggleBonificationActive(bonificacion.id)}
                      className={`px-3 py-1 rounded-atlas text-sm font-medium transition-colors ${
                        bonificacion.activa
                          ? 'bg-warn text-white hover:bg-warning-600'
                          : 'bg-ok text-white hover:bg-success-600'
                      }`}
                    >
                      {bonificacion.activa ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBonification(bonificacion.id)}
                      className="p-1 text-error-500 hover:text-error-700 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonifications Summary */}
      {(formData.bonificaciones || []).length > 0 && (
        <div className="bg-atlas-blue border border-atlas-blue border-opacity-20 rounded-atlas p-4">
          <h4 className="font-medium text-atlas-blue mb-3 flex items-center">
            <Calculator className="h-4 w-4 mr-2" />
            Resumen de Bonificaciones
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-gray block">Bonificaciones activas</span>
              <span className="font-semibold text-atlas-navy-1">
                {(formData.bonificaciones || []).filter(b => b.activa).length} de {(formData.bonificaciones || []).length}
              </span>
            </div>
            <div>
              <span className="text-text-gray block">Descuento total</span>
              <span className="font-semibold text-atlas-navy-1">
                -{formatPercentage(totalBonificaciones)} p.p.
              </span>
            </div>
          </div>

          {/* Tope acumulado warning */}
          {totalBonificaciones > maxBonificacion && (
            <div className="mt-3 p-3 bg-warning-50 border border-warning-200 rounded-atlas">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                <div className="ml-2 text-sm">
                  <p className="text-warning-700 font-medium">Tope de bonificaciones superado</p>
                  <p className="text-warning-600">
                    El descuento total ({formatPercentage(totalBonificaciones)} p.p.) supera el máximo configurado de {formatPercentage(maxBonificacion)} p.p.
                    Revise las condiciones específicas del producto.
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
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-atlas">
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