import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, Save, X } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../types/financiacion';
import { Prestamo, Bonificacion } from '../../../../types/prestamos';
import { prestamosService } from '../../../../services/prestamosService';
import { useDebouncedCalculation } from '../../../../hooks/useDebouncedCalculation';
import Stepper from './Stepper';
import StepTransition from './StepTransition';
import LiveCalculationFooter from './LiveCalculationFooter';
import IdentificacionStep from './steps/IdentificacionStep';
import EstructuraStep from './steps/EstructuraStep';
import ConfiguracionStep from './steps/ConfiguracionStep';
import BonificacionesStep from './steps/BonificacionesStep';
import ResumenStep from './steps/ResumenStep';

interface PrestamosWizardProps {
  prestamoId?: string;
  initialData?: Partial<PrestamoFinanciacion>;
  onSuccess: () => void;
  onCancel: () => void;
}

type StepId = 'identificacion' | 'estructura' | 'configuracion' | 'bonificaciones' | 'resumen';

const mapToStoragePrestamo = (data: PrestamoFinanciacion): Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> => ({
  ambito: data.ambito,
  inmuebleId: data.inmuebleId,
  nombre: data.alias || 'Préstamo',
  cuentaCargoId: data.cuentaCargoId,
  fechaFirma: data.fechaFirma,
  fechaPrimerCargo: data.fechaPrimerCargo,
  diaCargoMes: data.diaCobroMes,
  esquemaPrimerRecibo: data.esquemaPrimerRecibo,
  principalInicial: data.capitalInicial!,
  principalVivo: data.capitalInicial!,
  plazoMesesTotal: data.plazoPeriodo === 'AÑOS' ? (data.plazoTotal || 0) * 12 : (data.plazoTotal || 0),
  tipo: data.tipo,
  tipoNominalAnualFijo: data.tinFijo,
  indice: data.indice,
  valorIndiceActual: data.valorIndice,
  diferencial: data.diferencial,
  periodoRevisionMeses: data.revision,
  tramoFijoMeses: data.tramoFijoAnos ? data.tramoFijoAnos * 12 : undefined,
  tipoNominalAnualMixtoFijo: data.tinTramoFijo,
  carencia: data.carencia || 'NINGUNA',
  carenciaMeses: data.carenciaMeses,
  sistema: 'FRANCES',
  comisionApertura: data.comisionApertura,
  comisionMantenimiento: data.comisionMantenimiento,
  comisionAmortizacionAnticipada: data.comisionAmortizacionAnticipada,
  bonificaciones: (data.bonificaciones || []).map(b => ({
    id: b.id,
    tipo: b.tipo as Bonificacion['tipo'],
    nombre: b.nombre,
    reduccionPuntosPorcentuales: b.descuentoTIN,
    impacto: b.impacto,
    aplicaEn: b.aplicaEn,
    lookbackMeses: b.ventanaEvaluacion || 6,
    regla: { tipo: 'OTRA' as const, descripcion: b.nombre },
    estado: 'SELECCIONADO' as const,
  })),
  cuotasPagadas: 0,
  origenCreacion: 'MANUAL',
  activo: true,
});

const PrestamosWizard: React.FC<PrestamosWizardProps> = ({
  prestamoId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<PrestamoFinanciacion>>(() => {
    if (initialData) {
      return {
        ...initialData,
        esquemaPrimerRecibo: initialData.esquemaPrimerRecibo || 'NORMAL',
        sistema: 'FRANCES',
        revision: initialData.revision || 12,
        diaCobroMes: initialData.diaCobroMes || 1,
        bonificaciones: initialData.bonificaciones || [],
      };
    }

    return {
      ambito: 'PERSONAL',
      esquemaPrimerRecibo: 'NORMAL',
      tipo: 'FIJO',
      plazoPeriodo: 'AÑOS',
      carencia: 'NINGUNA',
      sistema: 'FRANCES',
      revision: 12,
      diaCobroMes: 1,
      bonificaciones: [],
    };
  });

  const [currentStep, setCurrentStep] = useState<StepId>('identificacion');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const existingPrincipalVivoRef = useRef<number | undefined>(undefined);
  const existingCuotasPagadasRef = useRef<number | undefined>(undefined);

  const calculoLive = useDebouncedCalculation(formData);

  // Load existing prestamo for edit mode
  useEffect(() => {
    if (prestamoId) {
      prestamosService.getPrestamoById(prestamoId).then(prestamo => {
        if (prestamo) {
          existingPrincipalVivoRef.current = prestamo.principalVivo;
          existingCuotasPagadasRef.current = prestamo.cuotasPagadas;
          setFormData({
            id: prestamo.id,
            ambito: prestamo.ambito,
            inmuebleId: prestamo.inmuebleId,
            alias: prestamo.nombre,
            cuentaCargoId: prestamo.cuentaCargoId,
            fechaFirma: prestamo.fechaFirma,
            fechaPrimerCargo: prestamo.fechaPrimerCargo,
            diaCobroMes: prestamo.diaCargoMes,
            esquemaPrimerRecibo: prestamo.esquemaPrimerRecibo,
            capitalInicial: prestamo.principalInicial,
            plazoTotal: prestamo.plazoMesesTotal,
            plazoPeriodo: 'MESES',
            carencia: prestamo.carencia,
            carenciaMeses: prestamo.carenciaMeses,
            tipo: prestamo.tipo,
            tinFijo: prestamo.tipoNominalAnualFijo,
            indice: prestamo.indice,
            valorIndice: prestamo.valorIndiceActual,
            diferencial: prestamo.diferencial,
            revision: prestamo.periodoRevisionMeses as 6 | 12 || 12,
            tramoFijoAnos: prestamo.tramoFijoMeses ? prestamo.tramoFijoMeses / 12 : undefined,
            tinTramoFijo: prestamo.tipoNominalAnualMixtoFijo,
            sistema: 'FRANCES',
            comisionApertura: prestamo.comisionApertura,
            comisionMantenimiento: prestamo.comisionMantenimiento,
            comisionAmortizacionAnticipada: prestamo.comisionAmortizacionAnticipada,
            bonificaciones: [],
          });
        }
      });
    }
  }, [prestamoId]);

  const handleChange = useCallback((updates: Partial<PrestamoFinanciacion>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedKeys = Object.keys(updates);
    setErrors(prev => {
      const next = { ...prev };
      updatedKeys.forEach(k => delete next[k]);
      return next;
    });
  }, []);

  // Determine steps (no Importación step - origen is always manual)
  const getSteps = useCallback(() => {
    const base: { id: StepId; label: string }[] = [
      { id: 'identificacion', label: 'Identificación' },
      { id: 'estructura', label: 'Condiciones' },
      { id: 'configuracion', label: 'Configuración' },
      { id: 'bonificaciones', label: 'Bonificaciones' },
    ];
    base.push({ id: 'resumen', label: 'Resumen' });
    return base;
  }, []);

  const allSteps = getSteps();

  const stepOrder: StepId[] = allSteps.map(s => s.id);
  const currentIndex = stepOrder.indexOf(currentStep);

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 'identificacion') {
      if (!formData.ambito) newErrors.ambito = 'Selecciona el ámbito';
      if (formData.ambito === 'INMUEBLE' && !formData.inmuebleId) newErrors.inmuebleId = 'Selecciona un inmueble';
      if (!formData.cuentaCargoId) newErrors.cuentaCargoId = 'Selecciona una cuenta de cargo';
      if (!formData.fechaFirma) newErrors.fechaFirma = 'Introduce la fecha de firma';
      if (!formData.fechaPrimerCargo) newErrors.fechaPrimerCargo = 'Introduce la fecha del primer cargo';
      if (!formData.diaCobroMes || formData.diaCobroMes < 1 || formData.diaCobroMes > 31) {
        newErrors.diaCobroMes = 'Día de cobro debe estar entre 1 y 31';
      }
    }

    if (currentStep === 'estructura') {
      if (!formData.capitalInicial || formData.capitalInicial <= 0) newErrors.capitalInicial = 'Introduce el capital inicial';
      if (!formData.plazoTotal || formData.plazoTotal <= 0) newErrors.plazoTotal = 'Introduce el plazo';
      if (!formData.tipo) newErrors.tipo = 'Selecciona el tipo de interés';
    }

    if (currentStep === 'configuracion') {
      if (formData.tipo === 'FIJO' && (formData.tinFijo === undefined || formData.tinFijo < 0)) {
        newErrors.tinFijo = 'Introduce el TIN fijo';
      }
      if (formData.tipo === 'VARIABLE' && formData.diferencial === undefined) {
        newErrors.diferencial = 'Introduce el diferencial';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    setIsLoading(true);
    try {
      const mapped = mapToStoragePrestamo(formData as PrestamoFinanciacion);
      if (prestamoId) {
        // Preserve principalVivo and cuotasPagadas for existing loans instead of resetting
        if (existingPrincipalVivoRef.current !== undefined) {
          mapped.principalVivo = existingPrincipalVivoRef.current;
        }
        if (existingCuotasPagadasRef.current !== undefined) {
          mapped.cuotasPagadas = existingCuotasPagadasRef.current;
        }
        const updated = await prestamosService.updatePrestamo(prestamoId, mapped);
        if (updated && new Date(formData.fechaFirma as string) < new Date()) {
          await prestamosService.autoMarcarCuotasPagadas(updated.id);
        }
      } else {
        const created = await prestamosService.createPrestamo(mapped);
        if (created && new Date(formData.fechaFirma as string) < new Date()) {
          await prestamosService.autoMarcarCuotasPagadas(created.id);
        }
      }
      onSuccess();
    } catch (err) {
      console.error('[PrestamosWizard] Submit error:', err);
      setErrors({ submit: 'Error al guardar el préstamo. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const stepDefs = allSteps.map((s, i) => ({
    id: s.id,
    label: s.label,
    isCompleted: i < currentIndex,
    isActive: s.id === currentStep,
  }));

  const uniqueSteps = stepDefs;

  const isLastStep = currentIndex === stepOrder.length - 1;

  return (
    <div style={{ height: '100%', backgroundColor: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        backgroundColor: 'var(--bg)',
        borderBottom: '1px solid #eee',
        padding: '12px 24px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
              {prestamoId ? 'Editar préstamo' : 'Nuevo préstamo'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
              >
                <X size={16} strokeWidth={1.5} />
                Cancelar
              </button>
            </div>
          </div>
          <Stepper steps={uniqueSteps} onStepClick={(id) => setCurrentStep(id as StepId)} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 24px 24px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }} className="hide-scrollbar">
        <StepTransition stepKey={currentStep}>
          {currentStep === 'identificacion' && (
            <IdentificacionStep
              data={formData}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 'estructura' && (
            <EstructuraStep
              data={formData}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 'configuracion' && (
            <ConfiguracionStep
              data={formData}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 'bonificaciones' && (
            <BonificacionesStep
              data={formData}
              onChange={handleChange}
              errors={errors}
            />
          )}
          {currentStep === 'resumen' && (
            <ResumenStep
              data={formData}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              errors={errors}
            />
          )}
        </StepTransition>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0,
        backgroundColor: 'var(--bg)',
        borderTop: '1px solid #eee',
        padding: '12px 24px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LiveCalculationFooter
            cuotaMensual={calculoLive?.cuotaEstimada ?? null}
            tae={calculoLive?.taeAproximada ?? null}
            tinEfectivo={calculoLive?.tinEfectivo ?? null}
            isVisible={!isLastStep && calculoLive !== null}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 8,
                border: '1.5px solid #ddd',
                backgroundColor: 'var(--bg)',
                color: currentIndex === 0 ? 'var(--text-gray)' : 'var(--atlas-navy-1)',
                cursor: currentIndex === 0 ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              Anterior
            </button>

            {errors.submit && (
              <div style={{ fontSize: 12, color: 'var(--error)' }}>{errors.submit}</div>
            )}

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--atlas-navy-1)',
                  color: '#fff',
                  cursor: isLoading ? 'wait' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <Save size={16} strokeWidth={1.5} />
                {isLoading ? 'Guardando…' : 'Guardar préstamo'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--atlas-blue)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Siguiente
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrestamosWizard;
