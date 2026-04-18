// TabCartera.tsx
// ATLAS HORIZON: Cartera tab for investment portfolio management

import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ChevronUp, ChevronDown, Star, Eye } from 'lucide-react';
import { TabCarteraProps, PositionRow } from '../types';
import { Chip } from '../cards';
import { formatCurrency, formatPercent, CHART_COLORS } from '../utils';

const GRUPOS: { tipos: string[]; label: string }[] = [
  { tipos: ['cuenta_remunerada'], label: 'Cuentas remuneradas' },
  { tipos: ['prestamo_p2p', 'deposito_plazo', 'deposito'], label: 'Préstamos y depósitos' },
  { tipos: ['fondo_inversion', 'etf', 'reit', 'accion', 'crypto', 'otro'], label: 'Fondos, acciones y crypto' },
  { tipos: ['plan_pensiones', 'plan_empleo'], label: 'Planes de pensiones' },
];

const TabCartera: React.FC<TabCarteraProps> = ({
  onSelectPosition,
  onViewAportaciones,
  positions,
  closedPositions,
  planesPension,
}) => {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<keyof PositionRow>('alias');
  const [sortAsc, setSortAsc] = useState(true);

  const normalizedQuery = query.trim().toLowerCase();
  const hasActiveFilter = normalizedQuery.length > 0;

  const filtered = useMemo(() => {
    return positions
      .filter(
        (p) =>
          p.alias.toLowerCase().includes(normalizedQuery) ||
          p.broker.toLowerCase().includes(normalizedQuery) ||
          p.tipo.toLowerCase().includes(normalizedQuery)
      )
      .sort((a: any, b: any) =>
        sortAsc
          ? a[sortKey] > b[sortKey]
            ? 1
            : -1
          : a[sortKey] < b[sortKey]
          ? 1
          : -1
      );
  }, [normalizedQuery, sortKey, sortAsc, positions]);
  const groupedSections = useMemo(() => {
    if (hasActiveFilter) return [];
    const coveredTipos = new Set(GRUPOS.flatMap((g) => g.tipos));
    const sections = GRUPOS.map((g) => ({
      label: g.label,
      items: filtered.filter((p) => g.tipos.includes(p.tipo)),
    })).filter((g) => g.items.length > 0);
    const unmatched = filtered.filter((p) => !coveredTipos.has(p.tipo));
    if (unmatched.length > 0) {
      sections.push({ label: 'Otros', items: unmatched });
    }
    return sections;
  }, [filtered, hasActiveFilter]);

  const handleSort = (key: keyof PositionRow) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ k }: { k: keyof PositionRow }) =>
    sortKey === k ? sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : null;

  const renderCard = (p: PositionRow) => (
    <div
      key={p.id}
      onClick={() => onSelectPosition(p.id)}
      style={{
        border: '1.5px solid var(--grey-200, #DDE3EC)',
        borderRadius: 12,
        padding: 18,
        cursor: 'pointer',
        transition: 'box-shadow 120ms',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = '0 4px 16px rgba(4,44,94,.08)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: p.color,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--grey-700, #303A4C)',
            }}
          >
            {p.alias}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--grey-500, #6C757D)',
              marginTop: 2,
            }}
          >
            {p.broker} · {p.tipo}
          </div>
        </div>
        {p.tag && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background: 'rgba(4,44,94,.08)',
              color: CHART_COLORS.navy900,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Star size={10} />
            {p.tag}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              color: 'var(--grey-500, #6C757D)',
              marginBottom: 2,
            }}
          >
            Valor actual
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--grey-700, #303A4C)',
            }}
          >
            {formatCurrency(p.valor)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--grey-500, #6C757D)',
              marginTop: 1,
            }}
          >
            Aportado: {formatCurrency(p.aportado)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              color: 'var(--grey-500, #6C757D)',
              marginBottom: 2,
            }}
          >
            Rentabilidad
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 20,
              fontWeight: 600,
              color:
                p.rentPct > 0
                  ? 'var(--s-pos, #042C5E)'
                  : 'var(--s-neg, #303A4C)',
            }}
          >
            {formatPercent(p.rentPct)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--grey-500, #6C757D)',
              marginTop: 1,
            }}
          >
            {p.rentAnual.toFixed(2)}% / año
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--grey-500, #6C757D)',
            marginBottom: 4,
          }}
        >
          <span>Peso portfolio</span>
          <span style={{ fontWeight: 600 }}>{p.peso}%</span>
        </div>
        <div
          style={{
            background: 'var(--grey-100, #EEF1F5)',
            borderRadius: 4,
            height: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${p.peso}%`,
              background: p.color,
              borderRadius: 4,
              transition: 'width 600ms ease',
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: 'var(--white, #fff)',
        border: '1px solid var(--grey-300, #C8D0DC)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--grey-100, #EEF1F5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            maxWidth: 360,
            padding: '7px 12px',
            border: '1.5px solid var(--grey-200, #DDE3EC)',
            borderRadius: 8,
            background: 'var(--grey-50, #F8F9FA)',
          }}
        >
          <Search size={14} color="var(--grey-500, #6C757D)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, broker o tipo..."
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--grey-700, #303A4C)',
              width: '100%',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              fontSize: 12,
              background: 'transparent',
              border: '1.5px solid var(--grey-200, #DDE3EC)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--grey-500, #6C757D)',
              fontFamily: 'inherit',
            }}
          >
            <SlidersHorizontal size={13} /> Filtros
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '8px 20px',
          fontSize: 11,
          color: 'var(--grey-500, #6C757D)',
          borderBottom: '1px solid var(--grey-100, #EEF1F5)',
        }}
      >
        {filtered.length} posiciones
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--grey-500, #6C757D)',
            borderBottom: '1px solid var(--grey-100, #EEF1F5)',
          }}
        >
          No hay posiciones para mostrar.
        </div>
      )}

      {/* Position cards */}
      {hasActiveFilter ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            padding: 20,
          }}
        >
          {filtered.map((p) => renderCard(p))}
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          {groupedSections.map((grupo) => (
            <div key={grupo.label} style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6C757D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {grupo.label}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 16,
                }}
              >
                {grupo.items.map((p) => renderCard(p))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          borderTop: '1px solid var(--grey-100, #EEF1F5)',
          padding: '0 0 0 0',
        }}
      >
        <div
          style={{
            padding: '8px 20px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--grey-500, #6C757D)',
            background: 'var(--grey-50, #F8F9FA)',
          }}
        >
          Vista tabla
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { key: 'alias', label: 'Posición / Broker', align: 'left' },
                { key: 'aportado', label: 'Aportado', align: 'right' },
                { key: 'valor', label: 'Valor actual', align: 'right' },
                { key: 'rentPct', label: '% Rent. total', align: 'right' },
                { key: 'rentAnual', label: '% Rent. anual', align: 'right' },
                { key: 'peso', label: 'Peso %', align: 'right' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key as keyof PositionRow)}
                  style={{
                    padding: '9px 16px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: 'var(--grey-500, #6C757D)',
                    background: 'var(--grey-50, #F8F9FA)',
                    borderBottom: '1px solid var(--grey-200, #DDE3EC)',
                    textAlign: col.align as any,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {col.label}
                    <SortIcon k={col.key as keyof PositionRow} />
                  </span>
                </th>
              ))}
              <th
                style={{
                  padding: '9px 16px',
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'var(--grey-50, #F8F9FA)',
                  borderBottom: '1px solid var(--grey-200, #DDE3EC)',
                }}
              />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => onSelectPosition(p.id)}
                style={{
                  borderBottom:
                    i < filtered.length - 1
                      ? '1px solid var(--grey-100, #EEF1F5)'
                      : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(4,44,94,.015)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <td style={{ padding: '12px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: p.color,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--grey-700, #303A4C)',
                          fontSize: 13,
                        }}
                      >
                        {p.alias}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--grey-500, #6C757D)',
                          marginTop: 1,
                        }}
                      >
                        {p.broker} · {p.tipo}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                  }}
                >
                  {formatCurrency(p.aportado)}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                  }}
                >
                  {formatCurrency(p.valor)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Chip
                    color={
                      p.rentPct > 5
                        ? 'var(--s-pos, #042C5E)'
                        : p.rentPct > 0
                        ? 'var(--grey-500, #6C757D)'
                        : 'var(--s-neg, #303A4C)'
                    }
                    bg={
                      p.rentPct > 5
                        ? 'var(--s-pos-bg, #E8EFF7)'
                        : p.rentPct > 0
                        ? 'var(--grey-100, #EEF1F5)'
                        : 'var(--s-neg-bg, #EEF1F5)'
                    }
                  >
                    {formatPercent(p.rentPct)}
                  </Chip>
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                    color: 'var(--s-pos, #042C5E)',
                    fontWeight: 600,
                  }}
                >
                  {p.rentAnual.toFixed(2)}%
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                  }}
                >
                  {p.peso}%
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                    }}
                  >
                    {p.tipo !== 'plan_pensiones' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewAportaciones(p.id);
                        }}
                        title="Ver historial aportaciones"
                        aria-label={`Ver historial de ${p.alias}`}
                        style={{
                          width: 28,
                          height: 28,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--grey-500, #6C757D)',
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Closed positions */}
      {closedPositions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {/* Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--grey-700, #303A4C)',
              }}
            >
              Operaciones declaradas
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--grey-500, #6C757D)',
                background: 'var(--grey-100, #EEF1F5)',
                borderRadius: 12,
                padding: '2px 8px',
              }}
            >
              {closedPositions.length}
            </span>
          </div>

          {/* Table */}
          <div
            style={{
              background: 'var(--white, #fff)',
              border: '1px solid var(--grey-200, #DDE3EC)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--grey-50, #F8F9FA)',
                    borderBottom: '1px solid var(--grey-200, #DDE3EC)',
                  }}
                >
                  {[
                    { label: 'Operación', w: undefined },
                    { label: 'Año', w: 70 },
                    { label: 'Tipo', w: 150 },
                    { label: 'Valor transmisión', w: undefined },
                    { label: 'Ganancia / Pérdida', w: undefined },
                  ].map(({ label, w }) => (
                    <th
                      key={label}
                      style={{
                        padding: '10px 16px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: 'var(--grey-500, #6C757D)',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--grey-200, #DDE3EC)',
                        ...(w ? { width: w } : {}),
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((p, idx) => {
                  const año =
                    p.fecha_valoracion?.slice(0, 4) ??
                    p.fecha_compra?.slice(0, 4) ??
                    '—';
                  const gp = p.valor_actual - p.total_aportado;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom:
                          idx < closedPositions.length - 1
                            ? '1px solid var(--grey-100, #EEF1F5)'
                            : 'none',
                        background:
                          idx % 2 === 0
                            ? 'var(--white, #fff)'
                            : 'var(--grey-50, #F8F9FA)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--grey-700, #303A4C)',
                          }}
                        >
                          {p.nombre}
                        </div>
                        {p.entidad && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--grey-500, #6C757D)',
                              marginTop: 1,
                            }}
                          >
                            {p.entidad}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 13,
                            color: 'var(--grey-700, #303A4C)',
                          }}
                        >
                          {año}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            color: 'var(--grey-500, #6C757D)',
                            background: 'var(--grey-100, #EEF1F5)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            display: 'inline-block',
                          }}
                        >
                          {p.tipo.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 13,
                            color: 'var(--grey-700, #303A4C)',
                          }}
                        >
                          {formatCurrency(p.valor_actual)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 13,
                            fontWeight: 600,
                            color:
                              gp >= 0
                                ? 'var(--s-pos, #042C5E)'
                                : CHART_COLORS.teal600,
                          }}
                        >
                          {gp >= 0 ? '+' : ''}
                          {formatCurrency(gp)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabCartera;
