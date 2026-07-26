// Fila desplegada como FORMULARIO COMPLETO (§3.2). Sustituye al cajón de edición
// y a los wizards de alta: es la única superficie para editar un gasto. Quién lo
// cobra (proveedor, CIF, CUPS, nº contrato, cómo se declara) · cuánto · cuándo
// (rejilla de 12 meses, día de cargo, "no lo sé", margen de gracia) · si sube
// cada año. Guarda con actualizarCompromiso y regenera las previsiones.

import React, { useMemo, useState } from 'react';
import { actualizarCompromiso } from '../../../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../../../services/treasuryBootstrapService';
import { showToastV5 } from '../../../../../design-system/v5';
import type {
  CompromisoRecurrente,
  ImporteEvento,
  PatronVariacion,
  BolsaPresupuesto,
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

const BOLSAS: Array<{ id: BolsaPresupuesto; label: string }> = [
  { id: 'necesidades', label: 'Necesidad' },
  { id: 'deseos', label: 'Deseo' },
  { id: 'ahorroInversion', label: 'Ahorro / inversión' },
  { id: 'obligaciones', label: 'Obligación' },
  { id: 'inmueble', label: 'Gasto de inmueble' },
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

const RowForm: React.FC<RowFormProps> = ({ compromiso: c, accounts, onSaved }) => {
  const [proveedor, setProveedor] = useState(c.proveedor?.nombre ?? '');
  const [nif, setNif] = useState(c.proveedor?.nif ?? '');
  const [cups, setCups] = useState(c.cups ?? '');
  const [numeroContrato, setNumeroContrato] = useState(c.numeroContrato ?? '');
  const [bolsa, setBolsa] = useState<BolsaPresupuesto>(c.bolsaPresupuesto);
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
  const [ipcMes, setIpcMes] = useState<number>(
    c.variacion?.tipo === 'ipcAnual' ? c.variacion.mesRevision : 1,
  );
  const [contratoMes, setContratoMes] = useState<number>(
    c.variacion?.tipo === 'aniversarioContrato' ? c.variacion.mesAniversario : 1,
  );
  const [contratoPct, setContratoPct] = useState<string>(
    c.variacion?.tipo === 'aniversarioContrato' ? String(c.variacion.porcentajeAnual) : '',
  );
  const [saving, setSaving] = useState(false);

  const mesAncla = useMemo(() => (meses.length ? Math.min(...meses) : new Date().getMonth() + 1), [meses]);

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
        variacion = {
          tipo: 'aniversarioContrato',
          mesAniversario: contratoMes,
          porcentajeAnual: parseFloat(contratoPct) || 0,
        };
      else variacion = { tipo: 'sinVariacion' };

      const patron = mesesToPatron(meses.length ? meses : [new Date().getMonth() + 1], dia || 1);
      const margen = parseInt(margenGracia, 10);

      const payload: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>> = {
        proveedor: { ...c.proveedor, nombre: proveedor.trim() || c.proveedor?.nombre || c.alias, nif: nif.trim() || undefined },
        cups: cups.trim() || undefined,
        numeroContrato: numeroContrato.trim() || undefined,
        bolsaPresupuesto: bolsa,
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
      <div style={grid}>
        {/* ── Quién lo cobra ── */}
        <fieldset style={block}>
          <legend style={legend}>Quién lo cobra</legend>
          <label style={lbl} htmlFor={`rf-prov-${c.id}`}>Proveedor</label>
          <input id={`rf-prov-${c.id}`} style={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          <label style={lbl} htmlFor={`rf-nif-${c.id}`}>CIF / NIF</label>
          <input id={`rf-nif-${c.id}`} style={inp} value={nif} onChange={(e) => setNif(e.target.value)} placeholder="Opcional" />
          <label style={lbl} htmlFor={`rf-cups-${c.id}`}>CUPS</label>
          <input id={`rf-cups-${c.id}`} style={inp} value={cups} onChange={(e) => setCups(e.target.value)} placeholder="Suministros · opcional" />
          <label style={lbl} htmlFor={`rf-nc-${c.id}`}>Nº de contrato / póliza</label>
          <input id={`rf-nc-${c.id}`} style={inp} value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} placeholder="Opcional" />
          <label style={lbl} htmlFor={`rf-bolsa-${c.id}`}>Cómo se declara</label>
          <select id={`rf-bolsa-${c.id}`} style={inp} value={bolsa} onChange={(e) => setBolsa(e.target.value as BolsaPresupuesto)}>
            {BOLSAS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </fieldset>

        {/* ── Cuánto ── */}
        <fieldset style={block}>
          <legend style={legend}>Cuánto</legend>
          <label style={lbl} htmlFor={`rf-imp-${c.id}`}>Importe €/cargo</label>
          <input
            id={`rf-imp-${c.id}`}
            type="number"
            min={0}
            step="0.01"
            style={inp}
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="—"
          />
          <label style={lbl} htmlFor={`rf-medio-${c.id}`}>Medio de pago</label>
          <select id={`rf-medio-${c.id}`} style={inp} value={medio} onChange={(e) => setMedio(e.target.value as MetodoPagoCompromiso)}>
            {MEDIOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label style={lbl} htmlFor={`rf-cuenta-${c.id}`}>Cuenta de cargo</label>
          <select id={`rf-cuenta-${c.id}`} style={inp} value={cuentaCargo} onChange={(e) => setCuentaCargo(parseInt(e.target.value, 10))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.alias ?? a.name ?? a.banco?.name ?? `Cuenta ${a.id}`}
              </option>
            ))}
          </select>
          <label style={lbl} htmlFor={`rf-sube-${c.id}`}>Sube cada año</label>
          <select id={`rf-sube-${c.id}`} style={inp} value={sube} onChange={(e) => setSube(e.target.value as SubeCadaAnio)}>
            <option value="no">No sube</option>
            <option value="ipc">Con el IPC</option>
            <option value="contrato">% fijo por contrato</option>
          </select>
          {sube === 'ipc' && (
            <div style={inlineRow}>
              <span style={hintInline}>Revisión en el mes</span>
              <input type="number" min={1} max={12} style={inpSmall} value={ipcMes} onChange={(e) => setIpcMes(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
            </div>
          )}
          {sube === 'contrato' && (
            <div style={inlineRow}>
              <input type="number" min={0} step="0.1" style={inpSmall} value={contratoPct} onChange={(e) => setContratoPct(e.target.value)} placeholder="%" />
              <span style={hintInline}>% en el mes</span>
              <input type="number" min={1} max={12} style={inpSmall} value={contratoMes} onChange={(e) => setContratoMes(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
            </div>
          )}
        </fieldset>

        {/* ── Cuándo ── */}
        <fieldset style={block}>
          <legend style={legend}>Cuándo se cobra</legend>
          <label style={lbl} htmlFor={`rf-fi-${c.id}`}>Primer cobro</label>
          <input id={`rf-fi-${c.id}`} type="date" style={inp} value={fechaInicio.slice(0, 10)} onChange={(e) => setFechaInicio(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <RejillaMeses
              meses={meses}
              dia={dia}
              mesAncla={mesAncla}
              onMesesChange={setMeses}
              onDiaChange={setDia}
              disabled={diaIncierto}
            />
          </div>
          <label style={checkRow}>
            <input type="checkbox" checked={diaIncierto} onChange={(e) => setDiaIncierto(e.target.checked)} />
            <span>No sé el día del cargo todavía (se proyecta a mitad de mes)</span>
          </label>
          <label style={lbl} htmlFor={`rf-mg-${c.id}`}>Margen de gracia (días)</label>
          <input id={`rf-mg-${c.id}`} type="number" min={0} max={31} style={inpSmall} value={margenGracia} onChange={(e) => setMargenGracia(e.target.value)} placeholder="0" />
        </fieldset>
      </div>

      <div style={footer}>
        <button type="button" style={btnGold} disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

const panel: React.CSSProperties = {
  background: 'var(--atlas-v5-card-alt)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  padding: '18px 24px',
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 24,
};
const block: React.CSSProperties = {
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 10,
  padding: '12px 14px 16px',
  margin: 0,
  minWidth: 0,
  background: 'var(--atlas-v5-card)',
};
const legend: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--atlas-v5-ink-4)',
  padding: '0 6px',
};
const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-ink-2)',
  margin: '10px 0 4px',
};
const inp: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 7,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 12.5,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
const inpSmall: React.CSSProperties = { ...inp, width: 80 };
const inlineRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
};
const hintInline: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-3)',
};
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-3)',
  margin: '12px 0 2px',
  cursor: 'pointer',
};
const footer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 16,
};
const btnGold: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default RowForm;
