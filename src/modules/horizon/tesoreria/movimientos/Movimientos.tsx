import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Filter, Edit2, Link, Trash2 } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import CSVImportModal from '../../../../components/treasury/CSVImportModal';
import { initDB, Account, Movement, ImportBatch, Document } from '../../../../services/db';
import { ParsedMovement, generateImportBatchId } from '../../../../services/csvParserService';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';
import toast from 'react-hot-toast';

const Movimientos: React.FC = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load accounts and movements on component mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const db = await initDB();
      
      // Load Horizon accounts
      const allAccounts = await db.getAll('accounts');
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      setAccounts(horizonAccounts);
      
      // Load movements for Horizon accounts
      const allMovements = await db.getAll('movements');
      const horizonMovements = allMovements.filter(mov => 
        horizonAccounts.some(acc => acc.id === mov.accountId)
      );
      setMovements(horizonMovements);
      
    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast.error('Error al cargar los datos de tesorería');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateAccount = async (accountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> => {
    try {
      const db = await initDB();
      const now = new Date().toISOString();
      
      const account: Account = {
        ...accountData,
        createdAt: now,
        updatedAt: now
      };
      
      const id = await db.add('accounts', account) as number;
      const createdAccount: Account = { ...account, id };
      
      // Update local state
      setAccounts(prev => [...prev, createdAccount]);
      
      return createdAccount;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  };
  
  const handleImportMovements = async (
    parsedMovements: ParsedMovement[],
    accountId: number,
    skipDuplicates: boolean,
    csvFile: File
  ): Promise<void> => {
    try {
      const db = await initDB();
      const now = new Date().toISOString();
      const batchId = generateImportBatchId();
      
      // Filter duplicates if requested
      let movementsToImport = parsedMovements;
      if (skipDuplicates) {
        const existingMovements = movements.filter(m => m.accountId === accountId);
        movementsToImport = parsedMovements.filter(parsed => {
          return !existingMovements.some(existing =>
            existing.date === parsed.date &&
            existing.amount === parsed.amount &&
            existing.description === parsed.description
          );
        });
      }
      
      // Create movements
      const newMovements: Movement[] = [];
      for (let i = 0; i < movementsToImport.length; i++) {
        const parsed = movementsToImport[i];
        const movement: Movement = {
          accountId,
          date: parsed.date,
          valueDate: parsed.valueDate,
          amount: parsed.amount,
          description: parsed.description,
          counterparty: parsed.counterparty,
          reference: parsed.reference,
          status: 'pendiente',
          importBatch: batchId,
          csvRowIndex: parsedMovements.indexOf(parsed),
          createdAt: now,
          updatedAt: now
        };
        
        const id = await db.add('movements', movement) as number;
        newMovements.push({ ...movement, id });
      }
      
      // Create import batch record
      const importBatch: ImportBatch = {
        id: batchId,
        filename: csvFile.name,
        accountId,
        totalRows: parsedMovements.length,
        importedRows: movementsToImport.length,
        skippedRows: parsedMovements.length - movementsToImport.length,
        duplicatedRows: skipDuplicates ? parsedMovements.length - movementsToImport.length : 0,
        createdAt: now
      };
      
      await db.add('importBatches', importBatch);
      
      // Create inbox document for the CSV extract
      const csvDocument: Document = {
        filename: csvFile.name,
        type: csvFile.type || 'text/csv',
        size: csvFile.size,
        lastModified: csvFile.lastModified,
        content: csvFile,
        uploadDate: now,
        metadata: {
          title: `Extracto bancario - ${csvFile.name}`,
          description: `Importación automática desde Tesorería`,
          tipo: 'Extracto bancario',
          status: 'Asignado',
          entityType: 'personal',
          extractMetadata: {
            bank: 'Detectado automáticamente',
            totalRows: parsedMovements.length,
            importedRows: movementsToImport.length,
            accountId: accountId,
            importBatchId: batchId,
            dateRange: parsedMovements.length > 0 ? {
              from: parsedMovements[parsedMovements.length - 1].date,
              to: parsedMovements[0].date
            } : undefined
          }
        }
      };
      
      const docId = await db.add('documents', csvDocument) as number;
      
      // Update import batch with inbox item ID
      importBatch.inboxItemId = docId;
      await db.put('importBatches', importBatch);
      
      // Update account balance
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
        const balanceChange = newMovements.reduce((sum, mov) => sum + mov.amount, 0);
        account.balance += balanceChange;
        account.updatedAt = now;
        await db.put('accounts', account);
        setAccounts(prev => prev.map(acc => acc.id === accountId ? account : acc));
      }
      
      // Update local state
      setMovements(prev => [...prev, ...newMovements]);
      
      // Show success toast with link to inbox
      const successMessage = `${movementsToImport.length} movimientos importados correctamente`;
      toast.success(
        <div>
          <div>{successMessage}</div>
          <button
            onClick={() => window.location.href = '/inbox'}
            className="text-sm underline mt-1 hover:no-underline"
          >
            Ver en Inbox
          </button>
        </div>,
        { duration: 6000 }
      );
      
    } catch (error) {
      console.error('Error importing movements:', error);
      throw error;
    }
  };
  
  if (loading) {
    return (
      <PageLayout title="Movimientos" subtitle="Historial de transacciones bancarias.">
        <div className="flex items-center justify-center py-12">
          <div className="text-neutral-500">Cargando...</div>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout title="Movimientos" subtitle="Historial de transacciones bancarias.">
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Movimientos</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {/* TODO: Add manual movement */}}
              className="flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Añadir movimiento
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#011f42] transition-colors"
            >
              <Upload className="h-4 w-4" />
              Importar extracto (CSV)
            </button>
          </div>
        </div>
        
        {/* Accounts Summary */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-neutral-900">{account.name}</h3>
                    <p className="text-sm text-neutral-500">{account.bank}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-neutral-900">
                      {formatEuro(account.balance)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {account.isActive ? 'Activa' : 'Inactiva'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Movements List */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900">
                Últimos movimientos
              </h2>
              <div className="flex items-center gap-2">
                <button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <Upload className="h-12 w-12 mb-4 text-neutral-300" />
              <h3 className="text-lg font-medium mb-2">No hay movimientos</h3>
              <p className="text-sm mb-4">Comienza importando un extracto bancario en formato CSV</p>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#011f42] transition-colors"
              >
                Importar extracto CSV
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Contraparte
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {movements.slice(0, 50).map((movement) => (
                    <tr key={movement.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {formatDate(movement.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 max-w-xs">
                        <div className="truncate" title={movement.description}>
                          {movement.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        {movement.counterparty || '—'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        movement.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatEuro(movement.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          movement.status === 'conciliado' ? 'bg-green-100 text-green-800' :
                          movement.status === 'parcial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {movement.status === 'conciliado' ? 'Conciliado' :
                           movement.status === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <button className="text-neutral-400 hover:text-neutral-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button className="text-neutral-400 hover:text-blue-600">
                            <Link className="h-4 w-4" />
                          </button>
                          <button className="text-neutral-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportMovements}
        accounts={accounts}
        onCreateAccount={handleCreateAccount}
        destination="horizon"
      />
    </PageLayout>
  );
};

export default Movimientos;