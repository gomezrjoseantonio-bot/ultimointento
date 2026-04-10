/**
 * TesoreriaSupervisionPage.tsx
 *
 * SUPERVISIÓN > Tesorería  (/tesoreria)
 * Header blanco, sin botones de acción.
 * Dos tabs:
 *   - Evolución          → TreasuryEvolucionContent
 *   - Balances bancarios → BalancesBancariosView (read-only)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import PageHeader from '../../../components/shared/PageHeader';
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
