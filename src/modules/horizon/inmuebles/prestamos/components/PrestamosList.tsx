// Préstamos List View Component

import React, { useState, useEffect } from 'react';
import { Plus, Calculator, Home, Search, Filter, Eye, Trash2, Edit } from 'lucide-react';
import { formatEuro, formatDate, formatPercentage } from '../../../../../utils/formatUtils';
import { Prestamo } from '../../../../../types/prestamos';
import { prestamosService } from '../../../../../services/prestamosService';
import { prestamosCalculationService } from '../../../../../services/prestamosCalculationService';

interface PrestamosListProps {
  onSelectPrestamo: (prestamoId: string) => void;
  onEditPrestamo: (prestamoId: string) => void;
  onCreateNew: () => void;
}

const PrestamosList: React.FC<PrestamosListProps> = ({ onSelectPrestamo, onEditPrestamo, onCreateNew }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadPrestamos();
  }, []);

  const loadPrestamos = async () => {
    try {
      setLoading(true);
      const allPrestamos = await prestamosService.getAllPrestamos();
      setPrestamos(allPrestamos);
    } catch (error) {
      console.error('Error loading préstamos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrestamo = async (prestamoId: string, prestamoNombre: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el préstamo "${prestamoNombre}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const success = await prestamosService.deletePrestamo(prestamoId);
      if (success) {
        // Reload the list after deletion
        await loadPrestamos();
      } else {
        alert('Error al eliminar el préstamo');
      }
    } catch (error) {
      console.error('Error deleting préstamo:', error);
      alert('Error al eliminar el préstamo');
    } finally {
      setLoading(false);
    }
  };

  const getTipoDisplay = (prestamo: Prestamo): string => {
    switch (prestamo.tipo) {
      case 'FIJO':
        return `Fijo ${formatPercentage(prestamo.tipoNominalAnualFijo || 0)}`;
      case 'VARIABLE':
        return `${prestamo.indice} + ${formatPercentage(prestamo.diferencial || 0)}`;
      case 'MIXTO':
        return `Mixto (${prestamo.tramoFijoMeses}m)`;
      default:
        return prestamo.tipo;
    }
  };

  const getCurrentRate = (prestamo: Prestamo): number => {
    return prestamosCalculationService.calculateBaseRate(prestamo);
  };

  const getEstimatedPayment = (prestamo: Prestamo): number => {
    const rate = getCurrentRate(prestamo);
    // Simplified calculation - assuming all regular payments for estimation
    return prestamosCalculationService.calculateFrenchPayment(
      prestamo.principalVivo, 
      rate, 
      prestamo.plazoMesesTotal
    );
  };

  const filteredPrestamos = prestamos.filter(prestamo => {
    const matchesSearch = prestamo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prestamo.inmuebleId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || prestamo.tipo === typeFilter;
    
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#022D5E]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Préstamos</h1>
          <p className="text-[#6B7280] mt-1">
            Gestión y seguimiento de financiación inmobiliaria
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#033A73] transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo préstamo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-[#D7DEE7] p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Buscar por nombre o inmueble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-[#6B7280]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-[#D1D5DB] rounded-md px-3 py-2 focus:ring-[#022D5E] focus:border-[#022D5E]"
            >
              <option value="all">Todos los tipos</option>
              <option value="FIJO">Fijo</option>
              <option value="VARIABLE">Variable</option>
              <option value="MIXTO">Mixto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-4">
          <div className="text-2xl font-bold text-[#022D5E]">{prestamos.length}</div>
          <div className="text-sm text-[#6B7280]">Total préstamos</div>
        </div>
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-4">
          <div className="text-2xl font-bold text-[#022D5E]">
            {formatEuro(prestamos.reduce((sum, p) => sum + p.principalVivo, 0))}
          </div>
          <div className="text-sm text-[#6B7280]">Capital vivo total</div>
        </div>
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-4">
          <div className="text-2xl font-bold text-[#022D5E]">
            {formatEuro(prestamos.reduce((sum, p) => sum + getEstimatedPayment(p), 0))}
          </div>
          <div className="text-sm text-[#6B7280]">Cuotas mensuales est.</div>
        </div>
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-4">
          <div className="text-2xl font-bold text-[#022D5E]">
            {prestamos.filter(p => p.tipo === 'VARIABLE').length}
          </div>
          <div className="text-sm text-[#6B7280]">Préstamos variables</div>
        </div>
      </div>

      {/* Loans list */}
      <div className="bg-white rounded-lg border border-[#D7DEE7] overflow-hidden">
        {filteredPrestamos.length === 0 ? (
          <div className="text-center py-12">
            <Calculator className="h-12 w-12 text-[#D1D5DB] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#374151] mb-2">
              {prestamos.length === 0 ? 'No hay préstamos' : 'No se encontraron préstamos'}
            </h3>
            <p className="text-[#6B7280] mb-4">
              {prestamos.length === 0 
                ? 'Comienza agregando tu primer préstamo o hipoteca'
                : 'Prueba ajustando los filtros de búsqueda'
              }
            </p>
            {prestamos.length === 0 && (
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#033A73] transition-colors"
              >
                Crear primer préstamo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Préstamo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Principal vivo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Cuota est.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Fecha firma
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Plazo restante
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F3F4F6]">
                {filteredPrestamos.map((prestamo) => {
                  const estimatedPayment = getEstimatedPayment(prestamo);
                  const currentRate = getCurrentRate(prestamo);
                  
                  return (
                    <tr key={prestamo.id} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <Home className="h-5 w-5 text-[#6B7280]" />
                          <div>
                            <div className="text-sm font-medium text-[#0F172A]">
                              {prestamo.nombre}
                            </div>
                            <div className="text-sm text-[#6B7280]">
                              {prestamo.inmuebleId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#0F172A]">{getTipoDisplay(prestamo)}</div>
                        <div className="text-sm text-[#6B7280]">
                          TAE actual: {formatPercentage(currentRate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-medium text-[#0F172A]">
                          {formatEuro(prestamo.principalVivo)}
                        </div>
                        <div className="text-sm text-[#6B7280]">
                          de {formatEuro(prestamo.principalInicial)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-medium text-[#0F172A]">
                          {formatEuro(estimatedPayment)}
                        </div>
                        <div className="text-sm text-[#6B7280]">estimada</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#0F172A]">
                          {formatDate(prestamo.fechaFirma)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-[#0F172A]">
                          {prestamo.plazoMesesTotal} meses
                        </div>
                        {prestamo.mesesSoloIntereses && prestamo.mesesSoloIntereses > 0 && (
                          <div className="text-xs text-[#D97706]">
                            {prestamo.mesesSoloIntereses}m solo intereses
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onSelectPrestamo(prestamo.id)}
                            className="inline-flex items-center px-3 py-1 border border-[#D1D5DB] text-sm font-medium rounded-md text-[#374151] bg-white hover:bg-[#F8F9FA] transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </button>
                          <button
                            onClick={() => onEditPrestamo(prestamo.id)}
                            className="inline-flex items-center px-3 py-1 border border-[#022D5E] text-sm font-medium rounded-md text-[#022D5E] bg-white hover:bg-[#EEF2FF] transition-colors"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeletePrestamo(prestamo.id, prestamo.nombre)}
                            className="inline-flex items-center px-3 py-1 border border-[#DC2626] text-sm font-medium rounded-md text-[#DC2626] bg-white hover:bg-[#FEE2E2] transition-colors"
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrestamosList;