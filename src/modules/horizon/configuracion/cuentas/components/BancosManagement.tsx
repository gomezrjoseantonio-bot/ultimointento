import React, { useState } from 'react';
import { Banknote, Info } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * BancosManagement - ATLAS Design System
 * 
 * Simplified account management without types per ATLAS guide.
 * This is a placeholder implementation for the ATLAS design system demo.
 * In a real implementation, this would integrate with the existing Account model.
 */
const BancosManagement: React.FC = () => {
  const [accounts] = useState([
    {
      id: 1,
      alias: 'Cuenta Principal',
      bank: 'Banco Santander',
      iban: 'ES21 1465 0100 72 2030876293',
      logoUrl: null
    },
    {
      id: 2,
      alias: 'Cuenta Secundaria',
      bank: 'BBVA',
      iban: 'ES91 2100 0418 45 0200051332',
      logoUrl: null
    }
  ]);

  const handleNewAccount = () => {
    toast.success('Funcionalidad de nueva cuenta en desarrollo');
  };

  return (
    <div className="px-6">
      {/* ATLAS Info Banner */}
      <div className="mb-6 bg-blue-50 border border-atlas-blue/20 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-6 h-6 text-atlas-blue mt-0.5 mr-3 flex-shrink-0" style={{ strokeWidth: 1.5 }} />
          <div>
            <h3 className="font-medium text-atlas-navy-1 mb-1">Cuentas simplificadas</h3>
            <p className="text-sm text-text-gray">
              Las cuentas ya no tienen tipos (Personal/Inmuebles/Mixto). 
              La clasificación de movimientos se realiza mediante reglas automáticas y presupuesto.
            </p>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-atlas-navy-1">
              Cuentas bancarias ({accounts.length})
            </h2>
            <button
              onClick={handleNewAccount}
              className="inline-flex items-center px-4 py-2 bg-atlas-blue text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              Nueva cuenta
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {accounts.map((account) => (
            <div key={account.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-gray-500" style={{ strokeWidth: 1.5 }} />
                  </div>
                  <div>
                    <h3 className="font-medium text-atlas-navy-1">{account.alias}</h3>
                    <p className="text-sm text-text-gray">{account.bank}</p>
                    <p className="text-sm text-text-gray font-mono">
                      {account.iban}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-text-gray">
                  Solo campos básicos: Banco, Alias, IBAN, Logo
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BancosManagement;