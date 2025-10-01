// Summary step for the 4-step wizard - shows all data before final confirmation
// Following Horizon design system with completion status and action buttons

import React from 'react';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Inmueble, ComplecionStatus } from '../../types/inmueble';
import { formatEuroAmount } from '../../utils/inmuebleUtils';

interface InmuebleResumenProps {
  data: Partial<Inmueble>;
  completitud: any;
  onEdit: (step: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const StatusIcon: React.FC<{ status: ComplecionStatus }> = ({ status }) => {
  switch (status) {
    case 'COMPLETO':
      return <CheckCircle className="w-5 h-5 text-success-500" size={24}  />;
    case 'PARCIAL':
      return <AlertTriangle className="w-5 h-5 text-warning-500" size={24}  />;
    case 'PENDIENTE':
    default:
      return <Clock className="w-5 h-5 text-error-500" size={24}  />;
  }
};

const StatusText: React.FC<{ status: ComplecionStatus }> = ({ status }) => {
  const config = {
    'COMPLETO': { text: 'Completo', color: 'text-success-700' },
    'PARCIAL': { text: 'Parcial', color: 'text-warning-700' },
    'PENDIENTE': { text: 'Pendiente', color: 'text-error-700' }
  };

  const { text, color } = config[status];
  
  return <span className={`text-sm font-medium ${color}`}>{text}</span>;
};

const InmuebleResumen: React.FC<InmuebleResumenProps> = ({
  data,
  completitud,
  onEdit,
  onSave,
  onCancel,
  isSaving
}) => {
  const formatCurrency = (value: number | undefined): string => {
    return value ? formatEuroAmount(value) : '0,00 €';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-hz-text mb-2 font-inter">
          Resumen · Confirmar y guardar
        </h2>
        <p className="text-sm text-gray-600">
          Revisa toda la información antes de crear el inmueble
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Identificación */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <StatusIcon status={completitud?.identificacion_status || 'PENDIENTE'} />
              <h3 className="text-lg font-medium text-gray-900 ml-2">Identificación</h3>
            </div>
            <div className="flex items-center space-x-2">
              <StatusText status={completitud?.identificacion_status || 'PENDIENTE'} />
              <button
                onClick={() => onEdit(1)}
                className="text-sm text-hz-primary hover:text-hz-primary font-medium"
              >
                Editar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Alias:</span>
              <span className="ml-1 font-medium">{data.alias || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="text-gray-600">Estado:</span>
              <span className="ml-1 font-medium">{data.estado || 'ACTIVO'}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-600">Dirección:</span>
              <span className="ml-1 font-medium">
                {data.direccion ? 
                  `${data.direccion.calle} ${data.direccion.numero}${data.direccion.piso ? `, ${data.direccion.piso}` : ''}${data.direccion.puerta ? ` ${data.direccion.puerta}` : ''}` 
                  : 'Sin especificar'
                }
              </span>
            </div>
            <div>
              <span className="text-gray-600">CP:</span>
              <span className="ml-1 font-medium">{data.direccion?.cp || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="text-gray-600">Municipio:</span>
              <span className="ml-1 font-medium">{data.direccion?.municipio || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="text-gray-600">Provincia:</span>
              <span className="ml-1 font-medium">{data.direccion?.provincia || 'Sin especificar'}</span>
            </div>
            <div>
              <span className="text-gray-600">CCAA:</span>
              <span className="ml-1 font-medium">{data.direccion?.ca || 'Sin especificar'}</span>
            </div>
          </div>
        </div>

        {/* Características físicas */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <StatusIcon status={completitud?.caracteristicas_status || 'PENDIENTE'} />
              <h3 className="text-lg font-medium text-gray-900 ml-2">Características físicas</h3>
            </div>
            <div className="flex items-center space-x-2">
              <StatusText status={completitud?.caracteristicas_status || 'PENDIENTE'} />
              <button
                onClick={() => onEdit(2)}
                className="text-sm text-hz-primary hover:text-hz-primary font-medium"
              >
                Editar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Superficie:</span>
              <span className="ml-1 font-medium">
                {data.caracteristicas?.m2 ? `${data.caracteristicas.m2} m²` : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Habitaciones:</span>
              <span className="ml-1 font-medium">
                {data.caracteristicas?.habitaciones !== undefined ? data.caracteristicas.habitaciones : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Baños:</span>
              <span className="ml-1 font-medium">
                {data.caracteristicas?.banos !== undefined ? data.caracteristicas.banos : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Año construcción:</span>
              <span className="ml-1 font-medium">
                {data.caracteristicas?.anio_construccion || 'Sin especificar'}
              </span>
            </div>
          </div>
        </div>

        {/* Coste de adquisición */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <StatusIcon status={completitud?.compra_status || 'PENDIENTE'} />
              <h3 className="text-lg font-medium text-gray-900 ml-2">Coste de adquisición</h3>
            </div>
            <div className="flex items-center space-x-2">
              <StatusText status={completitud?.compra_status || 'PENDIENTE'} />
              <button
                onClick={() => onEdit(3)}
                className="text-sm text-hz-primary hover:text-hz-primary font-medium"
              >
                Editar
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Régimen:</span>
                <span className="ml-1 font-medium">
                  {data.compra?.regimen === 'USADA_ITP' ? 'Vivienda usada (ITP)' : 
                   data.compra?.regimen === 'NUEVA_IVA_AJD' ? 'Obra nueva (IVA + AJD)' : 
                   'Sin especificar'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Fecha compra:</span>
                <span className="ml-1 font-medium">{data.compra?.fecha_compra || 'Sin especificar'}</span>
              </div>
            </div>
            
            {data.compra?.precio_compra && (
              <div className="bg-gray-50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Precio compra:</span>
                    <div className="font-medium">{formatCurrency(data.compra.precio_compra)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Gastos:</span>
                    <div className="font-medium">{formatCurrency(data.compra.total_gastos)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Impuestos:</span>
                    <div className="font-medium">{formatCurrency(data.compra.total_impuestos)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <div className="font-semibold text-hz-primary">{formatCurrency(data.compra.coste_total_compra)}</div>
                  </div>
                </div>
                
                {data.caracteristicas?.m2 && data.compra.eur_por_m2 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-600 text-sm">Precio por m²:</span>
                    <span className="ml-1 font-medium text-sm">{formatCurrency(data.compra.eur_por_m2)}/m²</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fiscalidad */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <StatusIcon status={completitud?.fiscalidad_status || 'PENDIENTE'} />
              <h3 className="text-lg font-medium text-gray-900 ml-2">Fiscalidad y amortización</h3>
            </div>
            <div className="flex items-center space-x-2">
              <StatusText status={completitud?.fiscalidad_status || 'PENDIENTE'} />
              <button
                onClick={() => onEdit(4)}
                className="text-sm text-hz-primary hover:text-hz-primary font-medium"
              >
                Editar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Valor catastral:</span>
              <span className="ml-1 font-medium">
                {data.fiscalidad?.valor_catastral_total ? formatCurrency(data.fiscalidad.valor_catastral_total) : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">VC construcción:</span>
              <span className="ml-1 font-medium">
                {data.fiscalidad?.valor_catastral_construccion ? formatCurrency(data.fiscalidad.valor_catastral_construccion) : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">% Construcción:</span>
              <span className="ml-1 font-medium">
                {data.fiscalidad?.porcentaje_construccion ? `${data.fiscalidad.porcentaje_construccion.toFixed(2)}%` : 'Sin especificar'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Amortización:</span>
              <span className="ml-1 font-medium">
                {data.fiscalidad?.metodo_amortizacion === 'REGLA_GENERAL_3' ? 'Regla general 3%' : 
                 data.fiscalidad?.metodo_amortizacion || 'Sin especificar'}
              </span>
            </div>
          </div>
        </div>

        {/* Checklist de completitud */}
        <div className="btn-secondary-horizon atlas-atlas-atlas-btn-primary ">
          <h4 className="text-sm font-medium text-blue-800 mb-3">
            📋 Estado de completitud
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Campos obligatorios completados:</span>
              <span className={`font-medium ${
                completitud?.identificacion_status === 'COMPLETO' && 
                completitud?.caracteristicas_status === 'COMPLETO' && 
                completitud?.compra_status === 'COMPLETO' 
                  ? 'text-success-700' : 'text-warning-700'
              }`}>
                {(completitud?.identificacion_status === 'COMPLETO' && 
                  completitud?.caracteristicas_status === 'COMPLETO' && 
                  completitud?.compra_status === 'COMPLETO') 
                  ? '✅ Sí' : '⚠️ Pendiente'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Datos fiscales (opcional):</span>
              <span className={`font-medium ${
                completitud?.fiscalidad_status === 'COMPLETO' ? 'text-success-700' : 
                completitud?.fiscalidad_status === 'PARCIAL' ? 'text-warning-700' : 'text-gray-600'
              }`}>
                {completitud?.fiscalidad_status === 'COMPLETO' ? '✅ Completo' : 
                 completitud?.fiscalidad_status === 'PARCIAL' ? '🟨 Parcial' : '📋 Puede completarse más adelante'}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 focus:ring-2 focus:ring-hz-primary focus:ring-offset-2"
            disabled={isSaving}
          >
            Cancelar
          </button>
          
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2 bg-hz-primary light focus:ring-2 focus:ring-hz-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Guardando...
              </>
            ) : (
              'Confirmar y guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InmuebleResumen;