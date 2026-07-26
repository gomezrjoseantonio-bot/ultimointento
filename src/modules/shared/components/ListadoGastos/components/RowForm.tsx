// Fila desplegada como FORMULARIO COMPLETO (§3.2). Va DENTRO de la tabla, con
// borde izquierdo de 3 px en oro y fondo crema. Cuatro bloques con título en
// mayúsculas espaciadas y separador arriba (quién lo cobra · cuánto · cuándo ·
// estado), cada uno una rejilla de columnas con etiqueta pequeña en mayúsculas
// ENCIMA de cada campo (nada de leyendas flotando sobre el borde). Es la única
// superficie de edición: guarda con actualizarCompromiso y regenera previsiones.

import React, { useMemo, useState } from 'react';
import { actualizarCompromiso } from '../../../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../../../services/treasuryBootstrapService';
import { showToastV5 } from '../../../../../design-system/v5';
import type {
  CompromisoRecurrente,
  ImporteEvento,
  PatronVariacion,
  MetodoPagoCompromiso,
} from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import RejillaMeses from './RejillaMeses';
import { patronToMeses, mesesToPatron, diaDePatron } from '../utils/rejillaMeses';

interface RowFormProps {
  compromiso: CompromisoRecurrente & { id: number };
  accounts: Account[];
  onSaved: (updated: CompromisoRecurrente) => void;
}

type SubeCadaAnio = 'no' | 'ipc' | 'contrato';

// Familias fiscales reales (§3.2 · "cómo se declara"). Se guardan en `categoria`
// (que no dirige la agrupación por bloque · esa va por tipoFamilia).
const FISCAL: Array<{ id: string; label: string }> = [
  { id: 'comunidad', label: 'Comunidad' },
  { id: 'ibi_tasas', label: 'IBI y tasas' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'suministros', label: 'Suministros' },
  { id: 'reparaciones_conservacion', label: 'Reparaciones y conservación' },
  { id: 'servicios_profesionales', label: 'Servicios profesionales' },
  { id: 'intereses_financiacion', label: 'Intereses de financiación' },
  { id: 'mejora', label: 'Mejora' },
  { id: 'no_deducible', label: 'No deducible' },
];

const MEDIOS: Array<{ id: MetodoPagoCompromiso; label: string }> = [
  { id: 'domiciliacion', label: 'Domiciliación' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'bizum', label: 'Bizum' },
];

function importeToFijo(imp: ImporteEvento): string {
  if (imp.modo === 'fijo') return imp.importe > 0 ? String(imp.importe) : '';
  if (imp.modo === 'variable') return imp.importeMedio > 0 ? String(imp.importeMedio) : '';
  return '';
}
function variacionInicial(v?: PatronVariacion): SubeCadaAnio {
  if (v?.tipo === 'ipcAnual') return 'ipc';
  if (v?.tipo === 'aniversarioContrato') return 'contrato';
  return 'no';
}
/** Extrae la familia fiscal de `categoria` (si casa con alguna de la lista). */
function fiscalInicial(categoria?: string): string {
  if (!categoria) return '';
  return FISCAL.find((f) => categoria.includes(f.id))?.id ?? '';
}

const RowForm: React.FC<RowFormProps> = ({ compromiso: c, accounts, onSaved }) => {
  const [alias, setAlias] = useState(c.alias === 'Nuevo gasto' ? '' : c.alias);
  const [proveedor, setProveedor] = useState(c.proveedor?.nombre ?? '');
  const [nif, setNif] = useState(c.proveedor?.nif ?? '');
  const [cups, setCups] = useState(c.cups ?? '');
  const [numeroContrato, setNumeroContrato] = useState(c.numeroContrato ?? '');
  const [fiscal, setFiscal] = useState<string>(() => fiscalInicial(c.categoria));
  const [medio, setMedio] = useState<MetodoPagoCompromiso>(c.metodoPago);
  const [cuentaCargo, setCuentaCargo] = useState<number>(c.cuentaCargo);
  const [fechaInicio, setFechaInicio] = useState(c.fechaInicio ?? '');
  const [importe, setImporte] = useState(importeToFijo(c.importe));
  const [meses, setMeses] = useState<number[]>(() => patronToMeses(c.patron));
  const [dia, setDia] = useState<number>(() => diaDePatron(c.patron));
  const [diaIncierto, setDiaIncierto] = useState<boolean>(!!c.diaCargoIncierto);
  const [margenGracia, setMargenGracia] = useState<string>(
    c.margenGraciaDias != null ? String(c.margenGraciaDias) : '',
  );
  const [sube, setSube] = useState<SubeCadaAnio>(() => variacionInicial(c.variacion));
  const [ipcMes, setIpcMes] = useState<number>(c.variacion?.tipo === 'ipcAnual' ? c.variacion.mesRevision : 1);
  const [contratoMes, setContratoMes] = useState<number>(
    c.variacion?.tipo === 'aniversarioContrato' ? c.variacion.mesAniversario : 1,
  );
  const [contratoPct, setContratoPct] = useState<string>(
    c.variacion?.tipo === 'aniversarioContrato' ? String(c.variacion.porcentajeAnual) : '',
  );
  const [saving, setSaving] = useState(false);

  const mesAncla = useMemo(() => (meses.length ? Math.min(...meses) : new Date().getMonth() + 1), [meses]);
  const estadoLabel = c.estado === 'activo' ? 'Activo · se proyecta' : c.estado === 'preparado' ? 'Preparado · aún no se proyecta' : 'Dado de baja';

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const impNum = parseFloat(importe);
      const importeEvento: ImporteEvento =
        !Number.isNaN(impNum) && impNum > 0 ? { modo: 'fijo', importe: impNum } : { modo: 'fijo', importe: 0 };

      let variacion: PatronVariacion;
      if (sube === 'ipc') variacion = { tipo: 'ipcAnual', mesRevision: ipcMes };
      else if (sube === 'contrato')
        variacion = { tipo: 'aniversarioContrato', mesAniversario: contratoMes, porcentajeAnual: parseFloat(contratoPct) || 0 };
      else variacion = { tipo: 'sinVariacion' };

      const patron = mesesToPatron(meses.length ? meses : [new Date().getMonth() + 1], dia || 1);
      const margen = parseInt(margenGracia, 10);
      const nombre = alias.trim() || proveedor.trim() || 'Gasto recurrente';

      const payload: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>> = {
        alias: nombre,
        proveedor: { ...c.proveedor, nombre: proveedor.trim() || nombre, nif: nif.trim() || undefined },
        cups: cups.trim() || undefined,
        numeroContrato: numeroContrato.trim() || undefined,
        categoria: fiscal || c.categoria,
        metodoPago: medio,
        cuentaCargo,
        fechaInicio: fechaInicio || c.fechaInicio,
        importe: importeEvento,
        patron,
        variacion,
        diaCargoIncierto: diaIncierto || undefined,
        margenGraciaDias: Number.isNaN(margen) ? undefined : margen,
      };

      const updated = await actualizarCompromiso(c.id, payload);
      await regenerateForecastsForward({ force: true }).catch(() => {});
      showToastV5(`«${updated.alias}» guardado`, 'success');
      onSaved(updated);
    } catch (err) {
      showToastV5(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="region" aria-label={`Editar ${c.alias}`} style={panel}>
      {/* ── Quién lo cobra ── */}
      <div style={dtit}>Quién lo cobra</div>
      <div style={dgrid}>
        <Field label="Concepto"><input style={inp} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Luz, comunidad, seguro…" /></Field>
        <Field label="Proveedor"><input style={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></Field>
        <Field label="CIF o NIF"><input style={inp} value={nif} onChange={(e) => setNif(e.target.value)} placeholder="A12345678" /></Field>
        <Field label="Cómo se declara">
          <select style={inp} value={fiscal} onChange={(e) => setFiscal(e.target.value)}>
            <option value="">— Elegir —</option>
            {FISCAL.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Field>
      </div>
      <div style={dgrid2}>
        <Field label="CUPS · para luz y gas" hint="Con el CUPS, ATLAS cuadra la factura aunque cambies de compañía">
          <input style={{ ...inp, fontFamily: 'var(--atlas-v5-font-mono-num)' }} value={cups} onChange={(e) => setCups(e.target.value)} placeholder="ES00…" />
        </Field>
        <Field label="Número de contrato o póliza" hint="Lo que venga en el recibo · ayuda a cuadrarlo en el banco">
          <input style={inp} value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} placeholder="Contrato, póliza, referencia…" />
        </Field>
      </div>

      {/* ── Cuánto ── */}
      <div style={dtit}>Cuánto</div>
      <div style={dgrid}>
        <Field label="Importe €/cargo"><input type="number" min={0} step="0.01" style={{ ...inp, textAlign: 'right' }} value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="—" /></Field>
        <Field label="Medio de pago">
          <select style={inp} value={medio} onChange={(e) => setMedio(e.target.value as MetodoPagoCompromiso)}>
            {MEDIOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Cuenta de cargo">
          <select style={inp} value={cuentaCargo} onChange={(e) => setCuentaCargo(parseInt(e.target.value, 10))}>
            {accounts.length === 0 && <option value={cuentaCargo}>Sin cuentas · añade una en Cuentas</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.alias ?? a.name ?? a.banco?.name ?? `Cuenta ${a.id}`}</option>)}
          </select>
        </Field>
        <Field label="Sube cada año">
          <select style={inp} value={sube} onChange={(e) => setSube(e.target.value as SubeCadaAnio)}>
            <option value="no">No sube</option>
            <option value="ipc">Con el IPC</option>
            <option value="contrato">% fijo por contrato</option>
          </select>
          {sube === 'ipc' && (
            <div style={inlineRow}><span style={hint}>Revisión en el mes</span><input type="number" min={1} max={12} style={inpSmall} value={ipcMes} onChange={(e) => setIpcMes(clampMes(e.target.value))} /></div>
          )}
          {sube === 'contrato' && (
            <div style={inlineRow}><input type="number" min={0} step="0.1" style={inpSmall} value={contratoPct} onChange={(e) => setContratoPct(e.target.value)} placeholder="%" /><span style={hint}>% en el mes</span><input type="number" min={1} max={12} style={inpSmall} value={contratoMes} onChange={(e) => setContratoMes(clampMes(e.target.value))} /></div>
          )}
        </Field>
      </div>

      {/* ── Cuándo ── */}
      <div style={dtit}>Cuándo se cobra</div>
      <div style={dgrid}>
        <Field label="Primer cobro" hint="Fija el día y desde cuándo arranca el ciclo"><input type="date" style={inp} value={fechaInicio.slice(0, 10)} onChange={(e) => setFechaInicio(e.target.value)} /></Field>
        <Field label="Margen de gracia" hint="Días antes de avisarte de que no ha llegado"><input type="number" min={0} max={31} style={inpSmall} value={margenGracia} onChange={(e) => setMargenGracia(e.target.value)} placeholder="0" /></Field>
      </div>
      <div style={{ marginTop: 4 }}>
        <RejillaMeses meses={meses} dia={dia} mesAncla={mesAncla} onMesesChange={setMeses} onDiaChange={setDia} disabled={diaIncierto} />
        <label style={checkRow}>
          <input type="checkbox" checked={diaIncierto} onChange={(e) => setDiaIncierto(e.target.checked)} />
          <span>No sé el día del cargo todavía (se proyecta a mitad de mes)</span>
        </label>
      </div>

      {/* ── Estado ── */}
      <div style={dtit}>Estado</div>
      <div style={estadoBox}>{estadoLabel} · el interruptor de la fila lo apaga, activa o reactiva.</div>

      <div style={footer}>
        <button type="button" style={btnGold} disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

function clampMes(v: string): number {
  return Math.min(12, Math.max(1, parseInt(v, 10) || 1));
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ minWidth: 0 }}>
    <label style={lab}>{label}</label>
    {children}
    {hint && <div style={hint2}>{hint}</div>}
  </div>
);

const panel: React.CSSProperties = {
  background: 'var(--atlas-v5-card-alt)',
  borderLeft: '3px solid var(--atlas-v5-gold)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  padding: '18px 20px 20px',
};
const dtit: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  margin: '20px 0 12px',
  paddingTop: 16,
  borderTop: '1px solid var(--atlas-v5-line-2)',
};
const dgrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '14px 16px',
};
const dgrid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '14px 16px',
  marginTop: 14,
};
const lab: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 5,
  display: 'block',
};
const inp: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 7,
  padding: '6px 9px',
  fontSize: 12.5,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
const inpSmall: React.CSSProperties = { ...inp, width: 84 };
const inlineRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 };
const hint: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-4)' };
const hint2: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-5)', marginTop: 5, lineHeight: 1.45 };
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-3)',
  marginTop: 10,
  cursor: 'pointer',
};
const estadoBox: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-3)',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 8,
  padding: '10px 13px',
};
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', marginTop: 18 };
const btnGold: React.CSSProperties = {
  padding: '9px 22px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-brand-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default RowForm;
