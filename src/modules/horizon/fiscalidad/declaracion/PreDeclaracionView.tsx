import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import {
  generarPreDeclaracion,
  exportarPreDeclaracion,
  PreDeclaracion,
  CasillaPreDeclaracion,
} from '../../../../services/preDeclaracionService';

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';

// ─── Sección expandible ──────────────────────────────────────────────────────

const SeccionCascada: React.FC<{
  titulo: string;
  casillas: CasillaPreDeclaracion[];
  defaultOpen?: boolean;
}> = ({ titulo, casillas, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (casillas.length === 0) return null;

  return (
    <div style={{ borderBottom: '1px solid var(--n-200)' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--n-900)',
          fontWeight: 600,
          fontSize: 'var(--t-sm, 14px)',
          fontFamily: 'IBM Plex Sans, sans-serif',
          minHeight: 44,
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {titulo}
        <span style={{ marginLeft: 'auto', color: 'var(--n-500)', fontWeight: 400, fontSize: 'var(--t-xs, 12px)' }}>
          {casillas.length} casilla{casillas.length !== 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 12, display: 'grid', gap: 2 }}>
          {casillas.map((c, idx) => (
            <div
              key={`${c.numero}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr auto',
                gap: 12,
                padding: '6px 0 6px 24px',
                alignItems: 'baseline',
              }}
            >
              {/* Número casilla */}
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 'var(--t-xs, 12px)',
                color: 'var(--n-500)',
              }}>
                {c.numero}
              </span>
              {/* Nombre + origen */}
              <div>
                <span style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: 'var(--t-xs, 12px)',
                  color: 'var(--n-700)',
                }}>
                  {c.nombre}
                </span>
                <span style={{
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  fontSize: 'var(--t-xs, 12px)',
                  color: 'var(--n-500)',
                  fontStyle: 'italic',
                  marginLeft: 8,
                }}>
                  ← {c.origenDetalle}
                </span>
                {c.origen === 'estimado' && (
                  <span style={{
                    marginLeft: 8,
                    padding: '3px 10px',
                    borderRadius: 'var(--r-sm, 8px)',
                    fontSize: 'var(--t-xs, 12px)',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    background: 'var(--s-warn-bg)',
                    color: 'var(--s-warn)',
                  }}>
                    Estimado
                  </span>
                )}
                {c.origen === 'manual' && (
                  <span style={{
                    marginLeft: 8,
                    padding: '3px 10px',
                    borderRadius: 'var(--r-sm, 8px)',
                    fontSize: 'var(--t-xs, 12px)',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    background: 'var(--n-100)',
                    color: 'var(--n-500)',
                  }}>
                    Manual
                  </span>
                )}
              </div>
              {/* Valor */}
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 'var(--t-xs, 12px)',
                color: 'var(--n-900)',
                textAlign: 'right',
                whiteSpace: 'nowrap',
              }}>
                {fmtMoney(c.valor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Vista principal ─────────────────────────────────────────────────────────

const PreDeclaracionView: React.FC = () => {
  const [preDecl, setPreDecl] = useState<PreDeclaracion | null>(null);
  const [loading, setLoading] = useState(false);
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [generated, setGenerated] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  const handleGenerar = useCallback(async () => {
    setLoading(true);
    try {
      const result = await generarPreDeclaracion(ejercicio);
      setPreDecl(result);
      setGenerated(true);
    } catch (error) {
      console.error('Error generando pre-declaración:', error);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  const handleExportar = useCallback(() => {
    if (!preDecl) return;
    const content = exportarPreDeclaracion(preDecl);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATLAS_PreDeclaracion_IRPF_${preDecl.ejercicio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preDecl]);

  // Group casillas by section
  const secciones = useMemo(() => {
    if (!preDecl) return [];
    const map = new Map<string, CasillaPreDeclaracion[]>();
    for (const c of preDecl.casillas) {
      const existing = map.get(c.seccion) ?? [];
      existing.push(c);
      map.set(c.seccion, existing);
    }
    return Array.from(map.entries()).map(([titulo, casillas]) => ({ titulo, casillas }));
  }, [preDecl]);

  return (
    <PageLayout title="Pre-declaración" subtitle="Borrador IRPF generado por ATLAS">
      <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'var(--font-ui, IBM Plex Sans, sans-serif)', maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={ejercicio}
            onChange={(e) => { setEjercicio(Number(e.target.value)); setGenerated(false); setPreDecl(null); }}
            style={{ border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 12px)', padding: '10px 12px', color: 'var(--n-700)', background: 'var(--white)' }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {!generated && (
            <button
              type="button"
              onClick={handleGenerar}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--r-md, 12px)',
                border: '1px solid var(--n-300)',
                background: 'var(--white)',
                color: 'var(--n-700)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                fontSize: 'var(--t-sm, 14px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <FileText size={16} />
              {loading ? 'Generando…' : 'Generar borrador'}
            </button>
          )}

          {preDecl && (
            <>
              {/* Badge tipo */}
              <span style={{
                padding: '3px 10px',
                borderRadius: 'var(--r-sm, 8px)',
                fontSize: 'var(--t-xs, 12px)',
                fontWeight: 500,
                background: preDecl.tipo === 'estimacion' ? 'var(--s-warn-bg)' : 'var(--n-100)',
                color: preDecl.tipo === 'estimacion' ? 'var(--s-warn)' : 'var(--n-700)',
              }}>
                {preDecl.tipo === 'estimacion' ? 'Estimación' : 'Borrador'}
              </span>

              <button
                type="button"
                onClick={handleExportar}
                style={{
                  marginLeft: 'auto',
                  padding: '10px 16px',
                  borderRadius: 'var(--r-md, 12px)',
                  border: '1px solid var(--n-300)',
                  background: 'var(--white)',
                  color: 'var(--n-700)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 'var(--t-sm, 14px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                }}
              >
                <Download size={16} />
                Exportar borrador
              </button>
            </>
          )}
        </div>

        {/* Pre-declaración content */}
        {preDecl && (
          <>
            {/* Resultado hero */}
            <div style={{ padding: '20px 24px', background: 'var(--n-50)', borderRadius: 'var(--r-lg, 16px)' }}>
              <div style={{ fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)', marginBottom: 8 }}>Resultado de la declaración</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 'var(--t-2xl, 48px)',
                  fontWeight: 500,
                  color: preDecl.resumen.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
                  lineHeight: 1,
                }}>
                  {fmtMoney(preDecl.resumen.resultado)}
                </span>
                <span style={{ color: preDecl.resumen.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)', fontSize: 18 }}>
                  {preDecl.resumen.resultado > 0 ? 'a pagar' : 'a devolver'}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)' }}>
                Cuota {fmtMoney(preDecl.resumen.cuotaLiquida)} − Retenciones {fmtMoney(preDecl.resumen.totalRetenciones)} · Tipo medio {preDecl.resumen.tipoMedio.toFixed(1)}%
              </p>
            </div>

            {/* Cascada de secciones */}
            <div style={{ border: '1px solid var(--n-200)', borderRadius: 'var(--r-lg, 16px)', padding: '0 20px', background: 'var(--white)' }}>
              {secciones.map((sec, idx) => (
                <SeccionCascada
                  key={sec.titulo}
                  titulo={sec.titulo}
                  casillas={sec.casillas}
                  defaultOpen={idx === 0}
                />
              ))}
            </div>

            {/* Cobertura */}
            <div style={{ fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)', lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                {preDecl.cobertura.casillasCalculadas} casillas calculadas
                {preDecl.cobertura.casillasEstimadas > 0 && ` · ${preDecl.cobertura.casillasEstimadas} estimadas`}
              </p>
              {preDecl.avisos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>Avisos:</strong>
                  {preDecl.avisos.map((aviso, i) => (
                    <span key={i}> {aviso}{i < preDecl.avisos.length - 1 ? ' ·' : ''}</span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!preDecl && !loading && (
          <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm, 14px)', padding: '40px 0', textAlign: 'center' }}>
            Selecciona un ejercicio y genera el borrador para ver las casillas IRPF calculadas por ATLAS.
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default PreDeclaracionView;
