// src/pages/account/MigracionTab.tsx
// ATLAS HORIZON: Migration Data tab for Account page

import React, { useState } from 'react';
import { TrendingUp, Banknote, Users, AlertCircle, ArrowRight, CheckCircle, LucideIcon } from 'lucide-react';
import ImportarValoraciones from './migracion/ImportarValoraciones';
import ImportarMovimientos from './migracion/ImportarMovimientos';
import ImportarContratos from './migracion/ImportarContratos';
import ImportarAportaciones from './migracion/ImportarAportaciones';

type MigracionView = 'menu' | 'valoraciones' | 'aportaciones' | 'movimientos' | 'contratos';

const MigracionTab: React.FC = () => {
  const [view, setView] = useState<MigracionView>('menu');
  const [completados, setCompletados] = useState<Set<string>>(new Set());

  const markCompleted = (key: string) => {
    setCompletados((prev) => {
      const next = new Set<string>();
      prev.forEach((v) => next.add(v));
      next.add(key);
      return next;
    });
    setView('menu');
  };

  if (view === 'valoraciones') {
    return (
      <ImportarValoraciones
        onComplete={() => markCompleted('valoraciones')}
        onBack={() => setView('menu')}
      />
    );
  }
  if (view === 'movimientos') {
    return (
      <ImportarMovimientos
        onComplete={() => markCompleted('movimientos')}
        onBack={() => setView('menu')}
      />
    );
  }
  if (view === 'aportaciones') {
    return (
      <ImportarAportaciones
        onComplete={() => markCompleted('aportaciones')}
        onBack={() => setView('menu')}
      />
    );
  }
  if (view === 'contratos') {
    return (
      <ImportarContratos
        onComplete={() => markCompleted('contratos')}
        onBack={() => setView('menu')}
      />
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Info box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '14px 16px',
          backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid var(--atlas-blue)',
        }}
      >
        <AlertCircle size={18} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--atlas-navy-1)', lineHeight: '1.5' }}>
          💡 <strong>Consejo:</strong> Puedes importar datos en cualquier momento. Los datos existentes no serán
          eliminados. La importación solo añade o actualiza registros de forma no destructiva.
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <MigracionCard
          icon={TrendingUp}
          title="Valoraciones históricas"
          description="Importa el histórico de valoraciones mensuales de tus inmuebles e inversiones desde Excel."
          color="var(--atlas-blue)"
          completed={completados.has('valoraciones')}
          onClick={() => setView('valoraciones')}
        />
        <MigracionCard
          icon={TrendingUp}
          title="Aportaciones inversiones"
          description="Importa aportaciones históricas (fecha e importe) para cualquier posición financiera desde Excel."
          color="var(--atlas-blue)"
          completed={completados.has('aportaciones')}
          onClick={() => setView('aportaciones')}
        />
        <MigracionCard
          icon={Banknote}
          title="Movimientos bancarios"
          description="Importa movimientos bancarios históricos desde archivos CSV o Excel."
          color="var(--ok)"
          completed={completados.has('movimientos')}
          onClick={() => setView('movimientos')}
        />
        <MigracionCard
          icon={Users}
          title="Contratos de alquiler"
          description="Importa contratos históricos de arrendamiento desde Excel."
          color="var(--warning)"
          completed={completados.has('contratos')}
          onClick={() => setView('contratos')}
        />
      </div>
    </div>
  );
};

// ── MigracionCard ─────────────────────────────────────────────────────────────

interface MigracionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  completed: boolean;
  onClick: () => void;
}

const MigracionCard: React.FC<MigracionCardProps> = ({
  icon: Icon,
  title,
  description,
  color,
  completed,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '20px',
        border: `1px solid ${hovered ? color : 'var(--hz-neutral-300)'}`,
        borderRadius: '12px',
        backgroundColor: hovered ? `${color}08` : 'var(--bg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? `0 4px 12px ${color}20` : 'none',
        fontFamily: 'var(--font-inter)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} strokeWidth={1.5} style={{ color }} aria-hidden="true" />
        </div>
        {completed ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ok)',
              backgroundColor: 'var(--ok-light, #E8F8EF)',
              padding: '3px 8px',
              borderRadius: '20px',
            }}
          >
            <CheckCircle size={12} strokeWidth={2} aria-hidden="true" />
            Importado
          </span>
        ) : (
          <ArrowRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-gray)' }} aria-hidden="true" />
        )}
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-gray)', lineHeight: '1.5' }}>
          {description}
        </p>
      </div>
    </button>
  );
};

export default MigracionTab;
