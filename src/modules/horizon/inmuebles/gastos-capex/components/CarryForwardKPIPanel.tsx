import React, { useState, useEffect } from 'react';
import { TrendingUpIcon, AlertTriangleIcon, CalendarIcon, InfoIcon } from 'lucide-react';
import { getCarryForwardsAppliedThisYear, calculateCarryForwards } from '../../../../../services/fiscalSummaryService';
import { initDB, Property } from '../../../../../services/db';
import { formatEuro } from '../../../../../utils/formatUtils';

interface CarryForwardKPIPanelProps {
  propertyId?: number; // If not provided, shows all properties
  selectedYear: number;
}

interface CarryForwardDetail {
  exerciseYear: number;
  excessAmount: number;
  remainingAmount: number;
  expirationYear: number;
  appliedThisYear?: number;
  expiresThisYear?: boolean;
}

const CarryForwardKPIPanel: React.FC<CarryForwardKPIPanelProps> = ({ 
  propertyId, 
  selectedYear 
}) => {
  const [appliedThisYear, setAppliedThisYear] = useState<number>(0);
  const [carryForwardDetails, setCarryForwardDetails] = useState<CarryForwardDetail[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [propertyId, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      
      // Load properties
      const propertiesData = await db.getAll('properties');
      const activeProperties = propertiesData.filter(p => p.state === 'activo');
      setProperties(activeProperties);

      // Load carryforward data
      const applied = await getCarryForwardsAppliedThisYear(propertyId);
      setAppliedThisYear(applied);

      // Load detailed carryforward information
      if (propertyId) {
        const details = await calculateCarryForwards(propertyId);
        setCarryForwardDetails(details);
      } else {
        // Aggregate details from all properties
        const allDetails: CarryForwardDetail[] = [];
        for (const property of activeProperties) {
          const propDetails = await calculateCarryForwards(property.id!);
          allDetails.push(...propDetails);
        }
        setCarryForwardDetails(allDetails);
      }
    } catch (error) {
      console.error('Error loading carryforward data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalPending = (): number => {
    return carryForwardDetails.reduce((sum, cf) => sum + cf.remainingAmount, 0);
  };

  const getExpiringThisYear = (): number => {
    return carryForwardDetails
      .filter(cf => cf.expiresThisYear)
      .reduce((sum, cf) => sum + cf.remainingAmount, 0);
  };

  const getExpiringNextYear = (): number => {
    return carryForwardDetails
      .filter(cf => cf.expirationYear === selectedYear + 1)
      .reduce((sum, cf) => sum + cf.remainingAmount, 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Applied This Year */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Arrastres Aplicados {selectedYear}</p>
              <p className="text-2xl font-bold text-success-600">{formatEuro(appliedThisYear)}</p>
            </div>
            <TrendingUpIcon className="w-8 h-8 text-success-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pérdidas de ejercicios anteriores aplicadas este año
          </p>
        </div>

        {/* Total Pending */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Pendiente</p>
              <p className="text-2xl font-bold text-primary-600">{formatEuro(getTotalPending())}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-primary-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Total disponible para futuros ejercicios
          </p>
        </div>

        {/* Expiring This Year */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Caduca en {selectedYear}</p>
              <p className="text-2xl font-bold text-error-600">{formatEuro(getExpiringThisYear())}</p>
            </div>
            <AlertTriangleIcon className="w-8 h-8 text-error-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Arrastres que expiran este año
          </p>
        </div>

        {/* Expiring Next Year */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Caduca en {selectedYear + 1}</p>
              <p className="text-2xl font-bold text-warning-600">{formatEuro(getExpiringNextYear())}</p>
            </div>
            <AlertTriangleIcon className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Arrastres que expiran el próximo año
          </p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Detalle de Arrastres AEAT
              </h3>
              <p className="text-sm text-gray-600">
                Arrastres aplicados, pendientes y fechas de caducidad
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <InfoIcon className="w-4 h-4" />
              <span>Límite AEAT: 4 ejercicios</span>
            </div>
          </div>
        </div>

        {carryForwardDetails.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUpIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No hay arrastres disponibles</p>
            <p className="text-sm text-gray-400">
              Los arrastres aparecerán cuando se generen pérdidas fiscales
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ejercicio Origen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pérdida Original
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aplicado {selectedYear}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Año Caducidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carryForwardDetails.map((detail, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {detail.exerciseYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatEuro(detail.excessAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {detail.appliedThisYear ? (
                        <span className="text-success-600 font-medium">
                          {formatEuro(detail.appliedThisYear)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`font-medium ${
                        detail.remainingAmount > 0 ? 'text-primary-600' : 'text-gray-400'
                      }`}>
                        {formatEuro(detail.remainingAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {detail.expirationYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {detail.expiresThisYear ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-error-100 text-error-800">
                          Caduca {selectedYear}
                        </span>
                      ) : detail.expirationYear === selectedYear + 1 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-warning-100 text-orange-800">
                          Caduca {selectedYear + 1}
                        </span>
                      ) : detail.remainingAmount > 0 ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                          Disponible
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Agotado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarryForwardKPIPanel;