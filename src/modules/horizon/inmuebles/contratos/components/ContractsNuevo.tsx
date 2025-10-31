import React, { useState, useEffect } from 'react';
import { Building, User, Calendar, Euro, FileText, CreditCard, Signature, TrendingUp } from 'lucide-react';
import { Property, Contract, Account, initDB } from '../../../../../services/db';
import {
  validateContract,
  saveContract,
  updateContract,
  calculateHabitualEndDate,
  calculateRentPeriodsNew,
  RentPeriodNew,
  SignatureStatus
} from '../../../../../services/contractServiceNew';
import { parseEuroInput, formatEuro } from '../../../../../utils/formatUtils';
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
  modalidad: 'habitual' | 'temporada' | 'vacacional';
  
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

  // Document preparation
  documentoContrato: {
    plantilla: 'habitual' | 'temporada' | 'vacacional' | 'habitacion';
    incluirInventario: boolean;
    incluirCertificadoEnergetico: boolean;
    clausulasAdicionales: string;
  };

  // Signature workflow
  firma: {
    metodo: 'digital' | 'manual';
    proveedor: 'signaturit' | 'docusign' | 'adobesign' | 'otro';
    emails: string[];
    enviarCopiaPropietario: boolean;
    emailPropietario: string;
    estado: SignatureStatus;
  };
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
    documentoContrato: {
      plantilla: editingContract?.documentoContrato?.plantilla
        || (editingContract?.unidadTipo === 'habitacion'
          ? 'habitacion'
          : editingContract?.modalidad === 'vacacional'
            ? 'vacacional'
            : editingContract?.modalidad === 'temporada'
              ? 'temporada'
              : 'habitual'),
      incluirInventario: editingContract?.documentoContrato?.incluirInventario ?? true,
      incluirCertificadoEnergetico: editingContract?.documentoContrato?.incluirCertificadoEnergetico ?? false,
      clausulasAdicionales: editingContract?.documentoContrato?.clausulasAdicionales || '',
    },
    firma: {
      metodo: editingContract?.firma?.metodo || 'digital',
      proveedor: editingContract?.firma?.proveedor || 'signaturit',
      emails: editingContract?.firma?.emails?.length
        ? [...editingContract.firma.emails]
        : (editingContract?.inquilino?.email ? [editingContract.inquilino.email] : []),
      enviarCopiaPropietario: editingContract?.firma?.enviarCopiaPropietario ?? true,
      emailPropietario: editingContract?.firma?.emailPropietario || '',
      estado: editingContract?.firma?.estado || 'borrador',
    },
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

  // Keep document template aligned with modality/unit type
  useEffect(() => {
    setFormData(prev => {
      const desiredTemplate = prev.unidadTipo === 'habitacion'
        ? 'habitacion'
        : prev.modalidad === 'vacacional'
          ? 'vacacional'
          : prev.modalidad === 'temporada'
            ? 'temporada'
            : 'habitual';

      if (prev.documentoContrato.plantilla === desiredTemplate) {
        return prev;
      }

      return {
        ...prev,
        documentoContrato: {
          ...prev.documentoContrato,
          plantilla: desiredTemplate,
        },
      };
    });
  }, [formData.unidadTipo, formData.modalidad]);

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
      const primaryEmail = formData.firma.metodo === 'digital'
        ? (formData.firma.emails[0] || formData.inquilino.email)
        : undefined;
      const additionalEmails = formData.firma.metodo === 'digital'
        ? formData.firma.emails.slice(1)
        : [];
      const emails = formData.firma.metodo === 'digital'
        ? [primaryEmail, ...additionalEmails].filter((email): email is string => Boolean(email && email.trim()))
        : [];

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
        historicoIndexaciones: editingContract?.historicoIndexaciones || [],
        fianzaMeses: parseInt(formData.fianzaMeses) || 0,
        fianzaImporte: parseEuroInput(formData.fianzaImporte) || 0,
        fianzaEstado: editingContract?.fianzaEstado || 'retenida',
        cuentaCobroId: formData.cuentaCobroId,
        estadoContrato: editingContract?.estadoContrato || 'activo',
        documentoContrato: {
          plantilla: formData.documentoContrato.plantilla,
          incluirInventario: formData.documentoContrato.incluirInventario,
          incluirCertificadoEnergetico: formData.documentoContrato.incluirCertificadoEnergetico,
          clausulasAdicionales: formData.documentoContrato.clausulasAdicionales?.trim() || undefined,
        },
        firma: {
          metodo: formData.firma.metodo,
          proveedor: formData.firma.metodo === 'digital' ? formData.firma.proveedor : undefined,
          emails,
          enviarCopiaPropietario: formData.firma.enviarCopiaPropietario,
          emailPropietario: formData.firma.emailPropietario?.trim() || undefined,
          estado: editingContract?.firma?.estado || (formData.firma.metodo === 'digital' ? 'preparado' : 'borrador'),
        },
        // Legacy fields for backward compatibility
        status: editingContract?.status || 'active',
        documents: editingContract?.documents || [],
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

  const rentPreview: RentPeriodNew[] = (() => {
    const rentValue = parseEuroInput(formData.rentaMensual);

    if (!formData.inmuebleId || !formData.fechaInicio || !formData.fechaFin || !rentValue) {
      return [];
    }

    try {
      const payload: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> = {
        inmuebleId: formData.inmuebleId,
        unidadTipo: formData.unidadTipo,
        habitacionId: formData.unidadTipo === 'habitacion' ? formData.habitacionId : undefined,
        modalidad: formData.modalidad,
        inquilino: formData.inquilino,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        rentaMensual: rentValue,
        diaPago: parseInt(formData.diaPago) || 1,
        margenGraciaDias: parseInt(formData.margenGraciaDias) || 5,
        indexacion: formData.indexacion,
        indexOtros: formData.indexacion === 'otros' ? formData.indexOtros : undefined,
        historicoIndexaciones: editingContract?.historicoIndexaciones || [],
        fianzaMeses: parseInt(formData.fianzaMeses) || 0,
        fianzaImporte: parseEuroInput(formData.fianzaImporte) || 0,
        fianzaEstado: editingContract?.fianzaEstado || 'retenida',
        cuentaCobroId: formData.cuentaCobroId,
        estadoContrato: editingContract?.estadoContrato || 'activo',
        documentoContrato: {
          plantilla: formData.documentoContrato.plantilla,
          incluirInventario: formData.documentoContrato.incluirInventario,
          incluirCertificadoEnergetico: formData.documentoContrato.incluirCertificadoEnergetico,
          clausulasAdicionales: formData.documentoContrato.clausulasAdicionales?.trim() || undefined,
        },
        firma: {
          metodo: formData.firma.metodo,
          proveedor: formData.firma.metodo === 'digital' ? formData.firma.proveedor : undefined,
          emails: formData.firma.metodo === 'digital'
            ? [
                formData.firma.emails[0] || formData.inquilino.email,
                ...formData.firma.emails.slice(1)
              ].filter((email): email is string => Boolean(email && email.trim()))
            : [],
          enviarCopiaPropietario: formData.firma.enviarCopiaPropietario,
          emailPropietario: formData.firma.emailPropietario?.trim() || undefined,
          estado: formData.firma.estado,
        },
        status: editingContract?.status || 'active',
        documents: editingContract?.documents || [],
      };

      return calculateRentPeriodsNew(payload);
    } catch (error) {
      console.error('Error calculating rent preview:', error);
      return [];
    }
  })();

  const forecastTotal = rentPreview.reduce((sum, period) => sum + period.importe, 0);
  const monthsCovered = rentPreview.length;

  const nextPeriod = (() => {
    const today = new Date();
    return rentPreview.find(period => {
      const [year, month] = period.periodo.split('-');
      const periodDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(formData.diaPago) || 1);
      return periodDate >= today;
    });
  })();

  const formatPeriodLabel = (periodo: string) => {
    const [year, month] = periodo.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
  };

  const additionalEmailsDisplay = formData.firma.emails.slice(1).join(', ');

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
                modalidad: e.target.value as FormData['modalidad']
              }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              required
            >
              <option value="habitual">Vivienda habitual</option>
              <option value="temporada">Vivienda de temporada</option>
              <option value="vacacional">Vivienda vacacional</option>
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
                onChange={(e) => {
                  const newEmail = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    inquilino: { ...prev.inquilino, email: newEmail },
                    firma: {
                      ...prev.firma,
                      emails: prev.firma.metodo === 'digital'
                        ? [newEmail, ...prev.firma.emails.slice(1)]
                        : prev.firma.emails,
                    }
                  }));
                }}
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
                    className="text-sm atlas-atlas-atlas-atlas-btn-ghost-horizon underline"
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

        {/* Document preparation & signature */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center mb-4">
            <Signature className="h-5 w-5 text-brand-navy mr-2" />
            <h3 className="text-lg font-semibold text-neutral-900">Documento y firma</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Plantilla base *
              </label>
              <select
                value={formData.documentoContrato.plantilla}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  documentoContrato: {
                    ...prev.documentoContrato,
                    plantilla: e.target.value as FormData['documentoContrato']['plantilla']
                  }
                }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="habitual">Contrato vivienda habitual</option>
                <option value="temporada">Contrato de temporada</option>
                <option value="vacacional">Contrato vacacional</option>
                <option value="habitacion">Alquiler por habitación</option>
              </select>
              <p className="text-sm text-neutral-500 mt-1">
                Selecciona la plantilla que usaremos para generar el PDF con los datos del contrato.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">Anexos del contrato</label>
              <label className="flex items-center space-x-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={formData.documentoContrato.incluirInventario}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    documentoContrato: {
                      ...prev.documentoContrato,
                      incluirInventario: e.target.checked
                    }
                  }))}
                  className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Incluir inventario e inspección inicial</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={formData.documentoContrato.incluirCertificadoEnergetico}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    documentoContrato: {
                      ...prev.documentoContrato,
                      incluirCertificadoEnergetico: e.target.checked
                    }
                  }))}
                  className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Adjuntar certificado energético y seguro</span>
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cláusulas adicionales
            </label>
            <textarea
              value={formData.documentoContrato.clausulasAdicionales}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                documentoContrato: {
                  ...prev.documentoContrato,
                  clausulasAdicionales: e.target.value
                }
              }))}
              rows={3}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Añade cláusulas personalizadas, horarios de check-in, política de mascotas, etc."
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Método de firma *
              </label>
              <div className="inline-flex rounded-md border border-neutral-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    firma: {
                      ...prev.firma,
                      metodo: 'digital',
                      estado: prev.firma.estado === 'firmado' ? 'firmado' : 'preparado'
                    }
                  }))}
                  className={`px-4 py-2 text-sm font-medium transition ${formData.firma.metodo === 'digital' ? 'bg-brand-navy text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100'}`}
                >
                  Firma digital
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    firma: {
                      ...prev.firma,
                      metodo: 'manual',
                      estado: prev.firma.estado === 'firmado' ? 'firmado' : 'borrador',
                      emails: []
                    }
                  }))}
                  className={`px-4 py-2 text-sm font-medium transition ${formData.firma.metodo === 'manual' ? 'bg-brand-navy text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100'}`}
                >
                  Firma en papel
                </button>
              </div>
              <p className="text-sm text-neutral-500 mt-2">
                Puedes enviar el contrato a firma digital directamente o descargarlo para firmar en persona.
              </p>
            </div>

            {formData.firma.metodo === 'digital' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Proveedor de firma digital *
                </label>
                <select
                  value={formData.firma.proveedor}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    firma: {
                      ...prev.firma,
                      proveedor: e.target.value as FormData['firma']['proveedor']
                    }
                  }))}
                  className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                >
                  <option value="signaturit">Signaturit</option>
                  <option value="docusign">DocuSign</option>
                  <option value="adobesign">Adobe Sign</option>
                  <option value="otro">Otro proveedor</option>
                </select>
              </div>
            )}
          </div>

          {formData.firma.metodo === 'digital' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Emails adicionales en copia (separados por comas)
                </label>
                <input
                  type="text"
                  value={additionalEmailsDisplay}
                  onChange={(e) => {
                    const extras = e.target.value
                      .split(',')
                      .map(email => email.trim())
                      .filter(Boolean);
                    setFormData(prev => ({
                      ...prev,
                      firma: {
                        ...prev.firma,
                        emails: [
                          prev.firma.emails[0] || prev.inquilino.email,
                          ...extras
                        ]
                      }
                    }));
                  }}
                  className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  placeholder="gestoria@empresa.com, administrador@propiedad.com"
                />
                <p className="text-sm text-neutral-500 mt-1">
                  El email del inquilino se añade automáticamente como destinatario principal.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email del propietario para copia
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.firma.enviarCopiaPropietario}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      firma: {
                        ...prev.firma,
                        enviarCopiaPropietario: e.target.checked,
                        emailPropietario: e.target.checked ? prev.firma.emailPropietario : ''
                      }
                    }))}
                    className="rounded border-neutral-300 text-brand-navy focus:ring-brand-navy"
                  />
                  <span className="text-sm text-neutral-700">Enviar copia automática al propietario</span>
                </div>
                {formData.firma.enviarCopiaPropietario && (
                  <input
                    type="email"
                    value={formData.firma.emailPropietario}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      firma: {
                        ...prev.firma,
                        emailPropietario: e.target.value
                      }
                    }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="propietario@atlas.com"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Forecast preview */}
        {rentPreview.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-brand-navy" />
                <h3 className="text-lg font-semibold text-neutral-900">Previsión de ingresos</h3>
              </div>
              <span className="text-sm text-neutral-500">{monthsCovered} meses planificados</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <p className="text-sm text-neutral-500">Total previsto del contrato</p>
                <p className="text-2xl font-semibold text-neutral-900">{formatEuro(forecastTotal)}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <p className="text-sm text-neutral-500">Próximo vencimiento</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {nextPeriod ? formatPeriodLabel(nextPeriod.periodo) : 'Pendiente de fechas'}
                </p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <p className="text-sm text-neutral-500">Renta media mensual</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {formatEuro(monthsCovered ? forecastTotal / monthsCovered : 0)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Periodo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Importe</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {rentPreview.slice(0, 6).map((periodo) => (
                    <tr key={periodo.periodo}>
                      <td className="px-4 py-2 text-sm text-neutral-800">{formatPeriodLabel(periodo.periodo)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-neutral-900">{formatEuro(periodo.importe)}</td>
                      <td className="px-4 py-2 text-sm text-neutral-500">{periodo.notas || (periodo.esProrrata ? 'Periodo prorrateado' : 'Renta completa')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rentPreview.length > 6 && (
                <p className="text-xs text-neutral-500 mt-2">
                  Mostrando los próximos 6 meses. El calendario completo se generará automáticamente en supervisión.
                </p>
              )}
            </div>
          </div>
        )}

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
              className="text-sm font-medium atlas-atlas-atlas-atlas-atlas-btn-primary hover:bg-navy-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
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