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

import React, { useEffect, useState } from 'react';
import { Check, X, Pencil, Save } from 'lucide-react';
import type { Account } from '../../services/db';

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

export interface MovimientoDrawerPatch {
  amount?: number;
  predictedDate?: string;
  accountId?: number | null;
}

export interface MovimientoDrawerProps {
  open: boolean;
  data: MovimientoDrawerData | null;
  onClose: () => void;
  onConfirmar?: (id: number | string) => void | Promise<void>;
  onEditar?: (id: number | string) => void;
  /** List of available accounts for the account selector in edit mode. */
  accounts?: Account[];
  /** Called when the user saves inline edits. */
  onSave?: (id: number | string, patch: MovimientoDrawerPatch) => void | Promise<void>;
}

const MovimientoDrawer: React.FC<MovimientoDrawerProps> = ({
  open,
  data,
  onClose,
  onConfirmar,
  onEditar,
  accounts,
  onSave,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAccountId, setEditAccountId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  // Reset edit state when drawer opens/closes or data changes
  useEffect(() => {
    if (!open || data == null) {
      setEditMode(false);
    }
  }, [open, data]);

  const enterEditMode = () => {
    if (!data) return;
    setEditAmount(String(Math.abs(data.amount)));
    setEditDate(data.predictedDate ? data.predictedDate.slice(0, 10) : '');
    const matchedAcc = accounts?.find(
      (a) => a.alias === data.accountAlias || a.banco?.name === data.accountAlias,
    );
    setEditAccountId(matchedAcc?.id ?? '');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!data || !onSave) return;
    setSaving(true);
    try {
      const patch: MovimientoDrawerPatch = {};
      const parsedAmt = parseFloat(editAmount.replace(',', '.'));
      if (!Number.isNaN(parsedAmt) && parsedAmt !== Math.abs(data.amount)) {
        patch.amount = parsedAmt;
      }
      if (editDate && editDate !== data.predictedDate?.slice(0, 10)) {
        patch.predictedDate = editDate;
      }
      if (editAccountId !== '' && editAccountId !== (accounts?.find(
        (a) => a.alias === data.accountAlias || a.banco?.name === data.accountAlias,
      )?.id)) {
        patch.accountId = editAccountId === '' ? null : Number(editAccountId);
      }
      await onSave(data.id, patch);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (editMode) cancelEdit();
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, editMode]);

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

              {/* ── Fecha prevista ── */}
              <Field label="Fecha de cargo prevista">
                {editMode ? (
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    aria-label="Fecha de cargo prevista"
                    style={inputStyle}
                  />
                ) : (
                  <ReadOnlyValue value={formatDateLong(data.predictedDate)} />
                )}
              </Field>

              {/* ── Importe ── */}
              <Field label="Importe (EUR)">
                {editMode ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    aria-label="Importe en euros"
                    style={inputStyle}
                  />
                ) : (
                  <ReadOnlyValue value={`${formatEur(data.amount)} €`} />
                )}
              </Field>

              {/* ── Cuenta ── */}
              <Field label="Cuenta de cargo">
                {editMode && accounts && accounts.length > 0 ? (
                  <select
                    value={editAccountId}
                    onChange={(e) =>
                      setEditAccountId(
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    aria-label="Cuenta de cargo"
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— Sin cuenta —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.alias ?? a.banco?.name ?? a.name ?? `#${a.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ReadOnlyValue value={data.accountAlias ?? '—'} />
                )}
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
          {editMode ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
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
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
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
                  background: 'var(--atlas-v5-brand)',
                  color: 'var(--atlas-v5-white)',
                  border: '1px solid transparent',
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Save size={14} strokeWidth={2.2} />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              {(onSave || onEditar) && data && (
                <button
                  type="button"
                  onClick={() => {
                    if (onSave) enterEditMode();
                    else if (onEditar) onEditar(data.id);
                  }}
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
                  <Pencil size={13} strokeWidth={2} />
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
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default MovimientoDrawer;

// ─── Subpiezas ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-brand)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui, inherit)',
  outline: 'none',
};

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
