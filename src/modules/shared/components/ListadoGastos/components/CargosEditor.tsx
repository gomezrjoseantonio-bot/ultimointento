// Los cargos del año de un gasto · el IBI que se paga en junio y en noviembre.
//
// Vive aparte de la ficha por lo mismo que `RepartoEditor`: es un editor con su
// propia lógica de filas —añadir, quitar, no dejar una a medio— y la ficha ya
// es larga. La ficha le pasa la lista y recibe la lista; quién convierte eso en
// importe y patrón es `cargosPorPago`, y lo hace con los dos a la vez.

import React from 'react';
import { Icons } from '../../../../../design-system/v5';
import { parseCargos, MESES_CORTOS, type CargoDraft } from '../utils/cargosPorPago';

interface CargosEditorProps {
  cargos: CargoDraft[];
  onChange: (cargos: CargoDraft[]) => void;
}

const CargosEditor: React.FC<CargosEditorProps> = ({ cargos, onChange }) => {
  // Una línea a medio escribir · no se deja añadir otra encima.
  const incompleto = parseCargos(cargos).length !== cargos.length;
  const primerMesLibre = (): number => {
    const usados = new Set(cargos.map((x) => x.mes));
    for (let m = 1; m <= 12; m++) if (!usados.has(m)) return m;
    return 1;
  };
  const cambiar = (i: number, campo: Partial<CargoDraft>) =>
    onChange(cargos.map((x, j) => (j === i ? { ...x, ...campo } : x)));

  return (
    <div style={{ marginTop: 12 }}>
      <label style={lab}>Cargos del año · uno por cada recibo, con su importe y su día</label>
      {cargos.map((cg, i) => (
        <div key={i} style={fila}>
          <select
            style={{ ...inp, maxWidth: 110 }}
            value={cg.mes}
            aria-label={`Mes (cargo ${i + 1})`}
            onChange={(e) => cambiar(i, { mes: parseInt(e.target.value, 10) })}
          >
            {MESES_CORTOS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            style={{ ...inp, maxWidth: 120, textAlign: 'right' }}
            value={cg.importe}
            placeholder="€"
            aria-label={`Importe (cargo ${i + 1})`}
            onChange={(e) => cambiar(i, { importe: e.target.value })}
          />
          <span style={hint}>el día</span>
          <input
            type="number"
            min={1}
            max={31}
            style={{ ...inp, maxWidth: 64, textAlign: 'right' }}
            value={cg.dia}
            placeholder="1"
            aria-label={`Día (cargo ${i + 1})`}
            onChange={(e) => cambiar(i, { dia: e.target.value })}
          />
          {cargos.length > 1 && (
            <button
              type="button"
              style={quitar}
              onClick={() => onChange(cargos.filter((_, j) => j !== i))}
              aria-label={`Quitar cargo ${i + 1}`}
            >
              <Icons.Close size={13} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        style={{ ...btnLink, opacity: incompleto || cargos.length >= 12 ? 0.45 : 1 }}
        disabled={incompleto || cargos.length >= 12}
        onClick={() => onChange([...cargos, { mes: primerMesLibre(), importe: '', dia: '1' }])}
      >
        + Añadir cargo
      </button>
      <div style={pie}>Los meses y los días del calendario salen de aquí · no hace falta marcarlos abajo.</div>
    </div>
  );
};

const lab: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--atlas-v5-ink-4)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};
const inp: React.CSSProperties = {
  width: '100%', border: '1px solid var(--atlas-v5-line)', borderRadius: 7, padding: '6px 9px',
  fontSize: 12.5, background: 'var(--atlas-v5-card)', color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)', boxSizing: 'border-box',
};
const fila: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };
const quitar: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--atlas-v5-ink-4)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', padding: 2,
};
const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--atlas-v5-gold-ink)', fontSize: 11.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--atlas-v5-font-ui)', padding: 0, marginTop: 2,
};
const hint: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-4)' };
const pie: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', marginTop: 6 };

export default CargosEditor;
