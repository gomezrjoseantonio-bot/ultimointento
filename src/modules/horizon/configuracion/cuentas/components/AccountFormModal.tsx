// ============================================================================
// S-WIZARD-CUENTA-V3 · sub-tarea 2 · placeholder transitorio
// ============================================================================
//
// El antiguo AccountFormModal (modal pequeño · max-w-md · botón navy · IBAN
// obligatorio · sin preview live · 513 líneas) se ha eliminado entero según
// spec docs/mockups/S-WIZARD-CUENTA-V3.md §2 sub-tarea 2.
//
// Este placeholder mantiene la signatura pública (open/onClose/onSuccess/
// editingAccount) para que los 3 callers existentes compilen mientras se
// construye la pantalla única ATLAS v8 en sub-tarea 3:
//
//   · src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx
//   · src/modules/tesoreria/tabs/VistaGeneralTab.tsx
//   · src/components/treasury/TesoreriaV4.tsx
//
// En sub-tarea 4 los callers se reescriben para importar CuentaWizard
// directamente desde src/components/cuenta/CuentaWizard.tsx y este archivo
// se borra por completo.
// ============================================================================

import React from 'react';
import type { Account } from '../../../../../services/db';

export interface AccountFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingAccount?: Account | null;
}

const AccountFormModal: React.FC<AccountFormModalProps> = () => null;

export default AccountFormModal;
