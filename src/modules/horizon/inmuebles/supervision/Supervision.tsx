import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import PageHeader from '../../../../components/common/PageHeader';
import { useSupervisionData } from './hooks/useSupervisionData';
import PatrimonioTab from './tabs/PatrimonioTab';
import RendimientoTab from './tabs/RendimientoTab';
import InmuebleTab from './tabs/InmuebleTab';

type TabKey = 'patrimonio' | 'rendimiento' | 'inmueble';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'patrimonio', label: 'Patrimonio' },
  { key: 'rendimiento', label: 'Rendimiento' },
  { key: 'inmueble', label: 'Inmueble' },
];

const Supervision: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('patrimonio');
  const { inmuebles, totales, loading, error } = useSupervisionData();

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Cartera inmobiliaria"
        subtitle={
          loading
            ? 'Cargando...'
            : `${totales.numInmuebles} inmueble${totales.numInmuebles !== 1 ? 's' : ''} \u00B7 supervisi\u00F3n`
        }
        icon={Building2}
      />

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid var(--grey-200)',
        background: 'var(--white)',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 0',
                  marginRight: 32,
                  fontSize: 'var(--t-base)',
                  fontFamily: 'var(--font-base)',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--grey-900)' : 'var(--grey-500)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive
                    ? '2px solid var(--navy-900)'
                    : '2px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  minHeight: 44,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 'var(--space-6)' }}>
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
            {activeTab === 'patrimonio' && (
              <PatrimonioTab inmuebles={inmuebles} totales={totales} />
            )}
            {activeTab === 'rendimiento' && (
              <RendimientoTab inmuebles={inmuebles} totales={totales} />
            )}
            {activeTab === 'inmueble' && (
              <InmuebleTab inmuebles={inmuebles} totales={totales} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Supervision;
