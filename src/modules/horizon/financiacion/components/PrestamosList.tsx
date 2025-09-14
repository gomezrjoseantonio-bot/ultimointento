import React, { useState, useEffect } from 'react';
import { 
  Edit3, 
  Eye,
  Trash2,
  Calculator,
  Calendar,
  CreditCard,
  Building,
  User,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { prestamosService } from '../../../../services/prestamosService';
import { Prestamo } from '../../../../types/prestamos';
import PrestamoDetailDrawer from './PrestamoDetailDrawer';

interface PrestamosListProps {
  onEdit: (prestamoId: string) => void;
}

type SortField = 'nombre' | 'tin' | 'capitalVivo' | 'vencimiento';
type SortDirection = 'asc' | 'desc';

const PrestamosList: React.FC<PrestamosListProps> = ({ onEdit }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Detail drawer state
  const [selectedPrestamoForDetail, setSelectedPrestamoForDetail] = useState<Prestamo | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Load loans
  useEffect(() => {
    const loadPrestamos = async () => {
      try {
        setLoading(true);
        const allPrestamos = await prestamosService.getAllPrestamos();
        setPrestamos(allPrestamos);
      } catch (error) {
        console.error('Error loading loans:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPrestamos();
  }, []);

  // Format numbers
  const formatNumber = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercentage = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate effective TIN (with bonifications)
  const calculateEffectiveTIN = (prestamo: Prestamo) => {
    let baseTIN = 0;
    if (prestamo.tipo === 'FIJO') {
      baseTIN = prestamo.tipoNominalAnualFijo || 0;
    } else if (prestamo.tipo === 'VARIABLE') {
      baseTIN = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
    } else if (prestamo.tipo === 'MIXTO') {
      baseTIN = prestamo.tipoNominalAnualMixtoFijo || 0;
    }

    const totalBonificaciones = (prestamo.bonificaciones || [])
      .reduce((sum, b) => sum + b.reduccionPuntosPorcentuales, 0);

    return Math.max(0, baseTIN - totalBonificaciones);
  };

  // Estimate monthly payment
  const estimateMonthlyPayment = (prestamo: Prestamo) => {
    const effectiveTIN = calculateEffectiveTIN(prestamo);
    const monthlyRate = effectiveTIN / 12 / 100;
    const months = prestamo.plazoMesesTotal;
    
    if (monthlyRate > 0) {
      return (prestamo.principalVivo * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
             (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      return prestamo.principalVivo / months;
    }
  };

  // Sort loans without complex filtering
  const sortedPrestamos = prestamos
    .sort((a, b) => {
      let valueA: any, valueB: any;
      
      switch (sortField) {
        case 'nombre':
          valueA = a.nombre.toLowerCase();
          valueB = b.nombre.toLowerCase();
          break;
        case 'tin':
          valueA = calculateEffectiveTIN(a);
          valueB = calculateEffectiveTIN(b);
          break;
        case 'capitalVivo':
          valueA = a.principalVivo;
          valueB = b.principalVivo;
          break;
        case 'vencimiento':
          // Calculate loan end date
          const fechaA = new Date(a.fechaFirma);
          fechaA.setMonth(fechaA.getMonth() + a.plazoMesesTotal);
          const fechaB = new Date(b.fechaFirma);
          fechaB.setMonth(fechaB.getMonth() + b.plazoMesesTotal);
          valueA = fechaA.getTime();
          valueB = fechaB.getTime();
          break;
        default:
          valueA = a.nombre.toLowerCase();
          valueB = b.nombre.toLowerCase();
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Calculate comprehensive loan statistics based on all loans
  const calculateLoanStats = () => {
    const loansToCalculate = sortedPrestamos; // Use all loans
    const capitalSolicitado = loansToCalculate.reduce((sum, p) => sum + p.principalInicial, 0);
    const capitalPendiente = loansToCalculate.reduce((sum, p) => sum + p.principalVivo, 0);
    const cuotaTotal = loansToCalculate.reduce((sum, p) => sum + estimateMonthlyPayment(p), 0);
    
    // Calculate paid and pending interests (estimation based on elapsed time)
    let interesesPagados = 0;
    let interesesPendientes = 0;
    
    loansToCalculate.forEach(prestamo => {
      const fechaFirma = new Date(prestamo.fechaFirma);
      const fechaActual = new Date();
      const mesesTranscurridos = Math.max(0, Math.floor((fechaActual.getTime() - fechaFirma.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
      
      const effectiveTIN = calculateEffectiveTIN(prestamo);
      const monthlyRate = effectiveTIN / 12 / 100;
      
      // Estimate interests paid (simplified calculation)
      const mesesPagados = Math.min(mesesTranscurridos, prestamo.plazoMesesTotal);
      
      // For simplicity, estimate that ~70% of early payments are interest
      const interesesPorCuota = prestamo.principalVivo * monthlyRate;
      interesesPagados += interesesPorCuota * mesesPagados * 0.7;
      
      // Estimate remaining interests
      const mesesRestantes = Math.max(0, prestamo.plazoMesesTotal - mesesTranscurridos);
      interesesPendientes += interesesPorCuota * mesesRestantes * 0.5; // Decreasing over time
    });
    
    return {
      capitalSolicitado,
      capitalPendiente,
      interesesPagados,
      interesesPendientes,
      cuotaTotal
    };
  };

  const loanStats = calculateLoanStats();

  // Action handlers
  const handleViewDetail = (prestamo: Prestamo) => {
    setSelectedPrestamoForDetail(prestamo);
    setIsDetailDrawerOpen(true);
  };

  const handleCloseDetailDrawer = () => {
    setIsDetailDrawerOpen(false);
    setSelectedPrestamoForDetail(null);
  };

  const handleDeletePrestamo = async (prestamoId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este préstamo?')) {
      try {
        await prestamosService.deletePrestamo(prestamoId);
        // Reload loans
        const allPrestamos = await prestamosService.getAllPrestamos();
        setPrestamos(allPrestamos);
        handleCloseDetailDrawer();
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-text-gray ml-1" />;
    return sortDirection === 'asc' ? 
      <ArrowUpDown className="h-3 w-3 text-atlas-blue ml-1" /> : 
      <ArrowUpDown className="h-3 w-3 text-atlas-blue ml-1 transform rotate-180" />;
  };

  // Account data will be loaded from the accounts service when needed
  // For now, all accounts show as unconfigured

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent mx-auto mb-4"></div>
          <p className="text-atlas-navy-1">Cargando préstamos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Information text with icon */}
      <div className="flex items-center space-x-2 text-sm text-text-gray">
        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-xs font-medium text-atlas-blue">i</span>
        </div>
        <span>Gestione sus préstamos hipotecarios y personales. Puede ordenar las columnas haciendo clic en los encabezados.</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <Calculator className="h-8 w-8 text-atlas-blue" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Capital Solicitado</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(loanStats.capitalSolicitado)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-warn" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Capital Pendiente</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(loanStats.capitalPendiente)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-ok" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Intereses Pagados</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(loanStats.interesesPagados)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-error" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Intereses Pendientes</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(loanStats.interesesPendientes)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-atlas-blue" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Cuota Total</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(loanStats.cuotaTotal)} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loans List */}
      {sortedPrestamos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-atlas border border-gray-200">
          <CreditCard className="h-12 w-12 text-text-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-atlas-navy-1 mb-2">No hay préstamos</h3>
          <p className="text-text-gray">Comience creando su primer préstamo con el botón "Crear Préstamo"</p>
        </div>
      ) : (
        <div className="bg-white rounded-atlas border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-text-gray uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('nombre')}
                  >
                    <div className="flex items-center">
                      Préstamo
                      {getSortIcon('nombre')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-gray uppercase tracking-wider">
                    Tipo
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('capitalVivo')}
                  >
                    <div className="flex items-center justify-end">
                      Capital Vivo
                      {getSortIcon('capitalVivo')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('tin')}
                  >
                    <div className="flex items-center justify-end">
                      TIN Efectivo
                      {getSortIcon('tin')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider">
                    Cuota Est.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-gray uppercase tracking-wider">
                    Cuenta
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedPrestamos.map((prestamo) => {
                  const effectiveTIN = calculateEffectiveTIN(prestamo);
                  const monthlyPayment = estimateMonthlyPayment(prestamo);
                  const isPersonal = prestamo.inmuebleId === 'standalone';

                  return (
                    <tr key={prestamo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                            isPersonal ? 'bg-primary-100' : 'bg-warning-100'
                          }`}>
                            {isPersonal ? (
                              <User className={`h-4 w-4 ${isPersonal ? 'text-atlas-blue' : 'text-warn'}`} />
                            ) : (
                              <Building className={`h-4 w-4 ${isPersonal ? 'text-atlas-blue' : 'text-warn'}`} />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-atlas-navy-1">
                              {prestamo.nombre}
                            </div>
                            <div className="text-sm text-text-gray">
                              {new Date(prestamo.fechaFirma).toLocaleDateString('es-ES')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          prestamo.tipo === 'FIJO' ? 'bg-blue-100 text-blue-800' :
                          prestamo.tipo === 'VARIABLE' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {prestamo.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-atlas-navy-1">
                        {formatNumber(prestamo.principalVivo)} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="text-atlas-navy-1 font-medium">
                          {formatPercentage(effectiveTIN)} %
                        </div>
                        {(prestamo.bonificaciones || []).length > 0 && (
                          <div className="text-xs text-ok-600">
                            {(prestamo.bonificaciones || []).length} bonif.
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-atlas-navy-1">
                        {formatNumber(monthlyPayment)} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-gray">
                        <div className="text-error-500">Sin cuenta configurada</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetail(prestamo)}
                            className="text-atlas-blue hover:text-primary-800 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEdit(prestamo.id)}
                            className="text-text-gray hover:text-atlas-blue transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePrestamo(prestamo.id)}
                            className="text-text-gray hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Loan Detail Drawer */}
      <PrestamoDetailDrawer
        prestamo={selectedPrestamoForDetail}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseDetailDrawer}
        onEdit={onEdit}
        onDelete={handleDeletePrestamo}
      />
    </div>
  );
};

export default PrestamosList;