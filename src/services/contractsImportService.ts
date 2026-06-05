// Importador de contratos Rentila/plantilla · el flujo real (wizard) vive en
// contractDraftService + contractImportCreationService. Aquí solo queda el
// helper de cuentas, consumido por AccountSelectionModal y la creación de
// tesorería. La antigua `importContractsFromRentilaRows` (camino directo sin
// wizard, con el mapeo de habitación obsoleto) se retiró en el PR FIX (commit 6).
import { initDB, Account } from './db';

export const getAvailableAccounts = async (): Promise<Account[]> => {
  const db = await initDB();
  const accounts = await db.getAll('accounts');

  return accounts
    .filter((account) => account.status === 'ACTIVE' || account.activa)
    .map((account) => {
      const normalizedId = Number(account.id);
      return {
        ...account,
        id: Number.isFinite(normalizedId) ? normalizedId : undefined,
      };
    })
    .filter((account) => !!account.id);
};
