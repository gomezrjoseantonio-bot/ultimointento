// Loan Creation Form Component

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  Home, 
  Calculator,
  AlertCircle,
  Calendar,
  TrendingUp,
  CreditCard,
  Eye
} from 'lucide-react';
import { formatEuro } from '../../../../../utils/formatUtils';
import { formatSpanishNumber, parseSpanishNumber } from '../../../../../services/spanishFormattingService';
import { Prestamo, Bonificacion } from '../../../../../types/prestamos';
import { prestamosService } from '../../../../../services/prestamosService';
import { prestamosCalculationService } from '../../../../../services/prestamosCalculationService';
import BonificationForm from './BonificationForm';

interface PrestamoFormProps {
  onSuccess: (prestamo: Prestamo) => void;
  onCancel: () => void;
}

const PrestamoForm: React.FC<PrestamoFormProps> = ({ onSuccess, onCancel }) => {
  // Basic loan data
  const [nombre, setNombre] = useState('');
  const [inmuebleId, setInmuebleId] = useState('');
  const [principalInicial, setPrincipalInicial] = useState<string>('');
  const [fechaFirma, setFechaFirma] = useState(new Date().toISOString().split('T')[0]);
  const [plazoMesesTotal, setPlazoMesesTotal] = useState<string>('');
  
  // Interest type
  const [tipo, setTipo] = useState<'FIJO' | 'VARIABLE' | 'MIXTO'>('FIJO');
  const [tipoNominalAnualFijo, setTipoNominalAnualFijo] = useState<string>('');
  const [indice, setIndice] = useState<'EURIBOR' | 'OTRO'>('EURIBOR');
  const [valorIndiceActual, setValorIndiceActual] = useState<string>('');
  const [diferencial, setDiferencial] = useState<string>('');
  const [periodoRevisionMeses, setPeriodoRevisionMeses] = useState<string>('12');
  const [tramoFijoMeses, setTramoFijoMeses] = useState<string>('');
  const [tipoNominalAnualMixtoFijo, setTipoNominalAnualMixtoFijo] = useState<string>('');

  // Irregular payments
  const [mesesSoloIntereses, setMesesSoloIntereses] = useState<string>('0');
  const [diferirPrimeraCuotaMeses, setDiferirPrimeraCuotaMeses] = useState<string>('0');
  const [prorratearPrimerPeriodo, setProrratearPrimerPeriodo] = useState(false);
  const [cobroMesVencido, setCobroMesVencido] = useState(false);

  // Collection details
  const [diaCargoMes, setDiaCargoMes] = useState<string>('1');
  const [cuentaCargoId, setCuentaCargoId] = useState('');

  // Costs
  const [comisionAmortizacionParcial, setComisionAmortizacionParcial] = useState<string>('0.01');
  const [comisionCancelacionTotal, setComisionCancelacionTotal] = useState<string>('0.005');
  const [gastosFijosOperacion, setGastosFijosOperacion] = useState<string>('30');

  // Bonifications
  const [bonificaciones, setBonificaciones] = useState<Bonificacion[]>([]);
  const [fechaFinPeriodo, setFechaFinPeriodo] = useState<string>('');
  const [fechaEvaluacion, setFechaEvaluacion] = useState<string>('');
  const [offsetEvaluacionDias, setOffsetEvaluacionDias] = useState<string>('30');

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [estimatedPayment, setEstimatedPayment] = useState<number | null>(null);

  // Calculate estimated payment when relevant fields change
  useEffect(() => {
    const principal = parseFloat(principalInicial) || 0;
    const plazo = parseInt(plazoMesesTotal) || 0;
    
    if (principal > 0 && plazo > 0) {
      let rate = 0;
      
      switch (tipo) {
        case 'FIJO':
          rate = parseFloat(tipoNominalAnualFijo) || 0;
          break;
        case 'VARIABLE':
          rate = (parseFloat(valorIndiceActual) || 0) + (parseFloat(diferencial) || 0);
          break;
        case 'MIXTO':
          rate = parseFloat(tipoNominalAnualMixtoFijo) || 0;
          break;
      }

      const payment = prestamosCalculationService.calculateFrenchPayment(principal, rate, plazo);
      setEstimatedPayment(payment);
    } else {
      setEstimatedPayment(null);
    }
  }, [principalInicial, plazoMesesTotal, tipo, tipoNominalAnualFijo, valorIndiceActual, diferencial, tipoNominalAnualMixtoFijo]);

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!nombre.trim()) errors.push('Nombre del préstamo es obligatorio');
    if (!inmuebleId.trim()) errors.push('ID del inmueble es obligatorio');
    if (!principalInicial || parseFloat(principalInicial) <= 0) errors.push('Principal inicial debe ser mayor que 0');
    if (!plazoMesesTotal || parseInt(plazoMesesTotal) <= 0) errors.push('Plazo debe ser mayor que 0');
    if (!fechaFirma) errors.push('Fecha de firma es obligatoria');
    if (!cuentaCargoId.trim()) errors.push('Cuenta de cargo es obligatoria');

    if (tipo === 'FIJO' && (!tipoNominalAnualFijo || parseFloat(tipoNominalAnualFijo) < 0)) {
      errors.push('Tipo de interés fijo es obligatorio');
    }

    if (tipo === 'VARIABLE') {
      if (!valorIndiceActual || parseFloat(valorIndiceActual) < 0) errors.push('Valor del índice es obligatorio');
      if (!diferencial || parseFloat(diferencial) < 0) errors.push('Diferencial es obligatorio');
    }

    if (tipo === 'MIXTO') {
      if (!tramoFijoMeses || parseInt(tramoFijoMeses) <= 0) errors.push('Tramo fijo en meses es obligatorio');
      if (!tipoNominalAnualMixtoFijo || parseFloat(tipoNominalAnualMixtoFijo) < 0) errors.push('Tipo fijo del tramo mixto es obligatorio');
      if (!valorIndiceActual || parseFloat(valorIndiceActual) < 0) errors.push('Valor del índice es obligatorio');
      if (!diferencial || parseFloat(diferencial) < 0) errors.push('Diferencial es obligatorio');
    }

    const diaCargoNum = parseInt(diaCargoMes);
    if (diaCargoNum < 1 || diaCargoNum > 31) errors.push('Día de cargo debe estar entre 1 y 31');

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    try {
      setLoading(true);
      setError('');

      const prestamoData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
        nombre: nombre.trim(),
        inmuebleId: inmuebleId.trim(),
        principalInicial: parseFloat(principalInicial),
        principalVivo: parseFloat(principalInicial),
        fechaFirma,
        plazoMesesTotal: parseInt(plazoMesesTotal),
        tipo,
        
        // Type-specific fields
        ...(tipo === 'FIJO' && { tipoNominalAnualFijo: parseFloat(tipoNominalAnualFijo) }),
        ...(tipo === 'VARIABLE' && {
          indice,
          valorIndiceActual: parseFloat(valorIndiceActual),
          diferencial: parseFloat(diferencial),
          periodoRevisionMeses: parseInt(periodoRevisionMeses),
          fechaProximaRevision: new Date(new Date(fechaFirma).getTime() + parseInt(periodoRevisionMeses) * 30.44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }),
        ...(tipo === 'MIXTO' && {
          tramoFijoMeses: parseInt(tramoFijoMeses),
          tipoNominalAnualMixtoFijo: parseFloat(tipoNominalAnualMixtoFijo),
          indice,
          valorIndiceActual: parseFloat(valorIndiceActual),
          diferencial: parseFloat(diferencial),
          periodoRevisionMeses: parseInt(periodoRevisionMeses)
        }),

        // Irregular payments
        mesesSoloIntereses: parseInt(mesesSoloIntereses) || undefined,
        diferirPrimeraCuotaMeses: parseInt(diferirPrimeraCuotaMeses) || undefined,
        prorratearPrimerPeriodo,
        cobroMesVencido,

        // Collection
        diaCargoMes: parseInt(diaCargoMes),
        cuentaCargoId: cuentaCargoId.trim(),

        // Costs
        comisionAmortizacionParcial: parseFloat(comisionAmortizacionParcial),
        comisionCancelacionTotal: parseFloat(comisionCancelacionTotal),
        gastosFijosOperacion: parseFloat(gastosFijosOperacion),

        // Bonifications
        ...(bonificaciones.length > 0 && { bonificaciones }),
        ...(fechaFinPeriodo && { fechaFinPeriodo }),
        ...(fechaEvaluacion && { fechaEvaluacion }),
        ...(offsetEvaluacionDias && { offsetEvaluacionDias: parseInt(offsetEvaluacionDias) })
      };

      const newPrestamo = await prestamosService.createPrestamo(prestamoData);
      onSuccess(newPrestamo);
      
    } catch (err) {
      setError('Error al crear el préstamo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="h-6 w-6 text-[#022D5E]" />
            <h1 className="text-xl font-semibold text-[#0F172A]">Crear nuevo préstamo</h1>
          </div>
          <button
            onClick={onCancel}
            className="text-[#6B7280] hover:text-[#374151] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
            <Home className="h-5 w-5 text-[#022D5E]" />
            <span>Información básica</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Nombre del préstamo *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="Ej: Hipoteca Vivienda Principal"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                ID del inmueble *
              </label>
              <input
                type="text"
                value={inmuebleId}
                onChange={(e) => setInmuebleId(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="Ej: property_001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Principal inicial (€) *
              </label>
              <input
                type="text"
                value={principalInicial ? formatSpanishNumber(parseFloat(principalInicial), 2) : ''}
                onChange={(e) => {
                  const parsed = parseSpanishNumber(e.target.value);
                  setPrincipalInicial(parsed.toString());
                }}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="180.000,00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Plazo total (meses) *
              </label>
              <input
                type="number"
                value={plazoMesesTotal}
                onChange={(e) => setPlazoMesesTotal(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="300"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Fecha de firma *
              </label>
              <input
                type="date"
                value={fechaFirma}
                onChange={(e) => setFechaFirma(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Cuenta de cargo *
              </label>
              <input
                type="text"
                value={cuentaCargoId}
                onChange={(e) => setCuentaCargoId(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="cuenta_001"
                required
              />
            </div>
          </div>
        </div>

        {/* Interest Type */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-[#022D5E]" />
            <span>Tipo de interés</span>
          </h2>

          <div className="space-y-6">
            {/* Type selection */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-3">
                Modalidad *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['FIJO', 'VARIABLE', 'MIXTO'] as const).map((tipoOption) => (
                  <button
                    key={tipoOption}
                    type="button"
                    onClick={() => setTipo(tipoOption)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      tipo === tipoOption
                        ? 'border-[#022D5E] bg-[#F8F9FA] text-[#022D5E]'
                        : 'border-[#D1D5DB] hover:border-[#9CA3AF] text-[#6B7280]'
                    }`}
                  >
                    <div className="font-medium">{tipoOption}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            {tipo === 'FIJO' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Tipo nominal anual (%) *
                </label>
                <input
                  type="text"
                  value={tipoNominalAnualFijo ? formatSpanishNumber(parseFloat(tipoNominalAnualFijo), 3) : ''}
                  onChange={(e) => {
                    const parsed = parseSpanishNumber(e.target.value);
                    setTipoNominalAnualFijo(parsed.toString());
                  }}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="4,49"
                  required
                />
              </div>
            )}

            {tipo === 'VARIABLE' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2">
                    Índice *
                  </label>
                  <select
                    value={indice}
                    onChange={(e) => setIndice(e.target.value as 'EURIBOR' | 'OTRO')}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  >
                    <option value="EURIBOR">EURIBOR</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2">
                    Valor actual (%) *
                  </label>
                  <input
                    type="text"
                    value={valorIndiceActual ? formatSpanishNumber(parseFloat(valorIndiceActual), 3) : ''}
                    onChange={(e) => {
                      const parsed = parseSpanishNumber(e.target.value);
                      setValorIndiceActual(parsed.toString());
                    }}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                    placeholder="3,65"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-2">
                    Diferencial (%) *
                  </label>
                  <input
                    type="text"
                    value={diferencial ? formatSpanishNumber(parseFloat(diferencial), 3) : ''}
                    onChange={(e) => {
                      const parsed = parseSpanishNumber(e.target.value);
                      setDiferencial(parsed.toString());
                    }}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                    placeholder="1,2"
                    required
                  />
                </div>
              </div>
            )}

            {tipo === 'MIXTO' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      Tramo fijo (meses) *
                    </label>
                    <input
                      type="number"
                      value={tramoFijoMeses}
                      onChange={(e) => setTramoFijoMeses(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                      placeholder="60"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      Tipo fijo (%) *
                    </label>
                    <input
                      type="text"
                      value={tipoNominalAnualMixtoFijo ? formatSpanishNumber(parseFloat(tipoNominalAnualMixtoFijo), 3) : ''}
                      onChange={(e) => {
                        const parsed = parseSpanishNumber(e.target.value);
                        setTipoNominalAnualMixtoFijo(parsed.toString());
                      }}
                      className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                      placeholder="3,2"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      Índice post-fijo *
                    </label>
                    <select
                      value={indice}
                      onChange={(e) => setIndice(e.target.value as 'EURIBOR' | 'OTRO')}
                      className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                    >
                      <option value="EURIBOR">EURIBOR</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      Valor actual (%) *
                    </label>
                    <input
                      type="text"
                      value={valorIndiceActual ? formatSpanishNumber(parseFloat(valorIndiceActual), 3) : ''}
                      onChange={(e) => {
                        const parsed = parseSpanishNumber(e.target.value);
                        setValorIndiceActual(parsed.toString());
                      }}
                      className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                      placeholder="3,65"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      Diferencial (%) *
                    </label>
                    <input
                      type="text"
                      value={diferencial ? formatSpanishNumber(parseFloat(diferencial), 3) : ''}
                      onChange={(e) => {
                        const parsed = parseSpanishNumber(e.target.value);
                        setDiferencial(parsed.toString());
                      }}
                      className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                      placeholder="1,5"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {(tipo === 'VARIABLE' || tipo === 'MIXTO') && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Período de revisión (meses)
                </label>
                <select
                  value={periodoRevisionMeses}
                  onChange={(e) => setPeriodoRevisionMeses(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                >
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Irregular Payments */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-[#022D5E]" />
            <span>Configuración de pagos</span>
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Meses solo intereses
                </label>
                <input
                  type="number"
                  value={mesesSoloIntereses}
                  onChange={(e) => setMesesSoloIntereses(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Períodos iniciales donde solo se pagan intereses
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Diferir primera cuota (meses)
                </label>
                <input
                  type="number"
                  value={diferirPrimeraCuotaMeses}
                  onChange={(e) => setDiferirPrimeraCuotaMeses(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Meses de diferimiento hasta primera cuota
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Día de cargo (1-31)
                </label>
                <input
                  type="number"
                  value={diaCargoMes}
                  onChange={(e) => setDiaCargoMes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="1"
                  min="1"
                  max="31"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="prorratearPrimerPeriodo"
                  checked={prorratearPrimerPeriodo}
                  onChange={(e) => setProrratearPrimerPeriodo(e.target.checked)}
                  className="rounded border-[#D1D5DB] text-[#022D5E] focus:ring-[#022D5E]"
                />
                <label htmlFor="prorratearPrimerPeriodo" className="text-sm text-[#374151]">
                  Prorratear primer período por días reales
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="cobroMesVencido"
                  checked={cobroMesVencido}
                  onChange={(e) => setCobroMesVencido(e.target.checked)}
                  className="rounded border-[#D1D5DB] text-[#022D5E] focus:ring-[#022D5E]"
                />
                <label htmlFor="cobroMesVencido" className="text-sm text-[#374151]">
                  Cobro a mes vencido (devengo mes t, cargo mes t+1)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Costs */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-[#022D5E]" />
            <span>Comisiones y gastos</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Comisión amortización parcial (%)
              </label>
              <input
                type="text"
                value={comisionAmortizacionParcial ? formatSpanishNumber(parseFloat(comisionAmortizacionParcial), 3) : ''}
                onChange={(e) => {
                  const parsed = parseSpanishNumber(e.target.value);
                  setComisionAmortizacionParcial(parsed.toString());
                }}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="1,0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Comisión cancelación total (%)
              </label>
              <input
                type="text"
                value={comisionCancelacionTotal ? formatSpanishNumber(parseFloat(comisionCancelacionTotal), 3) : ''}
                onChange={(e) => {
                  const parsed = parseSpanishNumber(e.target.value);
                  setComisionCancelacionTotal(parsed.toString());
                }}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="0,5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Gastos fijos por operación (€)
              </label>
              <input
                type="text"
                value={gastosFijosOperacion ? formatSpanishNumber(parseFloat(gastosFijosOperacion), 2) : ''}
                onChange={(e) => {
                  const parsed = parseSpanishNumber(e.target.value);
                  setGastosFijosOperacion(parsed.toString());
                }}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                placeholder="30,00"
              />
            </div>
          </div>
        </div>

        {/* Bonifications */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-[#022D5E]" />
            <span>Bonificaciones</span>
          </h2>

          {/* Bonification period settings */}
          <div className="mb-6">
            <h3 className="font-medium text-[#374151] mb-4">Período de evaluación</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Fin del período bonificado
                </label>
                <input
                  type="date"
                  value={fechaFinPeriodo}
                  onChange={(e) => setFechaFinPeriodo(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="2025-12-31"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Fecha hasta la cual se aplicarán las bonificaciones
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Fecha de evaluación
                </label>
                <input
                  type="date"
                  value={fechaEvaluacion}
                  onChange={(e) => setFechaEvaluacion(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="2025-12-01"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Fecha de evaluación de cumplimiento
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Días antes del fin (offset)
                </label>
                <input
                  type="number"
                  value={offsetEvaluacionDias}
                  onChange={(e) => setOffsetEvaluacionDias(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:ring-[#022D5E] focus:border-[#022D5E]"
                  placeholder="30"
                  min="0"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Días antes del fin del período para evaluar
                </p>
              </div>
            </div>
          </div>

          {/* Bonifications list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#374151]">Bonificaciones configuradas</h3>
              <button
                type="button"
                onClick={() => {
                  const newBonif: Bonificacion = {
                    id: `bonif_${Date.now()}`,
                    nombre: '',
                    reduccionPuntosPorcentuales: 0,
                    lookbackMeses: 3,
                    regla: { tipo: 'NOMINA', minimoMensual: 1000 },
                    estado: 'PENDIENTE'
                  };
                  setBonificaciones([...bonificaciones, newBonif]);
                }}
                className="px-3 py-1 text-sm bg-[#022D5E] text-white rounded-md hover:bg-[#033A73] transition-colors"
              >
                + Añadir bonificación
              </button>
            </div>

            {bonificaciones.length === 0 ? (
              <div className="text-center py-6 text-[#6B7280]">
                <p>No hay bonificaciones configuradas</p>
                <p className="text-sm">Haz clic en "Añadir bonificación" para empezar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bonificaciones.map((bonif, index) => (
                  <BonificationForm 
                    key={bonif.id}
                    bonification={bonif}
                    onChange={(updatedBonif) => {
                      const newBonifs = [...bonificaciones];
                      newBonifs[index] = updatedBonif;
                      setBonificaciones(newBonifs);
                    }}
                    onRemove={() => {
                      setBonificaciones(bonificaciones.filter((_, i) => i !== index));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estimated Payment Preview */}
        {estimatedPayment && (
          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="h-5 w-5 text-[#0369A1]" />
              <h3 className="font-medium text-[#0369A1]">Vista previa</h3>
            </div>
            <div className="text-sm text-[#374151]">
              <p>
                <strong>Cuota mensual estimada:</strong> {formatEuro(estimatedPayment)}
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                Cálculo aproximado basado en sistema francés estándar
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg border border-[#D7DEE7] p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#033A73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{loading ? 'Creando...' : 'Crear préstamo'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PrestamoForm;