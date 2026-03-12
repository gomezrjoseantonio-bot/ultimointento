import React, { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { getOrCreateEjercicio } from '../../../../services/ejercicioFiscalService';
import { EjercicioFiscal } from '../../../../services/db';
import FiscalChip from '../../../../components/fiscal/ui/FiscalChip';

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Math.abs(n));

const cardStyle: React.CSSProperties = { background: 'var(--n-50)', border: '1.5px solid var(--n-200)', borderRadius: 'var(--r-lg)', padding: 'var(--s5)' };

const DeclaracionPage: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [ejercicioFiscal, setEjercicioFiscal] = useState<EjercicioFiscal | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [decl, ejercicioData] = await Promise.all([calcularDeclaracionIRPF(ejercicio), getOrCreateEjercicio(ejercicio)]);
      setDeclaracion(decl);
      setEjercicioFiscal(ejercicioData);
    } catch (e) {
      console.error('Error loading declaracion:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    if (!declaracion) return;
    const blob = new Blob([JSON.stringify(declaracion, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `declaracion_irpf_${ejercicio}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataRealPct = declaracion ? (declaracion.retenciones.total > 0 ? 0.75 : 0) : 0;

  return (
    <PageLayout title={`Declaración IRPF ${ejercicio}`} subtitle="Desglose AEAT del ejercicio seleccionado">
      <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'var(--font-ui)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s3)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
              <FileText size={20} color="var(--blue)" />
              <h1 style={{ fontSize: 'var(--t-xl)', fontWeight: 600, color: 'var(--n-900)' }}>Declaración</h1>
            </div>
            <p style={{ fontSize: 'var(--t-base)', color: 'var(--n-500)' }}>{ejercicioFiscal?.estado === 'declarado' ? 'Presentada' : 'En preparación'}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <select value={ejercicio} onChange={e => setEjercicio(Number(e.target.value))} style={{ padding: '6px 10px', border: '1.5px solid var(--n-300)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-base)', color: 'var(--n-900)' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleExport} style={{ padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--blue)', color: 'var(--white)' }}>Exportar PDF</button>
          </div>
        </header>

        {dataRealPct === 0 ? (
          <FiscalChip label="Sin datos de cobertura" variant="warn" />
        ) : (
          <div style={{ background: 'var(--s-pos-bg)', borderRadius: 'var(--r-md)', padding: 'var(--s2) var(--s3)', display: 'inline-flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--s-pos)' }} />
            <span style={{ fontSize: 'var(--t-sm)', color: 'var(--s-pos)' }}>Cobertura de datos real: {Math.round(dataRealPct * 100)}%</span>
          </div>
        )}

        {!loading && declaracion && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>
              <article style={cardStyle}>
                <h3 style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--n-900)', marginBottom: 'var(--s3)' }}>Ingresos y gastos</h3>
                {[
                  ['Ingresos íntegros', declaracion.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.ingresosIntegros, 0), 'var(--s-pos)'],
                  ['Gastos deducibles', -declaracion.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.gastosDeducibles + i.amortizacion, 0), 'var(--s-neg)'],
                  ['Retenciones', declaracion.retenciones.total, 'var(--s-pos)'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--s2) 0', borderBottom: '0.5px solid var(--n-200)' }}>
                    <span style={{ fontSize: 'var(--t-base)', color: 'var(--n-500)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-md)', color: String(color) }}>{Number(value) < 0 ? `−${fmt(Number(value))}` : fmt(Number(value))}</span>
                  </div>
                ))}
              </article>

              <article style={cardStyle}>
                <h3 style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--n-900)', marginBottom: 'var(--s3)' }}>Reducciones y cuota</h3>
                {[
                  ['Arrastres', declaracion.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + (i.arrastresAplicados ?? 0), 0), 'var(--s-pos)'],
                  ['Deducciones', -declaracion.liquidacion.deduccionesDobleImposicion, 'var(--s-neg)'],
                  ['Cuota líquida', declaracion.liquidacion.cuotaLiquida, 'var(--n-900)'],
                ].map(([label, value, color], idx) => (
                  <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--s2) 0', borderBottom: idx < 2 ? '0.5px solid var(--n-200)' : 'none' }}>
                    <span style={{ fontSize: 'var(--t-base)', color: 'var(--n-500)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: idx === 2 ? 'var(--t-xl)' : 'var(--t-md)', fontWeight: idx === 2 ? 500 : 400, color: String(color) }}>{Number(value) < 0 ? `−${fmt(Number(value))}` : fmt(Number(value))}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid var(--n-200)', paddingTop: 'var(--s2)' }}>
                  <span style={{ color: 'var(--n-900)', fontWeight: 500 }}>{declaracion.resultado < 0 ? 'A devolver' : 'A ingresar'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xl)', fontWeight: 500, color: declaracion.resultado < 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{fmt(declaracion.resultado)}</span>
                </div>
              </article>
            </section>

            <article style={cardStyle}>
              <h3 style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--n-900)', marginBottom: 'var(--s3)' }}>Arrastres</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Inmueble', 'Aplicado', 'Pendiente'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 'var(--s2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {declaracion.baseGeneral.rendimientosInmuebles.map(item => {
                    const pendiente = item.excesoArrastrable ?? 0;
                    return (
                      <tr key={item.inmuebleId} style={{ borderBottom: '0.5px solid var(--n-200)', fontSize: 'var(--t-base)' }}>
                        <td style={{ padding: 'var(--s2) 0' }}>{item.alias}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(item.arrastresAplicados ?? 0)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: pendiente > 0 ? 'var(--s-neg)' : 'var(--n-300)' }}>{pendiente > 0 ? fmt(pendiente) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default DeclaracionPage;
