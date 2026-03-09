// src/components/dashboard/ActualizacionValoresDrawer.tsx
// ATLAS HORIZON: Drawer for updating monthly asset valuations from Dashboard

import React, { useEffect, useState, useCallback } from 'react';
import { X, Zap, Building2, LineChart, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { valoracionesService } from '../../services/valoracionesService';
import type { ActivoParaActualizar, ValoracionInput } from '../../types/valoraciones';

interface ActualizacionValoresDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const getMesActual = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMesAnterior = (fecha: string): string => {
  const [y, m] = fecha.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ActualizacionValoresDrawer: React.FC<ActualizacionValoresDrawerProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [selectedMes, setSelectedMes] = useState(getMesActual());
  const [inmuebles, setInmuebles] = useState<ActivoParaActualizar[]>([]);
  const [inversiones, setInversiones] = useState<ActivoParaActualizar[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadActivos = useCallback(async () => {
    setLoading(true);
    try {
      const [inm, inv] = await Promise.all([
        valoracionesService.getInmueblesParaActualizar(),
        valoracionesService.getInversionesParaActualizar(),
      ]);
      setInmuebles(inm);
      setInversiones(inv);

      // Preload with last known values
      const initial: Record<string, string> = {};
      [...inm, ...inv].forEach((a) => {
        if (a.ultima_valoracion !== undefined) {
          initial[`${a.tipo}-${a.id}`] = String(a.ultima_valoracion);
        }
      });
      setValores(initial);
    } catch (e) {
      console.error('Error loading activos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedMes(getMesActual());
      loadActivos();
    }
  }, [isOpen, loadActivos]);

  const handleCopiarMesAnterior = async () => {
    const mesAnterior = getMesAnterior(selectedMes);
    const snapshot = await valoracionesService.getSnapshotMensual(mesAnterior);

    if (!snapshot) {
      // Fall back to ultima_valoracion from each asset
      const initial: Record<string, string> = {};
      [...inmuebles, ...inversiones].forEach((a) => {
        if (a.ultima_valoracion !== undefined) {
          initial[`${a.tipo}-${a.id}`] = String(a.ultima_valoracion);
        }
      });
      setValores(initial);
      toast('Valores copiados del histórico de cada activo', { icon: '📋' });
      return;
    }

    // Load values as-of previous month (not latest overall)
    const newValores: Record<string, string> = {};
    for (const activo of [...inmuebles, ...inversiones]) {
      const hist = await valoracionesService.getUltimaValoracionHastaMes(activo.tipo, activo.id, mesAnterior);
      if (hist) {
        newValores[`${activo.tipo}-${activo.id}`] = String(hist.valor);
      }
    }
    setValores(newValores);
    toast('Valores copiados del mes anterior', { icon: '📋' });
  };

  const handleGuardar = async () => {
    const valoraciones: ValoracionInput[] = [];
    for (const activo of [...inmuebles, ...inversiones]) {
      const raw = valores[`${activo.tipo}-${activo.id}`];
      if (raw === undefined || raw === '') continue;
      const valor = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      if (isNaN(valor) || valor < 0) continue;
      valoraciones.push({
        tipo_activo: activo.tipo,
        activo_id: activo.id,
        activo_nombre: activo.nombre,
        valor,
      });
    }

    if (valoraciones.length === 0) {
      toast.error('Introduce al menos un valor');
      return;
    }

    setSaving(true);
    try {
      await valoracionesService.guardarValoracionesMensual(selectedMes, valoraciones);
      toast.success(`Valores de ${valoraciones.length} activos guardados correctamente`);
      onSaved();
      onClose();
    } catch (e) {
      console.error('Error saving valoraciones:', e);
      toast.error('Error al guardar los valores');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 998,
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Actualizar valores"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'clamp(320px, 90vw, 600px)',
          backgroundColor: 'var(--bg)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-inter)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
            <div>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--atlas-navy-1)',
                  margin: 0,
                }}
              >
                Actualizar valores
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', margin: 0 }}>
                Introduce los valores de cierre del mes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              color: 'var(--text-gray)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
            <input
              type="month"
              value={selectedMes}
              max={getMesActual()}
              onChange={(e) => setSelectedMes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--hz-neutral-300)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: 'var(--atlas-navy-1)',
                backgroundColor: 'var(--bg)',
                fontFamily: 'var(--font-inter)',
                appearance: 'none',
              }}
            />
          </div>
          <button
            onClick={handleCopiarMesAnterior}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--hz-neutral-300)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg)',
              color: 'var(--atlas-navy-1)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-inter)',
              whiteSpace: 'nowrap',
            }}
          >
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
            Copiar mes anterior
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
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
              Cargando activos...
            </div>
          ) : (
            <>
              {/* Inmuebles */}
              {inmuebles.length > 0 && (
                <section style={{ marginBottom: '28px' }}>
                  <h3
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: '0 0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Building2 size={14} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
                    Inmuebles
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {inmuebles.map((inm) => (
                      <AssetRow
                        key={`inmueble-${inm.id}`}
                        activo={inm}
                        valor={valores[`${inm.tipo}-${inm.id}`] ?? ''}
                        onChange={(v) =>
                          setValores((prev) => ({ ...prev, [`${inm.tipo}-${inm.id}`]: v }))
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Inversiones */}
              {inversiones.length > 0 && (
                <section>
                  <h3
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-gray)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: '0 0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <LineChart size={14} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
                    Inversiones
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {inversiones.map((inv) => (
                      <AssetRow
                        key={`inversion-${inv.id}`}
                        activo={inv}
                        valor={valores[`${inv.tipo}-${inv.id}`] ?? ''}
                        onChange={(v) =>
                          setValores((prev) => ({ ...prev, [`${inv.tipo}-${inv.id}`]: v }))
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {inmuebles.length === 0 && inversiones.length === 0 && (
                <p
                  style={{
                    color: 'var(--text-gray)',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    marginTop: '40px',
                  }}
                >
                  No hay activos activos para valorar. Añade inmuebles o inversiones primero.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--hz-neutral-300)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg)',
              color: 'var(--atlas-navy-1)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-inter)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: saving ? 'var(--hz-neutral-300)' : 'var(--atlas-blue)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-inter)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving ? 'Guardando...' : 'Guardar valores'}
          </button>
        </div>
      </div>
    </>
  );
};

// ── AssetRow ────────────────────────────────────────────────────────────────

interface AssetRowProps {
  activo: ActivoParaActualizar;
  valor: string;
  onChange: (v: string) => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ activo, valor, onChange }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 12px',
      border: '1px solid var(--hz-neutral-300)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg)',
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--atlas-navy-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {activo.nombre}
      </p>
      {activo.ultima_valoracion !== undefined && (
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'var(--text-gray)',
          }}
        >
          Último: {formatCurrency(activo.ultima_valoracion)}
        </p>
      )}
    </div>
    <input
      type="number"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      min="0"
      step="100"
      aria-label={`Valor para ${activo.nombre}`}
      style={{
        width: '140px',
        padding: '8px 10px',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: 'var(--atlas-navy-1)',
        backgroundColor: 'var(--bg)',
        fontFamily: 'var(--font-inter)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  </div>
);

export default ActualizacionValoresDrawer;
