// Compact single-screen property form - replaces 5-step wizard
// Fits entirely in one screen without scroll for better UX

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Home, X } from 'lucide-react';

import { initDB, Property } from '../../services/db';
import { getLocationFromPostalCode, calculateITP, calculateIVA } from '../../utils/locationUtils';

interface InmuebleFormCompactProps {
  mode: 'create' | 'edit';
}

interface FormData {
  // Identificación
  alias: string;
  cp: string;
  direccion: string;
  refCatastral: string;
  
  // Compra
  fechaCompra: string;
  precioCompra: number;
  tipo: 'USADA_ITP' | 'NUEVA_IVA_AJD';
  
  // Gastos
  notaria: number;
  registro: number;
  gestoria: number;
  otros: number;
  impuestos: number;
  
  // Características
  m2: number;
  habitaciones: number;
  banos: number;
  anioConstruccion: number;
  
  // Fiscal
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
}

const InmuebleFormCompact: React.FC<InmuebleFormCompactProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    identificacion: true,
    compra: true,
    caracteristicas: true
  });
  
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!id);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    alias: '',
    cp: '',
    direccion: '',
    refCatastral: '',
    fechaCompra: '',
    precioCompra: 0,
    tipo: 'USADA_ITP',
    notaria: 0,
    registro: 0,
    gestoria: 0,
    otros: 0,
    impuestos: 0,
    m2: 0,
    habitaciones: 0,
    banos: 0,
    anioConstruccion: 0,
    valorCatastralTotal: 0,
    valorCatastralConstruccion: 0
  });
  
  // Auto-detected location from postal code
  const [locationInfo, setLocationInfo] = useState<{
    municipality: string;
    province: string;
    ccaa: string;
  } | null>(null);
  
  // Load existing property for edit mode
  useEffect(() => {
    if (mode === 'edit' && id) {
      loadProperty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);
  
  const loadProperty = async () => {
    try {
      setIsLoading(true);
      const db = await initDB();
      const propertyId = parseInt(id!, 10);
      
      if (isNaN(propertyId)) {
        toast.error('ID de inmueble inválido');
        navigate('/inmuebles/cartera');
        return;
      }
      
      const property = await db.get('properties', propertyId);
      
      if (!property) {
        toast.error('Inmueble no encontrado');
        navigate('/inmuebles/cartera');
        return;
      }
      
      // Map Property to FormData
      setFormData({
        alias: property.alias,
        cp: property.postalCode,
        direccion: property.address,
        refCatastral: property.cadastralReference || '',
        fechaCompra: property.purchaseDate,
        precioCompra: property.acquisitionCosts.price,
        tipo: property.transmissionRegime === 'usada' ? 'USADA_ITP' : 'NUEVA_IVA_AJD',
        notaria: property.acquisitionCosts.notary || 0,
        registro: property.acquisitionCosts.registry || 0,
        gestoria: property.acquisitionCosts.management || 0,
        otros: property.acquisitionCosts.other?.reduce((sum: number, item: { concept: string; amount: number }) => sum + item.amount, 0) || 0,
        impuestos: (property.acquisitionCosts.itp || property.acquisitionCosts.iva || 0),
        m2: property.squareMeters || 0,
        habitaciones: property.bedrooms || 0,
        banos: property.bathrooms || 0,
        anioConstruccion: 0,
        valorCatastralTotal: property.fiscalData?.cadastralValue || 0,
        valorCatastralConstruccion: property.fiscalData?.constructionCadastralValue || 0
      });
      
      // Set location info
      if (property.postalCode) {
        const location = getLocationFromPostalCode(property.postalCode);
        if (location) {
          setLocationInfo({
            municipality: location.municipalities[0] || '',
            province: location.province,
            ccaa: location.ccaa
          });
        }
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Error al cargar el inmueble');
      navigate('/inmuebles/cartera');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle postal code change and auto-complete location
  const handleCpChange = (cp: string) => {
    setFormData(prev => ({ ...prev, cp }));
    
    if (cp.length === 5 && /^\d{5}$/.test(cp)) {
      const location = getLocationFromPostalCode(cp);
      if (location) {
        setLocationInfo({
          municipality: location.municipalities[0] || '',
          province: location.province,
          ccaa: location.ccaa
        });
        
        // Auto-calculate taxes when CP is available
        if (formData.precioCompra > 0) {
          calculateTaxes(formData.precioCompra, formData.tipo, location.ccaa);
        }
      } else {
        setLocationInfo(null);
      }
    } else {
      setLocationInfo(null);
    }
  };
  
  // Calculate taxes based on type and price
  const calculateTaxes = (precio: number, tipo: 'USADA_ITP' | 'NUEVA_IVA_AJD', ccaa: string) => {
    if (precio <= 0 || !ccaa) return;
    
    let taxAmount = 0;
    
    if (tipo === 'USADA_ITP') {
      taxAmount = calculateITP(precio, ccaa);
    } else {
      const iva = calculateIVA(precio);
      const ajd = precio * 0.015; // 1.5% AJD
      taxAmount = iva + ajd;
    }
    
    setFormData(prev => ({ ...prev, impuestos: Math.round(taxAmount * 100) / 100 }));
  };
  
  // Handle price change
  const handlePrecioChange = (precio: number) => {
    setFormData(prev => ({ ...prev, precioCompra: precio }));
    
    if (locationInfo && precio > 0) {
      calculateTaxes(precio, formData.tipo, locationInfo.ccaa);
    }
  };
  
  // Handle type change
  const handleTipoChange = (tipo: 'USADA_ITP' | 'NUEVA_IVA_AJD') => {
    setFormData(prev => ({ ...prev, tipo }));
    
    if (locationInfo && formData.precioCompra > 0) {
      calculateTaxes(formData.precioCompra, tipo, locationInfo.ccaa);
    }
  };
  
  // Calculate total cost
  const calculateTotal = (): number => {
    return (
      formData.precioCompra +
      formData.notaria +
      formData.registro +
      formData.gestoria +
      formData.otros +
      formData.impuestos
    );
  };
  
  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Validate form
  const validate = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!formData.alias.trim()) {
      errors.push('El alias es obligatorio');
    }
    
    if (!/^\d{5}$/.test(formData.cp)) {
      errors.push('El código postal debe tener 5 dígitos');
    }
    
    if (!formData.fechaCompra) {
      errors.push('La fecha de compra es obligatoria');
    }
    
    if (formData.precioCompra <= 0) {
      errors.push('El precio debe ser mayor que 0');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Map form data to Property model
  const mapToProperty = (): Omit<Property, 'id'> => {
    const location = locationInfo || {
      municipality: '',
      province: '',
      ccaa: 'Madrid'
    };
    
    const property: Omit<Property, 'id'> = {
      alias: formData.alias,
      address: formData.direccion || '',
      postalCode: formData.cp,
      municipality: location.municipality,
      province: location.province,
      ccaa: location.ccaa,
      purchaseDate: formData.fechaCompra,
      cadastralReference: formData.refCatastral || undefined,
      squareMeters: formData.m2 || 0,
      bedrooms: formData.habitaciones || 0,
      bathrooms: formData.banos || undefined,
      transmissionRegime: formData.tipo === 'USADA_ITP' ? 'usada' : 'obra-nueva',
      state: 'activo',
      acquisitionCosts: {
        price: formData.precioCompra,
        notary: formData.notaria || 0,
        registry: formData.registro || 0,
        management: formData.gestoria || 0,
        other: formData.otros > 0 ? [{ concept: 'Otros', amount: formData.otros }] : []
      },
      documents: [],
      fiscalData: {
        cadastralValue: formData.valorCatastralTotal || undefined,
        constructionCadastralValue: formData.valorCatastralConstruccion || undefined,
        constructionPercentage: 
          formData.valorCatastralTotal > 0 && formData.valorCatastralConstruccion > 0
            ? (formData.valorCatastralConstruccion / formData.valorCatastralTotal) * 100
            : undefined
      }
    };
    
    // Add tax based on type
    if (formData.tipo === 'USADA_ITP') {
      property.acquisitionCosts.itp = formData.impuestos;
    } else {
      property.acquisitionCosts.iva = formData.impuestos;
    }
    
    return property;
  };
  
  // Save property
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const validation = validate();
      if (!validation.isValid) {
        toast.error(validation.errors[0]);
        return;
      }
      
      const propertyData = mapToProperty();
      const db = await initDB();
      
      if (mode === 'edit' && id) {
        const propertyId = parseInt(id, 10);
        await db.put('properties', { ...propertyData, id: propertyId });
        toast.success('Inmueble actualizado correctamente');
      } else {
        await db.add('properties', propertyData);
        toast.success('Inmueble guardado correctamente');
      }
      
      navigate('/inmuebles/cartera?refresh=1');
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Error al guardar el inmueble');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Cancel and go back
  const handleCancel = () => {
    navigate('/inmuebles/cartera');
  };
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-hz-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-hz-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando datos del inmueble...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-hz-bg">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center space-x-3">
            <Home className="w-6 h-6 text-atlas-blue" />
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === 'edit' ? 'Editar Inmueble' : 'Nuevo Inmueble'}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-atlas-blue text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-atlas-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-gray-700 focus:ring-2 focus:ring-gray-300 rounded-md transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Form Content - Compact Layout */}
        <div className="p-6 space-y-4 inmueble-form-compact">
          {/* Section 1: IDENTIFICACIÓN */}
          <section className="border border-gray-200 rounded-lg bg-white">
            <button
              onClick={() => toggleSection('identificacion')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors section-header"
            >
              <h3 className="font-medium text-gray-900 flex items-center">
                {expandedSections.identificacion ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 mr-2 text-gray-500" />
                )}
                IDENTIFICACIÓN
              </h3>
            </button>
            
            {expandedSections.identificacion && (
              <div className="p-4 pt-0 space-y-3">
                {/* Row 1 */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Alias *
                    </label>
                    <input
                      type="text"
                      value={formData.alias}
                      onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                      maxLength={40}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="Piso Centro"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      CP *
                    </label>
                    <input
                      type="text"
                      value={formData.cp}
                      onChange={(e) => handleCpChange(e.target.value)}
                      maxLength={5}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="28001"
                    />
                  </div>
                  <div className="col-span-3 flex items-end">
                    {locationInfo && (
                      <span className="text-xs text-gray-600 pb-2">
                        {locationInfo.municipality}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Row 2 */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-9">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                      maxLength={100}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="Calle, nº, piso, puerta"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Ref. Catastral
                    </label>
                    <input
                      type="text"
                      value={formData.refCatastral}
                      onChange={(e) => setFormData(prev => ({ ...prev, refCatastral: e.target.value }))}
                      maxLength={20}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
          
          {/* Section 2: COMPRA Y COSTE */}
          <section className="border border-gray-200 rounded-lg bg-white">
            <button
              onClick={() => toggleSection('compra')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors section-header"
            >
              <h3 className="font-medium text-gray-900 flex items-center">
                {expandedSections.compra ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 mr-2 text-gray-500" />
                )}
                COMPRA Y COSTE
              </h3>
            </button>
            
            {expandedSections.compra && (
              <div className="p-4 pt-0 space-y-3">
                {/* Row 1: Fecha, Precio, Tipo */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={formData.fechaCompra}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaCompra: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Precio *
                    </label>
                    <input
                      type="number"
                      value={formData.precioCompra || ''}
                      onChange={(e) => handlePrecioChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="€"
                    />
                  </div>
                  <div className="col-span-4 flex items-end pb-2 space-x-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="USADA_ITP"
                        checked={formData.tipo === 'USADA_ITP'}
                        onChange={(e) => handleTipoChange(e.target.value as any)}
                        className="mr-1"
                      />
                      <span className="text-sm text-gray-700">Usada</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="NUEVA_IVA_AJD"
                        checked={formData.tipo === 'NUEVA_IVA_AJD'}
                        onChange={(e) => handleTipoChange(e.target.value as any)}
                        className="mr-1"
                      />
                      <span className="text-sm text-gray-700">Nueva</span>
                    </label>
                  </div>
                </div>
                
                {/* Separator */}
                <hr className="border-gray-200" />
                
                {/* Row 2: Gastos en línea */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notaría
                    </label>
                    <input
                      type="number"
                      value={formData.notaria || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, notaria: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Registro
                    </label>
                    <input
                      type="number"
                      value={formData.registro || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, registro: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gestoría
                    </label>
                    <input
                      type="number"
                      value={formData.gestoria || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, gestoria: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Otros
                    </label>
                    <input
                      type="number"
                      value={formData.otros || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, otros: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                {/* Row 3: Impuestos y Total */}
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Impuestos
                    </label>
                    <input
                      type="number"
                      value={formData.impuestos || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, impuestos: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="€"
                    />
                  </div>
                  <div className="col-span-8 text-right pb-2">
                    <span className="text-lg font-semibold text-atlas-blue">
                      Total: {formatCurrency(calculateTotal())} €
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
          
          {/* Section 3: CARACTERÍSTICAS Y FISCAL */}
          <section className="border border-gray-200 rounded-lg bg-white">
            <button
              onClick={() => toggleSection('caracteristicas')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors section-header"
            >
              <h3 className="font-medium text-gray-900 flex items-center">
                {expandedSections.caracteristicas ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 mr-2 text-gray-500" />
                )}
                CARACTERÍSTICAS Y FISCAL
              </h3>
            </button>
            
            {expandedSections.caracteristicas && (
              <div className="p-4 pt-0 space-y-3">
                {/* Row 1: Características */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      m²
                    </label>
                    <input
                      type="number"
                      value={formData.m2 || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, m2: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Habitaciones
                    </label>
                    <input
                      type="number"
                      value={formData.habitaciones || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, habitaciones: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Baños
                    </label>
                    <input
                      type="number"
                      value={formData.banos || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, banos: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Año
                    </label>
                    <input
                      type="number"
                      value={formData.anioConstruccion || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, anioConstruccion: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="1990"
                    />
                  </div>
                  <div className="col-span-4">
                    {/* Empty space */}
                  </div>
                </div>
                
                {/* Separator */}
                <hr className="border-gray-200" />
                
                {/* Row 2: Valores catastrales */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Valor Catastral Total
                    </label>
                    <input
                      type="number"
                      value={formData.valorCatastralTotal || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, valorCatastralTotal: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="€"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      V. Cat. Construcción
                    </label>
                    <input
                      type="number"
                      value={formData.valorCatastralConstruccion || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, valorCatastralConstruccion: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="€"
                    />
                  </div>
                  <div className="col-span-4 flex items-end pb-2">
                    {formData.valorCatastralTotal > 0 && formData.valorCatastralConstruccion > 0 && (
                      <span className="text-xs text-gray-500">
                        {((formData.valorCatastralConstruccion / formData.valorCatastralTotal) * 100).toFixed(1)}% construcción
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer Actions */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between sticky bottom-0 shadow-lg">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-atlas-blue text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-atlas-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Guardando...' : 'Guardar Inmueble'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InmuebleFormCompact;
