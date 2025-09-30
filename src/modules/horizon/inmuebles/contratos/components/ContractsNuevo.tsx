import React, { useState, useEffect } from 'react';
import { Building, User, Calendar, Euro, FileText, CreditCard } from 'lucide-react';
import { Property, Contract, Account, initDB } from '../../../../../services/db';
import { 
  validateContract,
  saveContract,
  updateContract,
  calculateHabitualEndDate
} from '../../../../../services/contractServiceNew';
import { parseEuroInput } from '../../../../../utils/formatUtils';
import { cuentasService } from '../../../../../services/cuentasService';
import AccountOption from '../../../../../components/common/AccountOption';
import toast from 'react-hot-toast';

interface ContractsNuevoProps {
  editingContract?: Contract | null;
  onContractCreated: () => void;
  onCancel: () => void;
}

interface FormData {
  // Property and unit information
  inmuebleId: number;
  unidadTipo: 'vivienda' | 'habitacion';
  habitacionId: string;
  
  // Contract modality
  modalidad: 'habitual' | 'temporada';
  
  // Tenant information
  inquilino: {
    nombre: string;
    apellidos: string;
    dni: string;
    telefono: string;
    email: string;
  };
  
  // Contract dates
  fechaInicio: string;
  fechaFin: string;
  
  // Financial terms
  rentaMensual: string;
  diaPago: string;
  margenGraciaDias: string;
  
  // Indexation
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';
  indexOtros: {
    formula: string;
    frecuencia: string;
    nota: string;
  };
  
  // Deposit
  fianzaMeses: string;
  fianzaImporte: string;
  
  // Bank account
  cuentaCobroId: number;
}

const ContractsNuevo: React.FC<ContractsNuevoProps> = ({ editingContract, onContractCreated, onCancel }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<FormData>({
    inmuebleId: editingContract?.inmuebleId || 0,
    unidadTipo: editingContract?.unidadTipo || 'vivienda',
    habitacionId: editingContract?.habitacionId || '',
    modalidad: editingContract?.modalidad || 'habitual',
    inquilino: {
      nombre: editingContract?.inquilino?.nombre || '',
      apellidos: editingContract?.inquilino?.apellidos || '',
      dni: editingContract?.inquilino?.dni || '',
      telefono: editingContract?.inquilino?.telefono || '',
      email: editingContract?.inquilino?.email || '',
    },
    fechaInicio: editingContract?.fechaInicio || '',
    fechaFin: editingContract?.fechaFin || '',
    rentaMensual: editingContract?.rentaMensual?.toString() || '',
    diaPago: editingContract?.diaPago?.toString() || '1',
    margenGraciaDias: editingContract?.margenGraciaDias?.toString() || '5',
    indexacion: editingContract?.indexacion || 'none',
    indexOtros: {
      formula: editingContract?.indexOtros?.formula || '',
      frecuencia: editingContract?.indexOtros?.frecuencia || 'anual',
      nota: editingContract?.indexOtros?.nota || '',
    },
    fianzaMeses: editingContract?.fianzaMeses?.toString() || '1',
    fianzaImporte: editingContract?.fianzaImporte?.toString() || '',
    cuentaCobroId: editingContract?.cuentaCobroId || 0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-calculate deposit amount
  useEffect(() => {
    const monthlyRent = parseEuroInput(formData.rentaMensual);
    const months = parseInt(formData.fianzaMeses) || 0;
    
    if (monthlyRent && months) {
      const depositAmount = monthlyRent * months;
      setFormData(prev => ({
        ...prev,
        fianzaImporte: depositAmount.toString(),
      }));
    }
  }, [formData.rentaMensual, formData.fianzaMeses]);

  const loadData = async () => {
    try {
      const db = await initDB();
      
      // Load properties
      const propertiesData = await db.getAll('properties');
      setProperties(propertiesData);
      
      // Load bank accounts using new cuentasService
      const accountsData = await cuentasService.list();
      const activeAccounts = accountsData.filter(account => account.activa);
      setAccounts(activeAccounts);
      
      if (propertiesData.length > 0 && !editingContract) {
        setFormData(prev => ({ ...prev, inmuebleId: propertiesData[0].id || 0 }));
        setSelectedProperty(propertiesData[0]);
      }
      
      if (activeAccounts.length > 0 && !editingContract) {
        setFormData(prev => ({ ...prev, cuentaCobroId: activeAccounts[0].id || 0 }));
      }
      
      // If editing, load the selected property
      if (editingContract && propertiesData.length > 0) {
        const property = propertiesData.find(p => p.id === editingContract.inmuebleId);
        if (property) {
          setSelectedProperty(property);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePropertyChange = (inmuebleId: number) => {
    const property = properties.find(p => p.id === inmuebleId);
    setSelectedProperty(property || null);
    setFormData(prev => ({
      ...prev,
      inmuebleId,
      habitacionId: '', // Reset room selection when property changes
    }));
  };

  // Auto-calculate end date for habitual contracts
  useEffect(() => {
    if (formData.fechaInicio && formData.modalidad === 'habitual' && !editingContract) {
      const calculatedEndDate = calculateHabitualEndDate(formData.fechaInicio);
      setFormData(prev => ({ ...prev, fechaFin: calculatedEndDate }));
    }
  }, [formData.fechaInicio, formData.modalidad, editingContract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    try {
      // Build contract object
      const contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> = {
        inmuebleId: formData.inmuebleId,
        unidadTipo: formData.unidadTipo,
        habitacionId: formData.unidadTipo === 'habitacion' ? formData.habitacionId : undefined,
        modalidad: formData.modalidad,
        inquilino: formData.inquilino,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        rentaMensual: parseEuroInput(formData.rentaMensual) || 0,
        diaPago: parseInt(formData.diaPago) || 1,
        margenGraciaDias: parseInt(formData.margenGraciaDias) || 5,
        indexacion: formData.indexacion,
        indexOtros: formData.indexacion === 'otros' ? formData.indexOtros : undefined,
        historicoIndexaciones: [],
        fianzaMeses: parseInt(formData.fianzaMeses) || 0,
        fianzaImporte: parseEuroInput(formData.fianzaImporte) || 0,
        fianzaEstado: 'retenida',
        cuentaCobroId: formData.cuentaCobroId,
        estadoContrato: 'activo',
        // Legacy fields for backward compatibility
        status: 'active',
        documents: [],
      };

      // Validate contract
      const validationErrors = await validateContract(contractData);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (editingContract) {
        await updateContract(editingContract.id!, contractData);
        toast.success('Contrato actualizado correctamente');
      } else {
        await saveContract(contractData);
        toast.success('Contrato creado correctamente');
      }

      onContractCreated();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('Error al guardar el contrato');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableRooms = (): string[] => {
    if (!selectedProperty) return [];
    
    // Generate room list based on bedrooms (H1, H2, H3, etc.)
    const rooms: string[] = [];
    for (let i = 1; i <= selectedProperty.bedrooms; i++) {
      rooms.push(`H${i}`);
    }
    return rooms;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-brand-navy" />
          <h2 className="text-xl font-semibold text-neutral-900">
            {editingContract ? 'Editar contrato' : 'Nuevo contrato'}
          </h2>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-error-50 border border-error-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-error-800 mb-2">Errores de validación:</h3>
          <ul className="text-sm text-error-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <form id="contract-form" onSubmit={handleSubmit} className="space-y-8">
        {/* Property Selection */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <Building className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Inmueble y unidad</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Inmueble *
              </label>
              <select
                value={formData.inmuebleId}
                onChange={(e) => handlePropertyChange(parseInt(e.target.value))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value="">Seleccionar inmueble</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo de unidad *
              </label>
              <select
                value={formData.unidadTipo}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  unidadTipo: e.target.value as 'vivienda' | 'habitacion',
                  habitacionId: '' // Reset room when changing type
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value="vivienda">Vivienda completa</option>
                <option value="habitacion">Habitación</option>
              </select>
            </div>
          </div>

          {/* Room Selection */}
          {formData.unidadTipo === 'habitacion' && selectedProperty && selectedProperty.bedrooms > 1 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Habitación *
              </label>
              <select
                value={formData.habitacionId}
                onChange={(e) => setFormData(prev => ({ ...prev, habitacionId: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value="">Seleccionar habitación</option>
                {getAvailableRooms().map(room => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Modalidad *
            </label>
            <select
              value={formData.modalidad}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                modalidad: e.target.value as 'habitual' | 'temporada' 
              }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              required
            >
              <option value="habitual">Vivienda habitual</option>
              <option value="temporada">Vivienda de temporada</option>
            </select>
          </div>
        </div>

        {/* Tenant Information */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <User className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Información del inquilino</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.inquilino.nombre}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  inquilino: { ...prev.inquilino, nombre: e.target.value } 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Apellidos *
              </label>
              <input
                type="text"
                value={formData.inquilino.apellidos}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  inquilino: { ...prev.inquilino, apellidos: e.target.value } 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                DNI/NIE *
              </label>
              <input
                type="text"
                value={formData.inquilino.dni}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  inquilino: { ...prev.inquilino, dni: e.target.value } 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Teléfono *
              </label>
              <input
                type="tel"
                value={formData.inquilino.telefono}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  inquilino: { ...prev.inquilino, telefono: e.target.value } 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.inquilino.email}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  inquilino: { ...prev.inquilino, email: e.target.value } 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>
          </div>
        </div>

        {/* Contract Dates */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Fechas del contrato</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha de inicio *
              </label>
              <input
                type="date"
                value={formData.fechaInicio}
                onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha de fin *
              </label>
              <input
                type="date"
                value={formData.fechaFin}
                onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
              {formData.modalidad === 'habitual' && (
                <p className="text-sm text-neutral-500 mt-1">
                  Se calcula automáticamente para contratos habituales (+5 años)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Financial Terms */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <Euro className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Términos económicos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Renta mensual (€) *
              </label>
              <input
                type="text"
                value={formData.rentaMensual}
                onChange={(e) => setFormData(prev => ({ ...prev, rentaMensual: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="650,00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Día de pago *
              </label>
              <select
                value={formData.diaPago}
                onChange={(e) => setFormData(prev => ({ ...prev, diaPago: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    Día {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Margen de gracia (días)
              </label>
              <input
                type="number"
                value={formData.margenGraciaDias}
                onChange={(e) => setFormData(prev => ({ ...prev, margenGraciaDias: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                min="0"
                max="30"
              />
            </div>
          </div>
        </div>

        {/* Indexation */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Indexación</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo de indexación
              </label>
              <select
                value={formData.indexacion}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  indexacion: e.target.value as 'none' | 'ipc' | 'irav' | 'otros' 
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="none">Sin indexación</option>
                <option value="ipc">IPC</option>
                <option value="irav">IRAV</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            {formData.indexacion === 'otros' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fórmula personalizada
                </label>
                <input
                  type="text"
                  value={formData.indexOtros.formula}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    indexOtros: { ...prev.indexOtros, formula: e.target.value } 
                  }))}
                  className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  placeholder="2,5%"
                />
              </div>
            )}
          </div>
        </div>

        {/* Deposit and Bank Account */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Fianza y cuenta de cobro</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Meses de fianza *
              </label>
              <input
                type="number"
                value={formData.fianzaMeses}
                onChange={(e) => setFormData(prev => ({ ...prev, fianzaMeses: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                min="0"
                step="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Importe de fianza (€)
              </label>
              <input
                type="text"
                value={formData.fianzaImporte}
                onChange={(e) => setFormData(prev => ({ ...prev, fianzaImporte: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent bg-neutral-50"
                placeholder="Se calcula automáticamente"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Cuenta de cobro *
              </label>
              {accounts.length === 0 ? (
                <div className="w-full p-3 bg-gray-50 border border-gray-300 rounded-md">
                  <p className="text-sm text-gray-500 mb-2">No hay cuentas disponibles.</p>
                  <button
                    type="button"
                    onClick={() => window.open('/cuenta/cuentas', '_blank')}
                    className="text-sm btn-ghost-horizon underline"
                  >
                    Ir a Cuenta → Configuración → Cuentas Bancarias
                  </button>
                </div>
              ) : (
                <>
                  <select
                    value={formData.cuentaCobroId}
                    onChange={(e) => setFormData(prev => ({ ...prev, cuentaCobroId: parseInt(e.target.value) }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.alias} - {account.banco?.name || 'Banco'} - {account.iban}
                      </option>
                    ))}
                  </select>
                  
                  {/* Show selected account using AccountOption */}
                  {formData.cuentaCobroId && accounts.find(acc => acc.id === formData.cuentaCobroId) && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <AccountOption 
                        account={accounts.find(acc => acc.id === formData.cuentaCobroId)!} 
                        size="sm" 
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="bg-white border-t border-gray-200 mt-8 shadow-sm">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm font-medium btn-primary-horizon hover:bg-navy-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : (editingContract ? 'Actualizar contrato' : 'Crear contrato')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ContractsNuevo;