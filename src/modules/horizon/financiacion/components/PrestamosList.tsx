import React, { useState, useEffect } from 'react';
import { Edit3, Eye, Trash2, CreditCard, Home, User } from 'lucide-react';
import { prestamosService } from '../../../../services/prestamosService';
import { cuentasService } from '../../../../services/cuentasService';
import { inmuebleService } from '../../../../services/inmuebleService';
import { Prestamo } from '../../../../types/prestamos';
import { Account } from '../../../../services/db';
import { Inmueble } from '../../../../types/inmueble';
import PrestamoDetailDrawer from './PrestamoDetailDrawer';
import { confirmDelete } from '../../../../services/confirmationService';

interface PrestamosListProps {
  onEdit: (prestamoId: string) => void;
  onViewDetail?: (prestamoId: string) => void;
}

const PrestamosList: React.FC<PrestamosListProps> = ({ onEdit, onViewDetail }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  const [selectedPrestamoForDetail, setSelectedPrestamoForDetail] = useState<Prestamo | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const [allPrestamos, accountsList, inmueblesList] = await Promise.all([
          prestamosService.getAllPrestamos(),
          cuentasService.list(),
          inmuebleService.getAll(),
        ]);
        setPrestamos(allPrestamos);
        setAccounts(accountsList);
        setInmuebles(inmueblesList);
      } catch (error) {
        console.error('Error loading loans:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const fmt = (value: number) =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const calculateEffectiveTIN = (prestamo: Prestamo) => {
    let baseTIN = 0;
    if (prestamo.tipo === 'FIJO') baseTIN = prestamo.tipoNominalAnualFijo || 0;
    else if (prestamo.tipo === 'VARIABLE') baseTIN = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
    else if (prestamo.tipo === 'MIXTO') baseTIN = prestamo.tipoNominalAnualMixtoFijo || 0;
    const totalBonificaciones = (prestamo.bonificaciones || []).reduce((s, b) => s + b.reduccionPuntosPorcentuales, 0);
    return Math.max(0, baseTIN - totalBonificaciones);
  };

  const estimateMonthlyPayment = (prestamo: Prestamo) => {
    const effectiveTIN = calculateEffectiveTIN(prestamo);
    const r = effectiveTIN / 12 / 100;
    const n = prestamo.plazoMesesTotal;
    if (r > 0 && n > 0) return (prestamo.principalVivo * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return n > 0 ? prestamo.principalVivo / n : 0;
  };

  const getAccount = (accountId?: string) =>
    accountId ? accounts.find(a => a.id?.toString() === accountId) || null : null;

  const getInmueble = (inmuebleId?: string) =>
    inmuebleId && inmuebleId !== 'standalone' ? inmuebles.find(i => i.id === inmuebleId) || null : null;

  const handleViewDetail = (prestamo: Prestamo) => {
    if (onViewDetail) {
      onViewDetail(prestamo.id);
    } else {
      setSelectedPrestamoForDetail(prestamo);
      setIsDetailDrawerOpen(true);
    }
  };

  const handleCloseDetailDrawer = () => {
    setIsDetailDrawerOpen(false);
    setSelectedPrestamoForDetail(null);
  };

  const handleDeletePrestamo = async (prestamoId: string) => {
    const prestamo = prestamos.find(p => p.id === prestamoId);
    const confirmed = await confirmDelete(prestamo?.nombre || 'este préstamo');
    if (confirmed) {
      try {
        await prestamosService.deletePrestamo(prestamoId);
        const allPrestamos = await prestamosService.getAllPrestamos();
        setPrestamos(allPrestamos);
        handleCloseDetailDrawer();
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-atlas-blue border-t-transparent mx-auto mb-4" />
          <p className="text-atlas-navy-1">Cargando préstamos...</p>
        </div>
      </div>
    );
  }

  if (prestamos.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <CreditCard className="h-12 w-12 text-text-gray mx-auto mb-4" />
        <h3 className="text-lg font-medium text-atlas-navy-1 mb-2">No hay préstamos</h3>
        <p className="text-text-gray">Comience creando su primer préstamo con el botón "Crear Préstamo"</p>
      </div>
    );
  }

  // Split by ambito
  const hipotecas = prestamos.filter(p => p.ambito === 'INMUEBLE');
  const personales = prestamos.filter(p => p.ambito === 'PERSONAL');

  // Sort each group by monthly payment descending
  const sortByPayment = (list: Prestamo[]) =>
    [...list].sort((a, b) => estimateMonthlyPayment(b) - estimateMonthlyPayment(a));

  // Global KPIs
  const deudaTotal = prestamos.reduce((sum, p) => sum + p.principalInicial, 0);
  const totalPagado = prestamos.reduce((sum, p) => sum + (p.principalInicial - p.principalVivo), 0);
  const totalPendiente = prestamos.reduce((sum, p) => sum + p.principalVivo, 0);
  const cuotaMensualTotal = prestamos.reduce((sum, p) => sum + estimateMonthlyPayment(p), 0);
  const globalPct = deudaTotal > 0 ? (totalPagado / deudaTotal) * 100 : 0;

  const sectionStats = (list: Prestamo[]) => {
    const deuda = list.reduce((sum, p) => sum + p.principalInicial, 0);
    const pendiente = list.reduce((sum, p) => sum + p.principalVivo, 0);
    return {
      deuda,
      pagado: list.reduce((sum, p) => sum + (p.principalInicial - p.principalVivo), 0),
      pendiente,
      cuota: list.reduce((sum, p) => sum + estimateMonthlyPayment(p), 0),
      capitalVivo: pendiente,
    };
  };

  const renderProgressBar = (pct: number, height = 8) => (
    <div
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: 'var(--hz-neutral-200, #e5e7eb)',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, pct))}%`,
          backgroundColor: 'var(--atlas-blue)',
          borderRadius: height / 2,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );

  const renderBadge = (tipo: Prestamo['tipo']) => {
    if (tipo === 'FIJO') {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          backgroundColor: 'var(--atlas-navy-1)', color: '#fff',
        }}>FIJO</span>
      );
    }
    if (tipo === 'MIXTO') {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          border: '1px solid var(--atlas-navy-1)', color: 'var(--atlas-navy-1)',
        }}>MIXTO</span>
      );
    }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        backgroundColor: '#f3f4f6', color: 'var(--text-gray)',
      }}>VARIABLE</span>
    );
  };

  const renderCard = (prestamo: Prestamo) => {
    const effectiveTIN = calculateEffectiveTIN(prestamo);
    const monthlyPayment = estimateMonthlyPayment(prestamo);
    const pagadoPct = prestamo.principalInicial > 0
      ? ((prestamo.principalInicial - prestamo.principalVivo) / prestamo.principalInicial) * 100
      : 0;
    const inmueble = getInmueble(prestamo.inmuebleId);
    const account = getAccount(prestamo.cuentaCargoId);
    const displayName = inmueble?.alias || prestamo.nombre;

    return (
      <div
        key={prestamo.id}
        className="group"
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 16,
          cursor: 'pointer',
          transition: 'box-shadow 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        onClick={() => handleViewDetail(prestamo)}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--atlas-navy-1)', wordBreak: 'break-word' }}>
                {displayName}
              </span>
              {renderBadge(prestamo.tipo)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 2 }}>
              {new Date(prestamo.fechaFirma).toLocaleDateString('es-ES')}
            </div>
          </div>
          {/* Action icons — visible on hover */}
          <div
            className="group-hover:opacity-100"
            style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => handleViewDetail(prestamo)}
              title="Ver detalle"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--atlas-blue)', padding: 4, borderRadius: 4 }}
            >
              <Eye size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onEdit(prestamo.id)}
              title="Editar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)', padding: 4, borderRadius: 4 }}
            >
              <Edit3 size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleDeletePrestamo(prestamo.id)}
              title="Eliminar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4, borderRadius: 4 }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Capital vivo */}
        <div style={{ margin: '10px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--atlas-navy-1)' }}>
            {fmt(prestamo.principalVivo)} €
          </div>
        </div>

        {/* TIN + Cuota */}
        <div style={{ fontSize: 13, color: 'var(--text-gray)', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
          TIN: {effectiveTIN.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          &nbsp;·&nbsp;
          Cuota: {fmt(monthlyPayment)} €
        </div>

        {/* Bank / account */}
        {account && (
          <div style={{ fontSize: 12, color: 'var(--text-gray)', marginBottom: 8 }}>
            Banco: {account.alias || account.banco?.name || account.bank || account.iban || '—'}
          </div>
        )}

        {/* Progress bar */}
        <div>
          {renderProgressBar(pagadoPct, 6)}
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {pagadoPct.toLocaleString('es-ES', { maximumFractionDigits: 0 })}% pagado
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    list: Prestamo[],
    icon: React.ReactNode,
  ) => {
    if (list.length === 0) return null;
    const stats = sectionStats(list);
    const pct = stats.deuda > 0 ? (stats.pagado / stats.deuda) * 100 : 0;
    const sorted = sortByPayment(list);

    return (
      <div style={{ marginBottom: 32 }}>
        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--atlas-navy-1)' }}>
              {title} ({list.length})
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--atlas-blue)', fontVariantNumeric: 'tabular-nums' }}>
            Capital vivo: {fmt(stats.capitalVivo)} €
          </span>
        </div>

        {/* Section sub-KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'Deuda total', value: stats.deuda },
            { label: 'Pagado', value: stats.pagado },
            { label: 'Pendiente', value: stats.pendiente },
            { label: 'Cuota mensual', value: stats.cuota },
          ].map(k => (
            <div key={k.label} style={{ backgroundColor: 'var(--bg)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(k.value)} €
              </div>
            </div>
          ))}
        </div>

        {/* Section progress bar */}
        <div style={{ marginBottom: 16 }}>
          {renderProgressBar(pct, 8)}
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {pct.toLocaleString('es-ES', { maximumFractionDigits: 0 })}% amortizado
          </div>
        </div>

        {/* Cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}
          className="loan-cards-grid">
          {sorted.map(p => renderCard(p))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Global KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Deuda Total', value: deudaTotal },
          { label: 'Total Pagado', value: totalPagado },
          { label: 'Total Pendiente', value: totalPendiente },
          { label: 'Cuota Mensual Total', value: cuotaMensualTotal },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: 'var(--bg)', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(k.value)} €
            </div>
          </div>
        ))}
      </div>

      {/* Global progress bar */}
      <div style={{ marginBottom: 28 }}>
        {renderProgressBar(globalPct, 10)}
        <div style={{ fontSize: 12, color: 'var(--text-gray)', marginTop: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {globalPct.toLocaleString('es-ES', { maximumFractionDigits: 1 })}% amortizado del total
        </div>
      </div>

      {/* Hipotecas section */}
      {renderSection(
        'Hipotecas',
        hipotecas,
        <Home size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} />,
      )}

      {/* Préstamos personales section */}
      {renderSection(
        'Préstamos Personales',
        personales,
        <User size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} />,
      )}

      {/* Loan Detail Drawer */}
      <PrestamoDetailDrawer
        prestamo={selectedPrestamoForDetail}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseDetailDrawer}
        onEdit={onEdit}
        onDelete={handleDeletePrestamo}
      />

      <style>{`
        @media (max-width: 1024px) {
          .loan-cards-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .loan-cards-grid { grid-template-columns: 1fr !important; }
        }
        .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default PrestamosList;