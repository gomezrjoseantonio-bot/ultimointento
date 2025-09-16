import React, { useRef } from 'react';
import PageHeader from '../../../../components/common/PageHeader';
import AtlasBancosManagement, { AtlasBancosManagementRef } from './components/AtlasBancosManagement';

/**
 * Cuentas - ATLAS Design System
 * 
 * Main container for account management following ATLAS requirements:
 * - Bank account management only (no analytics tab)
 * - Located under: Cuenta ▸ Configuración ▸ Cuentas Bancarias
 * - Canonical route: /cuenta/cuentas
 */
const Cuentas: React.FC = () => {
  const bancosRef = useRef<AtlasBancosManagementRef>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <PageHeader
        title="Cuentas Bancarias"
        subtitle="Gestión de cuentas bancarias con validaciones IBAN, branding persistente y activar/inactivar simétrico"
        breadcrumb={[
          { name: 'Cuenta', href: '/cuenta' },
          { name: 'Configuración', href: '/cuenta' },
          { name: 'Cuentas Bancarias', href: '/cuenta/cuentas' }
        ]}
        primaryAction={{
          label: "Nueva cuenta",
          onClick: () => {
            bancosRef.current?.triggerNewAccount();
          }
        }}
      />

      {/* Content - Direct bank management, no tabs */}
      <div className="py-8">
        <AtlasBancosManagement ref={bancosRef} />
      </div>
    </div>
  );
};

export default Cuentas;