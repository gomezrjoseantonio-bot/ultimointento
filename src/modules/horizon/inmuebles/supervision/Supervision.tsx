import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import PageHeader from '../../../../components/shared/PageHeader';
import { useSupervisionData } from './hooks/useSupervisionData';
import PatrimonioTab from './tabs/PatrimonioTab';
import RendimientoTab from './tabs/RendimientoTab';
import InmuebleTab from './tabs/InmuebleTab';

// Internal sub-tabs within Supervisión
type SubTabKey = 'patrimonio' | 'rendimiento' | 'inmueble';

const SUB_TABS: { id: SubTabKey; label: string }[] = [
  { id: 'patrimonio', label: 'Patrimonio' },
  { id: 'rendimiento', label: 'Rendimiento' },
  { id: 'inmueble', label: 'Inmueble' },
];

const Supervision: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('patrimonio');
  const { inmuebles, totales, loading, error } = useSupervisionData();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grey-50)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <PageHeader
          icon={Building2}
          title="Cartera inmobiliaria"
          subtitle={
            loading
              ? 'Cargando...'
              : `${totales.numInmuebles} inmueble${totales.numInmuebles !== 1 ? 's' : ''} · supervisión`
          }
          tabs={SUB_TABS.map((t) => ({ id: t.id, label: t.label }))}
          activeTab={activeSubTab}
          onTabChange={(id) => setActiveSubTab(id as SubTabKey)}
        />

        {/* Content */}
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            gap: 8,
          }}>
            <div
              className="animate-spin"
              style={{
                width: 24,
                height: 24,
                border: '2px solid var(--navy-900)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }}
            />
            <span style={{ color: 'var(--grey-500)', fontSize: 'var(--t-base)' }}>
              Cargando datos...
            </span>
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            color: 'var(--grey-500)',
            fontSize: 'var(--t-base)',
          }}>
            {error}
          </div>
        ) : inmuebles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            color: 'var(--grey-500)',
            fontSize: 'var(--t-base)',
          }}>
            No hay inmuebles activos en la cartera
          </div>
        ) : (
          <>
            {activeSubTab === 'patrimonio' && (
              <PatrimonioTab inmuebles={inmuebles} totales={totales} />
            )}
            {activeSubTab === 'rendimiento' && (
              <RendimientoTab inmuebles={inmuebles} totales={totales} />
            )}
            {activeSubTab === 'inmueble' && (
              <InmuebleTab inmuebles={inmuebles} totales={totales} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Supervision;
