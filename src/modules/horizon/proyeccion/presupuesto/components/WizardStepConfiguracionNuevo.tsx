import React from 'react';
import { ChevronRight } from 'lucide-react';
import { PresupuestoLinea } from '../../../../../services/db';
import ScopedBudgetView from './ScopedBudgetView';

interface WizardStepConfiguracionProps {
  year: number;
  scopes: ('PERSONAL' | 'INMUEBLES')[];
  initialLines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[];
  onComplete: (lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]) => void;
}

const WizardStepConfiguracion: React.FC<WizardStepConfiguracionProps> = ({
  year,
  scopes,
  initialLines,
  onComplete
}) => {
  // Add temporary IDs for editing
  const linesWithIds = initialLines.map((line, index) => ({
    ...line,
    id: `temp-${index}`,
    presupuestoId: 'temp'
  })) as PresupuestoLinea[];

  const handleLinesChange = (updatedLines: PresupuestoLinea[]) => {
    // Remove temporary IDs before passing back
    const cleanLines = updatedLines.map(({ id, presupuestoId, ...line }) => line);
    onComplete(cleanLines as Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]);
  };

  const handleAddLine = (scope: 'PERSONAL' | 'INMUEBLES') => {
    const newLine: Omit<PresupuestoLinea, 'id' | 'presupuestoId'> = {
      scope,
      type: 'COSTE',
      category: 'Otros',
      label: 'Nueva línea',
      amountByMonth: new Array(12).fill(0)
    };

    const newLineWithId = {
      ...newLine,
      id: `temp-${Date.now()}`,
      presupuestoId: 'temp'
    } as PresupuestoLinea;

    handleLinesChange([...linesWithIds, newLineWithId]);
  };

  const handleContinue = () => {
    onComplete(initialLines);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuración del Presupuesto</h2>
        <p className="text-gray-600">
          Ajusta los importes mensuales, configura las cuentas de cargo/abono y añade líneas adicionales.
        </p>
      </div>

      {/* Budget editing interface */}
      <div className="mb-8">
        <ScopedBudgetView
          year={year}
          scopes={scopes}
          lines={linesWithIds}
          onLinesChange={handleLinesChange}
          onAddLine={handleAddLine}
        />
      </div>

      {/* Important notes */}
      <div className="bg-warning-50 border border-yellow-200 p-6 mb-8">
        <h4 className="font-semibold text-yellow-900 mb-2">Importante</h4>
        <div className="text-sm text-yellow-800 space-y-1">
          <p>• <strong>Cuentas obligatorias:</strong> Todas las líneas necesitan una cuenta de cargo/abono antes de guardar</p>
          <p>• <strong>Edición en tabla:</strong> Haz clic en cualquier celda para editarla directamente</p>
          <p>• <strong>Navegación:</strong> Usa Tab ↹ / Enter ↵ para moverte entre celdas</p>
          <p>• <strong>Acciones:</strong> Duplica o elimina líneas usando los iconos de la derecha</p>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="atlas-atlas-atlas-atlas-btn-primary flex items-center px-6 py-3 font-medium"
        >
          Continuar a revisión
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default WizardStepConfiguracion;