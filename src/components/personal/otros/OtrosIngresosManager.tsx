import React, { useState, useEffect, useCallback } from 'react';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { personalDataService } from '../../../services/personalDataService';
import { OtrosIngresos } from '../../../types/personal';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, Calendar, Users, User, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

const OtrosIngresosManager: React.FC = () => {
  const [ingresos, setIngresos] = useState<OtrosIngresos[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    dividendos: { mensual: 0, anual: 0, count: 0 },
    intereses: { mensual: 0, anual: 0, count: 0 },
    fondosIndexados: { mensual: 0, anual: 0, count: 0 },
    otros: { mensual: 0, anual: 0, count: 0 },
    total: { mensual: 0, anual: 0, count: 0 }
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const ingresosData = await otrosIngresosService.getOtrosIngresos(personalData.id);
        setIngresos(ingresosData);
        
        const summaryData = otrosIngresosService.getIncomeSummaryByType(ingresosData);
        setSummary(summaryData);
      }
    } catch (error) {
      console.error('Error loading otros ingresos:', error);
      toast.error('Error al cargar otros ingresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTipoLabel = (tipo: OtrosIngresos['tipo']) => {
    switch (tipo) {
      case 'dividendos': return 'Dividendos';
      case 'intereses': return 'Intereses';
      case 'fondos-indexados': return 'Fondos Indexados';
      case 'otros': return 'Otros';
      default: return tipo;
    }
  };

  const getFrecuenciaLabel = (frecuencia: OtrosIngresos['frecuencia']) => {
    switch (frecuencia) {
      case 'mensual': return 'Mensual';
      case 'trimestral': return 'Trimestral';
      case 'semestral': return 'Semestral';
      case 'anual': return 'Anual';
      case 'unico': return 'Único';
      default: return frecuencia;
    }
  };

  const getTitularidadIcon = (titularidad: OtrosIngresos['titularidad']) => {
    switch (titularidad) {
      case 'yo': return <User className="w-4 h-4" />;
      case 'pareja': return <Heart className="w-4 h-4" />;
      case 'ambos': return <Users className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTitularidadColor = (titularidad: OtrosIngresos['titularidad']) => {
    switch (titularidad) {
      case 'yo': return 'text-blue-600';
      case 'pareja': return 'text-red-600';
      case 'ambos': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando otros ingresos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Otros Ingresos</h3>
          <p className="text-gray-500">
            Gestiona dividendos, intereses, fondos indexados y otros ingresos recurrentes
          </p>
        </div>
        <button
          onClick={() => toast('Formulario de nuevos ingresos - En desarrollo', { icon: 'ℹ️' })}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ingreso
        </button>
      </div>

      {/* Summary Cards */}
      {summary.total.count > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h4 className="text-lg font-semibold text-emerald-900">
                Resumen de Otros Ingresos
              </h4>
            </div>
            <div className="flex items-center space-x-2 text-sm text-emerald-700">
              <TrendingUp className="w-4 h-4" />
              <span>{summary.total.count} fuentes activas</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Ingresos Mensuales</p>
              <p className="text-xl font-bold text-emerald-900">
                {formatCurrency(summary.total.mensual)}
              </p>
            </div>

            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Ingresos Anuales</p>
              <p className="text-xl font-bold text-emerald-900">
                {formatCurrency(summary.total.anual)}
              </p>
            </div>

            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Dividendos</p>
              <p className="text-lg font-bold text-emerald-900">
                {formatCurrency(summary.dividendos.anual)}
              </p>
              <p className="text-xs text-emerald-600">{summary.dividendos.count} fuentes</p>
            </div>

            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Intereses</p>
              <p className="text-lg font-bold text-emerald-900">
                {formatCurrency(summary.intereses.anual)}
              </p>
              <p className="text-xs text-emerald-600">{summary.intereses.count} fuentes</p>
            </div>
          </div>
        </div>
      )}

      {/* Income Sources List */}
      <div className="bg-white border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Fuentes de Ingresos</h4>
        
        {ingresos.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay otros ingresos configurados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Añade dividendos, intereses, fondos indexados u otros ingresos recurrentes.
            </p>
            <div className="mt-6">
              <button
                onClick={() => toast('Formulario de nuevos ingresos - En desarrollo', { icon: 'ℹ️' })}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir Primer Ingreso
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {ingresos.map((ingreso) => {
              const nextPayment = otrosIngresosService.getNextPaymentDate(ingreso);
              const taxInfo = otrosIngresosService.getTaxImplications(ingreso);
              
              return (
                <div key={ingreso.id} className="border p-4 <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{ingreso.nombre}</h5>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                          {getTipoLabel(ingreso.tipo)}
                        </span>
                        <div className={`flex items-center space-x-1 ${getTitularidadColor(ingreso.titularidad)}`}>
                          {getTitularidadIcon(ingreso.titularidad)}
                          <span className="text-xs font-medium">
                            {ingreso.titularidad === 'yo' ? 'Mío' : 
                             ingreso.titularidad === 'pareja' ? 'Pareja' : 'Ambos'}
                          </span>
                        </div>
                        {!ingreso.activo && (
                          <span className="btn-danger inline-flex items-center px-2 py-1 text-xs font-medium text-red-800">
                            Inactivo
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Importe</p>
                          <p className="font-medium">{formatCurrency(ingreso.importe)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Frecuencia</p>
                          <p className="font-medium">{getFrecuenciaLabel(ingreso.frecuencia)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Cuenta</p>
                          <p className="font-medium">Cuenta {ingreso.cuentaCobro}</p>
                        </div>
                        {nextPayment && (
                          <div>
                            <p className="text-gray-600">Próximo Pago</p>
                            <p className="font-medium flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{nextPayment.toLocaleDateString('es-ES')}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {taxInfo.retencion > 0 && (
                        <div className="mt-2 text-sm text-orange-600">
                          <p>
                            Retención estimada: {taxInfo.retencion}%
                            {taxInfo.declaracionAnual && (
                              <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                Declaración anual
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => toast('Edición de ingresos - En desarrollo', { icon: 'ℹ️' })}
                        className="p-2 text-gray-400 hover:text-blue-600"
            title="Editar ingreso"
          >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toast('Eliminación de ingresos - En desarrollo', { icon: 'ℹ️' })}
                        className="p-2 text-gray-400 hover:text-red-600"
            title="Eliminar ingreso"
          >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration Info */}
      <div className="btn-secondary-horizon btn-primary-horizon ">
        <p className="text-sm text-blue-700">
          <strong>Integración automática:</strong> Los ingresos recurrentes configurados se integrarán automáticamente 
          con el módulo de Tesorería para el seguimiento de flujos de caja y con Proyecciones para la planificación financiera.
          La información fiscal se marcará automáticamente para facilitar la declaración de impuestos.
        </p>
      </div>
    </div>
  );
};

export default OtrosIngresosManager;