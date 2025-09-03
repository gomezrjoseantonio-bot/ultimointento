import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, TrendingUp, TrendingDown, Building } from 'lucide-react';
import { ValidationResult } from '../../services/treasuryValidationService';

/**
 * Treasury UX/Microcopy Components
 * 
 * Provides consistent user feedback, tooltips, and validation messages
 * for Treasury operations across all containers.
 */

// Status indicators for Treasury records
export const TreasuryStatusBadge: React.FC<{
  status: 'previsto' | 'cobrado' | 'incompleto' | 'completo' | 'pagado' | 'amortizando';
  type: 'ingreso' | 'gasto' | 'capex';
}> = ({ status, type }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'previsto':
        return { 
          color: 'bg-blue-100 text-blue-800', 
          text: 'Previsto',
          microcopy: type === 'ingreso' ? 'Pendiente de cobro' : 'Pendiente de pago'
        };
      case 'cobrado':
        return { 
          color: 'bg-green-100 text-green-800', 
          text: 'Cobrado',
          microcopy: 'Ingreso registrado en cuenta'
        };
      case 'pagado':
        return { 
          color: 'bg-gray-100 text-gray-800', 
          text: 'Pagado',
          microcopy: 'Pago registrado en cuenta'
        };
      case 'incompleto':
        return { 
          color: 'bg-yellow-100 text-yellow-800', 
          text: 'Incompleto',
          microcopy: 'Faltan datos para completar el registro'
        };
      case 'completo':
        return { 
          color: 'bg-indigo-100 text-indigo-800', 
          text: 'Completo',
          microcopy: 'Todos los datos están registrados'
        };
      case 'amortizando':
        return { 
          color: 'bg-purple-100 text-purple-800', 
          text: 'Amortizando',
          microcopy: 'CAPEX en proceso de amortización'
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-800', 
          text: status,
          microcopy: ''
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      title={config.microcopy}
    >
      {config.text}
    </span>
  );
};

// Validation feedback component
export const ValidationFeedback: React.FC<{
  result: ValidationResult;
  className?: string;
}> = ({ result, className = '' }) => {
  if (result.isValid && result.warnings.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-green-700 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Registro válido</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {result.errors.length > 0 && (
        <div className="flex items-start gap-2 text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Errores que deben corregirse:</div>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {result.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {result.warnings.length > 0 && (
        <div className="flex items-start gap-2 text-amber-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Advertencias a revisar:</div>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Treasury amount display with proper formatting and context
export const TreasuryAmount: React.FC<{
  amount: number;
  type: 'ingreso' | 'gasto' | 'capex';
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showSign?: boolean;
}> = ({ amount, type, currency = 'EUR', size = 'md', showSign = true }) => {
  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getColorClass = () => {
    if (type === 'ingreso') return 'text-green-600';
    if (type === 'gasto') return 'text-red-600';
    return 'text-purple-600'; // CAPEX
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg font-semibold';
      default: return 'text-base';
    }
  };

  const getIcon = () => {
    if (type === 'ingreso') return <TrendingUp className="w-4 h-4" />;
    if (type === 'gasto') return <TrendingDown className="w-4 h-4" />;
    return <Building className="w-4 h-4" />; // CAPEX
  };

  return (
    <div className={`flex items-center gap-1 ${getColorClass()} ${getSizeClass()}`}>
      {getIcon()}
      <span>
        {showSign && type === 'ingreso' && '+'}
        {showSign && type === 'gasto' && '-'}
        {formatAmount(Math.abs(amount))}
      </span>
    </div>
  );
};

// Help tooltips and microcopys for Treasury fields
export const TreasuryFieldHelp: React.FC<{
  field: 'origen' | 'destino' | 'categoria_AEAT' | 'tipo_capex' | 'anos_amortizacion' | 'reconciliacion';
  className?: string;
}> = ({ field, className = '' }) => {
  const getHelpContent = () => {
    switch (field) {
      case 'origen':
        return {
          title: 'Origen del Ingreso',
          content: 'Indica la fuente del ingreso: contratos de alquiler, nóminas o documentos específicos.'
        };
      case 'destino':
        return {
          title: 'Destino del Registro',
          content: 'Personal: para gastos/ingresos personales. Inmueble: para registros asociados a una propiedad específica.'
        };
      case 'categoria_AEAT':
        return {
          title: 'Categoría AEAT',
          content: 'Clasificación fiscal según Hacienda para la declaración de la renta. Determina el tipo de deducción aplicable.'
        };
      case 'tipo_capex':
        return {
          title: 'Tipo de CAPEX',
          content: 'Mejora: renovaciones que aumentan el valor. Ampliación: construcción nueva. Mobiliario: muebles y equipamiento.'
        };
      case 'anos_amortizacion':
        return {
          title: 'Años de Amortización',
          content: 'Período durante el cual se distribuye el coste del CAPEX. Mobiliario: 10 años. Mejoras/Ampliaciones: 15-50 años.'
        };
      case 'reconciliacion':
        return {
          title: 'Reconciliación Bancaria',
          content: 'Vincula el registro con movimientos bancarios reales para confirmar que el pago/cobro se ha realizado.'
        };
      default:
        return { title: '', content: '' };
    }
  };

  const help = getHelpContent();

  if (!help.content) return null;

  return (
    <div className={`group relative ${className}`}>
      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
      <div className="absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-xs">
          <div className="font-medium mb-1">{help.title}</div>
          <div>{help.content}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
};

// Success/Error action feedback
export const TreasuryActionFeedback: React.FC<{
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}> = ({ type, title, message, action, onClose }) => {
  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          titleColor: 'text-green-800',
          messageColor: 'text-green-700'
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          titleColor: 'text-red-800',
          messageColor: 'text-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700'
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: <Info className="w-5 h-5 text-blue-500" />,
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700'
        };
    }
  };

  const config = getConfig();

  return (
    <div className={`rounded-lg border p-4 ${config.bg}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {config.icon}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${config.titleColor}`}>
            {title}
          </h3>
          <div className={`mt-1 text-sm ${config.messageColor}`}>
            {message}
          </div>
          {action && (
            <div className="mt-3">
              <button
                onClick={action.onClick}
                className={`text-sm font-medium ${config.titleColor} hover:underline`}
              >
                {action.label} →
              </button>
            </div>
          )}
        </div>
        {onClose && (
          <div className="ml-auto flex-shrink-0">
            <button
              onClick={onClose}
              className={`rounded-md p-1.5 hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.titleColor}`}
            >
              <span className="sr-only">Cerrar</span>
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Empty state for Treasury containers
export const TreasuryEmptyState: React.FC<{
  type: 'ingreso' | 'gasto' | 'capex' | 'movement';
  onCreateNew: () => void;
}> = ({ type, onCreateNew }) => {
  const getConfig = () => {
    switch (type) {
      case 'ingreso':
        return {
          icon: <TrendingUp className="w-12 h-12 text-green-400" />,
          title: 'No hay ingresos registrados',
          description: 'Comienza registrando un ingreso manual o activa contratos para generar ingresos automáticamente.',
          buttonText: 'Registrar primer ingreso',
          tips: [
            'Los ingresos de contratos activos se generan automáticamente',
            'Puedes importar ingresos desde documentos OCR',
            'Reconcilia los ingresos con movimientos bancarios'
          ]
        };
      case 'gasto':
        return {
          icon: <TrendingDown className="w-12 h-12 text-red-400" />,
          title: 'No hay gastos registrados',
          description: 'Registra gastos manualmente o procesa facturas en la bandeja de entrada para crearlos automáticamente.',
          buttonText: 'Registrar primer gasto',
          tips: [
            'Las facturas procesadas en Inbox se convierten en gastos automáticamente',
            'Clasifica los gastos según categorías AEAT para optimizar deducciones',
            'Asocia gastos a inmuebles específicos para un mejor control'
          ]
        };
      case 'capex':
        return {
          icon: <Building className="w-12 h-12 text-purple-400" />,
          title: 'No hay inversiones CAPEX registradas',
          description: 'Registra mejoras, ampliaciones o mobiliario que incrementen el valor de tus inmuebles.',
          buttonText: 'Registrar primer CAPEX',
          tips: [
            'CAPEX mejora el valor catastral de construcción de tus inmuebles',
            'Las inversiones se amortizan durante varios años',
            'Mobiliario se amortiza en 10 años, mejoras en 15-50 años'
          ]
        };
      default:
        return {
          icon: <Info className="w-12 h-12 text-blue-400" />,
          title: 'No hay movimientos disponibles',
          description: 'Importa extractos bancarios para comenzar la reconciliación automática.',
          buttonText: 'Importar extractos',
          tips: [
            'Los movimientos bancarios se reconcilian automáticamente con registros',
            'Importa extractos CSV desde la bandeja de entrada',
            'La reconciliación confirma que los pagos/cobros se han realizado'
          ]
        };
    }
  };

  const config = getConfig();

  return (
    <div className="text-center py-12">
      <div className="flex justify-center">
        {config.icon}
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        {config.title}
      </h3>
      <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
        {config.description}
      </p>
      
      <div className="mt-6">
        <button
          onClick={onCreateNew}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {config.buttonText}
        </button>
      </div>

      <div className="mt-8">
        <h4 className="text-sm font-medium text-gray-900 mb-3">💡 Consejos útiles:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          {config.tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-indigo-500 text-xs mt-1">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Quick stats summary for Treasury dashboard
export const TreasuryQuickStats: React.FC<{
  stats: {
    totalIngresos: number;
    totalGastos: number;
    totalCAPEX: number;
    pendingReconciliation: number;
  };
}> = ({ stats }) => {
  const netCashFlow = stats.totalIngresos - stats.totalGastos;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Ingresos</p>
            <p className="text-2xl font-semibold text-green-900">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.totalIngresos)}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-green-400" />
        </div>
      </div>

      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Gastos</p>
            <p className="text-2xl font-semibold text-red-900">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.totalGastos)}
            </p>
          </div>
          <TrendingDown className="w-8 h-8 text-red-400" />
        </div>
      </div>

      <div className="bg-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-600">CAPEX</p>
            <p className="text-2xl font-semibold text-purple-900">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.totalCAPEX)}
            </p>
          </div>
          <Building className="w-8 h-8 text-purple-400" />
        </div>
      </div>

      <div className={`${netCashFlow >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              Flujo Neto
            </p>
            <p className={`text-2xl font-semibold ${netCashFlow >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(netCashFlow)}
            </p>
            {stats.pendingReconciliation > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {stats.pendingReconciliation} pendientes de reconciliar
              </p>
            )}
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            netCashFlow >= 0 ? 'bg-blue-100' : 'bg-orange-100'
          }`}>
            <span className={`text-lg font-bold ${
              netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'
            }`}>
              {netCashFlow >= 0 ? '+' : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};