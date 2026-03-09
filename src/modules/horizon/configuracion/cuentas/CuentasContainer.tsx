import React from 'react';
import AtlasBancosManagement from './components/AtlasBancosManagement';

/**
 * Cuentas - ATLAS Design System
 * 
 * Main container for account management following ATLAS requirements:
 * - Bank account management only (no analytics tab)
 * - Located under: Cuenta ▸ Configuración ▸ Cuentas Bancarias
 * - Canonical route: /cuenta/cuentas
 */
const Cuentas: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Content - Direct bank management, no tabs */}
      <div className="py-8">
        <AtlasBancosManagement />
      </div>
    </div>
  );
};

export default Cuentas;
