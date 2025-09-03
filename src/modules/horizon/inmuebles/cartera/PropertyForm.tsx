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
  parseEuroInput,
  addCurrency
} from '../../../../utils/formatUtils';
import MoneyInput from '../../../../components/common/MoneyInput';
import PropertyImprovements from '../../../../components/fiscalidad/PropertyImprovements';
import toast from 'react-hot-toast';

interface PropertyFormProps {
  mode: 'create' | 'edit';
}

interface FormData {
  alias: string;
  globalAlias: string; // Global alias that can be shared/referenced across properties
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
  // H5: Fiscal auxiliary data
  fiscalData: {
    cadastralValue: string;
    constructionCadastralValue: string;
    acquisitionDate: string;
    contractUse: 'vivienda-habitual' | 'turistico' | 'otros' | '';
    housingReduction: boolean;
    isAccessory: boolean;
    mainPropertyId: string;
    accessoryData: {
      cadastralReference: string;
      acquisitionDate: string;
      cadastralValue: string;
      constructionCadastralValue: string;
    };
  };
  // H9-FISCAL: AEAT Amortization data
  aeatAmortization: {
    acquisitionType: 'onerosa' | 'lucrativa' | 'mixta' | '';
    firstAcquisitionDate: string;
    transmissionDate: string;
    cadastralValue: string;
    constructionCadastralValue: string;
    constructionPercentage: string;
    // Oneroso acquisition
    onerosoAcquisitionAmount: string;
    onerosoAcquisitionExpenses: string;
    // Lucrativo acquisition  
    lucrativoIsdValue: string;
    lucrativoIsdTax: string;
    lucrativoInherentExpenses: string;
    // Special case
    specialCaseType: '' | 'usufructo-temporal' | 'usufructo-vitalicio' | 'diferenciado' | 
                     'parcial-alquiler' | 'cambio-porcentaje' | 'sin-valor-catastral' | 
                     'ultimo-ano' | 'porcentaje-menor';
    usufructoDuration: string;
    maxDeductibleIncome: string;
    rentedPercentage: string;
    estimatedLandPercentage: string;
    customPercentage: string;
    manualAmount: string;
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
    globalAlias: '',
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
    },
    fiscalData: {
      cadastralValue: '',
      constructionCadastralValue: '',
      acquisitionDate: '',
      contractUse: '',
      housingReduction: false,
      isAccessory: false,
      mainPropertyId: '',
      accessoryData: {
        cadastralReference: '',
        acquisitionDate: '',
        cadastralValue: '',
        constructionCadastralValue: ''
      }
    },
    aeatAmortization: {
      acquisitionType: '',
      firstAcquisitionDate: '',
      transmissionDate: '',
      cadastralValue: '',
      constructionCadastralValue: '',
      constructionPercentage: '',
      onerosoAcquisitionAmount: '',
      onerosoAcquisitionExpenses: '',
      lucrativoIsdValue: '',
      lucrativoIsdTax: '',
      lucrativoInherentExpenses: '',
      specialCaseType: '',
      usufructoDuration: '',
      maxDeductibleIncome: '',
      rentedPercentage: '',
      estimatedLandPercentage: '10',
      customPercentage: '',
      manualAmount: ''
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
          globalAlias: property.globalAlias || '', // Use the property directly now
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
          },
          fiscalData: {
            cadastralValue: property.fiscalData?.cadastralValue?.toString() || '',
            constructionCadastralValue: property.fiscalData?.constructionCadastralValue?.toString() || '',
            acquisitionDate: property.fiscalData?.acquisitionDate || '',
            contractUse: property.fiscalData?.contractUse || '',
            housingReduction: property.fiscalData?.housingReduction || false,
            isAccessory: property.fiscalData?.isAccessory || false,
            mainPropertyId: property.fiscalData?.mainPropertyId?.toString() || '',
            accessoryData: {
              cadastralReference: property.fiscalData?.accessoryData?.cadastralReference || '',
              acquisitionDate: property.fiscalData?.accessoryData?.acquisitionDate || '',
              cadastralValue: property.fiscalData?.accessoryData?.cadastralValue?.toString() || '',
              constructionCadastralValue: property.fiscalData?.accessoryData?.constructionCadastralValue?.toString() || ''
            }
          },
          aeatAmortization: {
            acquisitionType: property.aeatAmortization?.acquisitionType || '',
            firstAcquisitionDate: property.aeatAmortization?.firstAcquisitionDate || '',
            transmissionDate: property.aeatAmortization?.transmissionDate || '',
            cadastralValue: property.aeatAmortization?.cadastralValue?.toString() || '',
            constructionCadastralValue: property.aeatAmortization?.constructionCadastralValue?.toString() || '',
            constructionPercentage: property.aeatAmortization?.constructionPercentage?.toString() || '',
            onerosoAcquisitionAmount: property.aeatAmortization?.onerosoAcquisition?.acquisitionAmount?.toString() || '',
            onerosoAcquisitionExpenses: property.aeatAmortization?.onerosoAcquisition?.acquisitionExpenses?.toString() || '',
            lucrativoIsdValue: property.aeatAmortization?.lucrativoAcquisition?.isdValue?.toString() || '',
            lucrativoIsdTax: property.aeatAmortization?.lucrativoAcquisition?.isdTax?.toString() || '',
            lucrativoInherentExpenses: property.aeatAmortization?.lucrativoAcquisition?.inherentExpenses?.toString() || '',
            specialCaseType: property.aeatAmortization?.specialCase?.type || '',
            usufructoDuration: property.aeatAmortization?.specialCase?.usufructoDuration?.toString() || '',
            maxDeductibleIncome: property.aeatAmortization?.specialCase?.maxDeductibleIncome?.toString() || '',
            rentedPercentage: property.aeatAmortization?.specialCase?.rentedPercentage?.toString() || '',
            estimatedLandPercentage: property.aeatAmortization?.specialCase?.estimatedLandPercentage?.toString() || '10',
            customPercentage: property.aeatAmortization?.specialCase?.customPercentage?.toString() || '',
            manualAmount: property.aeatAmortization?.specialCase?.manualAmount?.toString() || ''
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
      // Auto-calculate ITP if we have necessary data (always calculate since we just reset manual state)
      if (formData.ccaa && formData.acquisitionCosts.price) {
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
      // Auto-calculate IVA if we have necessary data (always calculate since we just reset manual state)
      if (formData.acquisitionCosts.price) {
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
    
    // Use precise arithmetic for other costs
    const otherAmounts = formData.acquisitionCosts.other.map(item => parseEuroInput(item.amount)).filter(amount => amount !== null) as number[];
    const other = otherAmounts.length > 0 ? addCurrency(...otherAmounts) : 0;
    
    // Use precise arithmetic for total calculation
    const total = addCurrency(price, tax, notary, registry, management, psi, realEstate, other);
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
        globalAlias: formData.globalAlias.trim() || undefined,
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
        documents: [],
        // AEAT Amortization data
        aeatAmortization: formData.aeatAmortization.acquisitionType ? {
          acquisitionType: formData.aeatAmortization.acquisitionType as 'onerosa' | 'lucrativa' | 'mixta',
          firstAcquisitionDate: formData.aeatAmortization.firstAcquisitionDate,
          transmissionDate: formData.aeatAmortization.transmissionDate || undefined,
          cadastralValue: parseEuroInput(formData.aeatAmortization.cadastralValue) || 0,
          constructionCadastralValue: parseEuroInput(formData.aeatAmortization.constructionCadastralValue) || 0,
          constructionPercentage: parseFloat(formData.aeatAmortization.constructionPercentage) || 0,
          onerosoAcquisition: (formData.aeatAmortization.acquisitionType === 'onerosa' || formData.aeatAmortization.acquisitionType === 'mixta') ? {
            acquisitionAmount: parseEuroInput(formData.aeatAmortization.onerosoAcquisitionAmount) || 0,
            acquisitionExpenses: parseEuroInput(formData.aeatAmortization.onerosoAcquisitionExpenses) || 0
          } : undefined,
          lucrativoAcquisition: (formData.aeatAmortization.acquisitionType === 'lucrativa' || formData.aeatAmortization.acquisitionType === 'mixta') ? {
            isdValue: parseEuroInput(formData.aeatAmortization.lucrativoIsdValue) || 0,
            isdTax: parseEuroInput(formData.aeatAmortization.lucrativoIsdTax) || 0,
            inherentExpenses: parseEuroInput(formData.aeatAmortization.lucrativoInherentExpenses) || 0
          } : undefined,
          specialCase: formData.aeatAmortization.specialCaseType ? {
            type: formData.aeatAmortization.specialCaseType as any,
            usufructoDuration: formData.aeatAmortization.usufructoDuration ? parseInt(formData.aeatAmortization.usufructoDuration) : undefined,
            maxDeductibleIncome: parseEuroInput(formData.aeatAmortization.maxDeductibleIncome) || undefined,
            rentedPercentage: formData.aeatAmortization.rentedPercentage ? parseFloat(formData.aeatAmortization.rentedPercentage) : undefined,
            estimatedLandPercentage: formData.aeatAmortization.estimatedLandPercentage ? parseFloat(formData.aeatAmortization.estimatedLandPercentage) : undefined,
            customPercentage: formData.aeatAmortization.customPercentage ? parseFloat(formData.aeatAmortization.customPercentage) : undefined,
            manualAmount: parseEuroInput(formData.aeatAmortization.manualAmount) || undefined
          } : undefined
        } : undefined
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
                Alias Global
              </label>
              <input
                type="text"
                value={formData.globalAlias}
                onChange={(e) => setFormData(prev => ({ ...prev, globalAlias: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Ej: Portfolio Centro, Inversión 2024"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Alias compartido para agrupar o referenciar inmuebles (opcional)
              </p>
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
                <MoneyInput
                  value={formData.acquisitionCosts.price}
                  onChange={(value) => handlePriceChange(value)}
                  placeholder="250.000,00"
                  error={!!errors['acquisitionCosts.price']}
                  aria-label="Precio de compra en euros"
                />
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
                  <MoneyInput
                    value={formData.acquisitionCosts.itp}
                    onChange={(value) => handleItpChange(value)}
                    placeholder="15.000,00"
                    aria-label="ITP en euros"
                  />
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
                  <MoneyInput
                    value={formData.acquisitionCosts.iva}
                    onChange={(value) => handleIvaChange(value)}
                    placeholder="25.000,00"
                    aria-label="IVA en euros"
                  />
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
                <MoneyInput
                  value={formData.acquisitionCosts.notary}
                  onChange={(value) => handleCostFieldChange('notary', value)}
                  placeholder="1.500,00"
                  aria-label="Gastos de notaría en euros"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Registro
                </label>
                <MoneyInput
                  value={formData.acquisitionCosts.registry}
                  onChange={(value) => handleCostFieldChange('registry', value)}
                  placeholder="800,00"
                  aria-label="Gastos de registro en euros"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Gestoría
                </label>
                <MoneyInput
                  value={formData.acquisitionCosts.management}
                  onChange={(value) => handleCostFieldChange('management', value)}
                  placeholder="600,00"
                  aria-label="Gastos de gestoría en euros"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  PSI (personal shopper)
                </label>
                <MoneyInput
                  value={formData.acquisitionCosts.psi}
                  onChange={(value) => handleCostFieldChange('psi', value)}
                  placeholder="2.000,00"
                  aria-label="Gastos de PSI en euros"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Inmobiliaria
                </label>
                <MoneyInput
                  value={formData.acquisitionCosts.realEstate}
                  onChange={(value) => handleCostFieldChange('realEstate', value)}
                  placeholder="7.500,00"
                  aria-label="Gastos de inmobiliaria en euros"
                />
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
                  <div className="flex-1">
                    <MoneyInput
                      value={item.amount}
                      onChange={(value) => {
                        const newOther = [...formData.acquisitionCosts.other];
                        newOther[index].amount = value;
                        setFormData(prev => ({
                          ...prev,
                          acquisitionCosts: {
                            ...prev.acquisitionCosts,
                            other: newOther
                          }
                        }));
                      }}
                      placeholder="Importe"
                      aria-label={`Importe de ${item.concept || 'otro concepto'}`}
                    />
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

        {/* Amortización AEAT */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-neutral-900">Amortización (AEAT)</h3>
            <div className="group relative">
              <button type="button" className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-medium hover:bg-blue-200 transition-colors">
                i
              </button>
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10 w-80 p-3 bg-neutral-800 text-white text-sm rounded-lg shadow-lg">
                <p className="mb-2"><strong>¿De dónde saco estos datos?</strong></p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Recibo IBI:</strong> Valor catastral (VC) y VC construcción</li>
                  <li>• <strong>Escritura:</strong> Precio y gastos de adquisición</li>
                  <li>• <strong>ISD:</strong> Valor y impuesto satisfecho (herencias/donaciones)</li>
                  <li>• <strong>Facturas:</strong> Mejoras realizadas por año</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Tipo de adquisición */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Tipo de adquisición *
              </label>
              <div className="flex gap-4">
                {[
                  { value: 'onerosa', label: 'Onerosa (compra)' },
                  { value: 'lucrativa', label: 'Lucrativa (herencia/donación)' },
                  { value: 'mixta', label: 'Mixta (ambas)' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      name="acquisitionType"
                      value={option.value}
                      checked={formData.aeatAmortization.acquisitionType === option.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, acquisitionType: e.target.value as any }
                      }))}
                      className="w-4 h-4 text-brand-navy bg-neutral-100 border-neutral-300 focus:ring-brand-navy focus:ring-2"
                    />
                    <span className="ml-2 text-sm text-neutral-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fecha adquisición (primera) *
                </label>
                <input
                  type="date"
                  value={formData.aeatAmortization.firstAcquisitionDate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    aeatAmortization: { ...prev.aeatAmortization, firstAcquisitionDate: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fecha transmisión (si aplica)
                </label>
                <input
                  type="date"
                  value={formData.aeatAmortization.transmissionDate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    aeatAmortization: { ...prev.aeatAmortization, transmissionDate: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                />
              </div>
            </div>

            {/* Valores catastrales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Valor catastral (VC) *
                </label>
                <MoneyInput
                  value={formData.aeatAmortization.cadastralValue}
                  onChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      aeatAmortization: { ...prev.aeatAmortization, cadastralValue: value }
                    }));
                    // Auto-calculate construction percentage
                    const vc = parseEuroInput(value) || 0;
                    const vcc = parseEuroInput(formData.aeatAmortization.constructionCadastralValue) || 0;
                    if (vc > 0 && vcc > 0) {
                      const percentage = ((vcc / vc) * 100).toFixed(2);
                      setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, constructionPercentage: percentage }
                      }));
                    }
                  }}
                  placeholder="150.000,00"
                  aria-label="Valor catastral en euros"
                />
                <p className="text-xs text-neutral-500 mt-1">Del recibo IBI más reciente</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  VC construcción (VCc) *
                </label>
                <MoneyInput
                  value={formData.aeatAmortization.constructionCadastralValue}
                  onChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      aeatAmortization: { ...prev.aeatAmortization, constructionCadastralValue: value }
                    }));
                    // Auto-calculate construction percentage
                    const vc = parseEuroInput(formData.aeatAmortization.cadastralValue) || 0;
                    const vcc = parseEuroInput(value) || 0;
                    if (vc > 0 && vcc > 0) {
                      const percentage = ((vcc / vc) * 100).toFixed(2);
                      setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, constructionPercentage: percentage }
                      }));
                    }
                  }}
                  placeholder="120.000,00"
                  aria-label="Valor catastral construcción en euros"
                />
                <p className="text-xs text-neutral-500 mt-1">Proporcional a la titularidad</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  % Construcción
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.aeatAmortization.constructionPercentage}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    aeatAmortization: { ...prev.aeatAmortization, constructionPercentage: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  placeholder="80,00"
                />
                <p className="text-xs text-neutral-500 mt-1">VCc / VC (auto-calculado)</p>
              </div>
            </div>

            {/* Adquisición onerosa */}
            {(formData.aeatAmortization.acquisitionType === 'onerosa' || formData.aeatAmortization.acquisitionType === 'mixta') && (
              <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                <h4 className="font-medium text-neutral-900 mb-3">Adquisición onerosa</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Importe adquisición
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.onerosoAcquisitionAmount}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, onerosoAcquisitionAmount: value }
                      }))}
                      placeholder="300.000,00"
                      aria-label="Importe adquisición onerosa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Gastos y tributos
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.onerosoAcquisitionExpenses}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, onerosoAcquisitionExpenses: value }
                      }))}
                      placeholder="25.000,00"
                      aria-label="Gastos y tributos adquisición"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Notaría, registro, ITP/IVA, gestoría...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Adquisición lucrativa */}
            {(formData.aeatAmortization.acquisitionType === 'lucrativa' || formData.aeatAmortization.acquisitionType === 'mixta') && (
              <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                <h4 className="font-medium text-neutral-900 mb-3">Adquisición lucrativa</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Valor ISD
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.lucrativoIsdValue}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, lucrativoIsdValue: value }
                      }))}
                      placeholder="250.000,00"
                      aria-label="Valor ISD"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Sin exceder valor de mercado</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Impuesto ISD
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.lucrativoIsdTax}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, lucrativoIsdTax: value }
                      }))}
                      placeholder="15.000,00"
                      aria-label="Impuesto ISD satisfecho"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Gastos inherentes
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.lucrativoInherentExpenses}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, lucrativoInherentExpenses: value }
                      }))}
                      placeholder="2.000,00"
                      aria-label="Gastos inherentes"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Casos especiales */}
            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h4 className="font-medium text-neutral-900 mb-3">Casos especiales (opcional)</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Tipo de caso especial
                  </label>
                  <select
                    value={formData.aeatAmortization.specialCaseType}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      aeatAmortization: { ...prev.aeatAmortization, specialCaseType: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  >
                    <option value="">Ninguno (regla general)</option>
                    <option value="usufructo-temporal">Usufructo temporal</option>
                    <option value="usufructo-vitalicio">Usufructo vitalicio</option>
                    <option value="diferenciado">Suelo y construcción diferenciados</option>
                    <option value="parcial-alquiler">Solo parte del inmueble alquilada</option>
                    <option value="cambio-porcentaje">Cambio porcentaje propiedad en ejercicio</option>
                    <option value="sin-valor-catastral">Sin valor catastral</option>
                    <option value="ultimo-ano">Último año amortización</option>
                    <option value="porcentaje-menor">Porcentaje voluntario &lt; 3%</option>
                  </select>
                </div>

                {/* Campos específicos por tipo de caso especial */}
                {formData.aeatAmortization.specialCaseType === 'usufructo-temporal' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Duración (años)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.aeatAmortization.usufructoDuration}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          aeatAmortization: { ...prev.aeatAmortization, usufructoDuration: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Tope rendimientos íntegros
                      </label>
                      <MoneyInput
                        value={formData.aeatAmortization.maxDeductibleIncome}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          aeatAmortization: { ...prev.aeatAmortization, maxDeductibleIncome: value }
                        }))}
                        placeholder="12.000,00"
                        aria-label="Tope por rendimientos íntegros"
                      />
                    </div>
                  </div>
                )}

                {formData.aeatAmortization.specialCaseType === 'parcial-alquiler' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Porcentaje alquilado (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.aeatAmortization.rentedPercentage}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, rentedPercentage: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                      placeholder="30,00"
                    />
                  </div>
                )}

                {formData.aeatAmortization.specialCaseType === 'sin-valor-catastral' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Estimación suelo (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.aeatAmortization.estimatedLandPercentage}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, estimatedLandPercentage: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                      placeholder="10,00"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Por defecto 10%. Se aplicará 3% sobre el resto (construcción)</p>
                  </div>
                )}

                {formData.aeatAmortization.specialCaseType === 'porcentaje-menor' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Porcentaje deseado (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="3"
                        value={formData.aeatAmortization.customPercentage}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          aeatAmortization: { ...prev.aeatAmortization, customPercentage: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                        placeholder="2,00"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                        <strong>Aviso:</strong> Se guardará 3% para efectos de minoración en futuras ventas
                      </div>
                    </div>
                  </div>
                )}

                {formData.aeatAmortization.specialCaseType && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Importe manual (casos especiales)
                    </label>
                    <MoneyInput
                      value={formData.aeatAmortization.manualAmount}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        aeatAmortization: { ...prev.aeatAmortization, manualAmount: value }
                      }))}
                      placeholder="8.500,00"
                      aria-label="Importe manual para casos especiales"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Solo si no se puede calcular automáticamente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mejoras del inmueble - only show when editing */}
        {mode === 'edit' && id && (
          <PropertyImprovements 
            propertyId={parseInt(id)}
            onImprovementsChange={() => {
              // Optionally refresh fiscal calculations when improvements change
              console.log('Improvements updated for property', id);
            }}
          />
        )}

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