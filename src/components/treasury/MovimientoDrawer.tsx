// ============================================================================
// ATLAS · T31 · MovimientoDrawer (mockup atlas-tesoreria-v8 · drawer detalle)
// ============================================================================
//
// Drawer lateral derecho que se abre al pulsar una pend-card de "Pendientes
// del día". Muestra el detalle del movimiento previsto:
//   · Header · "Movimiento previsto" + título · botón cerrar
//   · Importe grande (verde / rojo) + estado "previsto · pendiente de
//     confirmación"
//   · Campos · Concepto · Fecha prevista · Cuenta · Inmueble · Contrato ·
//     Categoría · Origen
//   · Footer · Editar (ghost) + Confirmar pago (gold)
//
// Solo lectura · los campos son select/input deshabilitados que sirven para
// mostrar la información estructurada. El botón "Editar" delega al padre
// (futuro · navegar a editor / modal). "Confirmar pago" llama onConfirmar
// que dispara confirmTreasuryEvent en el padre.
// ============================================================================

import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateLong = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export interface MovimientoDrawerData {
  id: number | string;
  description?: string;
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  status?: string;
  accountAlias?: string;
  inmuebleAlias?: string;
  contratoAlias?: string;
  categoryLabel?: string;
  origenTexto?: string;
  sourceType?: string;
}

export interface MovimientoDrawerProps {
  open: boolean;
  data: MovimientoDrawerData | null;
  onClose: () => void;
  onConfirmar?: (id: number | string) => void | Promise<void>;
  onEditar?: (id: number | string) => void;
}

const MovimientoDrawer: React.FC<MovimientoDrawerProps> = ({
  open,
  data,
  onClose,
  onConfirmar,
  onEditar,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const isPos = data?.type === 'income';
  const tone = isPos ? 'pos' : 'neg';
  const titulo = data?.description || (isPos ? 'Ingreso previsto' : 'Gasto previsto');

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14,20,35,0.42)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 110,
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '40%',
          maxWidth: 540,
          minWidth: 380,
          background: 'var(--atlas-v5-card)',
          borderLeft: '1px solid var(--atlas-v5-line)',
          boxShadow: '-8px 0 24px rgba(14,20,35,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .26s cubic-bezier(.32,.72,0,1)',
          zIndex: 111,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--atlas-v5-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
            background: 'var(--atlas-v5-card)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontWeight: 600,
                color: 'var(--atlas-v5-ink-4)',
                marginBottom: 4,
              }}
            >
              Movimiento previsto
            </div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--atlas-v5-ink)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--atlas-v5-ink-4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {data == null ? null : (
            <>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                  fontWeight: 700,
                  fontSize: 32,
                  color:
                    tone === 'pos' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
                  letterSpacing: '-0.025em',
                }}
              >
                {tone === 'pos' ? '+ ' : '− '}{formatEur(data.amount)} €
              </div>
              <div
                style={{
                  color: 'var(--atlas-v5-ink-4)',
                  fontSize: 13,
                  marginBottom: 18,
                }}
              >
                previsto · pendiente de confirmación
              </div>

              <Field label="Concepto">
                <ReadOnlyValue value={data.description ?? '—'} />
              </Field>
              <Field label="Fecha prevista">
                <ReadOnlyValue value={formatDateLong(data.predictedDate)} />
              </Field>
              <Field label="Cuenta">
                <ReadOnlyValue value={data.accountAlias ?? '—'} />
              </Field>
              {data.inmuebleAlias && (
                <Field label="Inmueble">
                  <ReadOnlyValue value={data.inmuebleAlias} />
                </Field>
              )}
              {data.contratoAlias && (
                <Field label="Contrato asociado">
                  <ReadOnlyValue
                    value={data.contratoAlias}
                    background="var(--atlas-v5-bg)"
                  />
                </Field>
              )}
              {data.categoryLabel && (
                <Field label="Categoría">
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--atlas-v5-brand-wash)',
                      color: 'var(--atlas-v5-brand)',
                    }}
                  >
                    {data.categoryLabel}
                  </span>
                </Field>
              )}
              {data.origenTexto && (
                <Field
                  label="Origen"
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--atlas-v5-line)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--atlas-v5-ink-3)',
                      lineHeight: 1.5,
                    }}
                  >
                    {data.origenTexto}
                  </div>
                </Field>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--atlas-v5-line)',
            display: 'flex',
            gap: 8,
            background: 'var(--atlas-v5-card-alt)',
            flexShrink: 0,
          }}
        >
          {onEditar && data && (
            <button
              type="button"
              onClick={() => onEditar(data.id)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--atlas-v5-card)',
                color: 'var(--atlas-v5-ink-2)',
                border: '1px solid var(--atlas-v5-line)',
                cursor: 'pointer',
              }}
            >
              Editar
            </button>
          )}
          {onConfirmar && data && (
            <button
              type="button"
              onClick={() => void onConfirmar(data.id)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--atlas-v5-gold)',
                color: 'var(--atlas-v5-white)',
                border: '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              <Check size={14} strokeWidth={2.2} />
              Confirmar pago
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default MovimientoDrawer;

// ─── Subpiezas ──────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, children, style }) => (
  <div style={{ marginBottom: 14, ...style }}>
    <div
      style={{
        fontSize: 10.5,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 700,
        color: 'var(--atlas-v5-ink-4)',
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

const ReadOnlyValue: React.FC<{ value: string; background?: string }> = ({
  value,
  background,
}) => (
  <div
    style={{
      padding: '8px 12px',
      background: background ?? 'var(--atlas-v5-card-alt)',
      border: '1px solid var(--atlas-v5-line)',
      borderRadius: 6,
      fontSize: 12.5,
      color: 'var(--atlas-v5-ink-2)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {value}
  </div>
);
