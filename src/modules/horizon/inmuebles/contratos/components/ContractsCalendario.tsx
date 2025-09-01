import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Edit2, Save, X } from 'lucide-react';
import { Contract, RentCalendar, initDB } from '../../../../../services/db';
import { getAllContracts, getRentCalendar } from '../../../../../services/contractService';
import { formatEuro, parseEuroInput } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface CalendarEntry extends RentCalendar {
  contractInfo?: {
    tenantName: string;
    propertyId: number;
  };
}

const ContractsCalendario: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<CalendarEntry[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ expectedAmount: '', notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const filterEntries = useCallback(() => {
    let filtered = [...calendarEntries];

    // Filter by contract
    if (selectedContractId !== 'all') {
      filtered = filtered.filter(entry => entry.contractId.toString() === selectedContractId);
    }

    // Filter by year
    filtered = filtered.filter(entry => {
      const year = parseInt(entry.period.split('-')[0]);
      return year === selectedYear;
    });

    // Sort by period
    filtered.sort((a, b) => a.period.localeCompare(b.period));

    setFilteredEntries(filtered);
  }, [calendarEntries, selectedContractId, selectedYear]);

  useEffect(() => {
    filterEntries();
  }, [filterEntries]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contracts
      const contractsData = await getAllContracts();
      setContracts(contractsData);
      
      // Load calendar entries for all contracts
      const allEntries: CalendarEntry[] = [];
      
      for (const contract of contractsData) {
        if (contract.id) {
          const entries = await getRentCalendar(contract.id);
          const entriesWithContractInfo = entries.map(entry => ({
            ...entry,
            contractInfo: {
              tenantName: contract.tenant.name,
              propertyId: contract.propertyId,
            },
          }));
          allEntries.push(...entriesWithContractInfo);
        }
      }
      
      setCalendarEntries(allEntries);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (entry: CalendarEntry) => {
    setEditingEntry(entry.id!);
    setEditForm({
      expectedAmount: formatEuro(entry.expectedAmount).replace('€', '').trim(),
      notes: entry.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editingEntry) return;

    const newAmount = parseEuroInput(editForm.expectedAmount);
    if (!newAmount || newAmount <= 0) {
      toast.error('El importe debe ser mayor que 0');
      return;
    }

    try {
      const db = await initDB();
      const entry = await db.get('rentCalendar', editingEntry);
      
      if (entry) {
        const updatedEntry = {
          ...entry,
          expectedAmount: newAmount,
          notes: editForm.notes.trim() || undefined,
        };
        
        await db.put('rentCalendar', updatedEntry);
        toast.success('Entrada del calendario actualizada');
        loadData();
      }
    } catch (error) {
      console.error('Error updating calendar entry:', error);
      toast.error('Error al actualizar la entrada');
    }

    setEditingEntry(null);
  };

  const cancelEdit = () => {
    setEditingEntry(null);
  };

  const formatPeriod = (period: string): string => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('es-ES', { 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const getMonthsInYear = (year: number): string[] => {
    const months: string[] = [];
    for (let month = 1; month <= 12; month++) {
      months.push(`${year}-${month.toString().padStart(2, '0')}`);
    }
    return months;
  };

  const getEntryForPeriod = (contractId: number, period: string): CalendarEntry | undefined => {
    return filteredEntries.find(entry => 
      entry.contractId === contractId && entry.period === period
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-brand-navy" />
            <h2 className="text-xl font-semibold text-neutral-900">Calendario de rentas</h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Contrato
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="all">Todos los contratos</option>
              {contracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.tenant.name} - Inmueble #{contract.propertyId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Año
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              {[2023, 2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {selectedContractId === 'all' ? (
        // Show all contracts in table format
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No hay entradas de calendario para el año seleccionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Contrato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Inmueble
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Importe previsto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Prorrateo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Notas
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                        {formatPeriod(entry.period)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {entry.contractInfo?.tenantName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        Inmueble #{entry.contractInfo?.propertyId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingEntry === entry.id ? (
                          <input
                            type="text"
                            value={editForm.expectedAmount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, expectedAmount: e.target.value }))}
                            className="w-32 px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy"
                            placeholder="1.200,00"
                          />
                        ) : (
                          <span className="text-sm font-medium text-neutral-900">
                            {formatEuro(entry.expectedAmount)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.isProrated ? (
                          <div className="text-sm">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Prorrateado
                            </span>
                            {entry.proratedDays && entry.totalDaysInMonth && (
                              <div className="text-xs text-neutral-500 mt-1">
                                {entry.proratedDays}/{entry.totalDaysInMonth} días
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingEntry === entry.id ? (
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy"
                            placeholder="Notas..."
                          />
                        ) : (
                          <span className="text-sm text-neutral-600">
                            {entry.notes || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingEntry === entry.id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={saveEdit}
                              className="text-green-600 hover:text-green-800 transition-colors"
                              title="Guardar"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-neutral-600 hover:text-neutral-800 transition-colors"
                              title="Cancelar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(entry)}
                            className="text-brand-navy hover:text-brand-navy/80 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Show selected contract in calendar format
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          {(() => {
            const selectedContract = contracts.find(c => c.id?.toString() === selectedContractId);
            if (!selectedContract) return null;

            const months = getMonthsInYear(selectedYear);

            return (
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-6">
                  {selectedContract.tenant.name} - Inmueble #{selectedContract.propertyId}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {months.map(period => {
                    const entry = getEntryForPeriod(selectedContract.id!, period);
                    
                    return (
                      <div key={period} className="border border-neutral-200 rounded-lg p-4">
                        <div className="font-medium text-neutral-900 mb-2">
                          {formatPeriod(period)}
                        </div>
                        
                        {entry ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-neutral-600">Importe:</span>
                              {editingEntry === entry.id ? (
                                <input
                                  type="text"
                                  value={editForm.expectedAmount}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, expectedAmount: e.target.value }))}
                                  className="w-24 px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy"
                                />
                              ) : (
                                <span className="font-medium text-neutral-900">
                                  {formatEuro(entry.expectedAmount)}
                                </span>
                              )}
                            </div>
                            
                            {entry.isProrated && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600">Prorrateo:</span>
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  {entry.proratedDays}/{entry.totalDaysInMonth}
                                </span>
                              </div>
                            )}
                            
                            {entry.notes && (
                              <div className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded">
                                {editingEntry === entry.id ? (
                                  <input
                                    type="text"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-1 py-0 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy"
                                  />
                                ) : (
                                  entry.notes
                                )}
                              </div>
                            )}
                            
                            <div className="flex justify-end">
                              {editingEntry === entry.id ? (
                                <div className="flex space-x-1">
                                  <button
                                    onClick={saveEdit}
                                    className="text-green-600 hover:text-green-800 transition-colors"
                                    title="Guardar"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-neutral-600 hover:text-neutral-800 transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="text-brand-navy hover:text-brand-navy/80 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-neutral-400">
                            Sin renta prevista
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ContractsCalendario;