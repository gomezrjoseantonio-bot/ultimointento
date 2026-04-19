// src/pages/GestionInmuebles/GestionInmueblesList.tsx
// Pantalla A · Lista de inmuebles (Gestión)
// V4: cards, toggle Solo activos / Todos, botón primario único

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader, { HeaderPrimaryButton } from '../../components/shared/PageHeader';
import { Property, PropertySale, initDB } from '../../services/db';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #00A7B5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €';

const fmtMonthYear = (iso: string): string => {
  if (!iso) return '—';
  const [y, m] = iso.slice(0, 10).split('-');
  return `${m}/${y}`;
};

const getTotalAcquisition = (p: Property): number => {
  const c = p.acquisitionCosts;
  return (
    (c.price || 0) +
    (c.itp || 0) +
    (c.iva || 0) +
    (c.notary || 0) +
    (c.registry || 0) +
    (c.management || 0) +
    (c.psi || 0) +
    (c.realEstate || 0) +
    (c.other?.reduce((s, o) => s + (o.amount || 0), 0) || 0)
  );
};

type Filter = 'activos' | 'todos';

const GestionInmueblesList: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [sales, setSales] = useState<PropertySale[]>([]);
  const [filter, setFilter] = useState<Filter>('activos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const [allProps, allSales] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('property_sales') as Promise<PropertySale[]>,
        ]);
        if (!cancelled) {
          setProperties(allProps);
          setSales(allSales);
        }
      } catch (err) {
        console.error('Error cargando inmuebles:', err);
        toast.error('Error al cargar los inmuebles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = properties.filter((p) => p.state === 'activo').length;
  const soldCount = properties.filter((p) => p.state === 'vendido').length;

  const filtered = useMemo(() => {
    if (filter === 'activos') return properties.filter((p) => p.state !== 'vendido');
    return properties;
  }, [properties, filter]);

  const saleByPropertyId = useMemo(() => {
    const map = new Map<number, PropertySale>();
    for (const s of sales) {
      if (s.status !== 'confirmed') continue;
      const existing = map.get(s.propertyId);
      if (!existing || s.saleDate > existing.saleDate) {
        map.set(s.propertyId, s);
      }
    }
    return map;
  }, [sales]);

  return (
    <div style={{ minHeight: '100vh', background: C.grey50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        <PageHeader
          icon={Building2}
          title="Inmuebles"
          subtitle="Gestión de propiedades"
          actions={
            <HeaderPrimaryButton
              icon={Plus}
              label="Nuevo inmueble"
              onClick={() => navigate('/gestion/inmuebles/nuevo')}
            />
          }
        />

        {/* Summary + toggle filter */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, color: C.grey500 }}>
            {properties.length} inmueble{properties.length !== 1 ? 's' : ''}
            {' · '}
            {activeCount} activo{activeCount !== 1 ? 's' : ''}
            {' · '}
            {soldCount} vendido{soldCount !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'inline-flex', background: C.white, border: `1px solid ${C.grey300}`, borderRadius: 8, padding: 2 }}>
            <FilterButton active={filter === 'activos'} onClick={() => setFilter('activos')}>
              Solo activos
            </FilterButton>
            <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')}>
              Todos
            </FilterButton>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: C.grey500 }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.grey200}`,
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              color: C.grey500,
            }}
          >
            {filter === 'activos' ? 'No hay inmuebles activos' : 'No hay inmuebles'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((p) => (
              <InmuebleCard
                key={p.id}
                property={p}
                sale={p.id != null ? saleByPropertyId.get(p.id) ?? null : null}
                onClick={() => navigate(`/gestion/inmuebles/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FilterButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 14px',
      borderRadius: 6,
      border: 'none',
      background: active ? C.navy900 : 'transparent',
      color: active ? C.white : C.grey700,
      fontSize: 13,
      fontWeight: active ? 500 : 400,
      cursor: 'pointer',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      transition: 'all 150ms ease',
    }}
  >
    {children}
  </button>
);

const InmuebleCard: React.FC<{
  property: Property;
  sale: PropertySale | null;
  onClick: () => void;
}> = ({ property, sale, onClick }) => {
  const isSold = property.state === 'vendido';
  const totalCost = getTotalAcquisition(property);
  const purchaseYear = property.purchaseDate ? property.purchaseDate.slice(0, 4) : '—';
  // Ganancia desde el snapshot fiscal del wizard. Las ventas previas al PR2 se muestran como "—".
  const gananciaPatrimonial = sale?.fiscalSnapshot?.gananciaPatrimonial ?? null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        background: isSold ? C.grey50 : C.white,
        border: `1px solid ${C.grey200}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.navy900;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.grey200;
      }}
    >
      {isSold && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '2px 8px',
            background: C.navy900,
            color: C.white,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.05em',
            borderRadius: 4,
          }}
        >
          VENDIDA {sale?.saleDate?.slice(0, 4) ?? ''}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, color: C.grey900, marginBottom: 4 }}>
        {property.alias}
      </div>
      <div style={{ fontSize: 12, color: C.grey500, marginBottom: 16, minHeight: 16 }}>
        {property.address}
        {property.municipality ? ` · ${property.municipality}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {isSold ? (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: C.grey500, letterSpacing: '.05em' }}>
                Vendida
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.grey900, marginTop: 2 }}>
                {sale ? fmtMonthYear(sale.saleDate) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: C.grey500, letterSpacing: '.05em' }}>
                Ganancia patrimonial
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color:
                    gananciaPatrimonial != null && gananciaPatrimonial < 0
                      ? C.teal600
                      : C.navy900,
                  marginTop: 2,
                }}
              >
                {gananciaPatrimonial != null
                  ? (gananciaPatrimonial >= 0 ? '+' : '') + fmtEuro(gananciaPatrimonial)
                  : '—'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: C.grey500, letterSpacing: '.05em' }}>
                Adquirido
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.grey900, marginTop: 2 }}>
                {purchaseYear}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: C.grey500, letterSpacing: '.05em' }}>
                Coste adquisición
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: C.grey900,
                  marginTop: 2,
                }}
              >
                {fmtEuro(totalCost)}
              </div>
            </div>
          </>
        )}
      </div>
    </button>
  );
};

export default GestionInmueblesList;
