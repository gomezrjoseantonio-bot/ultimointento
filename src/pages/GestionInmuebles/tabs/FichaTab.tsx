// src/pages/GestionInmuebles/tabs/FichaTab.tsx
// Pantalla D · Resumen compacto en 4 columnas (5 si el inmueble está vendido)

import React, { useEffect, useState } from 'react';
import type { Property, PropertySale } from '../../../services/db';
import { initDB } from '../../../services/db';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #00A7B5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

const fmtEuro = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €';
};

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(0)}%`;
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
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

interface FichaTabProps {
  property: Property;
}

const FichaTab: React.FC<FichaTabProps> = ({ property }) => {
  const [sale, setSale] = useState<PropertySale | null>(null);

  useEffect(() => {
    if (property.state !== 'vendido' || property.id == null) return;
    let cancelled = false;
    (async () => {
      const db = await initDB();
      const all = (await db.getAll('property_sales')) as PropertySale[];
      const latest = all
        .filter((s) => s.propertyId === property.id && s.status === 'confirmed')
        .sort((a, b) => b.saleDate.localeCompare(a.saleDate))[0];
      if (!cancelled) setSale(latest ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [property.id, property.state]);

  const totalAcquisition = getTotalAcquisition(property);
  const costs = property.acquisitionCosts;
  const otherSum = costs.other?.reduce((s, o) => s + (o.amount || 0), 0) || 0;
  const isSold = property.state === 'vendido';
  const fiscal = property.fiscalData;

  // Compute ITP percentage if price > 0
  const itpPct = costs.price > 0 && costs.itp
    ? (costs.itp / costs.price) * 100
    : null;

  // Ganancia patrimonial: siempre desde el snapshot fiscal del wizard.
  // Las ventas previas al PR2 no tenían snapshot y se muestran como "—".
  const gananciaPatrimonial = sale?.fiscalSnapshot?.gananciaPatrimonial ?? null;

  const columns = isSold ? 5 : 4;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 16,
      }}
    >
      {/* Identificación */}
      <FichaSection title="Identificación">
        <FichaRow label="Alias" value={property.alias} />
        <FichaRow label="Ref. catastral" value={property.cadastralReference || '—'} />
        <FichaRow
          label="Año construcción"
          value={fiscal?.acquisitionDate ? fiscal.acquisitionDate.slice(0, 4) : '—'}
        />
      </FichaSection>

      {/* Ubicación */}
      <FichaSection title="Ubicación">
        <FichaRow label="CP" value={property.postalCode || '—'} />
        <FichaRow label="Población" value={property.municipality || '—'} />
        <FichaRow label="Provincia" value={property.province || '—'} />
        <FichaRow label="Comunidad" value={property.ccaa || '—'} />
      </FichaSection>

      {/* Compra y coste */}
      <FichaSection title="Compra y coste">
        <FichaRow label="Fecha" value={fmtDate(property.purchaseDate)} />
        <FichaRow label="Precio" value={fmtEuro(costs.price)} mono />
        {costs.itp != null && costs.itp > 0 && (
          <FichaRow
            label={itpPct ? `ITP (${itpPct.toFixed(1)}%)` : 'ITP'}
            value={fmtEuro(costs.itp)}
            mono
          />
        )}
        {costs.iva != null && costs.iva > 0 && (
          <FichaRow label="IVA" value={fmtEuro(costs.iva)} mono />
        )}
        <FichaRow label="Notaría" value={fmtEuro(costs.notary)} mono />
        <FichaRow label="Registro" value={fmtEuro(costs.registry)} mono />
        <FichaRow label="Gestoría" value={fmtEuro(costs.management)} mono />
        {otherSum > 0 && <FichaRow label="Otros" value={fmtEuro(otherSum)} mono />}
        <FichaRow label="Total" value={fmtEuro(totalAcquisition)} mono bold />
      </FichaSection>

      {/* Fiscal */}
      <FichaSection title="Fiscal">
        <FichaRow label="V. catastral" value={fmtEuro(fiscal?.cadastralValue)} mono />
        <FichaRow
          label="V. construcción"
          value={fmtEuro(fiscal?.constructionCadastralValue)}
          mono
        />
        <FichaRow
          label="% construcción"
          value={fmtPct(fiscal?.constructionPercentage)}
          mono
        />
        <FichaRow
          label="Revisado"
          value={fiscal?.cadastralRevised ? 'Sí' : 'No'}
        />
        <FichaRow
          label="% propiedad"
          value={fmtPct(property.porcentajePropiedad ?? 100)}
          mono
        />
        <FichaRow
          label="Tipo"
          value={property.esUrbana === false ? 'Rústica' : 'Urbana'}
        />
      </FichaSection>

      {/* Venta (solo si está vendido) */}
      {isSold && (
        <FichaSection title="Venta" highlight>
          <FichaRow label="Fecha venta" value={fmtDate(sale?.saleDate)} />
          <FichaRow label="Precio venta" value={fmtEuro(sale?.salePrice)} mono />
          <FichaRow
            label="Gastos venta"
            value={fmtEuro(
              sale
                ? (sale.saleCosts.agencyCommission || 0) +
                    (sale.saleCosts.municipalTax || 0) +
                    (sale.saleCosts.saleNotaryCosts || 0) +
                    (sale.saleCosts.otherCosts || 0)
                : null,
            )}
            mono
          />
          <FichaRow
            label="Hipoteca cancelada"
            value={fmtEuro(sale?.loanSettlement.total)}
            mono
          />
          <FichaRow
            label="Neto recibido"
            value={fmtEuro(sale?.netProceeds)}
            mono
            bold
          />
          <FichaRow
            label="Ganancia patrimonial"
            value={
              gananciaPatrimonial != null
                ? (gananciaPatrimonial >= 0 ? '+' : '') + fmtEuro(gananciaPatrimonial)
                : '—'
            }
            mono
            bold
            positiveColor={
              gananciaPatrimonial != null
                ? gananciaPatrimonial >= 0
                  ? 'navy'
                  : 'teal'
                : undefined
            }
          />
        </FichaSection>
      )}
    </div>
  );
};

const FichaSection: React.FC<{
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}> = ({ title, highlight, children }) => (
  <div
    style={{
      background: highlight ? C.grey50 : C.white,
      border: `1px solid ${C.grey200}`,
      borderRadius: 12,
      padding: 16,
      borderLeft: highlight ? `3px solid ${C.navy900}` : `1px solid ${C.grey200}`,
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: C.grey500,
        letterSpacing: '.06em',
        marginBottom: 12,
      }}
    >
      {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
);

const FichaRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  positiveColor?: 'navy' | 'teal';
}> = ({ label, value, mono, bold, positiveColor }) => {
  const valueColor = positiveColor === 'teal' ? C.teal600 : positiveColor === 'navy' ? C.navy900 : C.grey900;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 12, color: C.grey500, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: bold ? 600 : 400,
          color: valueColor,
          fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
};

export default FichaTab;
