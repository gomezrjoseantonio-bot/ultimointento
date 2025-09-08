import React from 'react';
import UnifiedTreasury from './UnifiedTreasury';

/**
 * Tesorería - Single Radar View (per ATLAS Design Guide)
 * 
 * No subtabs - unified view with:
 * - "Excluir personal" switch
 * - Account cards with timeline expansion  
 * - Transaction state color coding
 * - Import functionality
 * 
 * All account management and rules moved to Configuración > Cuentas
 */
const Tesoreria: React.FC = () => {
  return <UnifiedTreasury />;
};

export default Tesoreria;