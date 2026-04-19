// src/pages/GestionInmuebles/tabs/LineaAnualForm.tsx
// Modal compartido para crear/editar líneas de reparación / mejora / mobiliario

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Account } from '../../../services/db';
import type { Categoria } from './LineasAnualesTab';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';

export interface LineaAnualFormData {
  concepto: string;
  fecha: string;
  proveedorNIF?: string;
  importe: number;
  accountId?: number;
  vidaUtil?: number;
}

interface Initial {
  id: number;
  concepto: string;
  fecha: string;
  proveedorNIF?: string;
  importe: number;
  vidaUtil?: number;
  // Cuenta resuelta previamente (movimiento vinculado o cuentaBancaria del gasto)
  accountId?: number;
}

interface Props {
  categoria: Categoria;
  accounts: Account[];
  initial: Initial | null;
  pendiente: number;
  onCancel: () => void;
  onSave: (data: LineaAnualFormData) => void;
}

const LINE_TITLES: Record<Categoria, string> = {
  reparacion: 'reparación',
  mejora: 'mejora',
  mobiliario: 'mobiliario',
};

const LineaAnualForm: React.FC<Props> = ({ categoria, accounts, initial, pendiente, onCancel, onSave }) => {
  const [concepto, setConcepto] = useState(initial?.concepto ?? '');
  const [fecha, setFecha] = useState(
    initial?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [proveedorNIF, setProveedorNIF] = useState(initial?.proveedorNIF ?? '');
  const [importe, setImporte] = useState<string>(
    initial ? String(initial.importe) : '',
  );
  // La cuenta de pago es obligatoria: sin cuenta no podemos crear el
  // movimiento conciliado en Tesorería que exige la bidireccionalidad.
  const [accountId, setAccountId] = useState<string>(
    initial?.accountId != null ? String(initial.accountId) : '',
  );

  // Preselección: si el usuario no la cambió todavía, preseleccionamos la
  // única cuenta activa cuando `accounts` cambia (carga async) o cuando
  // abrimos el modal en modo edición con un `initial.accountId` que llega
  // después del primer render. No sobrescribimos una elección del usuario.
  const userTouchedAccountRef = useRef(false);
  useEffect(() => {
    if (userTouchedAccountRef.current) return;
    if (accountId) return;
    if (initial?.accountId != null) {
      setAccountId(String(initial.accountId));
      return;
    }
    const activos = accounts.filter((a) => a.activa !== false && a.status !== 'DELETED');
    if (activos.length === 1 && activos[0].id != null) {
      setAccountId(String(activos[0].id));
    }
  }, [accounts, initial?.accountId, accountId]);
  const [vidaUtil, setVidaUtil] = useState<number>(initial?.vidaUtil ?? 10);

  const title = initial
    ? `Editar ${LINE_TITLES[categoria]}`
    : `Nueva ${LINE_TITLES[categoria]}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const importeNum = parseFloat(importe.replace(',', '.'));
    if (!concepto.trim() || Number.isNaN(importeNum)) return;
    if (!accountId) return;
    onSave({
      concepto: concepto.trim(),
      fecha,
      proveedorNIF: proveedorNIF.trim() || undefined,
      importe: importeNum,
      accountId: parseInt(accountId, 10),
      vidaUtil: categoria === 'mobiliario' ? vidaUtil : undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 20,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: `1px solid ${C.grey200}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.grey900 }}>{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.grey500,
              display: 'inline-flex',
            }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <Field label="Concepto">
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Importe (€)">
              <input
                type="text"
                inputMode="decimal"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                required
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: categoria === 'mobiliario' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <Field label="NIF proveedor">
              <input
                type="text"
                value={proveedorNIF}
                onChange={(e) => setProveedorNIF(e.target.value.toUpperCase())}
                style={inputStyle}
              />
            </Field>
            {categoria === 'mobiliario' && (
              <Field label="Vida útil (años)">
                <input
                  type="number"
                  min={5}
                  max={20}
                  value={vidaUtil}
                  onChange={(e) => setVidaUtil(parseInt(e.target.value, 10) || 10)}
                  style={inputStyle}
                />
              </Field>
            )}
          </div>

          <Field label="Cuenta de pago *">
            <select
              value={accountId}
              onChange={(e) => {
                userTouchedAccountRef.current = true;
                setAccountId(e.target.value);
              }}
              required
              style={inputStyle}
            >
              <option value="">— Selecciona cuenta —</option>
              {accounts
                .filter((a) => a.activa !== false && a.status !== 'DELETED')
                .map((acc) => {
                  const name = acc.alias || acc.name || acc.banco?.name || 'Cuenta';
                  const iban = acc.iban ? acc.iban.replace(/\s+/g, '') : '';
                  const last4 = iban ? iban.slice(-4) : '';
                  return (
                    <option key={acc.id} value={acc.id}>
                      {last4 ? `${name} ·${last4}` : name}
                    </option>
                  );
                })}
            </select>
            <span style={{ fontSize: 11, color: 'var(--grey-500, #6C757D)', marginTop: 4, display: 'block' }}>
              Se creará un movimiento conciliado en Tesorería
            </span>
          </Field>

          {categoria === 'reparacion' && pendiente > 0 && !initial && (
            <div
              style={{
                padding: 12,
                background: C.grey50,
                border: `1px solid ${C.grey200}`,
                borderRadius: 8,
                fontSize: 12,
                color: C.grey700,
                lineHeight: 1.5,
              }}
            >
              Al guardar, ATLAS creará el movimiento pagado en Tesorería conciliado
              automáticamente. Se descontará del total pendiente de desglosar del año:{' '}
              <strong>{fmtEuro(pendiente)}</strong>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: `1px solid ${C.grey200}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: `1.5px solid ${C.grey300}`,
              background: C.white,
              color: C.grey700,
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!accountId || !concepto.trim() || !importe}
            style={{
              padding: '8px 16px',
              border: 'none',
              opacity: !accountId || !concepto.trim() || !importe ? 0.5 : 1,
              background: C.navy900,
              color: C.white,
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 500, color: C.grey500, textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {label}
    </span>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '6px 10px',
  border: `1px solid ${C.grey300}`,
  borderRadius: 6,
  fontSize: 13,
  color: C.grey900,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  background: C.white,
  outline: 'none',
  boxSizing: 'border-box',
};

export default LineaAnualForm;
