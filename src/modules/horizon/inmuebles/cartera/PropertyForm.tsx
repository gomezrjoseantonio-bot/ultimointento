import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Property, initDB } from '../../../../services/db';
import { 
  CCAA_LIST, 
  getLocationFromPostalCode, 
  validatePostalCode, 
  calculateITP, 
  calculateIVA,
  getITPRateForCCAA,
  getSpecialRegionWarning,
  formatCadastralReference 
} from '../../../../utils/locationUtils';
import { 
  formatEuro, 
  formatEuroInput,
  parseEuroInput 
} from '../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface PropertyFormProps {
  mode: 'create' | 'edit';
}

interface FormData {
  alias: string;
  address: string;
  postalCode: string;
  province: string;
  municipality: string;
  ccaa: string;
  purchaseDate: string;
  cadastralReference: string;
  squareMeters: string;
  bedrooms: string;
  bathrooms: string;
  transmissionRegime: 'usada' | 'obra-nueva';
  state: 'activo' | 'vendido' | 'baja';
  notes: string;
  acquisitionCosts: {
    price: string;
    itp: string;
    iva: string;
    notary: string;
    registry: string;
    management: string;
    psi: string;
    realEstate: string;
    other: Array<{ concept: string; amount: string; }>;
  };
}

const PropertyForm: React.FC<PropertyFormProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [itpManual, setItpManual] = useState(false);
  const [ivaManual, setIvaManual] = useState(false);
  const [ccaaWarning, setCcaaWarning] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    alias: '',
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '',
    cadastralReference: '',
    squareMeters: '',
    bedrooms: '',
    bathrooms: '',
    transmissionRegime: 'usada',
    state: 'activo',
    notes: '',
    acquisitionCosts: {
      price: '',
      itp: '',
      iva: '',
      notary: '',
      registry: '',
      management: '',
      psi: '',
      realEstate: '',
      other: []
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load property data if editing
  useEffect(() => {
    if (mode === 'edit' && id) {
      loadProperty(parseInt(id));
    }
  }, [mode, id]);

  const loadProperty = async (propertyId: number) => {
    try {
      setLoading(true);
      const db = await initDB();
      const property = await db.get('properties', propertyId);
      
      if (property) {
        setFormData({
          alias: property.alias,
          address: property.address,
          postalCode: property.postalCode,
          province: property.province,
          municipality: property.municipality,
          ccaa: property.ccaa,
          purchaseDate: property.purchaseDate,
          cadastralReference: property.cadastralReference || '',
          squareMeters: property.squareMeters.toString(),
          bedrooms: property.bedrooms.toString(),
          bathrooms: property.bathrooms?.toString() || '',
          transmissionRegime: property.transmissionRegime,
          state: property.state,
          notes: property.notes || '',
          acquisitionCosts: {
            price: property.acquisitionCosts.price.toString(),
            itp: property.acquisitionCosts.itp?.toString() || '',
            iva: property.acquisitionCosts.iva?.toString() || '',
            notary: property.acquisitionCosts.notary?.toString() || '',
            registry: property.acquisitionCosts.registry?.toString() || '',
            management: property.acquisitionCosts.management?.toString() || '',
            psi: property.acquisitionCosts.psi?.toString() || '',
            realEstate: property.acquisitionCosts.realEstate?.toString() || '',
            other: property.acquisitionCosts.other?.map((item: { concept: string; amount: number; }) => ({
              concept: item.concept,
              amount: item.amount.toString()
            })) || []
          }
        });
        setItpManual(property.acquisitionCosts.itpIsManual || false);
        setIvaManual(property.acquisitionCosts.ivaIsManual || false);
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Error al cargar el inmueble');
    } finally {
      setLoading(false);
    }
  };

  // Handle postal code change and auto-fill location
  const handlePostalCodeChange = (value: string) => {
    setFormData(prev => ({ ...prev, postalCode: value }));
    
    if (validatePostalCode(value)) {
      const locationData = getLocationFromPostalCode(value);
      if (locationData) {
        setFormData(prev => ({
          ...prev,
          province: locationData.province,
          municipality: locationData.municipalities[0] || '',
          ccaa: locationData.ccaa
        }));
        
        // Check if current CCAA selection conflicts with postal code
        if (formData.ccaa && formData.ccaa !== locationData.ccaa) {
          setCcaaWarning(`Atención: el CP apunta a ${locationData.ccaa}. Has seleccionado ${formData.ccaa}. Usaremos la CCAA seleccionada para el cálculo del ITP.`);
        } else {
          setCcaaWarning('');
        }
        
        // Recalculate ITP if not manual
        if (!itpManual && formData.transmissionRegime === 'usada' && formData.acquisitionCosts.price) {
          const price = parseEuroInput(formData.acquisitionCosts.price);
          if (price) {
            const newItp = calculateITP(price, locationData.ccaa);
            setFormData(prev => ({
              ...prev,
              acquisitionCosts: {
                ...prev.acquisitionCosts,
                itp: newItp.toString()
              }
            }));
          }
        }
        
        // Recalculate IVA if not manual
        if (!ivaManual && formData.transmissionRegime === 'obra-nueva' && formData.acquisitionCosts.price) {
          const price = parseEuroInput(formData.acquisitionCosts.price);
          if (price) {
            const newIva = calculateIVA(price);
            setFormData(prev => ({
              ...prev,
              acquisitionCosts: {
                ...prev.acquisitionCosts,
                iva: newIva.toString()
              }
            }));
          }
        }
      }
    }
  };

  // Handle CCAA change
  const handleCCAAChange = (value: string) => {
    setFormData(prev => ({ ...prev, ccaa: value }));
    
    // Check warning against postal code
    if (formData.postalCode && validatePostalCode(formData.postalCode)) {
      const locationData = getLocationFromPostalCode(formData.postalCode);
      if (locationData && locationData.ccaa !== value) {
        setCcaaWarning(`Atención: el CP apunta a ${locationData.ccaa}. Has seleccionado ${value}. Usaremos la CCAA seleccionada para el cálculo del ITP.`);
      } else {
        setCcaaWarning('');
      }
    }
    
    // Recalculate ITP if not manual
    if (!itpManual && formData.transmissionRegime === 'usada' && formData.acquisitionCosts.price) {
      const price = parseEuroInput(formData.acquisitionCosts.price);
      if (price) {
        const newItp = calculateITP(price, value);
        setFormData(prev => ({
          ...prev,
          acquisitionCosts: {
            ...prev.acquisitionCosts,
            itp: newItp.toString()
          }
        }));
      }
    }
  };

  // Handle price change and recalculate ITP
  const handlePriceChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        price: value
      }
    }));
    
    const price = parseEuroInput(value);
    if (price && price > 0) {
      // Recalculate ITP if not manual and regime is "usada"
      if (!itpManual && formData.transmissionRegime === 'usada' && formData.ccaa) {
        const newItp = calculateITP(price, formData.ccaa);
        setFormData(prev => ({
          ...prev,
          acquisitionCosts: {
            ...prev.acquisitionCosts,
            itp: newItp.toString()
          }
        }));
      }
      
      // Recalculate IVA if not manual and regime is "obra-nueva"
      if (!ivaManual && formData.transmissionRegime === 'obra-nueva') {
        const newIva = calculateIVA(price);
        setFormData(prev => ({
          ...prev,
          acquisitionCosts: {
            ...prev.acquisitionCosts,
            iva: newIva.toString()
          }
        }));
      }
    }
  };

  // Handle ITP manual edit
  const handleItpChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        itp: value
      }
    }));
    
    // Mark as manual if user edits
    if (!itpManual) {
      setItpManual(true);
    }
  };

  // Handle IVA manual edit
  const handleIvaChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        iva: value
      }
    }));
    
    // Mark as manual if user edits
    if (!ivaManual) {
      setIvaManual(true);
    }
  };

  // Reset ITP to automatic
  const resetItpAutomatic = () => {
    setItpManual(false);
    // Recalculate immediately if we have price and CCAA
    if (formData.transmissionRegime === 'usada' && formData.ccaa && formData.acquisitionCosts.price) {
      const price = parseEuroInput(formData.acquisitionCosts.price);
      if (price && price > 0) {
        const newItp = calculateITP(price, formData.ccaa);
        setFormData(prev => ({
          ...prev,
          acquisitionCosts: {
            ...prev.acquisitionCosts,
            itp: newItp.toString()
          }
        }));
      }
    }
  };

  // Reset IVA to automatic
  const resetIvaAutomatic = () => {
    setIvaManual(false);
    // Recalculate immediately if we have price
    if (formData.transmissionRegime === 'obra-nueva' && formData.acquisitionCosts.price) {
      const price = parseEuroInput(formData.acquisitionCosts.price);
      if (price && price > 0) {
        const newIva = calculateIVA(price);
        setFormData(prev => ({
          ...prev,
          acquisitionCosts: {
            ...prev.acquisitionCosts,
            iva: newIva.toString()
          }
        }));
      }
    }
  };

  // Handle other cost field changes
  const handleCostFieldChange = (field: keyof FormData['acquisitionCosts'], value: string) => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        [field]: value
      }
    }));
  };

  // Handle transmission regime change
  const handleTransmissionRegimeChange = (value: 'usada' | 'obra-nueva') => {
    setFormData(prev => ({ ...prev, transmissionRegime: value }));
    
    // Reset manual states when switching regimes
    if (value === 'usada') {
      setIvaManual(false); // Reset IVA manual state when switching to usada
      // Auto-calculate ITP if we have necessary data
      if (!itpManual && formData.ccaa && formData.acquisitionCosts.price) {
        const price = parseEuroInput(formData.acquisitionCosts.price);
        if (price && price > 0) {
          const newItp = calculateITP(price, formData.ccaa);
          setFormData(prev => ({
            ...prev,
            acquisitionCosts: {
              ...prev.acquisitionCosts,
              itp: newItp.toString()
            }
          }));
        }
      }
    } else if (value === 'obra-nueva') {
      setItpManual(false); // Reset ITP manual state when switching to obra-nueva
      // Auto-calculate IVA if we have necessary data
      if (!ivaManual && formData.acquisitionCosts.price) {
        const price = parseEuroInput(formData.acquisitionCosts.price);
        if (price && price > 0) {
          const newIva = calculateIVA(price);
          setFormData(prev => ({
            ...prev,
            acquisitionCosts: {
              ...prev.acquisitionCosts,
              iva: newIva.toString()
            }
          }));
        }
      }
    }
  };

  // Add other cost item
  const addOtherCost = () => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        other: [...prev.acquisitionCosts.other, { concept: '', amount: '' }]
      }
    }));
  };

  // Remove other cost item
  const removeOtherCost = (index: number) => {
    setFormData(prev => ({
      ...prev,
      acquisitionCosts: {
        ...prev.acquisitionCosts,
        other: prev.acquisitionCosts.other.filter((_, i) => i !== index)
      }
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const price = parseEuroInput(formData.acquisitionCosts.price) || 0;
    const tax = formData.transmissionRegime === 'usada' 
      ? (parseEuroInput(formData.acquisitionCosts.itp) || 0)
      : (parseEuroInput(formData.acquisitionCosts.iva) || 0);
    const notary = parseEuroInput(formData.acquisitionCosts.notary) || 0;
    const registry = parseEuroInput(formData.acquisitionCosts.registry) || 0;
    const management = parseEuroInput(formData.acquisitionCosts.management) || 0;
    const psi = parseEuroInput(formData.acquisitionCosts.psi) || 0;
    const realEstate = parseEuroInput(formData.acquisitionCosts.realEstate) || 0;
    const other = formData.acquisitionCosts.other.reduce((sum, item) => {
      return sum + (parseEuroInput(item.amount) || 0);
    }, 0);
    
    const total = price + tax + notary + registry + management + psi + realEstate + other;
    const squareMeters = parseFloat(formData.squareMeters) || 0;
    const pricePerSqm = squareMeters > 0 ? total / squareMeters : 0;
    
    return { total, pricePerSqm };
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.alias.trim()) {
      newErrors.alias = 'El alias es obligatorio';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es obligatoria';
    }
    
    if (!validatePostalCode(formData.postalCode)) {
      newErrors.postalCode = 'Código postal debe tener 5 dígitos';
    }
    
    if (!formData.province.trim()) {
      newErrors.province = 'La provincia es obligatoria';
    }
    
    if (!formData.municipality.trim()) {
      newErrors.municipality = 'El municipio es obligatorio';
    }
    
    if (!formData.ccaa.trim()) {
      newErrors.ccaa = 'La CCAA es obligatoria';
    }
    
    if (!formData.purchaseDate) {
      newErrors.purchaseDate = 'La fecha de compra es obligatoria';
    } else {
      const purchaseDate = new Date(formData.purchaseDate);
      if (purchaseDate > new Date()) {
        newErrors.purchaseDate = 'La fecha de compra no puede ser futura';
      }
    }
    
    const squareMeters = parseFloat(formData.squareMeters);
    if (!squareMeters || squareMeters <= 0) {
      newErrors.squareMeters = 'La superficie debe ser mayor que 0';
    }
    
    const bedrooms = parseInt(formData.bedrooms);
    if (!bedrooms || bedrooms < 1) {
      newErrors.bedrooms = 'Las habitaciones deben ser al menos 1';
    }
    
    const bathrooms = formData.bathrooms ? parseInt(formData.bathrooms) : 0;
    if (formData.bathrooms && (isNaN(bathrooms) || bathrooms < 0)) {
      newErrors.bathrooms = 'Los baños deben ser 0 o mayor';
    }
    
    const price = parseEuroInput(formData.acquisitionCosts.price);
    if (!price || price < 0) {
      newErrors['acquisitionCosts.price'] = 'El precio de compra es obligatorio y debe ser mayor o igual a 0';
    }
    
    if (formData.cadastralReference && formData.cadastralReference.length > 0) {
      const formatted = formatCadastralReference(formData.cadastralReference);
      if (formatted.length !== 20) {
        newErrors.cadastralReference = 'La referencia catastral debe tener exactamente 20 caracteres alfanuméricos';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrige los errores en el formulario');
      return;
    }
    
    try {
      setLoading(true);
      
      const price = parseEuroInput(formData.acquisitionCosts.price) || 0;
      const itp = formData.transmissionRegime === 'usada' ? (parseEuroInput(formData.acquisitionCosts.itp) || 0) : undefined;
      const iva = formData.transmissionRegime === 'obra-nueva' ? (parseEuroInput(formData.acquisitionCosts.iva) || 0) : undefined;
      
      const property: Property = {
        alias: formData.alias.trim(),
        address: formData.address.trim(),
        postalCode: formData.postalCode,
        province: formData.province.trim(),
        municipality: formData.municipality.trim(),
        ccaa: formData.ccaa,
        purchaseDate: formData.purchaseDate,
        cadastralReference: formData.cadastralReference ? formatCadastralReference(formData.cadastralReference) : undefined,
        squareMeters: parseFloat(formData.squareMeters),
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        transmissionRegime: formData.transmissionRegime,
        state: formData.state,
        notes: formData.notes.trim() || undefined,
        acquisitionCosts: {
          price,
          itp,
          itpIsManual: formData.transmissionRegime === 'usada' ? itpManual : undefined,
          iva,
          ivaIsManual: formData.transmissionRegime === 'obra-nueva' ? ivaManual : undefined,
          notary: parseEuroInput(formData.acquisitionCosts.notary) || undefined,
          registry: parseEuroInput(formData.acquisitionCosts.registry) || undefined,
          management: parseEuroInput(formData.acquisitionCosts.management) || undefined,
          psi: parseEuroInput(formData.acquisitionCosts.psi) || undefined,
          realEstate: parseEuroInput(formData.acquisitionCosts.realEstate) || undefined,
          other: formData.acquisitionCosts.other
            .filter(item => item.concept.trim() && parseEuroInput(item.amount))
            .map(item => ({
              concept: item.concept.trim(),
              amount: parseEuroInput(item.amount) || 0
            }))
        },
        documents: []
      };
      
      const db = await initDB();
      
      if (mode === 'edit' && id) {
        property.id = parseInt(id);
        await db.put('properties', property);
        toast.success('Inmueble actualizado correctamente');
      } else {
        await db.add('properties', property);
        toast.success('Inmueble creado correctamente');
      }
      
      navigate('/inmuebles/cartera');
      
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Error al guardar el inmueble');
    } finally {
      setLoading(false);
    }
  };

  const { total, pricePerSqm } = calculateTotals();

  if (loading && mode === 'edit') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-neutral-600">Cargando inmueble...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/inmuebles/cartera')}
            className="p-2 text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {mode === 'edit' ? 'Editar inmueble' : 'Nuevo inmueble'}
            </h1>
            <p className="text-neutral-600">
              {mode === 'edit' ? 'Modifica los datos del inmueble' : 'Registra un nuevo activo inmobiliario'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identificación y ubicación */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Identificación y ubicación</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Alias *
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.alias ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="Ej: Piso Centro Madrid"
              />
              {errors.alias && (
                <p className="text-sm text-red-600 mt-1">{errors.alias}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Dirección *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.address ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="Ej: Calle Gran Vía, 123, 2º A"
              />
              {errors.address && (
                <p className="text-sm text-red-600 mt-1">{errors.address}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Código Postal *
              </label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => handlePostalCodeChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.postalCode ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="28001"
                maxLength={5}
              />
              {errors.postalCode && (
                <p className="text-sm text-red-600 mt-1">{errors.postalCode}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Provincia *
              </label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.province ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="Madrid"
              />
              {errors.province && (
                <p className="text-sm text-red-600 mt-1">{errors.province}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Municipio/Población *
              </label>
              <input
                type="text"
                value={formData.municipality}
                onChange={(e) => setFormData(prev => ({ ...prev, municipality: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.municipality ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="Madrid"
              />
              {errors.municipality && (
                <p className="text-sm text-red-600 mt-1">{errors.municipality}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Comunidad Autónoma *
              </label>
              <select
                value={formData.ccaa}
                onChange={(e) => handleCCAAChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.ccaa ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
              >
                <option value="">Selecciona CCAA</option>
                {CCAA_LIST.map(ccaa => (
                  <option key={ccaa.name} value={ccaa.name}>
                    {ccaa.name}
                  </option>
                ))}
              </select>
              {errors.ccaa && (
                <p className="text-sm text-red-600 mt-1">{errors.ccaa}</p>
              )}
              {ccaaWarning && (
                <p className="text-sm text-amber-600 mt-1">{ccaaWarning}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha de compra *
              </label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.purchaseDate ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
              />
              {errors.purchaseDate && (
                <p className="text-sm text-red-600 mt-1">{errors.purchaseDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Referencia catastral
              </label>
              <input
                type="text"
                value={formData.cadastralReference}
                onChange={(e) => setFormData(prev => ({ ...prev, cadastralReference: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.cadastralReference ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="0654104TP7005S0003YY"
                maxLength={20}
              />
              {errors.cadastralReference && (
                <p className="text-sm text-red-600 mt-1">{errors.cadastralReference}</p>
              )}
              <p className="text-xs text-neutral-500 mt-1">20 caracteres alfanuméricos</p>
            </div>
          </div>
        </div>

        {/* Superficie y composición */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Superficie y composición</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Superficie (m²) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.squareMeters}
                onChange={(e) => setFormData(prev => ({ ...prev, squareMeters: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.squareMeters ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="75.5"
              />
              {errors.squareMeters && (
                <p className="text-sm text-red-600 mt-1">{errors.squareMeters}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Habitaciones *
              </label>
              <input
                type="number"
                min="1"
                value={formData.bedrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.bedrooms ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="3"
              />
              {errors.bedrooms && (
                <p className="text-sm text-red-600 mt-1">{errors.bedrooms}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Baños
              </label>
              <input
                type="number"
                min="0"
                value={formData.bathrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.bathrooms ? 'border-red-300' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                placeholder="2"
              />
              {errors.bathrooms && (
                <p className="text-sm text-red-600 mt-1">{errors.bathrooms}</p>
              )}
            </div>
          </div>
        </div>

        {/* Costes de adquisición */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Costes de adquisición</h3>
          
          <div className="space-y-4">
            {/* Régimen de transmisión */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Régimen de transmisión *
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="transmissionRegime"
                    value="usada"
                    checked={formData.transmissionRegime === 'usada'}
                    onChange={(e) => handleTransmissionRegimeChange(e.target.value as 'usada' | 'obra-nueva')}
                    className="mr-2 text-brand-navy focus:ring-brand-navy"
                  />
                  Vivienda usada (ITP)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="transmissionRegime"
                    value="obra-nueva"
                    checked={formData.transmissionRegime === 'obra-nueva'}
                    onChange={(e) => handleTransmissionRegimeChange(e.target.value as 'usada' | 'obra-nueva')}
                    className="mr-2 text-brand-navy focus:ring-brand-navy"
                  />
                  Obra nueva (IVA)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Precio de compra */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Precio de compra *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    onBlur={(e) => {
                      const formatted = formatEuroInput(e.target.value);
                      if (formatted !== e.target.value) {
                        handlePriceChange(formatted);
                      }
                    }}
                    className={`w-full px-3 py-2 pr-8 border rounded-md text-right ${
                      errors['acquisitionCosts.price'] ? 'border-red-300' : 'border-neutral-300'
                    } focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent`}
                    placeholder="250.000,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
                {errors['acquisitionCosts.price'] && (
                  <p className="text-sm text-red-600 mt-1">{errors['acquisitionCosts.price']}</p>
                )}
              </div>

              {/* ITP (visible si "Usada") */}
              {formData.transmissionRegime === 'usada' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      ITP {itpManual && <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded text-xs ml-2">Manual</span>}
                    </label>
                    {itpManual && (
                      <button
                        type="button"
                        onClick={resetItpAutomatic}
                        className="text-xs text-brand-navy hover:text-brand-navy/80 underline"
                      >
                        Restablecer automático
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.acquisitionCosts.itp}
                      onChange={(e) => handleItpChange(e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatEuroInput(e.target.value);
                        if (formatted !== e.target.value) {
                          handleItpChange(formatted);
                        }
                      }}
                      className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-right"
                      placeholder="15.000,00"
                    />
                    <span className="absolute right-3 top-2 text-neutral-500">€</span>
                  </div>
                  {formData.ccaa && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Tipo aplicado: {getITPRateForCCAA(formData.ccaa)}% en {formData.ccaa}. Puedes modificarlo.
                    </p>
                  )}
                </div>
              )}

              {/* IVA (visible si "Obra nueva") */}
              {formData.transmissionRegime === 'obra-nueva' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700">
                      IVA {ivaManual && <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded text-xs ml-2">Manual</span>}
                    </label>
                    {ivaManual && (
                      <button
                        type="button"
                        onClick={resetIvaAutomatic}
                        className="text-xs text-brand-navy hover:text-brand-navy/80 underline"
                      >
                        Restablecer automático
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.acquisitionCosts.iva}
                      onChange={(e) => handleIvaChange(e.target.value)}
                      onBlur={(e) => {
                        const formatted = formatEuroInput(e.target.value);
                        if (formatted !== e.target.value) {
                          handleIvaChange(formatted);
                        }
                      }}
                      className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-right"
                      placeholder="25.000,00"
                    />
                    <span className="absolute right-3 top-2 text-neutral-500">€</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Tipo aplicado: 10% (obra nueva). Puedes modificarlo.
                  </p>
                  {formData.ccaa && getSpecialRegionWarning(formData.ccaa) && (
                    <p className="text-xs text-orange-600 mt-1">
                      {getSpecialRegionWarning(formData.ccaa)}
                    </p>
                  )}
                </div>
              )}

              {/* Otros costes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notaría
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.notary}
                    onChange={(e) => handleCostFieldChange('notary', e.target.value)}
                    onBlur={(e) => {
                      const formatted = formatEuroInput(e.target.value);
                      if (formatted !== e.target.value) {
                        handleCostFieldChange('notary', formatted);
                      }
                    }}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-right"
                    placeholder="1.500,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Registro
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.registry}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      acquisitionCosts: {
                        ...prev.acquisitionCosts,
                        registry: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="800,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Gestoría
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.management}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      acquisitionCosts: {
                        ...prev.acquisitionCosts,
                        management: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="600,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  PSI (personal shopper)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.psi}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      acquisitionCosts: {
                        ...prev.acquisitionCosts,
                        psi: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="2.000,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Inmobiliaria
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.acquisitionCosts.realEstate}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      acquisitionCosts: {
                        ...prev.acquisitionCosts,
                        realEstate: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="7.500,00"
                  />
                  <span className="absolute right-3 top-2 text-neutral-500">€</span>
                </div>
              </div>
            </div>

            {/* Otros (varios conceptos) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Otros
                </label>
                <button
                  type="button"
                  onClick={addOtherCost}
                  className="flex items-center text-sm text-brand-navy hover:text-brand-navy/80"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Añadir concepto
                </button>
              </div>
              
              {formData.acquisitionCosts.other.map((item, index) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={item.concept}
                    onChange={(e) => {
                      const newOther = [...formData.acquisitionCosts.other];
                      newOther[index].concept = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        acquisitionCosts: {
                          ...prev.acquisitionCosts,
                          other: newOther
                        }
                      }));
                    }}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    placeholder="Concepto"
                  />
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={item.amount}
                      onChange={(e) => {
                        const newOther = [...formData.acquisitionCosts.other];
                        newOther[index].amount = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          acquisitionCosts: {
                            ...prev.acquisitionCosts,
                            other: newOther
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                      placeholder="Importe"
                    />
                    <span className="absolute right-3 top-2 text-neutral-500">€</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOtherCost(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>Coste adquisición total:</span>
                <span>{formatEuro(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-600">
                <span>€/m²:</span>
                <span>{formatEuro(pricePerSqm)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Estado y notas */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Estado y notas</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estado
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value as 'activo' | 'vendido' | 'baja' }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="activo">Activo</option>
                <option value="vendido">Vendido</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Notas (privadas)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Notas adicionales sobre el inmueble..."
              />
            </div>
          </div>
        </div>

        {/* Form actions */}
        <div className="flex justify-end items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/inmuebles/cartera')}
            className="px-4 py-2 text-neutral-600 border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : (mode === 'edit' ? 'Actualizar inmueble' : 'Crear inmueble')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PropertyForm;