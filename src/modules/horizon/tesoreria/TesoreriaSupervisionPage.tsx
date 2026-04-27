/**
 * TesoreriaSupervisionPage.tsx
 *
 * SUPERVISIÓN > Tesorería  (/tesoreria)
 * Header blanco con un solo botón de acción: "Subir extracto" → /tesoreria/importar.
 * Dos tabs:
 *   - Evolución          → TreasuryEvolucionContent
 *   - Balances bancarios → BalancesBancariosView (read-only)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Upload } from 'lucide-react';
import PageHeader, { HeaderSecondaryButton } from '../../../components/shared/PageHeader';
import { TreasuryEvolucionContent } from '../../../components/treasury/TreasuryEvolucion';
import BalancesBancariosView from '../../../components/treasury/BalancesBancariosView';

type Tab = 'evolucion' | 'balances';

const TesoreriaSupervisionPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('evolucion');

  return (
    <div className="tv4-page">
      <PageHeader
        icon={Landmark}
        title="Tesorería"
        subtitle={tab === 'evolucion' ? 'Evolución histórica' : 'Saldos y movimientos por cuenta'}
        tabs={[
          { id: 'evolucion',  label: 'Evolución' },
          { id: 'balances',   label: 'Balances bancarios' },
        ]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as Tab)}
        actions={
          <HeaderSecondaryButton
            icon={Upload}
            label="Subir extracto"
            onClick={() => navigate('/tesoreria/importar')}
          />
        }
      />

      {tab === 'evolucion' && (
        <TreasuryEvolucionContent
          onGoToFlujo={(año) => navigate(`/conciliacion?año=${año}`)}
        />
      )}

      {tab === 'balances' && (
        <BalancesBancariosView />
      )}
    </div>
  );
};

export default TesoreriaSupervisionPage;
