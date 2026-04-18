// Compact single-screen property form - replaces 5-step wizard
// Fits entirely in one screen without scroll for better UX

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Home } from 'lucide-react';

import { initDB, Property } from '../../services/db';
import { getLocationFromPostalCode, inferLocationFromPostalCodeRange, calculateITP, calculateIVA } from '../../utils/locationUtils';
import { fetchLocationFromAPI } from '../../services/postalCodeApiService';
import { AJD_RATE } from '../../utils/inmuebleUtils';

interface InmuebleFormCompactProps {
  mode: 'create' | 'edit';
  propertyId?: number;
  embedded?: boolean;
  onCancel?: () => void;
  onSaved?: (propertyId: number) => void;
}

interface FormData {
  // Identificación
  alias: string;
  cp: string;
  direccion: string;
  refCatastral: string;

  // Ubicación (editable)
  municipality: string;
  province: string;
  ccaa: string;

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
  impuestosIsManual: boolean;

  // Características
  m2: number;
  habitaciones: number;
  banos: number;
  anioConstruccion: number;
  porcentajePropiedad: number;
  esUrbana: boolean;

  // Fiscal
  valorCatastralTotal: number;
  valorCatastralConstruccion: number;
  cadastralRevised: boolean;
}

const InmuebleFormCompact: React.FC<InmuebleFormCompactProps> = ({ mode, propertyId, embedded = false, onCancel, onSaved }) => {
  const navigate = useNavigate();
  const portfolioRoute = '/inmuebles?tab=cartera';
  const { id } = useParams();
  const resolvedPropertyId = propertyId ?? (id ? parseInt(id, 10) : undefined);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    identificacion: true,
    ubicacion: true,
    compra: true,
    caracteristicas: true
  });
  
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!resolvedPropertyId);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    alias: '',
    cp: '',
    direccion: '',
    refCatastral: '',
    municipality: '',
    province: '',
    ccaa: '',
    fechaCompra: '',
    precioCompra: 0,
    tipo: 'USADA_ITP',
    notaria: 0,
    registro: 0,
    gestoria: 0,
    otros: 0,
    impuestos: 0,
    impuestosIsManual: false,
    m2: 0,
    habitaciones: 0,
    banos: 0,
    anioConstruccion: 0,
    porcentajePropiedad: 100,
    esUrbana: true,
    valorCatastralTotal: 0,
    valorCatastralConstruccion: 0,
    cadastralRevised: false,
  });
  
  // Auto-detected location from postal code
  const [locationInfo, setLocationInfo] = useState<{
    municipality: string;
    province: string;
    ccaa: string;
    isInferred?: boolean;
  } | null>(null);
  
  // Load existing property for edit mode
  useEffect(() => {
    if (mode === 'edit' && resolvedPropertyId) {
      loadProperty(resolvedPropertyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedPropertyId]);

  const loadProperty = async (targetPropertyId: number) => {
    try {
      setIsLoading(true);
      const db = await initDB();
      const property = await db.get('properties', targetPropertyId);
      
      if (!property) {
        toast.error('Inmueble no encontrado');
        if (!embedded) {
          navigate(portfolioRoute);
        }
        return;
      }
      
      // Map Property to FormData
      setFormData({
        alias: property.alias,
        cp: property.postalCode,
        direccion: property.address,
        refCatastral: property.cadastralReference || '',
        municipality: property.municipality || '',
        province: property.province || '',
        ccaa: property.ccaa || '',
        fechaCompra: property.purchaseDate,
        precioCompra: property.acquisitionCosts.price,
        tipo: property.transmissionRegime === 'usada' ? 'USADA_ITP' : 'NUEVA_IVA_AJD',
        notaria: property.acquisitionCosts.notary || 0,
        registro: property.acquisitionCosts.registry || 0,
        gestoria: property.acquisitionCosts.management || 0,
        otros: property.acquisitionCosts.other?.reduce((sum: number, item: { concept: string; amount: number }) => sum + item.amount, 0) || 0,
        impuestos: (property.acquisitionCosts.itp || property.acquisitionCosts.iva || 0),
        impuestosIsManual: property.acquisitionCosts.itpIsManual ?? false,
        m2: property.squareMeters || 0,
        habitaciones: property.bedrooms || 0,
        banos: property.bathrooms || 0,
        anioConstruccion: 0,
        porcentajePropiedad: property.porcentajePropiedad ?? 100,
        esUrbana: property.esUrbana ?? true,
        valorCatastralTotal: property.fiscalData?.cadastralValue || 0,
        valorCatastralConstruccion: property.fiscalData?.constructionCadastralValue || 0,
        cadastralRevised: property.fiscalData?.cadastralRevised ?? false,
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
      if (!embedded) {
        navigate(portfolioRoute);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle postal code change and auto-complete location
  const handleCpChange = async (cp: string) => {
    setFormData(prev => ({ ...prev, cp }));
    
    if (cp.length === 5 && /^\d{5}$/.test(cp)) {
      // 1. Try exact match
      let location = getLocationFromPostalCode(cp);
      let isInferred = false;
      
      // 2. If not found, try external API (future)
      if (!location) {
        const apiResult = await fetchLocationFromAPI(cp);
        if (apiResult) {
          location = {
            province: apiResult.province,
            ccaa: apiResult.ccaa,
            municipalities: [apiResult.municipality]
          };
        }
      }
      
      // 3. If still not found, infer by range
      if (!location) {
        const inferred = inferLocationFromPostalCodeRange(cp);
        if (inferred) {
          location = inferred;
          isInferred = true;
        }
      }
      
      if (location) {
        setLocationInfo({
          municipality: location.municipalities[0] || '',
          province: location.province,
          ccaa: location.ccaa,
          isInferred
        });

        if (isInferred) {
          toast(`Ubicación inferida: ${location.province}. Puedes editarla manualmente.`);
        }

        // Capture ccaa to ensure it's non-null in the callback
        const ccaa = location.ccaa;
        const municipality = location.municipalities[0] || '';
        const province = location.province;

        // Auto-fill ubicación fields (only if empty, don't overwrite user edits)
        setFormData(prevFormData => {
          const next: FormData = {
            ...prevFormData,
            municipality: prevFormData.municipality || municipality,
            province: prevFormData.province || province,
            ccaa: prevFormData.ccaa || ccaa,
          };
          if (next.precioCompra > 0) {
            calculateTaxes(next.precioCompra, next.tipo, ccaa);
          }
          return next;
        });
      } else {
        setLocationInfo(null);
        toast('Código postal no reconocido. Introduce los datos manualmente.');
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
      const ajd = precio * (AJD_RATE / 100); // Use imported constant
      taxAmount = iva + ajd;
    }

    setFormData(prev => {
      // Respetar edición manual: no pisar un valor que el usuario editó.
      if (prev.impuestosIsManual) return prev;
      return { ...prev, impuestos: Math.round(taxAmount * 100) / 100 };
    });
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
    // User-edited ubicación fields win; fallback to auto-detected location,
    // and finally to 'Madrid' for CCAA (most common region) if still empty.
    const ccaaFallback = formData.ccaa || locationInfo?.ccaa || 'Madrid';

    const property: Omit<Property, 'id'> = {
      alias: formData.alias,
      address: formData.direccion || '',
      postalCode: formData.cp,
      municipality: formData.municipality || locationInfo?.municipality || '',
      province: formData.province || locationInfo?.province || '',
      ccaa: ccaaFallback,
      purchaseDate: formData.fechaCompra,
      cadastralReference: formData.refCatastral || undefined,
      squareMeters: formData.m2 || 0,
      bedrooms: formData.habitaciones || 0,
      bathrooms: formData.banos || undefined,
      transmissionRegime: formData.tipo === 'USADA_ITP' ? 'usada' : 'obra-nueva',
      state: 'activo',
      porcentajePropiedad:
        formData.porcentajePropiedad > 0 && formData.porcentajePropiedad <= 100
          ? formData.porcentajePropiedad
          : 100,
      esUrbana: formData.esUrbana,
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
            : undefined,
        cadastralRevised: formData.cadastralRevised,
      }
    };
    
    // Add tax based on type. Persist manual-edit flag only for ITP (usada).
    if (formData.tipo === 'USADA_ITP') {
      property.acquisitionCosts.itp = formData.impuestos;
      if (formData.impuestosIsManual) {
        property.acquisitionCosts.itpIsManual = true;
      }
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
      
      if (mode === 'edit' && resolvedPropertyId) {
        await db.put('properties', { ...propertyData, id: resolvedPropertyId });
        toast.success('Inmueble actualizado correctamente');
        onSaved?.(resolvedPropertyId);
      } else {
        const createdPropertyId = Number(await db.add('properties', propertyData));
        toast.success('Inmueble guardado correctamente');
        onSaved?.(createdPropertyId);
      }

      if (!embedded) {
        navigate(`${portfolioRoute}&refresh=1`);
      }
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Error al guardar el inmueble');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Cancel and go back
  const handleCancel = () => {
    if (embedded) {
      onCancel?.();
      return;
    }

    navigate(portfolioRoute);
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
    <div className={embedded ? '' : 'min-h-screen bg-hz-bg'}>
      <div className={embedded ? '' : 'max-w-5xl mx-auto'}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center">
          <div className="flex items-center space-x-3">
            <Home className="w-6 h-6 text-atlas-blue" />
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === 'edit' ? 'Editar Inmueble' : 'Nuevo Inmueble'}
            </h1>
          </div>
        </div>
        
        {/* Form Content - Compact Layout */}
        <div className={`p-6 space-y-4 ${embedded ? 'inmueble-form-compact' : ''}`}>
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
                {/* Row 1: Alias */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12">
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
                </div>

                {/* Row 2: Dirección + Ref. Catastral */}
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

          {/* Section 2: UBICACIÓN */}
          <section className="border border-gray-200 rounded-lg bg-white">
            <button
              onClick={() => toggleSection('ubicacion')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors section-header"
            >
              <h3 className="font-medium text-gray-900 flex items-center">
                {expandedSections.ubicacion ? (
                  <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 mr-2 text-gray-500" />
                )}
                UBICACIÓN
              </h3>
            </button>

            {expandedSections.ubicacion && (
              <div className="p-4 pt-0 space-y-3">
                {/* Row 1: CP + Municipio + Provincia */}
                <div className="grid grid-cols-12 gap-3">
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
                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Población
                    </label>
                    <input
                      type="text"
                      value={formData.municipality}
                      onChange={(e) => setFormData(prev => ({ ...prev, municipality: e.target.value }))}
                      maxLength={80}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="Madrid"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Provincia
                    </label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                      maxLength={60}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="Madrid"
                    />
                  </div>
                </div>

                {/* Row 2: Comunidad Autónoma */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Comunidad Autónoma
                    </label>
                    <input
                      type="text"
                      value={formData.ccaa}
                      onChange={(e) => setFormData(prev => ({ ...prev, ccaa: e.target.value }))}
                      maxLength={60}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="Comunidad de Madrid"
                    />
                  </div>
                  <div className="col-span-6 flex items-end pb-2">
                    {locationInfo && (
                      <span className={`text-xs ${locationInfo.isInferred ? 'text-orange-500' : 'text-gray-600'}`}>
                        <span aria-hidden="true">{locationInfo.isInferred ? '🔍 ' : '🎯 '}</span>
                        <span>
                          Detectado por CP: {locationInfo.municipality || locationInfo.province}
                        </span>
                        {locationInfo.isInferred && <span className="sr-only">(inferido)</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: COMPRA Y COSTE */}
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
                      step="0.01"
                      value={formData.impuestos || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? 0 : parseFloat(raw) || 0;
                        setFormData(prev => ({
                          ...prev,
                          impuestos: parsed,
                          impuestosIsManual: true,
                        }));
                      }}
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

                {/* Row: % Propiedad + Urbana/Rústica */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      % Propiedad
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={formData.porcentajePropiedad || ''}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        const clamped = Number.isFinite(raw)
                          ? Math.max(0, Math.min(100, raw))
                          : 0;
                        setFormData(prev => ({ ...prev, porcentajePropiedad: clamped }));
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      placeholder="100"
                    />
                  </div>
                  <div className="col-span-9 flex items-end pb-2 space-x-6">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="esUrbana"
                        checked={formData.esUrbana === true}
                        onChange={() => setFormData(prev => ({ ...prev, esUrbana: true }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Urbana</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="esUrbana"
                        checked={formData.esUrbana === false}
                        onChange={() => setFormData(prev => ({ ...prev, esUrbana: false }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Rústica</span>
                    </label>
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

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.cadastralRevised}
                    onChange={(e) => setFormData(prev => ({ ...prev, cadastralRevised: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-gray-700">
                    Valor catastral revisado (Hacienda ha revisado el valor catastral en el último año)
                  </span>
                </label>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer Actions */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between">
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
