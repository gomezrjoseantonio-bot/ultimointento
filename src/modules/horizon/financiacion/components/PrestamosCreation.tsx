import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  ChevronDown, 
  ChevronUp,
  User,
  Home,
  CreditCard,
  Calculator,
  CheckCircle,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { PrestamoFinanciacion, BonificacionFinanciacion, CalculoLive, ResumenFinal, ValidationError } from '../../../../types/financiacion';
import { prestamosService } from '../../../../services/prestamosService';

// Import block components (to be created)
import IdentificacionBlock from './blocks/IdentificacionBlock';
import CondicionesFinancierasBlock from './blocks/CondicionesFinancierasBlock';
import BonificacionesBlock from './blocks/BonificacionesBlock';
import ResumenFinalBlock from './blocks/ResumenFinalBlock';

interface PrestamosCreationProps {
  prestamoId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PrestamosCreation: React.FC<PrestamosCreationProps> = ({ prestamoId, onSuccess, onCancel }) => {
  // Block visibility state
  const [visibleBlocks, setVisibleBlocks] = useState({
    identificacion: true,
    condiciones: false,
    bonificaciones: false,
    resumen: false
  });

  // Form data state
  const [formData, setFormData] = useState<Partial<PrestamoFinanciacion>>({
    ambito: 'PERSONAL',
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    plazoPeriodo: 'AÑOS',
    carencia: 'NINGUNA',
    sistema: 'FRANCES',
    revision: 12,
    diaCobroMes: 1,
    bonificaciones: []
  });

  // Live calculation state
  const [calculoLive, setCalculoLive] = useState<CalculoLive | null>(null);
  
  // Form validation state
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditMode = !!prestamoId;

  // Load existing loan data if in edit mode
  useEffect(() => {
    if (prestamoId) {
      const loadPrestamoData = async () => {
        try {
          setLoading(true);
          const prestamo = await prestamosService.getPrestamoById(prestamoId);
          if (prestamo) {
            // Convert existing loan data to new format
            setFormData({
              id: prestamo.id,
              ambito: 'INMUEBLE', // Legacy loans were property-based
              inmuebleId: prestamo.inmuebleId,
              cuentaCargoId: prestamo.cuentaCargoId,
              fechaFirma: prestamo.fechaFirma,
              fechaPrimerCargo: prestamo.fechaFirma, // Use same date as default
              diaCobroMes: prestamo.diaCargoMes || 1,
              esquemaPrimerRecibo: 'NORMAL', // Default value
              capitalInicial: prestamo.principalInicial,
              plazoTotal: prestamo.plazoMesesTotal,
              plazoPeriodo: 'MESES',
              carencia: 'NINGUNA',
              tipo: prestamo.tipo,
              tinFijo: prestamo.tipoNominalAnualFijo,
              indice: prestamo.indice,
              valorIndice: prestamo.valorIndiceActual,
              diferencial: prestamo.diferencial,
              revision: prestamo.periodoRevisionMeses === 6 ? 6 : 12,
              tramoFijoAnos: prestamo.tramoFijoMeses ? Math.round(prestamo.tramoFijoMeses / 12) : undefined,
              tinTramoFijo: prestamo.tipoNominalAnualMixtoFijo,
              sistema: 'FRANCES',
              comisionApertura: 0,
              comisionMantenimiento: prestamo.gastosFijosOperacion,
              comisionAmortizacionAnticipada: prestamo.comisionAmortizacionParcial,
              bonificaciones: prestamo.bonificaciones?.map(b => ({
                id: b.id,
                tipo: 'OTROS',
                nombre: b.nombre,
                condicionParametrizable: 'Condición personalizada',
                descuentoTIN: b.reduccionPuntosPorcentuales,
                ventanaEvaluacion: b.lookbackMeses,
                fuenteVerificacion: 'MANUAL',
                estadoInicial: 'NO_CUMPLE',
                activa: true
              })) || []
            });
          }
        } catch (error) {
          console.error('Error loading loan data:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadPrestamoData();
    }
  }, [prestamoId]);

  // Toggle block visibility
  const toggleBlock = (blockName: keyof typeof visibleBlocks) => {
    setVisibleBlocks(prev => ({
      ...prev,
      [blockName]: !prev[blockName]
    }));
  };

  // Update form data
  const updateFormData = (updates: Partial<PrestamoFinanciacion>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: ValidationError[] = [];

    // Step 1 validation
    if (!formData.cuentaCargoId) {
      newErrors.push({ field: 'cuentaCargoId', message: 'La cuenta de cargo es obligatoria' });
    }
    if (!formData.fechaFirma) {
      newErrors.push({ field: 'fechaFirma', message: 'La fecha de firma es obligatoria' });
    }
    if (!formData.fechaPrimerCargo) {
      newErrors.push({ field: 'fechaPrimerCargo', message: 'La fecha del primer cargo es obligatoria' });
    }

    // Step 2 validation
    if (!formData.capitalInicial || formData.capitalInicial <= 0) {
      newErrors.push({ field: 'capitalInicial', message: 'El capital inicial es obligatorio y debe ser mayor que 0' });
    }
    if (!formData.plazoTotal || formData.plazoTotal <= 0) {
      newErrors.push({ field: 'plazoTotal', message: 'El plazo total es obligatorio y debe ser mayor que 0' });
    }
    if (!formData.tipo) {
      newErrors.push({ field: 'tipo', message: 'El tipo de interés es obligatorio' });
    }
    
    // Interest rate validation based on type
    if (formData.tipo === 'FIJO' && (!formData.tinFijo || formData.tinFijo <= 0)) {
      newErrors.push({ field: 'tinFijo', message: 'El TIN fijo es obligatorio para préstamos a tipo fijo' });
    }
    if (formData.tipo === 'VARIABLE') {
      if (!formData.valorIndice && formData.valorIndice !== 0) {
        newErrors.push({ field: 'valorIndice', message: 'El valor del índice es obligatorio para préstamos variables' });
      }
      if (!formData.diferencial && formData.diferencial !== 0) {
        newErrors.push({ field: 'diferencial', message: 'El diferencial es obligatorio para préstamos variables' });
      }
    }
    if (formData.tipo === 'MIXTO') {
      if (!formData.tramoFijoAnos || formData.tramoFijoAnos <= 0) {
        newErrors.push({ field: 'tramoFijoAnos', message: 'El tramo fijo es obligatorio para préstamos mixtos' });
      }
      if (!formData.tinTramoFijo || formData.tinTramoFijo <= 0) {
        newErrors.push({ field: 'tinTramoFijo', message: 'El TIN del tramo fijo es obligatorio para préstamos mixtos' });
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Calculate live values
  useEffect(() => {
    if (formData.capitalInicial && formData.plazoTotal && formData.tipo) {
      // Simulate live calculation (you would implement actual calculation service)
      const baseRate = formData.tipo === 'FIJO' ? (formData.tinFijo || 0) :
                      formData.tipo === 'VARIABLE' ? ((formData.valorIndice || 0) + (formData.diferencial || 0)) :
                      formData.tinTramoFijo || 0;

      const totalBonificaciones = (formData.bonificaciones || [])
        .filter(b => b.activa)
        .reduce((sum, b) => sum + b.descuentoTIN, 0);

      const tinEfectivo = Math.max(0, baseRate - totalBonificaciones);
      
      // Simple French payment calculation (monthly)
      const plazoMeses = formData.plazoPeriodo === 'AÑOS' ? formData.plazoTotal * 12 : formData.plazoTotal;
      const tasaMensual = tinEfectivo / 12 / 100;
      const cuotaEstimada = tasaMensual > 0 ? 
        (formData.capitalInicial * tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / 
        (Math.pow(1 + tasaMensual, plazoMeses) - 1) : 
        formData.capitalInicial / plazoMeses;

      // Calculate savings
      const cuotaSinBonif = baseRate > 0 ? 
        (formData.capitalInicial * (baseRate/12/100) * Math.pow(1 + baseRate/12/100, plazoMeses)) / 
        (Math.pow(1 + baseRate/12/100, plazoMeses) - 1) : 
        formData.capitalInicial / plazoMeses;

      const ahorroMensual = cuotaSinBonif - cuotaEstimada;
      const ahorroAnual = ahorroMensual * 12;

      setCalculoLive({
        cuotaEstimada,
        taeAproximada: tinEfectivo * 1.05, // Rough approximation
        tinEfectivo,
        ahorroMensual,
        ahorroAnual,
        proximaFechaRevision: formData.tipo === 'VARIABLE' ? 
          new Date(Date.now() + (formData.revision || 12) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
          undefined
      });
    } else {
      setCalculoLive(null);
    }
  }, [formData]);

  // Save loan
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Convert to legacy format for now (you would implement proper conversion service)
      const legacyData = {
        nombre: formData.alias || `Préstamo ${formData.ambito}`,
        inmuebleId: formData.inmuebleId || 'standalone',
        principalInicial: formData.capitalInicial!,
        principalVivo: formData.capitalInicial!,
        fechaFirma: formData.fechaFirma!,
        plazoMesesTotal: formData.plazoPeriodo === 'AÑOS' ? formData.plazoTotal! * 12 : formData.plazoTotal!,
        tipo: formData.tipo!,
        tipoNominalAnualFijo: formData.tinFijo,
        indice: formData.indice,
        valorIndiceActual: formData.valorIndice,
        diferencial: formData.diferencial,
        periodoRevisionMeses: formData.revision,
        tramoFijoMeses: formData.tramoFijoAnos ? formData.tramoFijoAnos * 12 : undefined,
        tipoNominalAnualMixtoFijo: formData.tinTramoFijo,
        diaCargoMes: formData.diaCobroMes,
        cuentaCargoId: formData.cuentaCargoId!,
        gastosFijosOperacion: formData.comisionMantenimiento,
        comisionAmortizacionParcial: formData.comisionAmortizacionAnticipada,
        bonificaciones: formData.bonificaciones?.map(b => ({
          id: b.id,
          nombre: b.nombre,
          reduccionPuntosPorcentuales: b.descuentoTIN,
          lookbackMeses: b.ventanaEvaluacion,
          regla: { tipo: 'OTRA', descripcion: b.condicionParametrizable },
          estado: 'PENDIENTE' as const
        }))
      };

      if (isEditMode) {
        await prestamosService.updatePrestamo(prestamoId!, legacyData);
      } else {
        await prestamosService.createPrestamo(legacyData);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving loan:', error);
      setErrors([{ field: 'general', message: 'Error al guardar el préstamo' }]);
    } finally {
      setLoading(false);
    }
  };

  // Block components data
  const blocks = [
    {
      id: 'identificacion',
      title: '1. Identificación & Cuenta de Cargo',
      icon: User,
      isVisible: visibleBlocks.identificacion,
      isComplete: !!(formData.cuentaCargoId && formData.fechaFirma && formData.fechaPrimerCargo),
      component: IdentificacionBlock
    },
    {
      id: 'condiciones',
      title: '2. Condiciones Financieras',
      icon: Calculator,
      isVisible: visibleBlocks.condiciones,
      isComplete: !!(formData.capitalInicial && formData.plazoTotal && formData.tipo && 
        (formData.tipo === 'FIJO' ? formData.tinFijo : 
         formData.tipo === 'VARIABLE' ? (formData.valorIndice !== undefined && formData.diferencial !== undefined) :
         (formData.tramoFijoAnos && formData.tinTramoFijo))),
      component: CondicionesFinancierasBlock
    },
    {
      id: 'bonificaciones',
      title: '3. Bonificaciones',
      icon: CreditCard,
      isVisible: visibleBlocks.bonificaciones,
      isComplete: true, // Bonifications are optional
      component: BonificacionesBlock
    },
    {
      id: 'resumen',
      title: '4. Resumen Final',
      icon: CheckCircle,
      isVisible: visibleBlocks.resumen,
      isComplete: true,
      component: ResumenFinalBlock
    }
  ];

  if (loading && isEditMode) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent mx-auto mb-4"></div>
          <p className="text-atlas-navy-1">Cargando datos del préstamo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onCancel}
              className="p-2 text-text-gray hover:text-atlas-navy-1 transition-colors"
              aria-label="Volver"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-atlas-navy-1">
                {isEditMode ? 'Editar Préstamo' : 'Crear Préstamo'}
              </h1>
              <p className="text-sm text-text-gray">
                Financiación - ATLAS Horizon
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-atlas text-white bg-atlas-blue hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atlas-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </>
            )}
          </button>
        </div>

        {/* General errors */}
        {errors.some(e => e.field === 'general') && (
          <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-atlas">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-error-500 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-error-700">
                  {errors.find(e => e.field === 'general')?.message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {blocks.map((block) => (
          <div key={block.id} className="bg-white rounded-atlas border border-gray-200 overflow-hidden">
            {/* Block Header */}
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleBlock(block.id as keyof typeof visibleBlocks)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <block.icon className={`h-5 w-5 ${block.isComplete ? 'text-ok' : 'text-text-gray'}`} />
                  <h3 className="text-lg font-medium text-atlas-navy-1">{block.title}</h3>
                  {block.isComplete && (
                    <CheckCircle className="h-5 w-5 text-ok" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {block.isVisible ? (
                    <ChevronUp className="h-5 w-5 text-text-gray" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-text-gray" />
                  )}
                </div>
              </div>
            </div>

            {/* Block Content */}
            {block.isVisible && (
              <div className="p-6">
                <block.component
                  formData={formData}
                  updateFormData={updateFormData}
                  errors={errors}
                  calculoLive={calculoLive}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrestamosCreation;