// Selector de concepto para "Añadir gasto" (§3.3). Enchufa el catálogo: en vez
// de crear una fila en blanco, ofrece los conceptos del catálogo agrupados por
// familia. Al elegir uno, la fila nace con su nombre y su familia ya puestos (y
// de ahí se deriva la fiscalidad). "Otro" queda al final para lo que no está.

import React from 'react';
import { Star } from 'lucide-react';
import type { TipoGasto } from '../../TipoGastoSelector';

export interface ConceptoElegido {
  tipoId: string;
  subtipoId: string;
  label: string;
  tipoCompromiso: string;
  categoria: string;
}

interface ConceptoPickerModalProps {
  catalog: TipoGasto[];
  /** Conceptos sugeridos por la modalidad (§3.3) · se marcan como sugeridos. */
  sugeridos?: Array<{ tipoId: string; subtipoId: string }>;
  onCancel: () => void;
  onPick: (concepto: ConceptoElegido) => void;
}

const ConceptoPickerModal: React.FC<ConceptoPickerModalProps> = ({ catalog, sugeridos, onCancel, onPick }) => {
  const sugeridosSet = new Set((sugeridos ?? []).map((r) => `${r.tipoId}:${r.subtipoId}`));
  const haySugeridos = sugeridosSet.size > 0;
  return (
    <>
      <div style={overlay} onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Elegir concepto del gasto" style={modal}>
        <div style={title}>¿Qué gasto añades?</div>
        <p style={hint}>
          Elige el concepto · la fila nace con su nombre y su familia fiscal ya puestos.
          {haySugeridos ? ' Los resaltados son los habituales para la modalidad de este inmueble.' : ''}
        </p>
        <div style={scroll}>
          {catalog.map((tipo) => (
            <div key={tipo.id} style={{ marginBottom: 14 }}>
              <div style={famLabel}>{tipo.label}</div>
              <div style={grid}>
                {tipo.subtipos.map((sub) => {
                  const esSugerido = sugeridosSet.has(`${tipo.id}:${sub.id}`);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      style={esSugerido ? chipSugerido : chip}
                      onClick={() =>
                        onPick({
                          tipoId: tipo.id,
                          subtipoId: sub.id,
                          label: sub.label,
                          // Los subtipos de inmueble/personal llevan tipoCompromiso y
                          // categoria; el tipo genérico no los expone, se leen sueltos.
                          tipoCompromiso: (sub as { tipoCompromiso?: string }).tipoCompromiso ?? 'otros',
                          categoria: (sub as { categoria?: string }).categoria ?? 'otros',
                        })
                      }
                    >
                      {esSugerido && <Star size={11} strokeWidth={2} style={{ marginRight: 5, verticalAlign: '-1px' }} />}
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--atlas-v5-overlay)',
  zIndex: 300,
};
const modal: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(560px, 94vw)',
  maxHeight: '82vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--atlas-v5-bg)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 14,
  boxShadow: 'var(--atlas-v5-shadow-modal)',
  zIndex: 301,
  padding: 22,
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink)',
  marginBottom: 6,
};
const hint: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 14,
  lineHeight: 1.45,
};
const scroll: React.CSSProperties = {
  overflowY: 'auto',
  paddingRight: 4,
  minHeight: 0,
};
const famLabel: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 7,
};
const grid: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
};
const chip: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const chipSugerido: React.CSSProperties = {
  ...chip,
  border: '1px solid var(--atlas-v5-gold-soft)',
  background: 'var(--atlas-v5-gold-wash)',
  color: 'var(--atlas-v5-gold-ink)',
};
const actions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 16,
  paddingTop: 14,
  borderTop: '1px solid var(--atlas-v5-line-2)',
};
const btnGhost: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default ConceptoPickerModal;
