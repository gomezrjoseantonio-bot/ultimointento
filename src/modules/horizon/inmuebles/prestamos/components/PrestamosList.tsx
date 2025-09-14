// Préstamos List View Component

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calculator, Home } from 'lucide-react';
import { formatEuro, formatDate, formatPercentage } from '../../../../../utils/formatUtils';
import { Prestamo } from '../../../../../types/prestamos';
import { prestamosService } from '../../../../../services/prestamosService';
import { prestamosCalculationService } from '../../../../../services/prestamosCalculationService';

// Import standardized components
import PageHeader from '../../../../../components/common/PageHeader';
import FilterBar from '../../../../../components/common/FilterBar';
import DataTable from '../../../../../components/common/DataTable';
import KpiCard from '../../../../../components/common/KpiCard';

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
        toast.error('Error al eliminar el préstamo');
      }
    } catch (error) {
      console.error('Error deleting préstamo:', error);
      toast.error('Error al eliminar el préstamo');
    } finally {
      setLoading(false);
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

  // DataTable configuration
  const tableColumns = [
    {
      key: 'nombre',
      label: 'Préstamo',
      render: (value: string, item: Prestamo) => (
        <div className="flex items-center space-x-3">
          <Home className="h-5 w-5 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{item.inmuebleId}</div>
          </div>
        </div>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: string, item: Prestamo) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">
            {formatPercentage(getCurrentRate(item))} actual
          </div>
        </div>
      )
    },
    {
      key: 'principalVivo',
      label: 'Principal vivo',
      render: (value: number) => (
        <div className="text-right text-sm font-medium text-gray-900">
          {formatEuro(value)}
        </div>
      ),
      className: 'text-right'
    },
    {
      key: 'cuotaEstimada',
      label: 'Cuota est.',
      render: (value: any, item: Prestamo) => (
        <div className="text-right text-sm font-medium text-gray-900">
          {formatEuro(getEstimatedPayment(item))}
        </div>
      ),
      className: 'text-right'
    },
    {
      key: 'fechaContrato',
      label: 'Fecha firma',
      render: (value: string) => (
        <div className="text-sm text-gray-900">
          {formatDate(value)}
        </div>
      )
    },
    {
      key: 'plazoRestante',
      label: 'Plazo restante',
      render: (value: any, item: Prestamo) => (
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">
            {item.plazoMesesTotal - (item.mesesSoloIntereses || 0)}m
          </div>
          {item.mesesSoloIntereses && (
            <div className="text-xs text-amber-600">
              {item.mesesSoloIntereses}m solo intereses
            </div>
          )}
        </div>
      ),
      className: 'text-center'
    }
  ];

  const tableActions = [
    {
      type: 'view' as const,
      label: 'Ver detalles',
      onClick: (item: Prestamo) => onSelectPrestamo(item.id)
    },
    {
      type: 'edit' as const,
      label: 'Editar préstamo',
      onClick: (item: Prestamo) => onEditPrestamo(item.id)
    },
    {
      type: 'delete' as const,
      label: 'Eliminar préstamo',
      onClick: (item: Prestamo) => handleDeletePrestamo(item.id, item.nombre)
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hz-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Standardized Header */}
      <PageHeader
        title="Préstamos"
        subtitle="Gestión y seguimiento de financiación inmobiliaria"
        primaryAction={{
          label: "Nuevo préstamo",
          onClick: onCreateNew
        }}
      />

      {/* Standardized Filter Bar */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre o inmueble..."
        filters={[
          {
            key: 'type',
            label: 'Tipo',
            value: typeFilter,
            options: [
              { value: 'all', label: 'Todos los tipos' },
              { value: 'FIJO', label: 'Fijo' },
              { value: 'VARIABLE', label: 'Variable' },
              { value: 'MIXTO', label: 'Mixto' }
            ],
            onChange: setTypeFilter
          }
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total préstamos"
          value={prestamos.length.toString()}
          className="bg-white"
        />
        <KpiCard
          title="Capital vivo total"
          value={formatEuro(prestamos.reduce((sum, p) => sum + p.principalVivo, 0))}
          className="bg-white"
        />
        <KpiCard
          title="Cuotas mensuales est."
          value={formatEuro(prestamos.reduce((sum, p) => sum + getEstimatedPayment(p), 0))}
          className="bg-white"
        />
        <KpiCard
          title="Préstamos variables"
          value={prestamos.filter(p => p.tipo === 'VARIABLE').length.toString()}
          className="bg-white"
        />
      </div>

      {/* Standardized Data Table */}
      <DataTable
        data={filteredPrestamos}
        columns={tableColumns}
        actions={tableActions}
        loading={loading}
        emptyMessage={prestamos.length === 0 ? 'Comienza agregando tu primer préstamo o hipoteca' : 'No se encontraron préstamos que coincidan con los filtros'}
        emptyIcon={<Calculator className="h-12 w-12 text-gray-400" />}
      />
    </div>
  );
};

export default PrestamosList;