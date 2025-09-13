import React, { useState, useEffect } from 'react';
import { Calendar, Euro, Building, AlertCircle } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { RentaMensual, Contract, Property, initDB } from '../../../../services/db';

const CobrosPendientes: React.FC = () => {
  const [pendingRents, setPendingRents] = useState<RentaMensual[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const db = await initDB();
        
        // Load all data
        const [rentsData, contractsData, propertiesData] = await Promise.all([
          db.getAll('rentaMensual'),
          db.getAll('contracts'),
          db.getAll('properties')
        ]);
        
        // Filter for pending rents (not fully collected)
        const pending = rentsData.filter(rent => 
          rent.estado === 'pendiente' || rent.estado === 'parcial'
        );
        
        setPendingRents(pending);
        setContracts(contractsData);
        setProperties(propertiesData);
      } catch (error) {
        console.error('Error loading cobros data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getContractInfo = (contratoId: number) => {
    return contracts.find(c => c.id === contratoId);
  };

  const getPropertyInfo = (inmuebleId: number) => {
    return properties.find(p => p.id === inmuebleId);
  };

  const formatEuro = (amount: number) => {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-warning-100 text-warning-800';
      case 'parcial':
        return 'bg-error-100 text-error-800';
      case 'cobrada':
        return 'bg-success-100 text-success-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  return (
    <PageLayout 
      title="Cobros" 
      subtitle="Gestión de cobros y conciliación"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Cobros Pendientes</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {pendingRents.length} rentas pendientes
              </span>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors">
                Nuevo Cobro
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">Cargando cobros pendientes...</p>
            </div>
          ) : pendingRents.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay cobros pendientes</p>
              <p className="text-sm text-gray-400 mt-1">Todas las rentas están al día</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRents.map(rent => {
                const contract = getContractInfo(rent.contratoId);
                const property = getPropertyInfo(contract?.inmuebleId || 0);
                
                return (
                  <div
                    key={rent.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3 mb-2">
                            <Building className="h-5 w-5 text-gray-400" />
                            <h4 className="text-sm font-medium text-gray-900">
                              {property?.alias || property?.address || 'Propiedad no encontrada'}
                            </h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(rent.estado)}`}>
                              {rent.estado.charAt(0).toUpperCase() + rent.estado.slice(1)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>Período: {rent.periodo}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Euro className="h-4 w-4" />
                              <span>Previsto: {formatEuro(rent.importePrevisto)}</span>
                            </div>
                            {rent.importeCobradoAcum > 0 && (
                              <div className="flex items-center space-x-2">
                                <span className="text-success-600">
                                  Cobrado: {formatEuro(rent.importeCobradoAcum)}
                                </span>
                              </div>
                            )}
                            {rent.estado === 'parcial' && (
                              <div className="flex items-center space-x-2 text-warning-600">
                                <AlertCircle className="h-4 w-4" />
                                <span>
                                  Pendiente: {formatEuro(rent.importePrevisto - rent.importeCobradoAcum)}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-2 text-sm text-gray-500">
                            Inquilino: {contract?.inquilino || 'No especificado'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors">
                          Conciliar
                        </button>
                        <button className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                          Ver Detalles
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default CobrosPendientes;