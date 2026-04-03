import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import PageHeader from '../../../../components/shared/PageHeader';
import { useSupervisionData } from './hooks/useSupervisionData';
import PatrimonioTab from './tabs/PatrimonioTab';
import RendimientoTab from './tabs/RendimientoTab';
import InmuebleTab from './tabs/InmuebleTab';

// Navigation-level tabs shared with InmueblesAnalisis
const NAV_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'evolucion', label: 'Evoluci\u00F3n' },
  { id: 'individual', label: 'Individual' },
  { id: 'supervision', label: 'Supervisi\u00F3n' },
];

// Internal sub-tabs within Supervisión
type SubTabKey = 'patrimonio' | 'rendimiento' | 'inmueble';

const SUB_TABS: { key: SubTabKey; label: string }[] = [
  { key: 'patrimonio', label: 'Patrimonio' },
  { key: 'rendimiento', label: 'Rendimiento' },
  { key: 'inmueble', label: 'Inmueble' },
];

const Supervision: React.FC = () => {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('patrimonio');
  const { inmuebles, totales, loading, error } = useSupervisionData();

  const handleNavTabChange = (tabId: string) => {
    if (tabId === 'supervision') return; // Already here
    // Navigate back to InmueblesAnalisis with the selected tab
    navigate(`/inmuebles?tab=${tabId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grey-50)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* Shared PageHeader with navigation tabs */}
        <PageHeader
          icon={Building2}
          title="Cartera inmobiliaria"
          subtitle={
            loading
              ? 'Cargando...'
              : `${totales.numInmuebles} inmueble${totales.numInmuebles !== 1 ? 's' : ''} \u00B7 supervisi\u00F3n`
          }
          tabs={NAV_TABS}
          activeTab="supervision"
          onTabChange={handleNavTabChange}
        />

        {/* Internal sub-tabs: Patrimonio / Rendimiento / Inmueble */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 24,
          paddingLeft: 30,
        }}>
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--navy-900)' : 'var(--grey-300)',
                  background: isActive ? 'var(--navy-900)' : 'var(--white)',
                  color: isActive ? 'var(--white)' : 'var(--grey-700)',
                  fontSize: 'var(--t-sm)',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

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
