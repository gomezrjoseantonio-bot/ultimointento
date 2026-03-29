import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ResultadoAnalisis, Diferencia } from '../../services/declaracionOnboardingService';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

export interface ConflictResolutions {
  [campo: string]: 'atlas' | 'aeat';
}

interface ConflictReviewStepProps {
  analisis: ResultadoAnalisis;
  resoluciones: ConflictResolutions;
  onResolve: (campo: string, valor: 'atlas' | 'aeat') => void;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--hz-neutral-200, #DEE2E6)',
  borderRadius: '16px',
  overflow: 'hidden',
  background: 'white',
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  background: 'var(--hz-neutral-100, #F0F2F5)',
  borderBottom: '1px solid var(--hz-neutral-200, #DEE2E6)',
  fontWeight: 600,
  color: 'var(--atlas-navy-1, #021E3F)',
  fontSize: '0.9rem',
};

const conflictRowStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--hz-neutral-100, #F0F2F5)',
};

const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  marginTop: '0.5rem',
};

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const newDataRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  borderBottom: '1px solid var(--hz-neutral-100, #F0F2F5)',
  fontSize: '0.9rem',
  color: 'var(--atlas-navy-1, #021E3F)',
};

const btnPrimary: React.CSSProperties = {
  border: 'none',
  borderRadius: '14px',
  padding: '0.85rem 1.5rem',
  background: 'var(--atlas-blue, #2563EB)',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.9rem',
};

const btnSecondary: React.CSSProperties = {
  border: '1px solid var(--hz-neutral-300, #CED4DA)',
  borderRadius: '14px',
  padding: '0.85rem 1.5rem',
  background: 'white',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.9rem',
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatValue(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'number') {
    return valor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  }
  return String(valor);
}

function collectAllConflicts(analisis: ResultadoAnalisis): Diferencia[] {
  const conflicts: Diferencia[] = [];

  // Personal conflicts (from perfilDetalle)
  if (analisis.perfilDetalle?.conflictos) {
    conflicts.push(...analisis.perfilDetalle.conflictos);
  }

  // Property conflicts (only real conflicts, not empty->filled)
  for (const inm of analisis.inmuebles.actualizar) {
    for (const diff of inm.diferencias) {
      if (diff.valorAtlas !== '—') {
        conflicts.push({
          ...diff,
          campo: `inm_${inm.inmuebleIdExistente}_${diff.campo}`,
          labelCampo: `${inm.direccion?.split(',')[0] || inm.referenciaCatastral}: ${diff.labelCampo}`,
        });
      }
    }
  }

  return conflicts;
}

function collectNewData(analisis: ResultadoAnalisis): Array<{ label: string; valor: string }> {
  const items: Array<{ label: string; valor: string }> = [];

  // Personal new fields
  if (analisis.perfilDetalle?.camposNuevos) {
    for (const campo of analisis.perfilDetalle.camposNuevos) {
      items.push({ label: campo.label, valor: campo.valor });
    }
  }

  // Property enrichment (empty fields filled)
  for (const inm of analisis.inmuebles.actualizar) {
    for (const diff of inm.diferencias) {
      if (diff.valorAtlas === '—') {
        items.push({
          label: `${inm.direccion?.split(',')[0] || inm.referenciaCatastral}: ${diff.labelCampo}`,
          valor: formatValue(diff.valorAeat),
        });
      }
    }
  }

  // New properties
  for (const inm of analisis.inmuebles.nuevos) {
    if (!inm.esAccesorio) {
      items.push({
        label: `Nuevo inmueble: ${inm.datos.direccion || inm.datos.referenciaCatastral}`,
        valor: inm.camposRellenados.join(', '),
      });
    }
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════

const ConflictReviewStep: React.FC<ConflictReviewStepProps> = ({
  analisis,
  resoluciones,
  onResolve,
  onConfirm,
  onCancel,
  saving = false,
}) => {
  const conflicts = collectAllConflicts(analisis);
  const newData = collectNewData(analisis);

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 0.25rem', color: 'var(--atlas-navy-1, #021E3F)', fontSize: '1.3rem' }}>
          Revision de datos importados
        </h3>
        <p style={{ margin: 0, color: 'var(--hz-neutral-700, #6C757D)', fontSize: '0.95rem' }}>
          ATLAS ha encontrado diferencias con los datos que ya tienes registrados.
        </p>
      </div>

      {/* Conflicts section */}
      {conflicts.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            Diferencias detectadas ({conflicts.length})
          </div>
          {conflicts.map((conflict) => (
            <div key={conflict.campo} style={conflictRowStyle}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--atlas-navy-1, #021E3F)' }}>
                {conflict.labelCampo}
              </div>
              <div style={radioGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name={`conflict_${conflict.campo}`}
                    checked={resoluciones[conflict.campo] === 'atlas'}
                    onChange={() => onResolve(conflict.campo, 'atlas')}
                  />
                  <span>
                    Mantener ATLAS: <strong>{formatValue(conflict.valorAtlas)}</strong>
                  </span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name={`conflict_${conflict.campo}`}
                    checked={(resoluciones[conflict.campo] ?? 'aeat') === 'aeat'}
                    onChange={() => onResolve(conflict.campo, 'aeat')}
                  />
                  <span>
                    Usar declaracion: <strong>{formatValue(conflict.valorAeat)}</strong>
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New data section */}
      {newData.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            Datos nuevos (se aplican automaticamente)
          </div>
          {newData.map((item, index) => (
            <div key={index} style={newDataRowStyle}>
              <CheckCircle2 size={16} style={{ color: 'var(--s-pos, #042C5E)', flexShrink: 0 }} />
              <span>{item.label}: <strong>{item.valor}</strong></span>
            </div>
          ))}
        </div>
      )}

      {/* No changes */}
      {conflicts.length === 0 && newData.length === 0 && (
        <div style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--hz-neutral-700, #6C757D)',
          border: '1px solid var(--hz-neutral-200)',
          borderRadius: '16px',
        }}>
          No hay diferencias entre la declaracion y los datos registrados en ATLAS.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onCancel}
          style={btnSecondary}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Importando...' : 'Confirmar todo'}
        </button>
      </div>
    </div>
  );
};

export default ConflictReviewStep;
export { collectAllConflicts, collectNewData };
