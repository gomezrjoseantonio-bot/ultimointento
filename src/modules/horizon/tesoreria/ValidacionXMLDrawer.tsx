import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeclaracionXMLResumen {
  totalIngresos: number;
  totalGastos: number;
  cuotaLiquida: number;
  resultado: number;
  fechaPresentacion: string;
}

export interface ValidacionXMLDrawerProps {
  open: boolean;
  año: number;
  declaracionXML: DeclaracionXMLResumen;
  atlasIngresos?: number;
  atlasGastos?: number;
  atlasCuota?: number;
  onClose: () => void;
  onDecision: (decision: 'actualizar' | 'mantener' | 'revision_parcial') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const mono = (n: number, opts?: { color?: string }): React.ReactNode => (
  <span style={{ fontFamily: 'IBM Plex Mono, monospace', ...(opts?.color ? { color: opts.color } : {}) }}>
    {fmt(n)}
  </span>
);

const diffColor = (diff: number): string => {
  if (Math.abs(diff) <= 1) return 'var(--n-400, #9ca3af)';
  return diff > 0 ? 'var(--s-neg, #dc2626)' : 'var(--s-pos, #16a34a)';
};

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1200,
  background: 'rgba(0,0,0,0.3)',
};

const drawerStyle: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0,
  width: '520px', maxWidth: '100vw',
  background: 'var(--white, #fff)',
  borderLeft: '1px solid var(--grey-200, #e5e7eb)',
  display: 'flex', flexDirection: 'column',
  zIndex: 1201,
  boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem',
};

const th: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--grey-200, #e5e7eb)',
  color: 'var(--n-500, #6b7280)', fontWeight: 600, fontSize: '0.78rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const td: React.CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderBottom: '1px solid var(--grey-100, #f3f4f6)',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--navy, #1a2e44)', color: 'var(--white, #fff)',
  border: 'none', borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem',
  cursor: 'pointer', flex: 1,
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--navy, #1a2e44)',
  border: '1.5px solid var(--navy, #1a2e44)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.875rem',
  cursor: 'pointer', flex: 1,
};

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--n-700, #374151)',
  border: '1px solid var(--grey-200, #e5e7eb)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.875rem',
  cursor: 'pointer', flex: 1,
};

// ── Component ─────────────────────────────────────────────────────────────────

const ValidacionXMLDrawer: React.FC<ValidacionXMLDrawerProps> = ({
  open,
  año,
  declaracionXML,
  atlasIngresos = 0,
  atlasGastos = 0,
  atlasCuota = 0,
  onClose,
  onDecision,
}) => {
  const [visible, setVisible] = useState(false);

  // Slide-in animation
  useEffect(() => {
    if (open) {
      // Small delay to trigger CSS transition
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const diferenciaIngresos = declaracionXML.totalIngresos - atlasIngresos;
  const diferenciaGastos = declaracionXML.totalGastos - atlasGastos;
  const diferenciaCuota = declaracionXML.cuotaLiquida - atlasCuota;
  const hayDiferencias =
    Math.abs(diferenciaIngresos) > 1 ||
    Math.abs(diferenciaGastos) > 1 ||
    Math.abs(diferenciaCuota) > 1;

  const handleDecision = (d: 'actualizar' | 'mantener' | 'revision_parcial') => {
    onDecision(d);
    onClose();
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div
        style={{
          ...drawerStyle,
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
        }}
      >

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--grey-200, #e5e7eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              Declaración {año} importada
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--n-500, #6b7280)', marginTop: '2px' }}>
              Presentada: {new Date(declaracionXML.fechaPresentacion).toLocaleDateString('es-ES')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {!hayDiferencias ? (
            <div>
              <p style={{ fontSize: '0.95rem', color: 'var(--n-700, #374151)', marginTop: 0, lineHeight: 1.6 }}>
                Lo que presentaste a Hacienda coincide con el cierre de ATLAS. ¿Archivamos el XML para tenerlo todo alineado?
              </p>
              <div style={{
                background: 'var(--s-pos-bg, #ecfdf5)',
                border: '1px solid var(--s-pos-border, #a7f3d0)',
                borderRadius: 'var(--r-md, 10px)',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem', color: 'var(--s-pos, #16a34a)', fontWeight: 500,
              }}>
                Resultado declarado: {mono(declaracionXML.resultado > 0 ? declaracionXML.resultado : 0)} a pagar
                {declaracionXML.resultado < 0 && <> / {mono(Math.abs(declaracionXML.resultado))} a devolver</>}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--n-500, #6b7280)', marginTop: 0, marginBottom: '1.25rem' }}>
                Existen diferencias entre el cierre de ATLAS y lo declarado.
              </p>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Concepto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cierre ATLAS</th>
                    <th style={{ ...th, textAlign: 'right' }}>Declarado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: 'Ingresos totales', atlas: atlasIngresos, declarado: declaracionXML.totalIngresos, diff: diferenciaIngresos },
                    { label: 'Gastos totales', atlas: atlasGastos, declarado: declaracionXML.totalGastos, diff: diferenciaGastos },
                    { label: 'Cuota líquida', atlas: atlasCuota, declarado: declaracionXML.cuotaLiquida, diff: diferenciaCuota },
                  ]).map(row => (
                    <tr key={row.label}>
                      <td style={td}>{row.label}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(row.atlas)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(row.declarado)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {mono(row.diff, { color: diffColor(row.diff) })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--grey-200, #e5e7eb)',
          padding: '1rem 1.5rem',
          display: 'flex', gap: '0.5rem',
          flexShrink: 0,
        }}>
          {!hayDiferencias ? (
            <>
              <button style={btnGhost} onClick={onClose}>No por ahora</button>
              <button style={btnPrimary} onClick={() => handleDecision('mantener')}>Archivar XML</button>
            </>
          ) : (
            <>
              <button style={btnGhost} onClick={() => handleDecision('mantener')}>
                Mantener cierre ATLAS
              </button>
              <button style={btnSecondary} onClick={() => handleDecision('revision_parcial')}>
                Revisar concepto a concepto
              </button>
              <button style={btnPrimary} onClick={() => handleDecision('actualizar')}>
                Actualizar con lo declarado
              </button>
            </>
          )}
        </div>

      </div>
    </>
  );
};

export default ValidacionXMLDrawer;
