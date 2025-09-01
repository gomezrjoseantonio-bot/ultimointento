import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronUp, ChevronDown, Plus, Eye, X, Building, User, XCircle, CheckCircle } from 'lucide-react';
import { enhancedCSVParser } from '../../services/csvParserService';
import { ParsedMovement, ParseResult } from '../../types/bankProfiles';
import { initDB, Account } from '../../services/db';
import { formatEuro, formatDate } from '../../utils/formatUtils';
import toast from 'react-hot-toast';

interface BankStatementDistributorProps {
  document: any;
  onClose: () => void;
  onComplete: (result: DistributionResult) => void;
}

interface MovementDistribution {
  movement: ParsedMovement;
  destination: 'horizon' | 'pulse' | 'skip';
  accountId?: number;
}

interface DistributionResult {
  horizonMovements: { movement: ParsedMovement; accountId: number }[];
  pulseMovements: { movement: ParsedMovement; accountId: number }[];
  skippedMovements: ParsedMovement[];
  summary: {
    horizon: number;
    pulse: number;
    skip: number;
  };
}

const BankStatementDistributor: React.FC<BankStatementDistributorProps> = ({
  document,
  onClose,
  onComplete
}) => {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [distributions, setDistributions] = useState<MovementDistribution[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<number[]>([]);
  const [bulkDestination, setBulkDestination] = useState<'horizon' | 'pulse' | 'skip'>('horizon');
  const [bulkAccountId, setBulkAccountId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank: '',
    iban: '',
    initialBalance: 0,
    destination: 'horizon' as 'horizon' | 'pulse'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Parse the bank statement file
      const result = await enhancedCSVParser.parseFile(document.content);
      setParseResult(result);

      // Initialize distributions with all movements set to skip by default
      const initialDistributions = result.movements.map(movement => ({
        movement,
        destination: 'skip' as const,
        accountId: undefined
      }));
      setDistributions(initialDistributions);

      // Load accounts
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      setAccounts(allAccounts);

    } catch (error) {
      toast.error(`Error procesando extracto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      console.error('Error processing bank statement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMovementDistribution = (index: number, destination: 'horizon' | 'pulse' | 'skip', accountId?: number) => {
    setDistributions(prev => prev.map((dist, i) => 
      i === index ? { ...dist, destination, accountId } : dist
    ));
  };

  const handleBulkUpdate = () => {
    if (selectedMovements.length === 0) {
      toast.error('Selecciona al menos un movimiento');
      return;
    }

    if ((bulkDestination === 'horizon' || bulkDestination === 'pulse') && !bulkAccountId) {
      toast.error('Selecciona una cuenta para la asignación masiva');
      return;
    }

    setDistributions(prev => prev.map((dist, index) => 
      selectedMovements.includes(index) 
        ? { ...dist, destination: bulkDestination, accountId: bulkDestination === 'skip' ? undefined : bulkAccountId || undefined }
        : dist
    ));

    setSelectedMovements([]);
    toast.success(`${selectedMovements.length} movimiento(s) actualizados`);
  };

  const toggleMovementSelection = (index: number) => {
    setSelectedMovements(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleAllMovements = () => {
    if (selectedMovements.length === distributions.length) {
      setSelectedMovements([]);
    } else {
      setSelectedMovements(distributions.map((_, index) => index));
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) {
      toast.error('El nombre de la cuenta es obligatorio');
      return;
    }

    try {
      const db = await initDB();
      const now = new Date().toISOString();
      
      const account: Account = {
        id: Date.now(),
        name: newAccount.name.trim(),
        bank: newAccount.bank.trim(),
        iban: newAccount.iban.trim(),
        balance: newAccount.initialBalance,
        destination: newAccount.destination,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      await db.add('accounts', account);
      setAccounts(prev => [...prev, account]);
      
      // Reset form
      setNewAccount({
        name: '',
        bank: '',
        iban: '',
        initialBalance: 0,
        destination: 'horizon'
      });
      setShowCreateAccount(false);
      
      toast.success('Cuenta creada correctamente');
    } catch (error) {
      toast.error('Error creando la cuenta');
      console.error('Error creating account:', error);
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);

    try {
      // Validate that all non-skipped movements have accounts assigned
      const invalidDistributions = distributions.filter(dist => 
        (dist.destination === 'horizon' || dist.destination === 'pulse') && !dist.accountId
      );

      if (invalidDistributions.length > 0) {
        toast.error('Todos los movimientos asignados deben tener una cuenta seleccionada');
        setIsProcessing(false);
        return;
      }

      // Prepare result
      const result: DistributionResult = {
        horizonMovements: distributions
          .filter(dist => dist.destination === 'horizon' && dist.accountId)
          .map(dist => ({ movement: dist.movement, accountId: dist.accountId! })),
        pulseMovements: distributions
          .filter(dist => dist.destination === 'pulse' && dist.accountId)
          .map(dist => ({ movement: dist.movement, accountId: dist.accountId! })),
        skippedMovements: distributions
          .filter(dist => dist.destination === 'skip')
          .map(dist => dist.movement),
        summary: {
          horizon: distributions.filter(dist => dist.destination === 'horizon').length,
          pulse: distributions.filter(dist => dist.destination === 'pulse').length,
          skip: distributions.filter(dist => dist.destination === 'skip').length
        }
      };

      onComplete(result);
    } catch (error) {
      toast.error('Error procesando la distribución');
      console.error('Error processing distribution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Procesando extracto bancario...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!parseResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <X className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Error de procesamiento</h3>
            <p className="text-neutral-600 mb-4">
              No se pudo procesar el extracto bancario
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const horizonAccounts = accounts.filter(acc => acc.destination === 'horizon');
  const pulseAccounts = accounts.filter(acc => acc.destination === 'pulse');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-screen overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Distribuidor de Extracto Bancario
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              {document.filename} • {parseResult.movements.length} movimientos detectados
              {parseResult.detectedBank && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {parseResult.detectedBank.bankKey}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedMovements.length === distributions.length}
                onChange={toggleAllMovements}
                className="rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                {selectedMovements.length > 0 
                  ? `${selectedMovements.length} seleccionados`
                  : 'Seleccionar todos'
                }
              </span>
            </div>

            {selectedMovements.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkDestination}
                    onChange={(e) => setBulkDestination(e.target.value as 'horizon' | 'pulse' | 'skip')}
                    className="text-sm border border-neutral-300 rounded px-2 py-1"
                  >
                    <option value="horizon">Horizon</option>
                    <option value="pulse">Pulse</option>
                    <option value="skip">Omitir</option>
                  </select>

                  {(bulkDestination === 'horizon' || bulkDestination === 'pulse') && (
                    <select
                      value={bulkAccountId || ''}
                      onChange={(e) => setBulkAccountId(e.target.value ? Number(e.target.value) : null)}
                      className="text-sm border border-neutral-300 rounded px-2 py-1"
                    >
                      <option value="">Seleccionar cuenta</option>
                      {(bulkDestination === 'horizon' ? horizonAccounts : pulseAccounts).map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.bank})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handleBulkUpdate}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Aplicar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Movements List */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-2">
            {distributions.map((distribution, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  selectedMovements.includes(index) ? 'border-blue-300 bg-blue-50' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedMovements.includes(index)}
                    onChange={() => toggleMovementSelection(index)}
                    className="rounded border-neutral-300"
                  />

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        {formatDate(distribution.movement.date)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {distribution.movement.valueDate && 
                          `Valor: ${formatDate(distribution.movement.valueDate)}`
                        }
                      </div>
                    </div>

                    <div>
                      <div className={`text-sm font-medium ${
                        distribution.movement.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatEuro(distribution.movement.amount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-neutral-900 truncate">
                        {distribution.movement.description}
                      </div>
                      {distribution.movement.counterparty && (
                        <div className="text-xs text-neutral-500 truncate">
                          {distribution.movement.counterparty}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={distribution.destination}
                        onChange={(e) => updateMovementDistribution(
                          index, 
                          e.target.value as 'horizon' | 'pulse' | 'skip'
                        )}
                        className="text-sm border border-neutral-300 rounded px-2 py-1 flex-1"
                      >
                        <option value="skip">Omitir</option>
                        <option value="horizon">Horizon</option>
                        <option value="pulse">Pulse</option>
                      </select>

                      {(distribution.destination === 'horizon' || distribution.destination === 'pulse') && (
                        <select
                          value={distribution.accountId || ''}
                          onChange={(e) => updateMovementDistribution(
                            index,
                            distribution.destination,
                            e.target.value ? Number(e.target.value) : undefined
                          )}
                          className="text-sm border border-neutral-300 rounded px-2 py-1 flex-1"
                        >
                          <option value="">Seleccionar cuenta</option>
                          {(distribution.destination === 'horizon' ? horizonAccounts : pulseAccounts).map(account => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Account Section */}
        {showCreateAccount && (
          <div className="border-t border-neutral-200 p-4 bg-neutral-50">
            <h3 className="text-sm font-medium text-neutral-900 mb-3">Crear nueva cuenta</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Nombre de la cuenta"
                value={newAccount.name}
                onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                className="text-sm border border-neutral-300 rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Banco"
                value={newAccount.bank}
                onChange={(e) => setNewAccount(prev => ({ ...prev, bank: e.target.value }))}
                className="text-sm border border-neutral-300 rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="IBAN (opcional)"
                value={newAccount.iban}
                onChange={(e) => setNewAccount(prev => ({ ...prev, iban: e.target.value }))}
                className="text-sm border border-neutral-300 rounded px-3 py-2"
              />
              <select
                value={newAccount.destination}
                onChange={(e) => setNewAccount(prev => ({ ...prev, destination: e.target.value as 'horizon' | 'pulse' }))}
                className="text-sm border border-neutral-300 rounded px-3 py-2"
              >
                <option value="horizon">Horizon</option>
                <option value="pulse">Pulse</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAccount}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Crear
                </button>
                <button
                  onClick={() => setShowCreateAccount(false)}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm hover:bg-neutral-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreateAccount(!showCreateAccount)}
              className="flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva cuenta
            </button>
            
            <div className="text-sm text-neutral-600">
              Horizon: {distributions.filter(d => d.destination === 'horizon').length} • 
              Pulse: {distributions.filter(d => d.destination === 'pulse').length} • 
              Omitir: {distributions.filter(d => d.destination === 'skip').length}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? 'Procesando...' : 'Confirmar distribución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementDistributor;