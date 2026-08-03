// Fila de la tabla de gastos recurrentes (§3.1). Ocho columnas de anchos fijos
// (switch · chevron · concepto · importe · cuándo · cuenta/medio · al año · menú)
// para que el concepto no serpentee. El importe y los selectores de cuándo y
// cuenta se editan EN LA PROPIA FILA. Un gasto sin importe pinta «—», nunca 0.
// El detalle completo vive en la fila desplegada (RowForm), que abre el chevron.

import React, { useMemo, useState } from 'react';
import { nombreDelMetodo } from '../../../../../services/metodoDePago';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import {
  actualizarCompromiso,
  importeCompromisoEnMes,
} from '../../../../../services/personal/compromisosRecurrentesService';
import { showToastV5 } from '../../../../../design-system/v5';
import { formatEur } from '../utils/amountFormatter';
import { formatPattern } from '../utils/patternFormatter';
import { getSubtypeIcon } from '../utils/iconMapping';
import { patronToMeses, diaDePatron, mesesToPatron, mesesDeAtajo, type AtajoRejilla } from '../utils/rejillaMeses';

interface ExpenseRowProps {
  compromiso: CompromisoRecurrente & { id: number };
  isExpanded: boolean;
  account: Account | null;
  accounts: Account[];
  onToggle: () => void;
  onDelete: () => void;
  /** Interruptor de estado (§2.3): apagar un activo · activar un preparado · reactivar una baja. */
  onToggleEstado: () => void;
  /** Tras una edición en línea (importe · cuándo · cuenta) para recargar. */
  onInlineSaved: () => void;
}

// switch 52 · chevron 30 · concepto flexible · importe 128 · cuándo 198 ·
// cuenta 172 · al año 104 · menú 38 (§3.1 · sin scroll horizontal).
const ROW_GRID = '52px 30px minmax(0,1fr) 128px 198px 172px 104px 38px';

const MESES_BAJA = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaBajaLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESES_BAJA[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

function accountLabelOf(account: Account | null): string {
  if (!account) return '—';
  const alias = account.alias ?? account.name ?? account.banco?.name ?? '';
  const last4 = account.iban?.replace(/\s/g, '').slice(-4) ?? '';
  if (alias && last4) return `${alias} ···· ${last4}`;
  return alias || (last4 ? `···· ${last4}` : (account.iban ?? '—'));
}

function buildSubLabel(c: CompromisoRecurrente): string {
  if (c.numeroContrato) return c.numeroContrato;
  if (c.cups) return c.cups;
  if (c.proveedor?.nombre) return c.proveedor.nombre;
  return '';
}

/** Importe por cargo (fijo) o media (variable/estacional). null → «—» (nunca 0). */
function importePorCargo(c: CompromisoRecurrente): number | null {
  if (c.importe.modo === 'fijo') return c.importe.importe > 0 ? c.importe.importe : null;
  if (c.importe.modo === 'variable') return c.importe.importeMedio > 0 ? c.importe.importeMedio : null;
  if (c.importe.modo === 'diferenciadoPorMes') {
    const suma = c.importe.importesPorMes.reduce((s, v) => s + (v || 0), 0);
    return suma > 0 ? suma / 12 : null;
  }
  return null;
}

/** Atajos de calendario para el selector "cuándo" en la propia fila. */
const CUANDO_ATAJOS: Array<{ id: AtajoRejilla; label: string }> = [
  { id: 'todos', label: 'Todos los meses' },
  { id: 'cada2', label: 'Un mes sí, uno no' },
  { id: 'cada3', label: 'Trimestral' },
  { id: 'cada6', label: 'Semestral' },
  { id: 'unaVezAlAnio', label: 'Una vez al año' },
];

const ExpenseRow: React.FC<ExpenseRowProps> = ({
  compromiso: c,
  isExpanded,
  account,
  accounts,
  onToggle,
  onDelete,
  onToggleEstado,
  onInlineSaved,
}) => {
  const pattern = formatPattern(c.patron, c.fechaInicio);
  const SubIcon = getSubtypeIcon(c.subtipo);
  const subLabel = buildSubLabel(c);
  const isActivo = c.estado === 'activo';
  const isPreparado = c.estado === 'preparado';

  const impCargo = importePorCargo(c);
  const [impDraft, setImpDraft] = useState<string>(impCargo != null ? String(impCargo) : '');
  const [savingImp, setSavingImp] = useState(false);

  const alAnio = useMemo(() => {
    const y = new Date().getFullYear();
    let s = 0;
    let any = false;
    for (let m = 0; m < 12; m++) {
      const v = importeCompromisoEnMes(c, y, m);
      if (v != null) {
        s += Math.abs(v);
        any = true;
      }
    }
    return any && s > 0 ? s : null;
  }, [c]);

  /**
   * FASE 0 · guardar un cambio NO puede lanzar dos generadores.
   *
   * Aquí se llamaba a `actualizarCompromiso` y justo después a
   * `regenerateForecastsForward({force:true})`. El primero ya borra todas las
   * previsiones `predicted` de ESE compromiso y las vuelve a emitir; el segundo
   * es un barrido GLOBAL que borra las `predicted` desde el mes en curso y
   * regenera todo el catálogo.
   *
   * Los dos rangos no coinciden —uno va por compromiso y sin límite de fecha,
   * el otro va por fecha y sobre todo— así que encadenarlos no es regenerar dos
   * veces lo mismo: es dejar el resultado a merced del orden y de qué tramo
   * cubre cada uno. De ahí que cambiar un importe acabara creando un registro
   * nuevo en vez de modificar el que ya estaba.
   *
   * El plan lo dice: si dos caminos generan la misma previsión, uno sobra.
   * Sobra el barrido global: no es trabajo de editar una fila.
   */
  const persistir = async (patch: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>>) => {
    try {
      await actualizarCompromiso(c.id, patch);
      onInlineSaved();
    } catch (err) {
      showToastV5(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const guardarImporte = async (n: number) => {
    if (savingImp) return;
    setSavingImp(true);
    await persistir({ importe: { modo: 'fijo', importe: n } });
    setSavingImp(false);
  };
  const commitImporte = async () => {
    const n = parseFloat(impDraft);
    const actual = impCargo ?? 0;
    if (Number.isNaN(n) || n <= 0) {
      if (actual !== 0) await guardarImporte(0);
      return;
    }
    if (n !== actual) await guardarImporte(n);
  };

  const cambiarCuando = async (atajo: AtajoRejilla) => {
    const dia = diaDePatron(c.patron);
    const mesesActuales = patronToMeses(c.patron);
    const ancla = Math.min(...(mesesActuales.length ? mesesActuales : [new Date().getMonth() + 1]));
    await persistir({ patron: mesesToPatron(mesesDeAtajo(atajo, ancla), dia) });
  };
  const cambiarCuenta = async (accountId: number) => {
    await persistir({ cuentaCargo: accountId });
  };

  const importeEditable = c.importe.modo === 'fijo';
  const cuandoAtajoActual = ((): AtajoRejilla | '' => {
    const meses = patronToMeses(c.patron);
    if (meses.length === 12) return 'todos';
    if (meses.length === 1) return 'unaVezAlAnio';
    return '';
  })();

  const esMedioSinCuenta = c.metodoPago === 'tarjeta' || c.metodoPago === 'efectivo' || c.metodoPago === 'bizum';

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 12,
        padding: '9px 12px',
        borderBottom: '1px solid var(--atlas-v5-line-3)',
        alignItems: 'center',
        background: isExpanded ? 'var(--atlas-v5-gold-wash-2)' : undefined,
        transition: 'background 120ms ease',
        fontFamily: 'var(--atlas-v5-font-ui)',
        opacity: isActivo ? 1 : 0.82,
      }}
    >
      {/* Col 1 · interruptor de estado (oro = activo) */}
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          role="switch"
          aria-checked={isActivo}
          aria-label={isActivo ? `Apagar ${c.alias}` : isPreparado ? `Activar ${c.alias}` : `Reactivar ${c.alias}`}
          title={isActivo ? 'Apagar' : isPreparado ? 'Activar' : 'Reactivar'}
          onClick={onToggleEstado}
          style={{
            ...switchTrack,
            background: isActivo ? 'var(--atlas-v5-gold)' : 'var(--atlas-v5-line)',
            justifyContent: isActivo ? 'flex-end' : 'flex-start',
          }}
        >
          <span style={switchKnob} />
        </button>
      </div>

      {/* Col 2 · chevron (abre la fila desplegada) */}
      <div role="cell">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Cerrar' : 'Abrir'} ${c.alias}`}
          style={chevronBtn}
        >
          <ChevronRight
            size={15}
            strokeWidth={2}
            style={{
              color: 'var(--atlas-v5-ink-4)',
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 120ms ease',
            }}
          />
        </button>
      </div>

      {/* Col 3 · concepto */}
      <div role="cell" style={{ minWidth: 0 }}>
        <button type="button" onClick={onToggle} style={conceptoBtn} aria-label={`Editar ${c.alias}`}>
          <span style={iconWrap}>
            <SubIcon size={13} strokeWidth={1.8} style={{ color: 'var(--atlas-v5-ink-3)' }} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={rowName}>{c.alias}</span>
            {subLabel && <span style={rowSub}>{subLabel}</span>}
          </span>
          {c.estado !== 'activo' && (
            <span style={{ ...estadoChip, ...(isPreparado ? chipPrep : chipBaja) }}>
              {isPreparado ? 'aún no' : `baja · ${fechaBajaLabel(c.fechaFin)}`}
            </span>
          )}
          {c.reparto && c.reparto.length > 0 && (
            <span style={{ ...estadoChip, ...chipReparto }}>se reparte</span>
          )}
        </button>
      </div>

      {/* Col 4 · importe (inline) */}
      <div role="cell" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
        {importeEditable ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={impDraft}
            placeholder="—"
            aria-label={`Importe de ${c.alias}`}
            onChange={(e) => setImpDraft(e.target.value)}
            onBlur={() => void commitImporte()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={impInput}
          />
        ) : (
          <span style={impReadonly}>{impCargo != null ? formatEur(impCargo) : '—'}</span>
        )}
      </div>

      {/* Col 5 · cuándo (inline) */}
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <select
          aria-label={`Cuándo se cobra ${c.alias}`}
          value={cuandoAtajoActual}
          onChange={(e) => {
            if (e.target.value) void cambiarCuando(e.target.value as AtajoRejilla);
          }}
          style={cellSelect}
        >
          {cuandoAtajoActual === '' && <option value="">{pattern.primary}</option>}
          {CUANDO_ATAJOS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} · día {diaDePatron(c.patron)}
            </option>
          ))}
        </select>
      </div>

      {/* Col 6 · cuenta / medio (inline) */}
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        {esMedioSinCuenta ? (
          <span style={medioLabel}>
            {nombreDelMetodo(c.metodoPago)}
          </span>
        ) : (
          <select
            aria-label={`Cuenta de cargo de ${c.alias}`}
            value={c.cuentaCargo}
            onChange={(e) => void cambiarCuenta(parseInt(e.target.value, 10))}
            style={cellSelect}
          >
            {accounts.length === 0 && <option value={c.cuentaCargo}>{accountLabelOf(account)}</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabelOf(a)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Col 7 · al año (canónico · «—» si no calculable) */}
      <div role="cell" style={{ textAlign: 'right' }}>
        <span style={alAnioValue}>{alAnio != null ? formatEur(-Math.abs(alAnio)) : '—'}</span>
      </div>

      {/* Col 8 · menú (suprimir) */}
      <div role="cell" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`Suprimir ${c.alias}`}
          title="Suprimir"
          onClick={onDelete}
          style={iconBtn}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--atlas-v5-neg)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--atlas-v5-ink-4)';
          }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
};

const switchTrack: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 30,
  height: 17,
  borderRadius: 99,
  border: 'none',
  padding: 2,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 120ms ease',
};
const switchKnob: React.CSSProperties = {
  width: 13,
  height: 13,
  borderRadius: '50%',
  background: 'var(--atlas-v5-white)',
  display: 'block',
  boxShadow: 'var(--atlas-v5-shadow-card-active)',
};
const chevronBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const conceptoBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  minWidth: 0,
  width: '100%',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const iconWrap: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  background: 'var(--atlas-v5-bg)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const rowName: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-ink-2)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const rowSub: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  color: 'var(--atlas-v5-ink-4)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const estadoChip: React.CSSProperties = {
  flexShrink: 0,
  marginLeft: 6,
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderRadius: 99,
  padding: '2px 7px',
};
const chipPrep: React.CSSProperties = {
  background: 'var(--atlas-v5-brand-wash)',
  color: 'var(--atlas-v5-brand)',
};
const chipBaja: React.CSSProperties = {
  background: 'var(--atlas-v5-line-3)',
  color: 'var(--atlas-v5-ink-4)',
};
const chipReparto: React.CSSProperties = {
  background: 'var(--atlas-v5-brand-wash)',
  color: 'var(--atlas-v5-brand)',
};
const impInput: React.CSSProperties = {
  width: '100%',
  textAlign: 'right',
  padding: '6px 8px',
  borderRadius: 7,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  color: 'var(--atlas-v5-ink)',
  background: 'var(--atlas-v5-card)',
  boxSizing: 'border-box',
};
const impReadonly: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink)',
};
const cellSelect: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 7,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 12,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
const medioLabel: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-3)',
};
const alAnioValue: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};
const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  color: 'var(--atlas-v5-ink-4)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 120ms ease',
};

export { ROW_GRID };
export default ExpenseRow;
