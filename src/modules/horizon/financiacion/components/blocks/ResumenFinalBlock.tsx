import React from 'react';
import { 
  CheckCircle, 
  Calculator, 
  Euro, 
  Calendar, 
  Percent, 
  TrendingUp,
  AlertCircle,
  Info
} from 'lucide-react';
import { PrestamoFinanciacion, ValidationError, CalculoLive } from '../../../../../types/financiacion';

interface ResumenFinalBlockProps {
  formData: Partial<PrestamoFinanciacion>;
  updateFormData: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: ValidationError[];
  calculoLive?: CalculoLive | null;
}

const ResumenFinalBlock: React.FC<ResumenFinalBlockProps> = ({ 
  formData, 
  updateFormData, 
  errors,
  calculoLive 
}) => {
  // Format numbers for display
  const formatNumber = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercentage = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate key values
  const capital = formData.capitalInicial || 0;
  const plazoFormatted = formData.plazoPeriodo === 'AÑOS' ? 
    `${formData.plazoTotal} años` : 
    `${formData.plazoTotal} meses`;

  // Base TIN calculation
  let tinBase = 0;
  if (formData.tipo === 'FIJO') {
    tinBase = formData.tinFijo || 0;
  } else if (formData.tipo === 'VARIABLE') {
    tinBase = (formData.valorIndice || 0) + (formData.diferencial || 0);
  } else if (formData.tipo === 'MIXTO') {
    tinBase = formData.tinTramoFijo || 0;
  }

  // Total bonifications
  const bonificacionesTotales = (formData.bonificaciones || [])
    .filter(b => b.activa)
    .reduce((sum, b) => sum + b.descuentoTIN, 0);

  const tinEfectivo = Math.max(0, tinBase - bonificacionesTotales);

  // Annual savings calculation
  const ahorroAnual = calculoLive?.ahorroAnual || 0;

  // Mock account data for display
  const mockAccounts = [
    { id: 'acc1', iban: 'ES91 2100 0418 4502 0005 1332', entidad: 'CaixaBank' },
    { id: 'acc2', iban: 'ES79 0049 0001 5025 1610 1005', entidad: 'Santander' },
    { id: 'acc3', iban: 'ES15 0081 0346 1100 0123 4567', entidad: 'Sabadell' }
  ];

  const selectedAccount = mockAccounts.find(acc => acc.id === formData.cuentaCargoId);

  // Check if all required fields are filled
  const isFormComplete = !!(
    formData.cuentaCargoId &&
    formData.fechaFirma &&
    formData.fechaPrimerCargo &&
    formData.capitalInicial &&
    formData.plazoTotal &&
    formData.tipo &&
    (formData.tipo === 'FIJO' ? formData.tinFijo :
     formData.tipo === 'VARIABLE' ? (formData.valorIndice !== undefined && formData.diferencial !== undefined) :
     (formData.tramoFijoAnos && formData.tinTramoFijo))
  );

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div className={`p-4 rounded-atlas border ${
        isFormComplete 
          ? 'border-ok-200 bg-ok-50' 
          : 'border-warning-200 bg-warning-50'
      }`}>
        <div className="flex items-center">
          {isFormComplete ? (
            <>
              <CheckCircle className="h-5 w-5 text-ok-600 mr-3" />
              <div>
                <p className="font-medium text-ok-700">Formulario completo</p>
                <p className="text-sm text-ok-600">Todos los campos obligatorios están cumplimentados</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-warning-600 mr-3" />
              <div>
                <p className="font-medium text-warning-700">Formulario incompleto</p>
                <p className="text-sm text-warning-600">Revise los campos obligatorios en las secciones anteriores</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Summary Panel */}
      <div className="bg-white border border-gray-200 rounded-atlas overflow-hidden">
        <div className="bg-atlas-blue px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Resumen del Préstamo
          </h3>
        </div>

        <div className="p-6">
          {/* Key Financial Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="bg-primary-50 rounded-atlas p-4">
                <Euro className="h-6 w-6 text-atlas-blue mx-auto mb-2" />
                <div className="text-sm text-text-gray">Capital</div>
                <div className="text-xl font-bold text-atlas-navy-1">
                  {formatNumber(capital)} €
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-primary-50 rounded-atlas p-4">
                <Calendar className="h-6 w-6 text-atlas-blue mx-auto mb-2" />
                <div className="text-sm text-text-gray">Plazo</div>
                <div className="text-xl font-bold text-atlas-navy-1">
                  {plazoFormatted}
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-primary-50 rounded-atlas p-4">
                <Percent className="h-6 w-6 text-atlas-blue mx-auto mb-2" />
                <div className="text-sm text-text-gray">TIN Base</div>
                <div className="text-xl font-bold text-atlas-navy-1">
                  {formatPercentage(tinBase)} %
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className={`rounded-atlas p-4 ${
                bonificacionesTotales > 0 ? 'bg-ok-50' : 'bg-primary-50'
              }`}>
                <TrendingUp className={`h-6 w-6 mx-auto mb-2 ${
                  bonificacionesTotales > 0 ? 'text-ok-600' : 'text-atlas-blue'
                }`} />
                <div className="text-sm text-text-gray">TIN Efectivo</div>
                <div className={`text-xl font-bold ${
                  bonificacionesTotales > 0 ? 'text-ok-600' : 'text-atlas-navy-1'
                }`}>
                  {formatPercentage(tinEfectivo)} %
                </div>
              </div>
            </div>
          </div>

          {/* Live Calculation Results */}
          {calculoLive && (
            <div className="bg-ok-50 border border-ok-200 rounded-atlas p-4 mb-6">
              <h4 className="font-medium text-ok-700 mb-3">Cálculo Financiero</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-text-gray text-sm block">Cuota Estimada</span>
                  <span className="text-lg font-semibold text-atlas-navy-1">
                    {formatNumber(calculoLive.cuotaEstimada)} €/mes
                  </span>
                </div>
                <div>
                  <span className="text-text-gray text-sm block">TAE Aproximada</span>
                  <span className="text-lg font-semibold text-atlas-navy-1">
                    {formatPercentage(calculoLive.taeAproximada)} %
                  </span>
                </div>
                {calculoLive.proximaFechaRevision && (
                  <div>
                    <span className="text-text-gray text-sm block">Próxima Revisión</span>
                    <span className="text-lg font-semibold text-atlas-navy-1">
                      {new Date(calculoLive.proximaFechaRevision).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bonifications Summary */}
          {bonificacionesTotales > 0 && (
            <div className="bg-atlas-blue bg-opacity-5 border border-atlas-blue border-opacity-20 rounded-atlas p-4 mb-6">
              <h4 className="font-medium text-atlas-blue mb-3">Beneficio de Bonificaciones</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-text-gray text-sm block">Descuento Total</span>
                  <span className="text-lg font-semibold text-ok-600">
                    -{formatPercentage(bonificacionesTotales)} p.p.
                  </span>
                </div>
                {calculoLive?.ahorroMensual && (
                  <>
                    <div>
                      <span className="text-text-gray text-sm block">Ahorro Mensual</span>
                      <span className="text-lg font-semibold text-ok-600">
                        {formatNumber(calculoLive.ahorroMensual)} €
                      </span>
                    </div>
                    <div>
                      <span className="text-text-gray text-sm block">Ahorro Anual</span>
                      <span className="text-lg font-semibold text-ok-600">
                        {formatNumber(ahorroAnual)} €
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Loan Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-atlas-navy-1">Detalles del Préstamo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-gray">Ámbito:</span>
                  <span className="font-medium text-atlas-navy-1">
                    {formData.ambito === 'PERSONAL' ? 'Personal' : 'Inmueble'}
                  </span>
                </div>
                {formData.alias && (
                  <div className="flex justify-between">
                    <span className="text-text-gray">Alias:</span>
                    <span className="font-medium text-atlas-navy-1">{formData.alias}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-gray">Fecha firma:</span>
                  <span className="font-medium text-atlas-navy-1">
                    {formData.fechaFirma ? new Date(formData.fechaFirma).toLocaleDateString('es-ES') : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-gray">Primer cargo:</span>
                  <span className="font-medium text-atlas-navy-1">
                    {formData.fechaPrimerCargo ? new Date(formData.fechaPrimerCargo).toLocaleDateString('es-ES') : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-gray">Día de cobro:</span>
                  <span className="font-medium text-atlas-navy-1">Día {formData.diaCobroMes || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-gray">Esquema primer recibo:</span>
                  <span className="font-medium text-atlas-navy-1">
                    {formData.esquemaPrimerRecibo === 'NORMAL' ? 'Normal' :
                     formData.esquemaPrimerRecibo === 'SOLO_INTERESES' ? 'Solo intereses' :
                     'Prorrata'}
                  </span>
                </div>
              </div>

              {/* Financial Conditions */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-gray">Tipo de interés:</span>
                  <span className="font-medium text-atlas-navy-1">{formData.tipo}</span>
                </div>
                {formData.carencia !== 'NINGUNA' && (
                  <div className="flex justify-between">
                    <span className="text-text-gray">Carencia:</span>
                    <span className="font-medium text-atlas-navy-1">
                      {formData.carencia} ({formData.carenciaMeses || 0} meses)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-gray">Sistema:</span>
                  <span className="font-medium text-atlas-navy-1">Francés</span>
                </div>
                {formData.comisionApertura && formData.comisionApertura > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-gray">Comisión apertura:</span>
                    <span className="font-medium text-atlas-navy-1">{formatPercentage(formData.comisionApertura)} %</span>
                  </div>
                )}
                {formData.comisionMantenimiento && formData.comisionMantenimiento > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-gray">Comisión mantenimiento:</span>
                    <span className="font-medium text-atlas-navy-1">{formatNumber(formData.comisionMantenimiento)} €/mes</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account Information */}
          {selectedAccount && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-atlas-navy-1 mb-3">Cuenta de Cargo</h4>
              <div className="flex items-center p-3 bg-gray-50 rounded-atlas">
                <div className="w-10 h-10 bg-atlas-blue rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                  {selectedAccount.entidad.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-atlas-navy-1">{selectedAccount.entidad}</div>
                  <div className="text-sm text-text-gray">{selectedAccount.iban}</div>
                </div>
              </div>
            </div>
          )}

          {/* Applied Bonifications */}
          {(formData.bonificaciones || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-atlas-navy-1 mb-3">Bonificaciones Aplicadas</h4>
              <div className="space-y-2">
                {(formData.bonificaciones || []).filter(b => b.activa).map((bonificacion) => (
                  <div key={bonificacion.id} className="flex justify-between items-center p-2 bg-ok-50 rounded">
                    <span className="text-sm text-ok-700">{bonificacion.nombre}</span>
                    <span className="text-sm font-medium text-ok-600">
                      -{formatPercentage(bonificacion.descuentoTIN)} p.p.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-info-50 border border-info-200 rounded-atlas p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-info-600 flex-shrink-0 mt-0.5" />
          <div className="ml-3 text-sm">
            <p className="font-medium text-info-700 mb-1">Información importante</p>
            <ul className="text-info-600 space-y-1">
              <li>• Los cálculos mostrados son estimaciones basadas en los datos introducidos</li>
              <li>• Las bonificaciones están sujetas a verificación y cumplimiento de condiciones</li>
              <li>• Al guardar se generarán los movimientos previstos en Tesorería</li>
              <li>• Se creará automáticamente el cuadro de amortización completo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumenFinalBlock;