import React from 'react';
import { AlertCircle, Building, Calendar, Clock, CreditCard, Home, Plus, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PrestamoFinanciacion, ValidationError } from '../../../../../types/financiacion';
import { AfectacionInmueblePrestamo } from '../../../../../types/prestamos';
import { cuentasService } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import AccountOption from '../../../../../components/common/AccountOption';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { Inmueble } from '../../../../../types/inmueble';

interface IdentificacionBlockProps {
  formData: Partial<PrestamoFinanciacion>;
  updateFormData: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: ValidationError[];
  calculoLive?: any;
}

const IdentificacionBlock: React.FC<IdentificacionBlockProps> = ({
  formData,
  updateFormData,
  errors,
}) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inmuebles, setInmuebles] = React.useState<Inmueble[]>([]);
  const [inmueblesLoading, setInmueblesLoading] = React.useState(false);

  const getFieldError = (fieldName: string) => errors.find((e) => e.field === fieldName)?.message;

  const initializedPrimerCargo = React.useRef(false);
  React.useEffect(() => {
    if (!initializedPrimerCargo.current) {
      initializedPrimerCargo.current = true;
      if (!formData.fechaPrimerCargo && formData.fechaFirma) {
        updateFormData({ fechaPrimerCargo: formData.fechaFirma });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsList = await cuentasService.list();
        setAccounts(accountsList.filter((acc) => acc.activa));
      } catch (error) {
        console.error('[PRESTAMOS] Failed to load accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
    const unsubscribe = cuentasService.on((event) => {
      if (event === 'accounts:updated') {
        loadAccounts();
      }
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const loadInmuebles = async () => {
      setInmueblesLoading(true);
      try {
        const list = await inmuebleService.getAll();
        const active = list.filter((i) => i.estado === 'ACTIVO');
        setInmuebles(active);
        if (active.length === 1 && formData.ambito === 'INMUEBLE' && !formData.inmuebleId && !(formData.afectacionesInmueble?.length)) {
          updateFormData({ inmuebleId: active[0].id });
        }
      } catch (error) {
        console.error('[PRESTAMOS] Failed to load inmuebles:', error);
      } finally {
        setInmueblesLoading(false);
      }
    };

    if (formData.ambito === 'INMUEBLE') {
      loadInmuebles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.ambito]);

  const selectedAccount = accounts.find((acc) => acc.id?.toString() === formData.cuentaCargoId);
  const totalPorcentaje = (formData.afectacionesInmueble || []).reduce((sum, af) => sum + (af.porcentaje || 0), 0);

  const handleAddAfectacion = () => {
    const current = formData.afectacionesInmueble || [];

    if (current.length === 0 && formData.inmuebleId) {
      updateFormData({
        afectacionesInmueble: [
          { inmuebleId: formData.inmuebleId, porcentaje: 50 },
          { inmuebleId: '', porcentaje: 50 },
        ],
        inmuebleId: undefined,
      });
      return;
    }

    updateFormData({
      afectacionesInmueble: [...current, { inmuebleId: '', porcentaje: 0 }],
    });
  };

  const handleUpdateAfectacion = (idx: number, updates: Partial<AfectacionInmueblePrestamo>) => {
    const current = [...(formData.afectacionesInmueble || [])];
    current[idx] = { ...current[idx], ...updates };
    updateFormData({ afectacionesInmueble: current });
  };

  const handleRemoveAfectacion = (idx: number) => {
    const current = [...(formData.afectacionesInmueble || [])];
    current.splice(idx, 1);

    if (current.length <= 1) {
      updateFormData({
        inmuebleId: current[0]?.inmuebleId || undefined,
        afectacionesInmueble: undefined,
      });
      return;
    }

    updateFormData({ afectacionesInmueble: current });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          Ámbito
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => updateFormData({ ambito: 'PERSONAL', inmuebleId: undefined, afectacionesInmueble: undefined })}
            className={`relative rounded-atlas border-2 p-4 text-left transition-all ${
              formData.ambito === 'PERSONAL'
                ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
            }`}
          >
            <div className="flex items-center">
              <User className="h-5 w-5 mr-3" />
              <div>
                <div className="font-medium">Personal</div>
                <div className="text-sm text-text-gray">Préstamo personal</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateFormData({ ambito: 'INMUEBLE' })}
            className={`relative rounded-atlas border-2 p-4 text-left transition-all ${
              formData.ambito === 'INMUEBLE'
                ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
            }`}
          >
            <div className="flex items-center">
              <Home className="h-5 w-5 mr-3" />
              <div>
                <div className="font-medium">Inmueble</div>
                <div className="text-sm text-text-gray">Asociado a propiedad</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {formData.ambito === 'INMUEBLE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-atlas-navy-1">
              Inmueble(s) vinculado(s)
            </label>
            {(formData.inmuebleId || (formData.afectacionesInmueble?.length ?? 0) > 0) && (
              <button
                type="button"
                onClick={handleAddAfectacion}
                className="text-xs text-atlas-blue hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Añadir inmueble
              </button>
            )}
          </div>

          {inmueblesLoading ? (
            <div className="w-full rounded-atlas border border-gray-300 p-3 bg-gray-50 text-center text-sm text-text-gray">
              Cargando inmuebles...
            </div>
          ) : inmuebles.length === 0 ? (
            <div className="w-full rounded-atlas border-2 border-dashed border-gray-300 p-4 bg-gray-50">
              <div className="flex flex-col items-center gap-3">
                <Building className="h-8 w-8 text-text-gray" />
                <p className="text-sm text-text-gray text-center">
                  No hay inmuebles disponibles
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/inmuebles/cartera/nuevo')}
                  className="inline-flex items-center px-4 py-2 bg-primary-50 border border-atlas-blue text-atlas-blue rounded-atlas hover:bg-primary-100 transition-colors text-sm font-medium"
                >
                  <Building className="h-4 w-4 mr-2" />
                  Crear primer inmueble
                </button>
              </div>
            </div>
          ) : (
            <>
              {(!formData.afectacionesInmueble || formData.afectacionesInmueble.length === 0) && (
                <>
                  <select
                    id="inmuebleId"
                    value={formData.inmuebleId || ''}
                    onChange={(e) => updateFormData({ inmuebleId: e.target.value || undefined })}
                    className={`w-full rounded-atlas border shadow-sm focus:border-atlas-blue focus:ring-atlas-blue ${
                      getFieldError('inmuebleId') ? 'border-error-300 focus:border-error-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Seleccionar inmueble</option>
                    {inmuebles.map((inmueble) => (
                      <option key={inmueble.id} value={inmueble.id}>
                        {inmueble.alias} – {inmueble.direccion.calle}, {inmueble.direccion.municipio}
                      </option>
                    ))}
                  </select>
                  {getFieldError('inmuebleId') && (
                    <p className="mt-1 text-sm text-error-600">{getFieldError('inmuebleId')}</p>
                  )}
                </>
              )}

              {formData.afectacionesInmueble && formData.afectacionesInmueble.length > 0 && (
                <div className="border border-gray-200 rounded-atlas overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inmueble</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">% préstamo</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.afectacionesInmueble.map((af, idx) => (
                        <tr key={`${af.inmuebleId || 'nuevo'}-${idx}`}>
                          <td className="px-3 py-2">
                            <select
                              value={af.inmuebleId}
                              onChange={(e) => handleUpdateAfectacion(idx, { inmuebleId: e.target.value })}
                              className="w-full border-gray-300 rounded text-sm"
                            >
                              <option value="">Seleccionar...</option>
                              {inmuebles.map((inmueble) => (
                                <option key={inmueble.id} value={inmueble.id}>
                                  {inmueble.alias}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={af.porcentaje}
                                onChange={(e) => handleUpdateAfectacion(idx, { porcentaje: parseFloat(e.target.value) || 0 })}
                                className="w-20 text-right border-gray-300 rounded text-sm"
                              />
                              <span className="text-gray-500 text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveAfectacion(idx)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td className="px-3 py-2 text-xs font-medium text-gray-500">Total</td>
                        <td className={`px-3 py-2 text-right text-xs font-semibold ${
                          Math.abs(totalPorcentaje - 100) <= 0.01 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {totalPorcentaje.toFixed(2)}%
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  {getFieldError('afectacionesInmueble') && (
                    <div className="px-3 py-2 bg-red-50 text-xs text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {getFieldError('afectacionesInmueble')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <label htmlFor="cuentaCargoId" className="block text-sm font-medium text-atlas-navy-1 mb-2">
          <CreditCard className="h-4 w-4 inline mr-1" />
          Cuenta de cargo *
        </label>

        {loading ? (
          <div className="w-full rounded-atlas border border-gray-300 p-3 bg-gray-50 text-center text-sm text-text-gray">
            Cargando cuentas...
          </div>
        ) : accounts.length === 0 ? (
          <div className="w-full rounded-atlas border border-gray-300 p-3 bg-gray-50">
            <p className="text-sm text-text-gray mb-2">
              No hay cuentas disponibles.
            </p>
            <button
              type="button"
              onClick={() => {
                window.open('/cuenta/cuentas', '_blank');
              }}
              className="atlas-atlas-atlas-atlas-btn-ghost-horizon text-sm underline"
            >
              Ir a Cuenta → Configuración → Cuentas Bancarias
            </button>
          </div>
        ) : (
          <select
            id="cuentaCargoId"
            value={formData.cuentaCargoId || ''}
            onChange={(e) => updateFormData({ cuentaCargoId: e.target.value })}
            className={`w-full rounded-atlas border shadow-sm focus:ring-atlas-blue ${
              getFieldError('cuentaCargoId')
                ? 'border-error-300 focus:border-error-500'
                : 'border-gray-300 focus:border-atlas-blue'
            }`}
          >
            <option value="">Seleccionar cuenta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id?.toString()}>
                {account.alias} - {account.banco?.name || 'Banco'} - {account.iban}
              </option>
            ))}
          </select>
        )}
        {getFieldError('cuentaCargoId') && (
          <p className="mt-1 text-sm text-error-600">{getFieldError('cuentaCargoId')}</p>
        )}

        {selectedAccount && (
          <div className="mt-3 p-3 bg-gray-50 rounded-atlas border border-gray-200">
            <AccountOption account={selectedAccount} size="md" />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="alias" className="block text-sm font-medium text-atlas-navy-1 mb-2">
          Alias (opcional)
        </label>
        <input
          type="text"
          id="alias"
          value={formData.alias || ''}
          onChange={(e) => updateFormData({ alias: e.target.value || undefined })}
          placeholder="Ej: Préstamo vivienda principal"
          className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fechaFirma" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Fecha firma *
          </label>
          <input
            type="date"
            id="fechaFirma"
            value={formData.fechaFirma || ''}
            onChange={(e) => updateFormData({ fechaFirma: e.target.value })}
            className={`w-full rounded-atlas border shadow-sm focus:ring-atlas-blue ${
              getFieldError('fechaFirma')
                ? 'border-error-300 focus:border-error-500'
                : 'border-gray-300 focus:border-atlas-blue'
            }`}
          />
          {getFieldError('fechaFirma') && (
            <p className="mt-1 text-sm text-error-600">{getFieldError('fechaFirma')}</p>
          )}
        </div>

        <div>
          <label htmlFor="fechaPrimerCargo" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            <Clock className="h-4 w-4 inline mr-1" />
            Primer cargo *
          </label>
          <input
            type="date"
            id="fechaPrimerCargo"
            value={formData.fechaPrimerCargo || ''}
            onChange={(e) => updateFormData({ fechaPrimerCargo: e.target.value })}
            className={`w-full rounded-atlas border shadow-sm focus:ring-atlas-blue ${
              getFieldError('fechaPrimerCargo')
                ? 'border-error-300 focus:border-error-500'
                : 'border-gray-300 focus:border-atlas-blue'
            }`}
          />
          {getFieldError('fechaPrimerCargo') && (
            <p className="mt-1 text-sm text-error-600">{getFieldError('fechaPrimerCargo')}</p>
          )}
        </div>

        <div>
          <label htmlFor="diaCobroMes" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            Día de cobro
          </label>
          <select
            id="diaCobroMes"
            value={formData.diaCobroMes || 1}
            onChange={(e) => updateFormData({ diaCobroMes: parseInt(e.target.value, 10) })}
            className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>Día {day}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          Esquema primer recibo
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'NORMAL', label: 'Normal', description: 'Cuota estándar desde el primer mes' },
            { value: 'SOLO_INTERESES', label: 'Solo intereses', description: 'Primer mes solo intereses' },
            { value: 'PRORRATA', label: 'Prorrata', description: 'Primer periodo prorrateado por días' },
          ].map((scheme) => (
            <button
              key={scheme.value}
              type="button"
              onClick={() => updateFormData({ esquemaPrimerRecibo: scheme.value as any })}
              className={`rounded-atlas border-2 p-3 text-left transition-all ${
                formData.esquemaPrimerRecibo === scheme.value
                  ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                  : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
              }`}
            >
              <div className="font-medium">{scheme.label}</div>
              <div className="text-xs text-text-gray mt-1">{scheme.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IdentificacionBlock;
