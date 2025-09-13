// Main 4-step wizard component for property creation/editing
// Following Horizon design system and specifications

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import InmuebleWizardLayout from './InmuebleWizardLayout';
import Step1Identificacion from './Step1Identificacion';
import Step2Caracteristicas from './Step2Caracteristicas';
import Step3Coste from './Step3Coste';
import Step4Fiscalidad from './Step4Fiscalidad';
import InmuebleResumen from './InmuebleResumen';

import { 
  Inmueble, 
  InmuebleStep1, 
  InmuebleStep2, 
  InmuebleStep3, 
  InmuebleStep4,
  EstadoInmueble,
  ComplecionStatus
} from '../../types/inmueble';
import { initDB, Property } from '../../services/db';
import { calculateCompletionStatus, validateForSave } from '../../utils/inmuebleUtils';
import { mapInmuebleToProperty, mapPropertyToInmueble } from '../../utils/propertyMapper';

interface InmuebleWizardProps {
  mode: 'create' | 'edit' | 'duplicate';
}

const InmuebleWizard: React.FC<InmuebleWizardProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!id);

  // Form data state
  const [step1Data, setStep1Data] = useState<InmuebleStep1>({
    alias: '',
    direccion: {
      calle: '',
      numero: '',
      piso: '',
      puerta: '',
      cp: '',
      municipio: '',
      provincia: '',
      ca: 'Madrid'
    },
    ref_catastral: '',
    estado: 'ACTIVO' as EstadoInmueble
  });

  const [step2Data, setStep2Data] = useState<InmuebleStep2>({
    caracteristicas: {
      m2: 0,
      habitaciones: 0,
      banos: 0,
      anio_construccion: undefined
    }
  });

  const [step3Data, setStep3Data] = useState<InmuebleStep3>({
    compra: {
      fecha_compra: '',
      regimen: 'USADA_ITP',
      precio_compra: 0,
      gastos: {
        notaria: 0,
        registro: 0,
        gestoria: 0,
        inmobiliaria: 0,
        psi: 0,
        otros: 0
      },
      impuestos: {},
      total_gastos: 0,
      total_impuestos: 0,
      coste_total_compra: 0,
      eur_por_m2: 0
    }
  });

  const [step4Data, setStep4Data] = useState<InmuebleStep4>({
    fiscalidad: {
      valor_catastral_total: 0,
      valor_catastral_construccion: 0,
      porcentaje_construccion: 0,
      tipo_adquisicion: 'LUCRATIVA_ONEROSA',
      metodo_amortizacion: 'REGLA_GENERAL_3',
      amortizacion_anual_base: 0,
      porcentaje_amortizacion_info: 3.0000,
      nota: ''
    }
  });

  const loadInmuebleData = useCallback(async (inmuebleId: string) => {
    try {
      setIsLoading(true);
      const db = await initDB();
      const propertyId = parseInt(inmuebleId, 10);
      
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

      // Convert Property to Inmueble format
      const inmueble = mapPropertyToInmueble(property);

      // Populate form data
      setStep1Data({
        alias: inmueble.alias || '',
        direccion: inmueble.direccion || {
          calle: '',
          numero: '',
          piso: '',
          puerta: '',
          cp: '',
          municipio: '',
          provincia: '',
          ca: 'Madrid'
        },
        ref_catastral: inmueble.ref_catastral || '',
        estado: inmueble.estado || 'ACTIVO'
      });

      setStep2Data({
        caracteristicas: inmueble.caracteristicas || {
          m2: 0,
          habitaciones: 0,
          banos: 0,
          anio_construccion: undefined
        }
      });

      setStep3Data({
        compra: inmueble.compra || {
          fecha_compra: '',
          regimen: 'USADA_ITP',
          precio_compra: 0,
          gastos: {
            notaria: 0,
            registro: 0,
            gestoria: 0,
            inmobiliaria: 0,
            psi: 0,
            otros: 0
          },
          impuestos: {},
          total_gastos: 0,
          total_impuestos: 0,
          coste_total_compra: 0,
          eur_por_m2: 0
        }
      });

      setStep4Data({
        fiscalidad: inmueble.fiscalidad || {
          valor_catastral_total: 0,
          valor_catastral_construccion: 0,
          porcentaje_construccion: 0,
          tipo_adquisicion: 'LUCRATIVA_ONEROSA',
          metodo_amortizacion: 'REGLA_GENERAL_3',
          amortizacion_anual_base: 0,
          porcentaje_amortizacion_info: 3.0000,
          nota: ''
        }
      });

    } catch (error) {
      console.error('Error loading inmueble:', error);
      toast.error('Error al cargar los datos del inmueble');
      navigate('/inmuebles/cartera');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Load existing data for edit mode
  useEffect(() => {
    if (mode === 'edit' && id) {
      loadInmuebleData(id);
    }
  }, [mode, id, loadInmuebleData]);

  // Combine all data for calculations and summary
  const getCombinedData = (): Partial<Inmueble> => {
    return {
      ...step1Data,
      ...step2Data,
      ...step3Data,
      ...step4Data
    } as Partial<Inmueble>;
  };

  // Calculate completion status for each step
  const getStepStatus = (): {
    identificacion_status: ComplecionStatus;
    caracteristicas_status: ComplecionStatus;
    compra_status: ComplecionStatus;
    fiscalidad_status: ComplecionStatus;
  } => {
    return calculateCompletionStatus(getCombinedData());
  };

  // Define wizard steps
  const getWizardSteps = () => {
    const completionStatus = getStepStatus();
    
    return [
      {
        id: 1,
        title: 'Identificación',
        status: completionStatus.identificacion_status,
        isActive: currentStep === 1,
        isCompleted: currentStep > 1
      },
      {
        id: 2,
        title: 'Características',
        status: completionStatus.caracteristicas_status,
        isActive: currentStep === 2,
        isCompleted: currentStep > 2
      },
      {
        id: 3,
        title: 'Coste',
        status: completionStatus.compra_status,
        isActive: currentStep === 3,
        isCompleted: currentStep > 3
      },
      {
        id: 4,
        title: 'Fiscalidad',
        status: completionStatus.fiscalidad_status,
        isActive: currentStep === 4,
        isCompleted: currentStep > 4
      }
    ];
  };

  // Navigation functions
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Save inmueble
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const combinedData = getCombinedData();
      
      // Validate MVP minimum requirements before saving
      const validation = validateForSave(combinedData);
      if (!validation.isValid) {
        // Show individual field errors
        validation.errors.forEach(error => {
          console.error('Validation error:', error);
        });
        
        toast.error(`Faltan datos obligatorios: ${validation.errors.join(', ')}`);
        setIsSaving(false);
        return;
      }
      
      // Convert Inmueble data to Property format for IndexedDB
      const propertyData = mapInmuebleToProperty(combinedData);
      
      // Add createdAt timestamp for proper sorting (remove unused variable)
      const db = await initDB();
      
      if (mode === 'edit' && id) {
        // Update existing property
        const propertyId = parseInt(id, 10);
        if (isNaN(propertyId)) {
          throw new Error('ID de inmueble inválido');
        }
        
        const updatedProperty: Property = {
          ...propertyData,
          id: propertyId
        };
        
        await db.put('properties', updatedProperty);
        toast.success('Inmueble actualizado correctamente');
      } else {
        // Create new property
        const newProperty: Omit<Property, 'id'> = {
          ...propertyData
        };
        
        await db.add('properties', newProperty);
        toast.success('Inmueble guardado');
      }

      // Navigate to cartera with refresh parameter
      navigate('/inmuebles/cartera?refresh=1');
      
    } catch (error) {
      console.error('Error saving inmueble:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar el inmueble: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel and go back
  const handleCancel = () => {
    navigate('/inmuebles/cartera');
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Identificacion 
            data={step1Data}
            onChange={setStep1Data}
          />
        );
      case 2:
        return (
          <Step2Caracteristicas 
            data={step2Data}
            onChange={setStep2Data}
          />
        );
      case 3:
        return (
          <Step3Coste 
            data={step3Data}
            onChange={setStep3Data}
            direccionCp={step1Data.direccion?.cp}
          />
        );
      case 4:
        return (
          <Step4Fiscalidad 
            data={step4Data}
            onChange={setStep4Data}
          />
        );
      case 5:
        return (
          <InmuebleResumen
            data={getCombinedData()}
            completitud={getStepStatus()}
            onEdit={goToStep}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'edit':
        return 'Editar Inmueble';
      case 'duplicate':
        return 'Duplicar Inmueble';
      case 'create':
      default:
        return 'Alta de Inmueble';
    }
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
    <InmuebleWizardLayout
      currentStep={currentStep}
      steps={getWizardSteps()}
      onStepClick={goToStep}
      title={getTitle()}
    >
      {renderStepContent()}
      
      {/* Navigation buttons (except for summary step) */}
      {currentStep < 5 && (
        <div className="flex justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-hz-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 focus:ring-2 focus:ring-hz-primary focus:ring-offset-2"
            >
              Cancelar
            </button>
            
            {/* Guardar button - available at any step if minimum requirements are met */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#042C5E] text-white rounded-md hover:bg-[#031F47] focus:ring-2 focus:ring-[#042C5E] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            
            <button
              onClick={currentStep === 4 ? () => setCurrentStep(5) : nextStep}
              className="px-6 py-2 bg-hz-primary text-white rounded-md hover:bg-hz-primary-dark focus:ring-2 focus:ring-hz-primary focus:ring-offset-2"
            >
              {currentStep === 4 ? 'Revisar' : 'Siguiente'}
            </button>
          </div>
        </div>
      )}
    </InmuebleWizardLayout>
  );
};

export default InmuebleWizard;