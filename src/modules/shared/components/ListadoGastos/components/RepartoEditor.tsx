// Reparto de un recibo entre varios inmuebles (§2.7). Se guarda el importe
// COMPLETO del recibo (el `importe` del compromiso) y cómo se reparte; el cargo
// se busca completo en el banco y se reparte al declarar. Reparto por porcentaje,
// por importe fijo a cada uno, o a partes iguales. El total tiene que sumar el
// 100 % (o el importe completo) · si no, no se puede guardar.

import React from 'react';
import { Icons } from '../../../../../design-system/v5';
import type { RepartoInmueble } from '../../../../../types/compromisosRecurrentes';
import { formatEur } from '../utils/amountFormatter';

export type ModoReparto = 'porcentaje' | 'importe';

export interface InmuebleOpcion {
  id: number;
  label: string;
}

interface RepartoEditorProps {
  importeCompleto: number;
  inmuebleActual: InmuebleOpcion;
  inmueblesDisponibles: InmuebleOpcion[];
  reparto: RepartoInmueble[];
  onChange: (reparto: RepartoInmueble[]) => void;
}

/** El modo se infiere de las líneas (si alguna trae `importe`, es por importe). */
export function modoDeReparto(reparto: RepartoInmueble[]): ModoReparto {
  return reparto.some((r) => r.importe != null) ? 'importe' : 'porcentaje';
}

/** Suma del reparto en su unidad (porcentaje → %, importe → €). */
export function sumaReparto(reparto: RepartoInmueble[], modo: ModoReparto): number {
  return reparto.reduce((s, r) => s + (modo === 'porcentaje' ? r.porcentaje ?? 0 : r.importe ?? 0), 0);
}

/** ¿Cuadra el reparto? (100 % o el importe completo, con tolerancia de céntimo). */
export function repartoCuadra(reparto: RepartoInmueble[], importeCompleto: number): boolean {
  if (reparto.length === 0) return false;
  const modo = modoDeReparto(reparto);
  const suma = sumaReparto(reparto, modo);
  const objetivo = modo === 'porcentaje' ? 100 : importeCompleto;
  return Math.abs(suma - objetivo) < 0.01;
}

const RepartoEditor: React.FC<RepartoEditorProps> = ({
  importeCompleto,
  inmuebleActual,
  inmueblesDisponibles,
  reparto,
  onChange,
}) => {
  const modo = modoDeReparto(reparto);
  const labelDe = (id: number): string =>
    id === inmuebleActual.id
      ? inmuebleActual.label
      : inmueblesDisponibles.find((i) => i.id === id)?.label ?? `Inmueble ${id}`;

  const leToca = (r: RepartoInmueble): number =>
    modo === 'porcentaje' ? (importeCompleto * (r.porcentaje ?? 0)) / 100 : r.importe ?? 0;

  const setModo = (nuevo: ModoReparto) => {
    // Al cambiar de modo, reparte a partes iguales en la nueva unidad.
    const n = reparto.length || 1;
    onChange(
      reparto.map((r) =>
        nuevo === 'porcentaje'
          ? { inmuebleId: r.inmuebleId, porcentaje: Math.round((100 / n) * 100) / 100 }
          : { inmuebleId: r.inmuebleId, importe: Math.round((importeCompleto / n) * 100) / 100 },
      ),
    );
  };

  const setParte = (inmuebleId: number, valor: number) => {
    onChange(
      reparto.map((r) =>
        r.inmuebleId === inmuebleId
          ? modo === 'porcentaje'
            ? { inmuebleId, porcentaje: valor }
            : { inmuebleId, importe: valor }
          : r,
      ),
    );
  };

  const partesIguales = () => {
    const n = reparto.length || 1;
    onChange(
      reparto.map((r) =>
        modo === 'porcentaje'
          ? { inmuebleId: r.inmuebleId, porcentaje: Math.round((100 / n) * 100) / 100 }
          : { inmuebleId: r.inmuebleId, importe: Math.round((importeCompleto / n) * 100) / 100 },
      ),
    );
  };

  const anadir = (id: number) => {
    if (reparto.some((r) => r.inmuebleId === id)) return;
    onChange([...reparto, modo === 'porcentaje' ? { inmuebleId: id, porcentaje: 0 } : { inmuebleId: id, importe: 0 }]);
  };

  const quitar = (id: number) => {
    if (id === inmuebleActual.id) return; // el inmueble actual no se quita
    onChange(reparto.filter((r) => r.inmuebleId !== id));
  };

  const noAnadidos = inmueblesDisponibles.filter((i) => !reparto.some((r) => r.inmuebleId === i.id));
  const suma = sumaReparto(reparto, modo);
  const objetivo = modo === 'porcentaje' ? 100 : importeCompleto;
  const cuadra = Math.abs(suma - objetivo) < 0.01;

  return (
    <div>
      <div style={modoRow}>
        <span style={modoLabel}>Cómo se reparte</span>
        <select style={modoSelect} value={modo} onChange={(e) => setModo(e.target.value as ModoReparto)}>
          <option value="porcentaje">Por porcentaje</option>
          <option value="importe">Por importe a cada uno</option>
        </select>
        <button type="button" style={btnLink} onClick={partesIguales}>
          A partes iguales
        </button>
      </div>

      <div style={tabla}>
        <div style={{ ...fila, ...cab }}>
          <span>Inmueble</span>
          <span style={{ textAlign: 'right' }}>{modo === 'porcentaje' ? 'Parte (%)' : 'Importe (€)'}</span>
          <span style={{ textAlign: 'right' }}>Le toca</span>
          <span />
        </div>
        {reparto.map((r) => (
          <div key={r.inmuebleId} style={fila}>
            <span style={celdaNombre}>{labelDe(r.inmuebleId)}</span>
            <input
              type="number"
              min={0}
              step={modo === 'porcentaje' ? 1 : 0.01}
              value={modo === 'porcentaje' ? r.porcentaje ?? 0 : r.importe ?? 0}
              onChange={(e) => setParte(r.inmuebleId, parseFloat(e.target.value) || 0)}
              style={parteInput}
              aria-label={`Parte de ${labelDe(r.inmuebleId)}`}
            />
            <span style={leTocaCel}>{formatEur(leToca(r))}</span>
            <span style={{ textAlign: 'center' }}>
              {r.inmuebleId !== inmuebleActual.id && (
                <button type="button" style={quitarBtn} onClick={() => quitar(r.inmuebleId)} aria-label="Quitar">
                  <Icons.Close size={13} />
                </button>
              )}
            </span>
          </div>
        ))}
        {noAnadidos.length > 0 && (
          <div style={{ ...fila, padding: '6px 12px' }}>
            <select
              style={anadirSelect}
              value=""
              onChange={(e) => {
                if (e.target.value) anadir(parseInt(e.target.value, 10));
              }}
              aria-label="Añadir otro inmueble"
            >
              <option value="">+ Añadir otro inmueble…</option>
              {noAnadidos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <span />
            <span />
            <span />
          </div>
        )}
        <div style={{ ...fila, ...totalFila }}>
          <span>Total</span>
          <span style={{ textAlign: 'right', color: cuadra ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)' }}>
            {modo === 'porcentaje' ? `${suma.toFixed(0)} %` : formatEur(suma)}
          </span>
          <span style={{ textAlign: 'right' }}>{formatEur(importeCompleto)}</span>
          <span />
        </div>
      </div>

      {!cuadra && (
        <div style={aviso}>
          El total tiene que sumar {modo === 'porcentaje' ? '100 %' : formatEur(importeCompleto)} · aún no cuadra, no se puede guardar así.
        </div>
      )}
    </div>
  );
};

const modoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
const modoLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--atlas-v5-ink-2)' };
const modoSelect: React.CSSProperties = {
  padding: '6px 9px',
  borderRadius: 7,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 12,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--atlas-v5-gold-ink)',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const tabla: React.CSSProperties = {
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 9,
  overflow: 'hidden',
};
const fila: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 110px 100px 32px',
  gap: 10,
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid var(--atlas-v5-line-3)',
  fontSize: 12.5,
};
const cab: React.CSSProperties = {
  background: 'var(--atlas-v5-card-alt)',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-ink-4)',
};
const celdaNombre: React.CSSProperties = {
  color: 'var(--atlas-v5-ink-2)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const parteInput: React.CSSProperties = {
  width: '100%',
  textAlign: 'right',
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 12.5,
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  boxSizing: 'border-box',
};
const leTocaCel: React.CSSProperties = {
  textAlign: 'right',
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};
const quitarBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--atlas-v5-ink-4)',
  cursor: 'pointer',
  fontSize: 15,
  lineHeight: 1,
};
const anadirSelect: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '6px 9px',
  borderRadius: 7,
  border: '1px dashed var(--atlas-v5-line)',
  fontSize: 12,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const totalFila: React.CSSProperties = {
  background: 'var(--atlas-v5-card-alt)',
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
  borderBottom: 'none',
  fontFamily: 'var(--atlas-v5-font-mono-num)',
};
const aviso: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11.5,
  color: 'var(--atlas-v5-neg)',
  lineHeight: 1.45,
};

export default RepartoEditor;
