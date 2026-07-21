// src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx
// ATLAS HORIZON: Historical valuations view + edit/delete individuales (D-CRUD-ALTA sub-tarea 6)

import React, { useCallback, useEffect, useState } from 'react';
import { MoreVertical, Pencil, Trash2, TrendingUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { valoracionesService } from '../../../../services/valoracionesService';
import type { ValoracionesMensuales, ValoracionHistorica } from '../../../../types/valoraciones';

type ValoracionesTab = 'historico' | 'evolucion' | 'detalle';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const Valoraciones: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ValoracionesTab>('historico');
  const [snapshots, setSnapshots] = useState<ValoracionesMensuales[]>([]);
  const [individuales, setIndividuales] = useState<ValoracionHistorica[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadIndividuales = useCallback(() => {
    valoracionesService.listarValoraciones().then(setIndividuales).catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all([
      valoracionesService.getHistoricoCompleto().then(setSnapshots),
      valoracionesService.listarValoraciones().then(setIndividuales),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tabs: { id: ValoracionesTab; label: string }[] = [
    { id: 'historico', label: 'Histórico' },
    { id: 'evolucion', label: 'Evolución' },
    { id: 'detalle', label: 'Detalle' },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-inter)', padding: '0' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
          Valoraciones
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          Histórico de valoraciones mensuales de tus activos
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--atlas-blue)' : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--atlas-blue)' : 'var(--text-gray)',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font-inter)',
              transition: 'color 0.2s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: 'var(--text-gray)',
            fontSize: '0.875rem',
          }}
        >
          Cargando histórico...
        </div>
      ) : (
        <>
          {activeTab === 'historico' && (snapshots.length === 0 ? <EmptyState /> : <TablaHistorico snapshots={snapshots} />)}
          {activeTab === 'evolucion' && (snapshots.length === 0 ? <EmptyState /> : <EvolucionView snapshots={snapshots} />)}
          {activeTab === 'detalle' && (
            <TablaIndividuales
              valoraciones={individuales}
              onChanged={reloadIndividuales}
            />
          )}
        </>
      )}
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '48px 24px',
      border: '1px dashed var(--hz-neutral-300)',
      borderRadius: '12px',
      color: 'var(--text-gray)',
      textAlign: 'center',
    }}
  >
    <TrendingUp size={48} strokeWidth={1} style={{ color: 'var(--hz-neutral-300)' }} aria-hidden="true" />
    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
      Sin valoraciones registradas
    </p>
    <p style={{ margin: 0, fontSize: '0.875rem' }}>
      Actualiza valores desde el Dashboard o importa un histórico desde Cuenta &gt; Migración de Datos.
    </p>
  </div>
);

// ── Tabla histórico ───────────────────────────────────────────────────────────

const TablaHistorico: React.FC<{ snapshots: ValoracionesMensuales[] }> = ({ snapshots }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
          {['Mes', 'Inmuebles', 'Inversiones', 'Total', 'Variación €', 'Variación %'].map((col) => (
            <th
              key={col}
              style={{
                padding: '10px 16px',
                textAlign: col === 'Mes' ? 'left' : 'right',
                fontWeight: 600,
                color: 'var(--text-gray)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...snapshots].reverse().map((s, i) => (
          <tr
            key={s.id ?? i}
            style={{
              borderBottom: '1px solid var(--hz-neutral-300)',
              backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, var(--atlas-v5-card-alt))',
            }}
          >
            <td style={{ padding: '10px 16px', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
              {s.fecha_cierre.substring(0, 7)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.inmuebles_total)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.inversiones_total)}
            </td>
            <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(s.patrimonio_total)}
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: s.variacion_euros >= 0 ? 'var(--ok)' : 'var(--alert)',
              }}
            >
              {s.variacion_euros >= 0 ? '+' : ''}{formatCurrency(s.variacion_euros)}
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: s.variacion_porcentaje >= 0 ? 'var(--ok)' : 'var(--alert)',
              }}
            >
              {formatPercent(s.variacion_porcentaje)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── Evolución bar chart (simple CSS-based) ────────────────────────────────────

const EvolucionView: React.FC<{ snapshots: ValoracionesMensuales[] }> = ({ snapshots }) => {
  if (snapshots.length === 0) return <EmptyState />;
  const maxVal = Math.max(...snapshots.map((s) => s.patrimonio_total));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          height: '200px',
          padding: '0 0 32px',
          borderBottom: '1px solid var(--hz-neutral-300)',
          overflowX: 'auto',
        }}
      >
        {snapshots.map((s, i) => (
          <div
            key={s.id ?? i}
            title={`${s.fecha_cierre.substring(0, 7)}: ${formatCurrency(s.patrimonio_total)}`}
            style={{
              flex: '0 0 auto',
              width: '32px',
              height: maxVal > 0 ? `${(s.patrimonio_total / maxVal) * 160}px` : '4px',
              backgroundColor: 'var(--atlas-blue)',
              borderRadius: '4px 4px 0 0',
              minHeight: '4px',
              opacity: 0.85,
              transition: 'opacity 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '0.85')}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingTop: '6px' }}>
        {snapshots.map((s, i) => (
          <div
            key={s.id ?? i}
            style={{
              flex: '0 0 auto',
              width: '32px',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: 'var(--text-gray)',
              transform: 'rotate(-45deg)',
              transformOrigin: 'top center',
              whiteSpace: 'nowrap',
            }}
          >
            {s.fecha_cierre.substring(0, 7)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── D-CRUD-ALTA sub-tarea 6 · Tabla individuales con kebab edit/delete ───────

const TIPO_LABEL: Record<string, string> = {
  inmueble: 'Inmueble',
  inversion: 'Inversión',
  plan_pensiones: 'Plan pensiones',
};

interface TablaIndividualesProps {
  valoraciones: ValoracionHistorica[];
  onChanged: () => void;
}

const TablaIndividuales: React.FC<TablaIndividualesProps> = ({ valoraciones, onChanged }) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ValoracionHistorica | null>(null);
  const [deleting, setDeleting] = useState<ValoracionHistorica | null>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const close = (): void => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  if (valoraciones.length === 0) return <EmptyState />;

  const ordenadas = [...valoraciones].sort((a, b) =>
    a.fecha_valoracion < b.fecha_valoracion ? 1 : -1,
  );

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
              {['Fecha', 'Activo', 'Tipo', 'Valor', 'Origen', ''].map((col, idx) => (
                <th
                  key={`${col}-${idx}`}
                  style={{
                    padding: '10px 16px',
                    textAlign: col === 'Valor' ? 'right' : 'left',
                    fontWeight: 600,
                    color: 'var(--text-gray)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((v, i) => {
              const isOpen = v.id != null && openMenuId === v.id;
              return (
                <tr
                  key={v.id ?? `${v.tipo_activo}-${v.activo_id}-${v.fecha_valoracion}-${i}`}
                  style={{
                    borderBottom: '1px solid var(--hz-neutral-300)',
                    backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, var(--atlas-v5-card-alt))',
                  }}
                >
                  <td style={{ padding: '10px 16px', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
                    {v.fecha_valoracion}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--atlas-navy-1)' }}>
                    {v.activo_nombre}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-gray)', fontSize: '0.75rem' }}>
                    {TIPO_LABEL[v.tipo_activo] ?? v.tipo_activo}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--atlas-navy-1)',
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(v.valor)}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-gray)', fontSize: '0.75rem' }}>
                    {v.origen}
                  </td>
                  <td style={{ padding: '10px 16px', position: 'relative', width: 40 }}>
                    {v.id != null && (
                      <button
                        type="button"
                        aria-label={`Acciones valoración ${v.activo_nombre} ${v.fecha_valoracion}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isOpen ? null : (v.id as number));
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          padding: '4px 6px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-gray)',
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>
                    )}
                    {isOpen && (
                      <div
                        role="menu"
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: 'calc(100% - 4px)',
                          zIndex: 50,
                          background: 'var(--surface-card, var(--atlas-v5-card))',
                          border: '1px solid var(--hz-neutral-300)',
                          borderRadius: 8,
                          boxShadow: 'var(--atlas-v5-shadow-card)',
                          minWidth: 160,
                          padding: 4,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setOpenMenuId(null); setEditing(v); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '8px 10px',
                            background: 'transparent', border: 'none',
                            borderRadius: 6, fontSize: 13,
                            color: 'var(--atlas-navy-1)', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setOpenMenuId(null); setDeleting(v); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '8px 10px',
                            background: 'transparent', border: 'none',
                            borderRadius: 6, fontSize: 13,
                            color: 'var(--alert)', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditValoracionModal
          valoracion={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}

      {deleting && (
        <ConfirmDeleteValoracion
          valoracion={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); onChanged(); }}
        />
      )}
    </>
  );
};

const EditValoracionModal: React.FC<{
  valoracion: ValoracionHistorica;
  onClose: () => void;
  onSaved: () => void;
}> = ({ valoracion, onClose, onSaved }) => {
  const [valor, setValor] = useState(String(valoracion.valor));
  const [fecha, setFecha] = useState(valoracion.fecha_valoracion);
  const [notas, setNotas] = useState(valoracion.notas ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (valoracion.id == null) return;
    const parsed = Number(valor.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Valor no válido');
      return;
    }
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(fecha)) {
      toast.error('Fecha no válida (YYYY-MM o YYYY-MM-DD)');
      return;
    }
    setSaving(true);
    try {
      await valoracionesService.actualizarValoracion(valoracion.id, {
        valor: parsed,
        fecha_valoracion: fecha,
        notas: notas.trim() || undefined,
      });
      toast.success('Valoración actualizada');
      onSaved();
    } catch (err) {
      console.error('Error updating valoracion', err);
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={() => !saving && onClose()} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--atlas-v5-card)', borderRadius: 8, boxShadow: 'var(--atlas-v5-shadow-modal)', maxWidth: 420, width: '100%' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hz-neutral-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 14, color: 'var(--atlas-navy-1)' }}>Editar valoración</strong>
          <button type="button" onClick={() => !saving && onClose()} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-gray)' }}>
            <strong>{valoracion.activo_nombre}</strong> · {TIPO_LABEL[valoracion.tipo_activo] ?? valoracion.tipo_activo}
          </div>
          <label style={{ fontSize: 12, color: 'var(--text-gray)' }}>
            Valor (€)
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--hz-neutral-300)', borderRadius: 6, fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-gray)' }}>
            Fecha (YYYY-MM o YYYY-MM-DD)
            <input
              type="text"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="2026-01"
              style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--hz-neutral-300)', borderRadius: 6, fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-gray)' }}>
            Notas
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--hz-neutral-300)', borderRadius: 6, fontSize: 13, resize: 'none' }}
            />
          </label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--hz-neutral-300)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => !saving && onClose()} disabled={saving} className="atlas-btn-secondary atlas-btn-sm">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="atlas-btn-primary atlas-btn-sm">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmDeleteValoracion: React.FC<{
  valoracion: ValoracionHistorica;
  onClose: () => void;
  onDeleted: () => void;
}> = ({ valoracion, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    if (valoracion.id == null) return;
    setDeleting(true);
    try {
      await valoracionesService.eliminarValoracion(valoracion.id);
      toast.success('Valoración eliminada');
      onDeleted();
    } catch (err) {
      console.error('Error deleting valoracion', err);
      toast.error('Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={() => !deleting && onClose()} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--atlas-v5-card)', borderRadius: 8, boxShadow: 'var(--atlas-v5-shadow-modal)', maxWidth: 380, width: '100%', padding: 18 }}>
        <strong style={{ fontSize: 14, color: 'var(--atlas-navy-1)' }}>Eliminar valoración</strong>
        <p style={{ fontSize: 13, color: 'var(--text-gray)', marginTop: 8 }}>
          Vas a eliminar la valoración de <strong>{valoracion.activo_nombre}</strong> ({valoracion.fecha_valoracion}) por {formatCurrency(valoracion.valor)}. Esta acción no se puede deshacer.
        </p>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => !deleting && onClose()} disabled={deleting} className="atlas-btn-secondary atlas-btn-sm">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="atlas-btn-destructive atlas-btn-sm">
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Valoraciones;
