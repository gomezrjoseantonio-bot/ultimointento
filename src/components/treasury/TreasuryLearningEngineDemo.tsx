/**
 * Treasury Learning Engine Demo Component
 * 
 * Demonstrates the full learning engine functionality:
 * - Manual reconciliation creates rules
 * - Backfill applies to similar movements
 * - New imports use learned rules
 * - Audit logs track actions
 */

import React, { useState, useEffect } from 'react';
import { Brain, FileText, TrendingUp, Database, Check, AlertCircle } from 'lucide-react';
import { 
  performManualReconciliation,
  applyAllRulesOnImport,
  getLearningRulesStats,
  getLearningLogs
} from '../../services/movementLearningService';
import { initDB, Movement, LearningLog } from '../../services/db';
import { MovementStatusChip } from './MovementStatusChip';

// Sample movement data for demo
const sampleMovements: Omit<Movement, 'id'>[] = [
  {
    date: '2024-01-15',
    amount: -45.23,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF123456',
    counterparty: 'ENDESA ESPAÑA SA',
    accountId: 999, // Demo account ID
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    category: { tipo: '', subtipo: '' },
    source: 'import',
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    date: '2024-01-20',
    amount: -42.15,
    description: 'ENDESA ESPAÑA SA RECIBO ELECTRICIDAD FEB2024 REF789012',
    counterparty: 'ENDESA ESPAÑA SA',
    accountId: 999, // Demo account ID
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    category: { tipo: '', subtipo: '' },
    source: 'import',
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    date: '2024-02-15',
    amount: -38.90,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ MAR2024 REF345678',
    counterparty: 'ENDESA ESPAÑA SA',
    accountId: 999, // Demo account ID
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    category: { tipo: '', subtipo: '' },
    source: 'import',
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const newImportMovements: Omit<Movement, 'id'>[] = [
  {
    date: '2024-03-15',
    amount: -41.77,
    description: 'ENDESA ESPAÑA SA RECIBO ELECTRICIDAD ABR2024 REF987654',
    counterparty: 'ENDESA ESPAÑA SA',
    accountId: 999, // Demo account ID
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    category: { tipo: '', subtipo: '' },
    source: 'import',
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

interface LearningStats {
  totalRules: number;
  totalApplications: number;
}

export const TreasuryLearningEngineDemo: React.FC = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stats, setStats] = useState<LearningStats>({ totalRules: 0, totalApplications: 0 });
  const [logs, setLogs] = useState<LearningLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');

  // Initialize demo data
  useEffect(() => {
    const initDemo = async () => {
      try {
        const db = await initDB();
        
        // Clear existing demo data
        const existingMovements = await db.getAll('movements');
        for (const movement of existingMovements) {
          if (movement.accountId === 999) { // Demo account ID
            await db.delete('movements', movement.id!);
          }
        }
        
        // Add sample movements
        const addedMovements: Movement[] = [];
        for (const movement of sampleMovements) {
          const id = await db.add('movements', movement);
          addedMovements.push({ ...movement, id: id as number });
        }
        
        setMovements(addedMovements);
        await updateStats();
        setMessage('Demo inicializado con movimientos de Endesa sin clasificar');
      } catch (error) {
        console.error('Error initializing demo:', error);
        setMessage('Error inicializando demo');
      }
    };
    
    initDemo();
  }, []);

  const updateStats = async () => {
    try {
      const rulesStats = await getLearningRulesStats();
      const recentLogs = await getLearningLogs(10);
      setStats({
        totalRules: rulesStats.totalRules,
        totalApplications: rulesStats.totalApplications
      });
      setLogs(recentLogs);
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  };

  const performReconciliation = async () => {
    if (movements.length === 0) return;
    
    setIsLoading(true);
    try {
      const firstMovement = movements[0];
      const result = await performManualReconciliation(
        firstMovement.id!,
        'SUMINISTROS',
        'INMUEBLE',
        'inmueble-demo'
      );
      
      // Refresh movements
      const db = await initDB();
      const updatedMovements = await db.getAll('movements');
      const demoMovements = updatedMovements.filter(m => m.accountId === 999);
      setMovements(demoMovements);
      
      await updateStats();
      setStep(1);
      setMessage(`Conciliación manual completada. ${result.appliedToSimilar} movimientos similares clasificados automáticamente.`);
    } catch (error) {
      console.error('Error performing reconciliation:', error);
      setMessage('Error en la conciliación manual');
    }
    setIsLoading(false);
  };

  const simulateNewImport = async () => {
    setIsLoading(true);
    try {
      // Apply learning rules to new movements
      const processedMovements = await applyAllRulesOnImport(newImportMovements);
      
      // Save to database
      const db = await initDB();
      const addedMovements: Movement[] = [];
      for (const movement of processedMovements) {
        const id = await db.add('movements', movement);
        addedMovements.push({ ...movement, id: id as number });
      }
      
      // Refresh all movements
      const allMovements = await db.getAll('movements');
      const demoMovements = allMovements.filter(m => m.accountId === 999);
      setMovements(demoMovements);
      
      await updateStats();
      setStep(2);
      setMessage('Nueva importación procesada. Reglas de aprendizaje aplicadas automáticamente.');
    } catch (error) {
      console.error('Error simulating import:', error);
      setMessage('Error en la simulación de importación');
    }
    setIsLoading(false);
  };

  const resetDemo = async () => {
    setStep(0);
    try {
      const db = await initDB();
      
      // Clear existing demo data
      const existingMovements = await db.getAll('movements');
      for (const movement of existingMovements) {
        if (movement.accountId === 999) { // Demo account ID
          await db.delete('movements', movement.id!);
        }
      }
      
      // Add sample movements
      const addedMovements: Movement[] = [];
      for (const movement of sampleMovements) {
        const id = await db.add('movements', movement);
        addedMovements.push({ ...movement, id: id as number });
      }
      
      setMovements(addedMovements);
      await updateStats();
      setMessage('Demo inicializado con movimientos de Endesa sin clasificar');
    } catch (error) {
      console.error('Error initializing demo:', error);
      setMessage('Error inicializando demo');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Motor de Aprendizaje - Treasury v1.1</h1>
            <p className="text-gray-600">Demostración de reglas implícitas y backfill automático</p>
          </div>
        </div>

        {/* Status and Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="atlas-atlas-atlas-btn-primary p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Reglas Creadas</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalRules}</p>
          </div>
          <div className="atlas-atlas-atlas-btn-primary p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Aplicaciones</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalApplications}</p>
          </div>
          <div className="bg-purple-50 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">Movimientos</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">{movements.length}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={performReconciliation}
            disabled={isLoading || step > 0 || movements.length === 0}
            className="atlas-atlas-atlas-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            1. Conciliar Manualmente (Crear Regla)
          </button>
          
          <button
            onClick={simulateNewImport}
            disabled={isLoading || step < 1 || step > 1}
            className="atlas-atlas-atlas-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            2. Simular Nueva Importación
          </button>
          
          <button
            onClick={resetDemo}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Demo
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className="btn-secondary-horizon atlas-atlas-atlas-btn-primary ">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800">{message}</span>
            </div>
          </div>
        )}

        {/* Movements Table */}
        <div className="bg-gray-50 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Movimientos</h3>
          <div className="space-y-2">
            {movements.map((movement) => (
              <div key={movement.id} className="bg-white p-3 border">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <MovementStatusChip 
                        status="no_planificado"
                        movementType="Gasto"
                        conciliationStatus={movement.statusConciliacion}
                        showAutoFlag={true}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{movement.counterparty}</p>
                        <p className="text-sm text-gray-600 truncate max-w-md">{movement.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{movement.amount.toFixed(2)}€</p>
                    <p className="text-xs text-gray-500">{movement.date}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {movement.statusConciliacion === 'match_manual' && 'Manual'}
                      {movement.statusConciliacion === 'match_automatico' && 'Auto'}
                      {movement.statusConciliacion === 'sin_match' && 'Sin clasificar'}
                    </p>
                    {movement.categoria && (
                      <p className="text-xs text-blue-600">{movement.categoria}</p>
                    )}
                    {movement.ambito === 'INMUEBLE' && movement.inmuebleId && (
                      <p className="text-xs text-purple-600">{movement.inmuebleId}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-gray-50 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Log de Aprendizaje</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-xs text-gray-600 font-mono">
                  <span className="text-gray-400">{new Date(log.ts).toLocaleTimeString()}</span> - 
                  <span className="font-medium ml-1">{log.action}</span> - 
                  <span className="text-blue-600 ml-1">{log.categoria}</span>
                  {log.ambito === 'INMUEBLE' && (
                    <span className="text-purple-600 ml-1">({log.inmuebleId})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreasuryLearningEngineDemo;