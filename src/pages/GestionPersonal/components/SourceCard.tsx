import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const BAND_COLORS: Record<string, string> = {
  teal: 'var(--teal-600, #1DA0BA)',
  navy: 'var(--navy-700, #142C50)',
  grey: 'var(--grey-200, #DDE3EC)',
};

/* ── Badge variants ── */
export const BadgeAEAT: React.FC = () => (
  <span
    style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 12,
      background: 'var(--navy-100, #E8EFF7)',
      color: 'var(--navy-900, #042C5E)',
      fontFamily: FONT,
    }}
  >
    AEAT {new Date().getFullYear() - 1}
  </span>
);

export const BadgeATLAS: React.FC = () => (
  <span
    style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 12,
      background: 'var(--teal-100, #E6F7FA)',
      color: 'var(--teal-600, #1DA0BA)',
      fontFamily: FONT,
    }}
  >
    ATLAS
  </span>
);

export const BadgePareja: React.FC = () => (
  <span
    style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 12,
      background: 'var(--navy-50, #F0F4FA)',
      color: 'var(--navy-700, #142C50)',
      border: '1px solid var(--navy-100, #E8EFF7)',
      fontFamily: FONT,
    }}
  >
    Pareja
  </span>
);

export const BadgeEmpty: React.FC = () => (
  <span
    style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 12,
      background: 'var(--grey-100, #EEF1F5)',
      color: 'var(--grey-400, #9CA3AF)',
      border: '1px dashed var(--grey-300, #C8D0DC)',
      fontFamily: FONT,
    }}
  >
    Vac\u00EDo
  </span>
);

/* ── KPI item ── */
interface KpiItem {
  label: string;
  value: string;
  color?: string;
}

/* ── SourceCard ── */
interface SourceCardProps {
  bandColor: 'teal' | 'navy' | 'grey';
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  description: string;
  kpis: KpiItem[];
  badge: React.ReactNode;
  action: React.ReactNode;
  detail?: React.ReactNode;
  onHeaderClick?: () => void;
}

const SourceCard: React.FC<SourceCardProps> = ({
  bandColor,
  icon,
  iconBg,
  name,
  description,
  kpis,
  badge,
  action,
  detail,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 10,
        border: '1px solid var(--grey-200, #DDE3EC)',
        background: 'var(--white, #FFFFFF)',
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      {/* Band */}
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: BAND_COLORS[bandColor] || BAND_COLORS.grey,
        }}
      />

      <div style={{ flex: 1, padding: '16px 20px' }}>
        {/* Top row: icon + name + badge + action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--grey-900, #1A2332)',
                }}
              >
                {name}
              </span>
              {badge}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--grey-500, #6C757D)',
                marginTop: 1,
              }}
            >
              {description}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {action}
          </div>
        </div>

        {/* KPIs row */}
        {kpis.length > 0 && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {kpis.map((kpi, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: 'var(--grey-500, #6C757D)', marginBottom: 2 }}>
                  {kpi.label}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: MONO,
                    fontVariantNumeric: 'tabular-nums',
                    color: kpi.color || 'var(--grey-900, #1A2332)',
                  }}
                >
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expandable detail */}
        {detail && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 10,
                padding: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                color: 'var(--teal-600, #1DA0BA)',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {expanded ? 'Ocultar detalle' : 'Ver detalle'}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {expanded && <div style={{ marginTop: 10 }}>{detail}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default SourceCard;
