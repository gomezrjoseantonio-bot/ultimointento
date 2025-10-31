import React from 'react';
import { Home, User, Calendar, Clock } from 'lucide-react';
import { PrestamoFinanciacion, ValidationError } from '../../../../../types/financiacion';
import { cuentasService } from '../../../../../services/cuentasService';
import { Account } from '../../../../../services/db';
import AccountOption from '../../../../../components/common/AccountOption';

interface IdentificacionBlockProps {
  formData: Partial<PrestamoFinanciacion>;
  updateFormData: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: ValidationError[];
  calculoLive?: any;
}

const IdentificacionBlock: React.FC<IdentificacionBlockProps> = ({ 
  formData, 
  updateFormData, 
  errors 
}) => {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getFieldError = (fieldName: string) => errors.find(e => e.field === fieldName)?.message;

  // Load accounts on component mount
  React.useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsList = await cuentasService.list();
        setAccounts(accountsList.filter(acc => acc.activa)); // Only show active accounts
      } catch (error) {
        console.error('[PRESTAMOS] Failed to load accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();

    // Subscribe to account updates
    const unsubscribe = cuentasService.on((event) => {
      if (event === 'accounts:updated') {
        loadAccounts();
      }
    });

    return unsubscribe;
  }, []);

  const selectedAccount = accounts.find(acc => acc.id?.toString() === formData.cuentaCargoId);

  return (
    <div className="space-y-6">
      {/* Scope Selection */}
      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          Ámbito
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => updateFormData({ ambito: 'PERSONAL', inmuebleId: undefined })}
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

      {/* Property selection (only if scope is INMUEBLE) */}
      {formData.ambito === 'INMUEBLE' && (
        <div>
          <label htmlFor="inmuebleId" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            Inmueble
          </label>
          <select
            id="inmuebleId"
            value={formData.inmuebleId || ''}
            onChange={(e) => updateFormData({ inmuebleId: e.target.value || undefined })}
            className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
          >
            <option value="">Seleccionar inmueble</option>
            <option value="prop1">Calle Mayor 123, Madrid</option>
            <option value="prop2">Avenida Diagonal 456, Barcelona</option>
            <option value="prop3">Calle Valencia 789, Valencia</option>
          </select>
        </div>
      )}

      {/* Account Selection */}
      <div>
        <label htmlFor="cuentaCargoId" className="block text-sm font-medium text-atlas-navy-1 mb-2">
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
                // Open Cuenta → Configuración → Cuentas Bancarias in a new tab to maintain form state
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
            {accounts.map(account => (
              <option key={account.id} value={account.id?.toString()}>
                {account.alias} - {account.banco?.name || 'Banco'} - {account.iban}
              </option>
            ))}
          </select>
        )}
        {getFieldError('cuentaCargoId') && (
          <p className="mt-1 text-sm text-error-600">{getFieldError('cuentaCargoId')}</p>
        )}
        
        {/* Show selected account details using AccountOption */}
        {selectedAccount && (
          <div className="mt-3 p-3 bg-gray-50 rounded-atlas border border-gray-200">
            <AccountOption account={selectedAccount} size="md" />
          </div>
        )}
      </div>

      {/* Alias */}
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

      {/* Dates Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Signing Date */}
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

        {/* First Charge Date */}
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

        {/* Collection Day */}
        <div>
          <label htmlFor="diaCobroMes" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            Día de cobro
          </label>
          <select
            id="diaCobroMes"
            value={formData.diaCobroMes || 1}
            onChange={(e) => updateFormData({ diaCobroMes: parseInt(e.target.value) })}
            className="w-full rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
              <option key={day} value={day}>Día {day}</option>
            ))}
          </select>
        </div>
      </div>

      {/* First Receipt Scheme */}
      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          Esquema primer recibo
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'NORMAL', label: 'Normal', description: 'Cuota estándar desde el primer mes' },
            { value: 'SOLO_INTERESES', label: 'Solo intereses', description: 'Primer mes solo intereses' },
            { value: 'PRORRATA', label: 'Prorrata', description: 'Primer periodo prorrateado por días' }
          ].map(scheme => (
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