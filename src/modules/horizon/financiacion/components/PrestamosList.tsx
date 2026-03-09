import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Edit3, Eye, Trash2, CreditCard, Home, User, ChevronDown, ChevronUp } from 'lucide-react';
import { prestamosService } from '../../../../services/prestamosService';
import { cuentasService } from '../../../../services/cuentasService';
import { inmuebleService } from '../../../../services/inmuebleService';
import { Prestamo } from '../../../../types/prestamos';
import { Account } from '../../../../services/db';
import { Inmueble } from '../../../../types/inmueble';
import PrestamoDetailDrawer from './PrestamoDetailDrawer';
import { confirmDelete } from '../../../../services/confirmationService';

const STORAGE_KEY_HIPOTECAS = 'atlas-loan-card-order-hipotecas';
const STORAGE_KEY_PERSONALES = 'atlas-loan-card-order-personales';

/** Calculate approximate end date: fechaPrimerCargo + plazoMesesTotal months */
const calcEndDate = (prestamo: Prestamo): Date => {
  const base = prestamo.fechaPrimerCargo ? new Date(prestamo.fechaPrimerCargo) : new Date(prestamo.fechaFirma);
  base.setMonth(base.getMonth() + (prestamo.plazoMesesTotal || 0));
  return base;
};

/** Sort by finish date ascending (closest end date first) */
const sortByEndDate = (list: Prestamo[]): Prestamo[] =>
  [...list].sort((a, b) => calcEndDate(a).getTime() - calcEndDate(b).getTime());

/** Apply saved order from localStorage, fallback to end-date sort */
const applyOrder = (list: Prestamo[], storageKey: string): Prestamo[] => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const savedIds: string[] = JSON.parse(saved);
      const byId = Object.fromEntries(list.map(p => [p.id, p]));
      const ordered = savedIds.filter(id => byId[id]).map(id => byId[id]);
      // Append any new items not yet in saved order
      const newItems = list.filter(p => !savedIds.includes(p.id));
      return [...ordered, ...sortByEndDate(newItems)];
    }
  } catch {}
  return sortByEndDate(list);
};

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
  const [hipotecasExpanded, setHipotecasExpanded] = useState(false);
  const [personalesExpanded, setPersonalesExpanded] = useState(false);
  const [hipotecasOrder, setHipotecasOrder] = useState<string[]>([]);
  const [personalesOrder, setPersonalesOrder] = useState<string[]>([]);
  const dragSrcRef = useRef<{ id: string; section: 'hipotecas' | 'personales' } | null>(null);

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
        // Initialize order
        const hipotecasList = allPrestamos.filter(p => p.ambito === 'INMUEBLE');
        const personalesList = allPrestamos.filter(p => p.ambito === 'PERSONAL');
        setHipotecasOrder(applyOrder(hipotecasList, STORAGE_KEY_HIPOTECAS).map(p => p.id));
        setPersonalesOrder(applyOrder(personalesList, STORAGE_KEY_PERSONALES).map(p => p.id));
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
    if (r > 0 && n > 0) return (prestamo.principalInicial * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return n > 0 ? prestamo.principalInicial / n : 0;
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

  // Split by ambito
  const hipotecas = prestamos.filter(p => p.ambito === 'INMUEBLE');
  const personales = prestamos.filter(p => p.ambito === 'PERSONAL');

  // Apply saved/sorted order to each group
  const getOrderedList = (list: Prestamo[], order: string[]): Prestamo[] => {
    if (order.length === 0) return sortByEndDate(list);
    const byId = Object.fromEntries(list.map(p => [p.id, p]));
    const ordered = order.filter(id => byId[id]).map(id => byId[id]);
    const newItems = list.filter(p => !order.includes(p.id));
    return [...ordered, ...sortByEndDate(newItems)];
  };

  // Drag & drop handlers
  const handleDragStart = useCallback((id: string, section: 'hipotecas' | 'personales') => {
    dragSrcRef.current = { id, section };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetId: string, section: 'hipotecas' | 'personales') => {
    const src = dragSrcRef.current;
    if (!src || src.id === targetId || src.section !== section) return;
    dragSrcRef.current = null;

    const reorder = (
      prev: string[],
      storageKey: string,
    ): string[] => {
      if (prev.length === 0) return prev; // order not yet initialized
      const next = [...prev];
      const fromIdx = next.indexOf(src.id);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, src.id);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    };

    if (section === 'hipotecas') {
      setHipotecasOrder(prev => reorder(prev, STORAGE_KEY_HIPOTECAS));
    } else {
      setPersonalesOrder(prev => reorder(prev, STORAGE_KEY_PERSONALES));
    }
  }, []);

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

  const renderCircleProgress = (pct: number) => {
    const size = 64;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--border-light, #e5e7eb)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--atlas-teal)" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x={size / 2} y={size / 2 - 5} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: 'var(--atlas-navy-1)' }}>
          {Math.round(pct)}%
        </text>
        <text x={size / 2} y={size / 2 + 8} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 9, fill: 'var(--text-gray)' }}>
          Pagado
        </text>
      </svg>
    );
  };

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
          backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--atlas-blue)',
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

  const renderCard = (prestamo: Prestamo, section: 'hipotecas' | 'personales') => {
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
        draggable
        onDragStart={() => handleDragStart(prestamo.id, section)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(prestamo.id, section)}
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 16,
          cursor: 'grab',
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
              {new Date(prestamo.fechaFirma).toLocaleDateString('es-ES')} – {calcEndDate(prestamo).toLocaleDateString('es-ES')}
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

        {/* Circular progress */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          {renderCircleProgress(pagadoPct)}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    list: Prestamo[],
    icon: React.ReactNode,
    section: 'hipotecas' | 'personales',
    expanded: boolean,
    onToggle: () => void,
  ) => {
    if (list.length === 0) return null;
    const stats = sectionStats(list);
    const pct = stats.deuda > 0 ? (stats.pagado / stats.deuda) * 100 : 0;
    const order = section === 'hipotecas' ? hipotecasOrder : personalesOrder;
    const sorted = getOrderedList(list, order);

    return (
      <div style={{ marginBottom: 32 }}>
        {/* Section header — clickable to expand/collapse */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none' }}
          onClick={onToggle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--atlas-navy-1)' }}>
              {title} ({list.length})
            </span>
            {expanded ? <ChevronUp size={14} strokeWidth={1.5} style={{ color: 'var(--text-gray)' }} /> : <ChevronDown size={14} strokeWidth={1.5} style={{ color: 'var(--text-gray)' }} />}
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
        <div style={{ marginBottom: expanded ? 16 : 0 }}>
          {renderProgressBar(pct, 8)}
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {pct.toLocaleString('es-ES', { maximumFractionDigits: 0 })}% amortizado
          </div>
        </div>

        {/* Cards grid — only when expanded */}
        {expanded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 16 }}
            className="loan-cards-grid">
            {sorted.map(p => renderCard(p, section))}
          </div>
        )}
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
        'hipotecas',
        hipotecasExpanded,
        () => setHipotecasExpanded(e => !e),
      )}

      {/* Préstamos personales section */}
      {renderSection(
        'Préstamos Personales',
        personales,
        <User size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} />,
        'personales',
        personalesExpanded,
        () => setPersonalesExpanded(e => !e),
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