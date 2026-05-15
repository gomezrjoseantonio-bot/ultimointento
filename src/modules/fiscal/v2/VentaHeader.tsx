/**
 * VentaHeader · breadcrumb + título · pill · meta-line (comprada · vendida ·
 * precio venta · duración tenencia).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 §7.2.
 */

import React from 'react';
import type { Property, PropertySale } from '../../../services/db';
import ejercStyles from './FiscalEjercicioPage.module.css';
import ventaStyles from './FiscalVentaPage.module.css';

export interface VentaHeaderProps {
  property: Property;
  sale: PropertySale;
  añoEjercicio: number;
  estadoLabel: string;
  estadoClass?: string;
  onBack: () => void;
  onGoDashboard: () => void;
  onGoEjercicio: () => void;
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtPrecio(n: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)} €`;
}

function duracionTenencia(compra?: string, venta?: string): string {
  if (!compra || !venta) return '';
  const c = new Date(compra);
  const v = new Date(venta);
  if (!Number.isFinite(c.getTime()) || !Number.isFinite(v.getTime())) return '';
  const meses = Math.max(0, (v.getFullYear() - c.getFullYear()) * 12 + (v.getMonth() - c.getMonth()));
  const años = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  const partes: string[] = [];
  if (años > 0) partes.push(`${años} año${años === 1 ? '' : 's'}`);
  if (mesesRestantes > 0) partes.push(`${mesesRestantes} mes${mesesRestantes === 1 ? '' : 'es'}`);
  return partes.join(' ');
}

const VentaHeader: React.FC<VentaHeaderProps> = ({
  property,
  sale,
  añoEjercicio,
  estadoLabel,
  estadoClass,
  onBack,
  onGoDashboard,
  onGoEjercicio,
}) => {
  const titulo = `Venta · ${property.alias}`;
  const duracion = duracionTenencia(property.purchaseDate, sale.saleDate);

  return (
    <>
      <nav className={ejercStyles.breadcrumb} aria-label="breadcrumb">
        <button type="button" className={ejercStyles.backBtn} onClick={onBack}>
          ‹ Volver
        </button>
        <button type="button" onClick={onGoDashboard}>Fiscal</button>
        <span className={ejercStyles.breadcrumbSep}>›</span>
        <button type="button" onClick={onGoEjercicio}>{añoEjercicio}</button>
        <span className={ejercStyles.breadcrumbSep}>›</span>
        <span className={ejercStyles.breadcrumbCurrent}>{titulo}</span>
      </nav>

      <header className={ejercStyles.pageHead}>
        <div>
          <h1 className={ejercStyles.pageHeadTitle}>
            {titulo}
            <span className={`${ejercStyles.pill} ${estadoClass ?? ventaStyles.pillBorrador}`}>
              {estadoLabel}
            </span>
          </h1>
          <div className={ejercStyles.metaLine}>
            <span>
              comprada{' '}
              <strong className={ejercStyles.mono}>{fmtFecha(property.purchaseDate)}</strong>
            </span>
            <span className={ejercStyles.metaDot} />
            <span>
              vendida{' '}
              <strong className={ejercStyles.mono}>{fmtFecha(sale.saleDate)}</strong>
              {duracion ? ` · ${duracion}` : ''}
            </span>
            <span className={ejercStyles.metaDot} />
            <span>
              precio venta{' '}
              <strong className={ejercStyles.mono}>{fmtPrecio(sale.salePrice)}</strong>
            </span>
          </div>
        </div>
      </header>
    </>
  );
};

export default VentaHeader;
