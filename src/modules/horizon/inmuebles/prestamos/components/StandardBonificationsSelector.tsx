// Standard Bonifications Selector Component
// Provides an easy way to select from pre-configured bonifications

import React, { useState } from 'react';
import { Plus, Check, CreditCard, Home, Shield, AlertTriangle, Target, Zap } from 'lucide-react';
import { Bonificacion } from '../../../../../types/prestamos';
import { standardBonificationsService, StandardBonification } from '../../../../../services/standardBonificationsService';
import { formatSpanishNumber } from '../../../../../services/spanishFormattingService';

interface StandardBonificationsProps {
  existingBonifications: Bonificacion[];
  onAddBonification: (bonification: Bonificacion) => void;
}

const StandardBonificationsSelector: React.FC<StandardBonificationsProps> = ({ 
  existingBonifications, 
  onAddBonification 
}) => {
  const [showAll, setShowAll] = useState(false);
  const standardBonifications = standardBonificationsService.getAllStandard();
  const habitualBonifications = standardBonificationsService.getHabitual();
  
  // Filter out bonifications that already exist (by name)
  const existingNames = existingBonifications.map(b => b.nombre.toLowerCase());
  const availableStandard = (showAll ? standardBonifications : habitualBonifications)
    .filter(std => !existingNames.includes(std.nombre.toLowerCase()));

  const getIconForBonification = (tipo: string) => {
    switch (tipo) {
      case 'NOMINA': return <Target className="h-4 w-4" />;
      case 'PLAN_PENSIONES': return <Shield className="h-4 w-4" />;
      case 'SEGURO_HOGAR': return <Home className="h-4 w-4" />;
      case 'SEGURO_VIDA': return <Shield className="h-4 w-4" />;
      case 'TARJETA': return <CreditCard className="h-4 w-4" />;
      case 'ALARMA': return <Zap className="h-4 w-4" />;
      default: return <Plus className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (categoria: StandardBonification['categoria']) => {
    switch (categoria) {
      case 'ingresos': return 'bg-green-50 border-green-200 text-green-800';
      case 'productos': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'servicios': return 'bg-purple-50 border-purple-200 text-purple-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const handleAddStandard = (standard: StandardBonification) => {
    const bonification = standardBonificationsService.createBonificationFromStandard(standard);
    onAddBonification(bonification);
  };

  if (availableStandard.length === 0 && !showAll) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600 mb-2">
          Ya tienes configuradas las bonificaciones más habituales
        </p>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Ver más opciones de bonificación
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-blue-900 flex items-center space-x-2">
          <Check className="h-4 w-4" />
          <span>Bonificaciones disponibles</span>
        </h4>
        {!showAll && availableStandard.length < standardBonifications.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Ver todas
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {availableStandard.map((standard) => (
          <button
            key={standard.id}
            type="button"
            onClick={() => handleAddStandard(standard)}
            className="text-left p-3 border border-gray-200 rounded-lg hover:bg-white hover:border-blue-300 transition-colors bg-white"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getIconForBonification(standard.regla.tipo)}
                <span className="font-medium text-gray-900 text-sm">
                  {standard.nombre}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(standard.categoria)}`}>
                {standard.categoria}
              </span>
            </div>
            
            <p className="text-xs text-gray-600 mb-2">
              {standard.descripcion}
            </p>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600 font-medium">
                -{formatSpanishNumber(standard.reduccionPuntosPorcentuales * 100, 2)}%
              </span>
              {standard.costeAnualEstimado && standard.costeAnualEstimado > 0 && (
                <span className="text-red-600">
                  ~{formatSpanishNumber(standard.costeAnualEstimado, 0)}€/año
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {availableStandard.length === 0 && showAll && (
        <div className="text-center py-2">
          <p className="text-sm text-gray-600">
            Ya tienes configuradas todas las bonificaciones disponibles
          </p>
        </div>
      )}

      {availableStandard.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-center space-x-2 text-xs text-blue-700">
            <AlertTriangle className="h-3 w-3" />
            <span>
              Haz clic en una bonificación para añadirla a tu préstamo. 
              Podrás editarla después si es necesario.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandardBonificationsSelector;