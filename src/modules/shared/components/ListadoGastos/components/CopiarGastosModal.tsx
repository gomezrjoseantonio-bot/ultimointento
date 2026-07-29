// Copiar los gastos de otro inmueble (mockup v2_3 · «Copiar de otro»). Lo que
// más tiempo ahorra con varios pisos: se copia la ESTRUCTURA (concepto,
// proveedor, calendario) y tú cambias las cifras. Se añaden como NUEVOS y nacen
// preparado · no se toca nada de lo que ya tenga el inmueble destino. CUPS,
// contratos y repartos no se copian (son propios de cada inmueble).

import React, { useEffect, useMemo, useState } from 'react';
import { showToastV5 } from '../../../../../design-system/v5';
import {

  listarCompromisos,
  copiarGastosDeInmueble,
} from '../../../../../services/personal/compromisosRecurrentesService';

// Checkbox nativo tintado con el navy ATLAS · sin él, el navegador pinta su
// azul por defecto (fuera de paleta).
const checkInput: React.CSSProperties = { accentColor: 'var(--atlas-v5-brand)' };


interface CopiarGastosModalProps {
  inmuebleDestinoId: number;
  inmuebleDestinoLabel: string;
  inmueblesOrigen: Array<{ id: number; label: string }>; // otros inmuebles
  onCancel: () => void;
  onCopiado: (creados: number) => void;
}

const CopiarGastosModal: React.FC<CopiarGastosModalProps> = ({
  inmuebleDestinoId,
  inmuebleDestinoLabel,
  inmueblesOrigen,
  onCancel,
  onCopiado,
}) => {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [origenId, setOrigenId] = useState<number | ''>('');
  const [copiarImportes, setCopiarImportes] = useState(true);
  const [copiarCuenta, setCopiarCuenta] = useState(true);
  const [copiando, setCopiando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map: Record<number, number> = {};
      for (const inm of inmueblesOrigen) {
        try {
          const cs = await listarCompromisos({ ambito: 'inmueble', inmuebleId: inm.id });
          map[inm.id] = cs.filter((c) => c.estado === 'activo' || c.estado === 'preparado').length;
        } catch {
          map[inm.id] = 0;
        }
      }
      if (!cancelled) setCounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [inmueblesOrigen]);

  const nGastos = origenId === '' ? 0 : counts[origenId] ?? 0;
  const conGastos = useMemo(
    () => inmueblesOrigen.filter((i) => (counts[i.id] ?? 0) > 0),
    [inmueblesOrigen, counts],
  );

  const confirmar = async () => {
    if (origenId === '' || copiando) return;
    setCopiando(true);
    try {
      const creados = await copiarGastosDeInmueble(origenId, inmuebleDestinoId, {
        importes: copiarImportes,
        cuenta: copiarCuenta,
      });
      showToastV5(`Copiados ${creados} gasto${creados === 1 ? '' : 's'} · nacen preparados, ajústalos`, 'success');
      onCopiado(creados);
    } catch (err) {
      showToastV5(`No se pudo copiar: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setCopiando(false);
    }
  };

  return (
    <>
      <div style={overlay} onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Copiar de otro inmueble" style={modal}>
        <div style={title}>Copiar gastos a «{inmuebleDestinoLabel}»</div>
        <p style={hint}>Se añaden como nuevos · no se toca nada de lo que ya tenga este inmueble.</p>

        <label style={lab} htmlFor="cop-origen">Copiar desde</label>
        <select
          id="cop-origen"
          style={input}
          value={origenId}
          onChange={(e) => setOrigenId(e.target.value ? parseInt(e.target.value, 10) : '')}
        >
          <option value="">— Elige un inmueble —</option>
          {conGastos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label} · {counts[i.id]} gasto{counts[i.id] === 1 ? '' : 's'}
            </option>
          ))}
        </select>
        {conGastos.length === 0 && (
          <div style={{ ...hint, marginTop: 6 }}>Ningún otro inmueble tiene gastos que copiar.</div>
        )}

        <div style={quePart}>Qué se copia</div>
        <div style={fijoRow}>Concepto, proveedor y calendario · siempre</div>
        <label style={optRow}>
          <input type="checkbox" style={checkInput} checked={copiarImportes} onChange={(e) => setCopiarImportes(e.target.checked)} />
          <span>Los importes <span style={optSub}>· los copias y los ajustas; si no, quedan vacíos</span></span>
        </label>
        <label style={optRow}>
          <input type="checkbox" style={checkInput} checked={copiarCuenta} onChange={(e) => setCopiarCuenta(e.target.checked)} />
          <span>La cuenta de cargo</span>
        </label>
        <div style={fijoRowMuted}>CUPS, contratos y repartos · no se copian (son propios de cada inmueble)</div>

        {origenId !== '' && nGastos > 0 && (
          <div style={warnbox}>
            Se van a crear <strong>{nGastos} gasto{nGastos === 1 ? '' : 's'} nuevo{nGastos === 1 ? '' : 's'}</strong> en «{inmuebleDestinoLabel}». Los que no apliquen los suprimes después.
          </div>
        )}

        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button type="button" style={btnGold} disabled={origenId === '' || nGastos === 0 || copiando} onClick={() => void confirmar()}>
            {copiando ? 'Copiando…' : `Copiar ${nGastos || ''} gasto${nGastos === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </div>
    </>
  );
};

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'var(--atlas-v5-overlay)', zIndex: 300 };
const modal: React.CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(460px, 94vw)', maxHeight: '86vh', overflowY: 'auto',
  background: 'var(--atlas-v5-bg)', border: '1px solid var(--atlas-v5-line)', borderRadius: 14,
  boxShadow: 'var(--atlas-v5-shadow-modal)', zIndex: 301, padding: 22, fontFamily: 'var(--atlas-v5-font-ui)',
};
const title: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--atlas-v5-ink)', marginBottom: 6 };
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--atlas-v5-ink-4)', marginBottom: 14, lineHeight: 1.45 };
const lab: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5,
};
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--atlas-v5-line)',
  fontSize: 12.5, background: 'var(--atlas-v5-card)', color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)', boxSizing: 'border-box',
};
const quePart: React.CSSProperties = { ...lab, marginTop: 16 };
const fijoRow: React.CSSProperties = {
  fontSize: 12, color: 'var(--atlas-v5-ink-3)', padding: '8px 0', borderBottom: '1px solid var(--atlas-v5-line-3)',
};
const fijoRowMuted: React.CSSProperties = { ...fijoRow, color: 'var(--atlas-v5-ink-5)', borderBottom: 'none' };
const optRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--atlas-v5-ink-3)',
  padding: '8px 0', borderBottom: '1px solid var(--atlas-v5-line-3)', cursor: 'pointer',
};
const optSub: React.CSSProperties = { color: 'var(--atlas-v5-ink-5)', fontWeight: 400 };
const warnbox: React.CSSProperties = {
  marginTop: 14, fontSize: 12, color: 'var(--atlas-v5-ink-2)', background: 'var(--atlas-v5-gold-wash)',
  border: '1px solid var(--atlas-v5-gold-soft)', borderRadius: 8, padding: '10px 13px', lineHeight: 1.45,
};
const actions: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 };
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)', background: 'var(--atlas-v5-card)', color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGold: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--atlas-v5-gold)', background: 'var(--atlas-v5-gold)', color: 'var(--atlas-v5-brand-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default CopiarGastosModal;
