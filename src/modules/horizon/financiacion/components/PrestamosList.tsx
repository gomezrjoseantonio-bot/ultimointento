import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Calculator,
  Calendar,
  CreditCard,
  Building,
  User,
  TrendingUp
} from 'lucide-react';
import { prestamosService } from '../../../../services/prestamosService';
import { Prestamo } from '../../../../types/prestamos';

interface PrestamosListProps {
  onCreateNew: () => void;
  onEdit: (prestamoId: string) => void;
}

const PrestamosList: React.FC<PrestamosListProps> = ({ onCreateNew, onEdit }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PERSONAL' | 'INMUEBLE'>('ALL');

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

  // Filter and search loans
  const filteredPrestamos = prestamos.filter(prestamo => {
    const matchesSearch = prestamo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prestamo.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'ALL' || 
                         (filter === 'INMUEBLE' && prestamo.inmuebleId !== 'standalone') ||
                         (filter === 'PERSONAL' && prestamo.inmuebleId === 'standalone');
    
    return matchesSearch && matchesFilter;
  });

  // Mock account data
  const mockAccounts = [
    { id: 'acc1', iban: 'ES91 2100 0418 4502 0005 1332', entidad: 'CaixaBank' },
    { id: 'acc2', iban: 'ES79 0049 0001 5025 1610 1005', entidad: 'Santander' },
    { id: 'acc3', iban: 'ES15 0081 0346 1100 0123 4567', entidad: 'Sabadell' }
  ];

  const getAccountInfo = (cuentaId: string) => {
    return mockAccounts.find(acc => acc.id === cuentaId);
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-atlas-navy-1">Préstamos</h2>
          <p className="text-text-gray">Gestión de financiación ATLAS Horizon</p>
        </div>
        
        <button
          onClick={onCreateNew}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-atlas text-white bg-atlas-blue hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear Préstamo
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-gray" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar préstamos..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-atlas focus:outline-none focus:ring-atlas-blue focus:border-atlas-blue"
          />
        </div>

        {/* Filter */}
        <div className="flex space-x-2">
          {[
            { value: 'ALL', label: 'Todos', icon: null },
            { value: 'PERSONAL', label: 'Personal', icon: User },
            { value: 'INMUEBLE', label: 'Inmueble', icon: Building }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setFilter(value as any)}
              className={`inline-flex items-center px-3 py-2 border rounded-atlas text-sm font-medium transition-colors ${
                filter === value
                  ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                  : 'border-gray-300 bg-white text-atlas-navy-1 hover:bg-gray-50'
              }`}
            >
              {Icon && <Icon className="h-4 w-4 mr-1" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <CreditCard className="h-8 w-8 text-atlas-blue" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Total Préstamos</p>
              <p className="text-2xl font-bold text-atlas-navy-1">{prestamos.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <Calculator className="h-8 w-8 text-ok" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">Capital Total</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {formatNumber(prestamos.reduce((sum, p) => sum + p.principalVivo, 0))} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-atlas border border-gray-200 p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-warn" />
            <div className="ml-4">
              <p className="text-sm font-medium text-text-gray">TIN Medio</p>
              <p className="text-2xl font-bold text-atlas-navy-1">
                {prestamos.length > 0 ? formatPercentage(
                  prestamos.reduce((sum, p) => sum + calculateEffectiveTIN(p), 0) / prestamos.length
                ) : '0,00'} %
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
                {formatNumber(prestamos.reduce((sum, p) => sum + estimateMonthlyPayment(p), 0))} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loans List */}
      {filteredPrestamos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-atlas border border-gray-200">
          {prestamos.length === 0 ? (
            <>
              <CreditCard className="h-12 w-12 text-text-gray mx-auto mb-4" />
              <h3 className="text-lg font-medium text-atlas-navy-1 mb-2">No hay préstamos</h3>
              <p className="text-text-gray mb-6">Comience creando su primer préstamo</p>
              <button
                onClick={onCreateNew}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-atlas text-white bg-atlas-blue hover:bg-primary-800 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Préstamo
              </button>
            </>
          ) : (
            <>
              <Search className="h-12 w-12 text-text-gray mx-auto mb-4" />
              <h3 className="text-lg font-medium text-atlas-navy-1 mb-2">No se encontraron préstamos</h3>
              <p className="text-text-gray">Intente modificar los criterios de búsqueda</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-atlas border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-gray uppercase tracking-wider">
                    Préstamo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-gray uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider">
                    Capital Vivo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-gray uppercase tracking-wider">
                    TIN Efectivo
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
                {filteredPrestamos.map((prestamo) => {
                  const effectiveTIN = calculateEffectiveTIN(prestamo);
                  const monthlyPayment = estimateMonthlyPayment(prestamo);
                  const account = getAccountInfo(prestamo.cuentaCargoId);
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
                        {account ? (
                          <div>
                            <div className="font-medium">{account.entidad}</div>
                            <div className="text-xs">...{account.iban.slice(-4)}</div>
                          </div>
                        ) : (
                          <span className="text-error-500">Sin cuenta</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onEdit(prestamo.id)}
                            className="text-atlas-blue hover:text-primary-800 transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
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
    </div>
  );
};

export default PrestamosList;