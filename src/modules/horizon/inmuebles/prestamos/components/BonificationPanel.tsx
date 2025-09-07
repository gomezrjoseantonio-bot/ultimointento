// Bonifications Panel Component

import React from 'react';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Calendar,
  Shield
} from 'lucide-react';
import { formatEuro, formatPercentage } from '../../../../../utils/formatUtils';
import { Prestamo } from '../../../../../types/prestamos';
import { prestamosCalculationService } from '../../../../../services/prestamosCalculationService';

interface BonificationPanelProps {
  prestamo: Prestamo;
}

const BonificationPanel: React.FC<BonificationPanelProps> = ({ prestamo }) => {
  // Calculate bonification savings
  const savings = prestamosCalculationService.calculateBonificationSavings(prestamo);
  const evaluation = prestamosCalculationService.evaluateBonifications(prestamo);

  // If no bonifications, show empty state
  if (!prestamo.bonificaciones || prestamo.bonificaciones.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-[#022D5E]" />
          <span>Bonificaciones</span>
        </h2>
        <div className="text-center py-8">
          <Shield className="h-12 w-12 text-[#D1D5DB] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#374151] mb-2">
            Sin bonificaciones configuradas
          </h3>
          <p className="text-[#6B7280]">
            Este préstamo no tiene bonificaciones activas
          </p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CUMPLIDA':
        return <CheckCircle className="h-4 w-4 text-[#059669]" />;
      case 'EN_RIESGO':
        return <AlertTriangle className="h-4 w-4 text-[#D97706]" />;
      case 'PERDIDA':
        return <AlertTriangle className="h-4 w-4 text-[#DC2626]" />;
      default:
        return <Clock className="h-4 w-4 text-[#6B7280]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CUMPLIDA':
        return 'text-[#059669] bg-[#D1FAE5]';
      case 'EN_RIESGO':
        return 'text-[#D97706] bg-[#FEF3C7]';
      case 'PERDIDA':
        return 'text-[#DC2626] bg-[#FEE2E2]';
      default:
        return 'text-[#6B7280] bg-[#F3F4F6]';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
      <h2 className="text-lg font-semibold text-[#0F172A] mb-6 flex items-center space-x-2">
        <CreditCard className="h-5 w-5 text-[#022D5E]" />
        <span>Bonificaciones y Ahorro</span>
      </h2>

      {/* Transparency section - Base vs Bonified rates */}
      <div className="bg-[#F8F9FA] rounded-lg p-4 mb-6">
        <h3 className="font-medium text-[#0F172A] mb-4">Transparencia de cuotas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Base payment without bonifications */}
          <div className="text-center p-4 bg-white rounded-lg border">
            <div className="text-lg font-bold text-[#6B7280]">
              {formatEuro(savings.basePayment)}
            </div>
            <div className="text-sm text-[#6B7280]">
              Cuota base sin bonificaciones
            </div>
            <div className="text-xs text-[#9CA3AF] mt-1">
              TAE: {formatPercentage(savings.baseRate)}
            </div>
          </div>

          {/* Current payment with bonifications */}
          <div className="text-center p-4 bg-white rounded-lg border border-[#059669]">
            <div className="text-lg font-bold text-[#059669]">
              {formatEuro(savings.bonifiedPayment)}
            </div>
            <div className="text-sm text-[#059669]">
              Cuota actual con bonificaciones
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              TAE: {formatPercentage(savings.bonifiedRate)}
            </div>
          </div>

          {/* Total savings */}
          <div className="text-center p-4 bg-[#D1FAE5] rounded-lg">
            <div className="text-lg font-bold text-[#059669]">
              {formatEuro(savings.totalSavingsPerMonth)}
            </div>
            <div className="text-sm text-[#059669]">
              Ahorro total mensual
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {formatEuro(savings.totalSavingsPerYear)}/año
            </div>
          </div>
        </div>
      </div>

      {/* Bonifications table */}
      <div className="mb-6">
        <h3 className="font-medium text-[#0F172A] mb-4">Detalle por bonificación</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#6B7280] uppercase">
                  Bonificación
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-[#6B7280] uppercase">
                  Estado
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#6B7280] uppercase">
                  Ahorro €/mes
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#6B7280] uppercase">
                  Ahorro €/año
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#6B7280] uppercase">
                  Progreso
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-[#6B7280] uppercase">
                  Evaluación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {prestamo.bonificaciones.map((bonif) => {
                const bonifSavings = savings.bonificationBreakdown.find(b => b.bonificationId === bonif.id);
                const status = evaluation.bonificationStatus.find(s => s.bonificationId === bonif.id);
                
                return (
                  <tr key={bonif.id} className="hover:bg-[#F8F9FA]">
                    <td className="px-3 py-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(bonif.estado)}
                        <div>
                          <div className="font-medium text-[#0F172A]">{bonif.nombre}</div>
                          <div className="text-xs text-[#6B7280]">
                            -{formatPercentage(bonif.reduccionPuntosPorcentuales)} pp
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bonif.estado)}`}>
                        {bonif.estado}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-[#0F172A]">
                      {bonifSavings ? formatEuro(bonifSavings.savingsPerMonth) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-[#6B7280]">
                      {bonifSavings ? formatEuro(bonifSavings.savingsPerYear) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {bonif.progreso ? (
                        <div>
                          <div className="text-xs text-[#6B7280]">{bonif.progreso.descripcion}</div>
                          {bonif.progreso.faltante && (
                            <div className="text-xs text-[#D97706] mt-1">{bonif.progreso.faltante}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {status?.alertDates ? (
                        <div className="text-xs">
                          <div className="text-[#6B7280]">
                            {new Date(status.alertDates.evaluationDate).toLocaleDateString()}
                          </div>
                          <div className="text-[#9CA3AF]">
                            ({status.alertDates.daysUntilEvaluation} días)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts section */}
      {evaluation.upcomingAlerts.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-lg p-4">
          <h3 className="font-medium text-[#92400E] mb-3 flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Alertas de bonificaciones</span>
          </h3>
          
          <div className="space-y-3">
            {evaluation.upcomingAlerts.map((alert, index) => (
              <div key={index} className="bg-white rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-[#92400E] text-sm">
                      {alert.alertType} - {alert.message}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-1">
                      Acción requerida: {alert.actionRequired}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-[#DC2626]">
                      +{formatEuro(alert.economicImpact.additionalCostPerMonth)}/mes
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      +{formatEuro(alert.economicImpact.additionalCostPerYear)}/año
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next evaluation info */}
      {prestamo.fechaEvaluacion && (
        <div className="mt-4 p-3 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg">
          <div className="flex items-center space-x-2 text-sm text-[#0369A1]">
            <Calendar className="h-4 w-4" />
            <span>
              Próxima evaluación de bonificaciones: {new Date(prestamo.fechaEvaluacion).toLocaleDateString()}
            </span>
            {prestamo.fechaFinPeriodo && (
              <span className="text-[#6B7280]">
                (aplicación: {new Date(prestamo.fechaFinPeriodo).toLocaleDateString()})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BonificationPanel;