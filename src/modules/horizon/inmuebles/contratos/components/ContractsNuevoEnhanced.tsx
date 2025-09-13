import React, { useState, useEffect } from 'react';
import { Building, User, Calendar, Euro, CreditCard, Info } from 'lucide-react';
import { Property, Contract, Account, initDB } from '../../../../../services/db';
import { 
  saveContract, 
  updateContract, 
  validateContract, 
  suggestIndexation,
  calculateHabitualEndDate,
  calculateDuration
} from '../../../../../services/contractServiceNew';
import { formatEuro, parseEuroInput } from '../../../../../utils/formatUtils';
import FormFooter from '../../../../../components/common/FormFooter';
import toast from 'react-hot-toast';

interface ContractsNuevoEnhancedProps {
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

const ContractsNuevoEnhanced: React.FC<ContractsNuevoEnhancedProps> = ({ 
  editingContract, 
  onContractCreated, 
  onCancel 
}) => {
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
  const [suggestedIndexation, setSuggestedIndexation] = useState<'ipc' | 'irav'>('irav');
  const [showIndexationWarning, setShowIndexationWarning] = useState(false);
  const [calculatedDuration, setCalculatedDuration] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Auto-suggest indexation based on start date
  useEffect(() => {
    if (formData.fechaInicio) {
      const suggested = suggestIndexation(formData.fechaInicio);
      setSuggestedIndexation(suggested);
      
      // Show warning if user selected IPC for contract starting >= 25/05/2023
      const startDate = new Date(formData.fechaInicio);
      const cutoffDate = new Date('2023-05-25');
      if (formData.indexacion === 'ipc' && startDate >= cutoffDate) {
        setShowIndexationWarning(true);
      } else {
        setShowIndexationWarning(false);
      }
      
      // Auto-calculate end date for habitual contracts
      if (formData.modalidad === 'habitual' && !editingContract) {
        const calculatedEndDate = calculateHabitualEndDate(formData.fechaInicio);
        setFormData(prev => ({ ...prev, fechaFin: calculatedEndDate }));
      }
    }
  }, [formData.fechaInicio, formData.indexacion, formData.modalidad, editingContract]);

  // Calculate duration for temporal contracts
  useEffect(() => {
    if (formData.modalidad === 'temporada' && formData.fechaInicio && formData.fechaFin) {
      const duration = calculateDuration(formData.fechaInicio, formData.fechaFin);
      setCalculatedDuration(duration);
    } else {
      setCalculatedDuration('');
    }
  }, [formData.modalidad, formData.fechaInicio, formData.fechaFin]);

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
      
      // Load bank accounts
      const accountsData = await db.getAll('accounts');
      const activeAccounts = accountsData.filter(account => account.isActive);
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

  const handlePropertyChange = (inmuebleId: number) => {
    const property = properties.find(p => p.id === inmuebleId);
    setSelectedProperty(property || null);
    setFormData(prev => ({
      ...prev,
      inmuebleId,
      habitacionId: '', // Reset room selection when property changes
    }));
  };

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

  const formatAccountDisplay = (account: Account): string => {
    const lastFourDigits = account.iban.slice(-4);
    return `${account.name || account.bank} (***${lastFourDigits})`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-error-50 border border-error-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-error-800">
                Errores en el formulario
              </h3>
              <div className="mt-2 text-sm text-error-700">
                <ul role="list" className="list-disc space-y-1 pl-5">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Inquilino */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-atlas-blue" />
          <h3 className="text-lg font-medium text-gray-900">Inquilino</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.inquilino.nombre}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                inquilino: { ...prev.inquilino, nombre: e.target.value }
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="Nombre del inquilino"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellidos *
            </label>
            <input
              type="text"
              value={formData.inquilino.apellidos}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                inquilino: { ...prev.inquilino, apellidos: e.target.value }
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="Apellidos del inquilino"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DNI *
            </label>
            <input
              type="text"
              value={formData.inquilino.dni}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                inquilino: { ...prev.inquilino, dni: e.target.value }
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="DNI del inquilino"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono de contacto *
            </label>
            <input
              type="tel"
              value={formData.inquilino.telefono}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                inquilino: { ...prev.inquilino, telefono: e.target.value }
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="Teléfono del inquilino"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de contacto *
            </label>
            <input
              type="email"
              value={formData.inquilino.email}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                inquilino: { ...prev.inquilino, email: e.target.value }
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="Email del inquilino"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Unidad */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building className="h-5 w-5 text-atlas-blue" />
          <h3 className="text-lg font-medium text-gray-900">Unidad</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inmueble *
            </label>
            <select
              value={formData.inmuebleId}
              onChange={(e) => handlePropertyChange(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value={0}>Seleccionar inmueble</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.alias} - {property.address}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de unidad *
            </label>
            <select
              value={formData.unidadTipo}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                unidadTipo: e.target.value as 'vivienda' | 'habitacion',
                habitacionId: e.target.value === 'vivienda' ? '' : prev.habitacionId
              }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="vivienda">Vivienda completa</option>
              <option value="habitacion">Habitación</option>
            </select>
          </div>
          
          {formData.unidadTipo === 'habitacion' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Habitación *
              </label>
              <select
                value={formData.habitacionId}
                onChange={(e) => setFormData(prev => ({ ...prev, habitacionId: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              >
                <option value="">Seleccionar habitación</option>
                {getAvailableRooms().map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Fechas y modalidad */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-atlas-blue" />
          <h3 className="text-lg font-medium text-gray-900">Fechas y modalidad</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modalidad *
            </label>
            <select
              value={formData.modalidad}
              onChange={(e) => setFormData(prev => ({ ...prev, modalidad: e.target.value as 'habitual' | 'temporada' }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="habitual">Vivienda habitual</option>
              <option value="temporada">Temporada</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={formData.fechaInicio}
              onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de fin *
              {formData.modalidad === 'habitual' && (
                <span className="text-sm text-gray-500 ml-1">
                  (auto +5 años, editable)
                </span>
              )}
            </label>
            <input
              type="date"
              value={formData.fechaFin}
              onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            />
          </div>
          
          {calculatedDuration && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duración
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                {calculatedDuration}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Económico */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Euro className="h-5 w-5 text-atlas-blue" />
          <h3 className="text-lg font-medium text-gray-900">Económico</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Renta mensual *
            </label>
            <input
              type="text"
              value={formData.rentaMensual}
              onChange={(e) => setFormData(prev => ({ ...prev, rentaMensual: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="0,00 €"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Día de pago *
            </label>
            <select
              value={formData.diaPago}
              onChange={(e) => setFormData(prev => ({ ...prev, diaPago: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Margen de gracia (días) *
            </label>
            <input
              type="number"
              value={formData.margenGraciaDias}
              onChange={(e) => setFormData(prev => ({ ...prev, margenGraciaDias: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              min="0"
              max="30"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fianza (meses) *
            </label>
            <input
              type="number"
              value={formData.fianzaMeses}
              onChange={(e) => setFormData(prev => ({ ...prev, fianzaMeses: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              min="0"
              step="0.1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Importe fianza *
            </label>
            <input
              type="text"
              value={formData.fianzaImporte}
              onChange={(e) => setFormData(prev => ({ ...prev, fianzaImporte: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              placeholder="0,00 €"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuenta de cobro *
            </label>
            <select
              value={formData.cuentaCobroId}
              onChange={(e) => setFormData(prev => ({ ...prev, cuentaCobroId: parseInt(e.target.value) }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value={0}>Seleccionar cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatAccountDisplay(account)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 5: Indexación */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-atlas-blue" />
          <h3 className="text-lg font-medium text-gray-900">Indexación</h3>
          <button
            type="button"
            className="ml-2 text-gray-400 hover:text-gray-600"
            title="La indexación se aplica anualmente en el aniversario del contrato"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        
        {formData.fechaInicio && (
          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Sugerencia automática:</strong> Para contratos con inicio{' '}
              {new Date(formData.fechaInicio) < new Date('2023-05-25') ? 'anterior' : 'posterior'} al 25/05/2023,
              se sugiere usar <strong>{suggestedIndexation.toUpperCase()}</strong>
            </p>
          </div>
        )}
        
        {showIndexationWarning && (
          <div className="mb-4 p-3 bg-warn-50 border border-warn-200 rounded-md">
            <p className="text-sm text-warn-700">
              <strong>Advertencia:</strong> Ha seleccionado IPC para un contrato con inicio ≥ 25/05/2023. 
              Se recomienda usar IRAV. ¿Desea continuar?
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de indexación *
            </label>
            <select
              value={formData.indexacion}
              onChange={(e) => setFormData(prev => ({ ...prev, indexacion: e.target.value as any }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="none">Sin indexación</option>
              <option value="ipc">IPC</option>
              <option value="irav">IRAV</option>
              <option value="otros">Otros</option>
            </select>
          </div>
          
          {formData.indexacion === 'otros' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fórmula/Porcentaje
                </label>
                <input
                  type="text"
                  value={formData.indexOtros.formula}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    indexOtros: { ...prev.indexOtros, formula: e.target.value }
                  }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                  placeholder="Ej: 2% anual"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frecuencia
                </label>
                <select
                  value={formData.indexOtros.frecuencia}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    indexOtros: { ...prev.indexOtros, frecuencia: e.target.value }
                  }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                >
                  <option value="anual">Anual</option>
                  <option value="semestral">Semestral</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nota de referencia
                </label>
                <input
                  type="text"
                  value={formData.indexOtros.nota}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    indexOtros: { ...prev.indexOtros, nota: e.target.value }
                  }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                  placeholder="Nota opcional"
                />
              </div>
            </>
          )}
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Nota:</strong> La indexación se aplica anualmente en el aniversario del contrato, 
            sin efecto retroactivo, sólo desde el mes efectivo en adelante.
          </p>
        </div>
      </div>

      {/* Form Footer */}
      <FormFooter
        onCancel={onCancel}
        submitLabel={editingContract ? "Actualizar contrato" : "Crear contrato"}
        isSubmitting={loading}
      />
    </form>
  );
};

export default ContractsNuevoEnhanced;