import React, { useState, useEffect } from 'react';
import { Building, User, Calendar, Euro, FileText } from 'lucide-react';
import { Property, Contract, initDB } from '../../../../../services/db';
import { saveContract, updateContract, validateContract } from '../../../../../services/contractService';
import { formatEuro, parseEuroInput, parsePercentageInput } from '../../../../../utils/formatUtils';
import FormFooter from '../../../../../components/common/FormFooter';
import toast from 'react-hot-toast';

interface ContractsNuevoProps {
  editingContract?: Contract | null;
  onContractCreated: () => void;
  onCancel: () => void;
}

interface FormData {
  propertyId: number;
  scope: 'full-property' | 'units';
  selectedUnits: string[];
  type: 'vivienda' | 'habitacion';
  tenant: {
    name: string;
    nif: string;
    email: string;
  };
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  noticePeriodDays: string;
  monthlyRent: string;
  paymentDay: string;
  rentUpdate: {
    type: 'none' | 'fixed-percentage' | 'ipc';
    fixedPercentage: string;
    ipcPercentage: string;
  };
  deposit: {
    months: string;
    amount: string;
  };
  additionalGuarantees: string;
  includedServices: {
    electricity: boolean;
    water: boolean;
    gas: boolean;
    internet: boolean;
    cleaning: boolean;
  };
  privateNotes: string;
}

const ContractsNuevo: React.FC<ContractsNuevoProps> = ({ editingContract, onContractCreated, onCancel }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<FormData>({
    propertyId: editingContract?.propertyId || 0,
    scope: editingContract?.scope || 'full-property',
    selectedUnits: editingContract?.selectedUnits || [],
    type: editingContract?.type || 'vivienda',
    tenant: {
      name: editingContract?.tenant?.name || '',
      nif: editingContract?.tenant?.nif || '',
      email: editingContract?.tenant?.email || '',
    },
    startDate: editingContract?.startDate || '',
    endDate: editingContract?.endDate || '',
    isIndefinite: editingContract?.isIndefinite || false,
    noticePeriodDays: editingContract?.noticePeriodDays?.toString() || '',
    monthlyRent: editingContract?.monthlyRent?.toString() || '',
    paymentDay: editingContract?.paymentDay?.toString() || '1',
    rentUpdate: {
      type: editingContract?.rentUpdate?.type || 'none',
      fixedPercentage: editingContract?.rentUpdate?.fixedPercentage?.toString() || '',
      ipcPercentage: editingContract?.rentUpdate?.ipcPercentage?.toString() || '',
    },
    deposit: {
      months: editingContract?.deposit?.months?.toString() || '2',
      amount: editingContract?.deposit?.amount?.toString() || '',
    },
    additionalGuarantees: editingContract?.additionalGuarantees?.toString() || '',
    includedServices: {
      electricity: editingContract?.includedServices?.electricity || false,
      water: editingContract?.includedServices?.water || false,
      gas: editingContract?.includedServices?.gas || false,
      internet: editingContract?.includedServices?.internet || false,
      cleaning: editingContract?.includedServices?.cleaning || false,
    },
    privateNotes: editingContract?.privateNotes || '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  // Load selected property when editing
  useEffect(() => {
    if (editingContract && properties.length > 0) {
      const property = properties.find(p => p.id === editingContract.propertyId);
      if (property) {
        setSelectedProperty(property);
      }
    }
  }, [editingContract, properties]);

  useEffect(() => {
    // Auto-calculate deposit amount when rent or months change
    const monthlyRent = parseEuroInput(formData.monthlyRent);
    const months = parseInt(formData.deposit.months) || 0;
    
    if (monthlyRent && months) {
      const depositAmount = monthlyRent * months;
      setFormData(prev => ({
        ...prev,
        deposit: {
          ...prev.deposit,
          amount: formatEuro(depositAmount),
        },
      }));
    }
  }, [formData.monthlyRent, formData.deposit.months]);

  const loadProperties = async () => {
    try {
      const db = await initDB();
      const data = await db.getAll('properties');
      setProperties(data);
      
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, propertyId: data[0].id || 0 }));
        setSelectedProperty(data[0]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Error al cargar los inmuebles');
    }
  };

  const handlePropertyChange = (propertyId: number) => {
    const property = properties.find(p => p.id === propertyId);
    setSelectedProperty(property || null);
    setFormData(prev => ({
      ...prev,
      propertyId,
      selectedUnits: [],
    }));
  };

  const handleUnitToggle = (unit: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUnits: prev.selectedUnits.includes(unit)
        ? prev.selectedUnits.filter(u => u !== unit)
        : [...prev.selectedUnits, unit],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert form data to contract format
    const monthlyRent = parseEuroInput(formData.monthlyRent);
    const depositAmount = parseEuroInput(formData.deposit.amount);
    const additionalGuarantees = parseEuroInput(formData.additionalGuarantees) || 0;
    const depositMonths = parseInt(formData.deposit.months) || 0;
    const paymentDay = parseInt(formData.paymentDay) || 1;
    const noticePeriodDays = parseInt(formData.noticePeriodDays) || undefined;

    const contract = {
      id: editingContract?.id, // Include ID for editing
      propertyId: formData.propertyId,
      scope: formData.scope,
      selectedUnits: formData.scope === 'units' ? formData.selectedUnits : undefined,
      type: formData.type,
      tenant: {
        name: formData.tenant.name.trim(),
        nif: formData.tenant.nif.trim() || undefined,
        email: formData.tenant.email.trim() || undefined,
      },
      startDate: formData.startDate,
      endDate: formData.isIndefinite ? undefined : formData.endDate,
      isIndefinite: formData.isIndefinite,
      noticePeriodDays,
      monthlyRent: monthlyRent || 0,
      paymentDay,
      periodicity: 'monthly' as const,
      rentUpdate: {
        type: formData.rentUpdate.type,
        fixedPercentage: formData.rentUpdate.type === 'fixed-percentage' 
          ? (parsePercentageInput(formData.rentUpdate.fixedPercentage) || undefined)
          : undefined,
        ipcPercentage: formData.rentUpdate.type === 'ipc' 
          ? (parsePercentageInput(formData.rentUpdate.ipcPercentage) || undefined)
          : undefined,
      },
      deposit: {
        months: depositMonths,
        amount: depositAmount || 0,
      },
      additionalGuarantees: additionalGuarantees > 0 ? additionalGuarantees : undefined,
      includedServices: formData.includedServices,
      privateNotes: formData.privateNotes.trim() || undefined,
      status: 'active' as const,
      documents: [],
    };

    // Validate contract
    const validationErrors = await validateContract(contract);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (editingContract?.id) {
        // Update existing contract
        await updateContract(editingContract.id, contract);
        toast.success('Contrato actualizado correctamente');
      } else {
        // Create new contract
        await saveContract(contract);
        toast.success('Contrato creado correctamente');
      }
      onContractCreated();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error(editingContract?.id ? 'Error al actualizar el contrato' : 'Error al guardar el contrato');
    } finally {
      setLoading(false);
    }
  };

  const renderPropertyUnits = () => {
    if (!selectedProperty || selectedProperty.bedrooms <= 1) {
      return null;
    }

    const units: string[] = [];
    for (let i = 1; i <= selectedProperty.bedrooms; i++) {
      units.push(`H${i}`);
    }

    return (
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Unidades seleccionadas *
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {units.map(unit => (
            <label key={unit} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.selectedUnits.includes(unit)}
                onChange={() => handleUnitToggle(unit)}
                className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
              />
              <span className="ml-2 text-sm text-neutral-700">{unit}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header - No buttons, form pattern */}
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">Errores de validación:</h3>
          <ul className="text-sm text-red-700 space-y-1">
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
            <h3 className="text-lg font-semibold text-neutral-900">Inmueble y ámbito</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Inmueble *
              </label>
              <select
                value={formData.propertyId}
                onChange={(e) => handlePropertyChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value={0}>Seleccionar inmueble</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias} - {property.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'vivienda' | 'habitacion' }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value="vivienda">Vivienda</option>
                <option value="habitacion">Habitación</option>
              </select>
            </div>
          </div>

          {/* Property scope for multi-unit properties */}
          {selectedProperty && selectedProperty.bedrooms > 1 && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Ámbito *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="scope"
                      value="full-property"
                      checked={formData.scope === 'full-property'}
                      onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value as 'full-property' | 'units', selectedUnits: [] }))}
                      className="text-brand-navy focus:ring-brand-navy"
                    />
                    <span className="ml-2 text-sm text-neutral-700">Inmueble completo</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="scope"
                      value="units"
                      checked={formData.scope === 'units'}
                      onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value as 'full-property' | 'units' }))}
                      className="text-brand-navy focus:ring-brand-navy"
                    />
                    <span className="ml-2 text-sm text-neutral-700">Unidades específicas</span>
                  </label>
                </div>
              </div>

              {formData.scope === 'units' && renderPropertyUnits()}
            </div>
          )}
        </div>

        {/* Tenant Information */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <User className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Información del inquilino</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre completo *
              </label>
              <input
                type="text"
                value={formData.tenant.name}
                onChange={(e) => setFormData(prev => ({ ...prev, tenant: { ...prev.tenant, name: e.target.value } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Nombre y apellidos"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                NIF/NIE
              </label>
              <input
                type="text"
                value={formData.tenant.nif}
                onChange={(e) => setFormData(prev => ({ ...prev, tenant: { ...prev.tenant, nif: e.target.value } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="12345678A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.tenant.email}
                onChange={(e) => setFormData(prev => ({ ...prev, tenant: { ...prev.tenant, email: e.target.value } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="email@ejemplo.com"
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha de inicio *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha de fin
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                disabled={formData.isIndefinite}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent disabled:bg-neutral-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Preaviso (días)
              </label>
              <input
                type="number"
                value={formData.noticePeriodDays}
                onChange={(e) => setFormData(prev => ({ ...prev, noticePeriodDays: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="30"
                min="0"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isIndefinite}
                onChange={(e) => setFormData(prev => ({ ...prev, isIndefinite: e.target.checked, endDate: e.target.checked ? '' : prev.endDate }))}
                className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
              />
              <span className="ml-2 text-sm text-neutral-700">Contrato indefinido</span>
            </label>
          </div>
        </div>

        {/* Financial Terms */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <Euro className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Condiciones económicas</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Renta base mensual *
              </label>
              <input
                type="text"
                value={formData.monthlyRent}
                onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="1.200,00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Día de cobro *
              </label>
              <select
                value={formData.paymentDay}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentDay: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>Día {day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Actualización
              </label>
              <select
                value={formData.rentUpdate.type}
                onChange={(e) => setFormData(prev => ({ ...prev, rentUpdate: { ...prev.rentUpdate, type: e.target.value as any } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="none">Sin indexación</option>
                <option value="fixed-percentage">% fijo anual</option>
                <option value="ipc">IPC</option>
              </select>
            </div>
          </div>

          {/* Rent update percentage inputs */}
          {formData.rentUpdate.type === 'fixed-percentage' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Porcentaje fijo anual
              </label>
              <input
                type="text"
                value={formData.rentUpdate.fixedPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, rentUpdate: { ...prev.rentUpdate, fixedPercentage: e.target.value } }))}
                className="w-full md:w-48 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="3,50"
              />
            </div>
          )}

          {formData.rentUpdate.type === 'ipc' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Porcentaje IPC manual
              </label>
              <input
                type="text"
                value={formData.rentUpdate.ipcPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, rentUpdate: { ...prev.rentUpdate, ipcPercentage: e.target.value } }))}
                className="w-full md:w-48 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="2,80"
              />
            </div>
          )}
        </div>

        {/* Deposit and Guarantees */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Fianza y garantías</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Meses de fianza *
              </label>
              <input
                type="number"
                value={formData.deposit.months}
                onChange={(e) => setFormData(prev => ({ ...prev, deposit: { ...prev.deposit, months: e.target.value } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                min="0"
                step="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Importe calculado
              </label>
              <input
                type="text"
                value={formData.deposit.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, deposit: { ...prev.deposit, amount: e.target.value } }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="2.400,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Garantías adicionales
              </label>
              <input
                type="text"
                value={formData.additionalGuarantees}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalGuarantees: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        {/* Included Services */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Servicios incluidos</h3>
          <p className="text-sm text-neutral-600 mb-4">Marque los servicios incluidos en el alquiler (informativo, no afecta cálculos)</p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(formData.includedServices).map(([service, checked]) => (
              <label key={service} className="flex items-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    includedServices: {
                      ...prev.includedServices,
                      [service]: e.target.checked,
                    },
                  }))}
                  className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
                />
                <span className="ml-2 text-sm text-neutral-700 capitalize">
                  {service === 'electricity' ? 'Electricidad' :
                   service === 'water' ? 'Agua' :
                   service === 'gas' ? 'Gas' :
                   service === 'internet' ? 'Internet' :
                   service === 'cleaning' ? 'Limpieza' : service}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Private Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Notas privadas</h3>
          
          <textarea
            value={formData.privateNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, privateNotes: e.target.value }))}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            rows={4}
            placeholder="Notas internas sobre el contrato..."
          />
        </div>
      </form>
      
      {/* Form Footer with actions */}
      <FormFooter
        onSave={() => {
          const form = document.getElementById('contract-form') as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
        onCancel={onCancel}
        saveLabel="Guardar contrato"
        isSubmitting={loading}
      />
    </div>
  );
};

export default ContractsNuevo;