import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { generarEventosFiscales } from '../../../../services/fiscalPaymentsService';
import FiscalKpiCard from '../../../../components/fiscal/ui/FiscalKpiCard';
import FiscalChip from '../../../../components/fiscal/ui/FiscalChip';
import FiscalCoverageBar from '../../../../components/fiscal/ui/FiscalCoverageBar';
import type { CompensacionDetalle, PerdidaResumen } from '../../../../services/compensacionAhorroService';
import { FuenteDeclaracion, obtenerDeclaracionParaEjercicio } from '../../../../services/declaracionResolverService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const cardStyle: React.CSSProperties = {
  background: 'var(--n-50)',
  border: '1.5px solid var(--n-200)',
  borderRadius: 'var(--r-lg)',
  padding: 'var(--s5)',
};

const badgeStyleByFuente: Record<FuenteDeclaracion, React.CSSProperties> = {
  declarado: { background: '#dcfce7', color: '#15803d' },
  importado: { background: '#dbeafe', color: '#1d4ed8' },
  vivo: { background: '#fef3c7', color: '#b45309' },
};

const badgeLabelByFuente: Record<FuenteDeclaracion, string> = {
  declarado: 'Declarado (importado)',
  importado: 'Importado parcial',
  vivo: 'Estimación en tiempo real',
};

const FiscalDashboard: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [fuente, setFuente] = useState<FuenteDeclaracion>('vivo');
  const [loading, setLoading] = useState(true);
  const [showComparativa, setShowComparativa] = useState(false);
  const [estimacionComparativa, setEstimacionComparativa] = useState<DeclaracionIRPF | null>(null);
  const [loadingComparativa, setLoadingComparativa] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { declaracion: decl, fuente: resolvedFuente } = await obtenerDeclaracionParaEjercicio(ejercicio);
      setDeclaracion(decl);
      setFuente(resolvedFuente);
      setShowComparativa(false);
      setEstimacionComparativa(null);
      await generarEventosFiscales(ejercicio, decl);
    } catch (e) {
      console.error('Error loading fiscal dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showComparativa || fuente !== 'declarado') {
      return;
    }

    let cancelled = false;
    setLoadingComparativa(true);

    calcularDeclaracionIRPF(ejercicio)
      .then((estimacion) => {
        if (!cancelled) {
          setEstimacionComparativa(estimacion);
        }
      })
      .catch((error) => {
        console.error('Error loading live estimate comparison:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingComparativa(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showComparativa, fuente, ejercicio]);

  const totalIngresosInmuebles = declaracion?.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.ingresosIntegros, 0) ?? 0;
  const totalGastosInmuebles = declaracion?.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.gastosDeducibles + i.amortizacion, 0) ?? 0;
  const totalArrastres = declaracion?.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + (i.arrastresAplicados ?? 0), 0) ?? 0;

  const coverageReal = declaracion ? (fuente === 'declarado' ? 1 : declaracion.retenciones.total > 0 ? 0.75 : 0) : 0;
  const coverageRet = declaracion ? Math.min(1, declaracion.retenciones.total / Math.max(1, declaracion.liquidacion.cuotaIntegra || 1)) : 0;
  const coverageGastos = declaracion ? Math.min(1, totalGastosInmuebles / Math.max(1, totalIngresosInmuebles || 1)) : 0;

  const monthly = useMemo(() => {
    const ingresosBase = totalIngresosInmuebles > 0 ? totalIngresosInmuebles / 12 : 0;
    const gastosBase = totalGastosInmuebles > 0 ? totalGastosInmuebles / 12 : 0;
    return {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      ingresos: Array.from({ length: 6 }, (_, i) => ingresosBase * (1 + i * 0.02)),
      gastos: Array.from({ length: 6 }, (_, i) => gastosBase * (1 + i * 0.01)),
    };
  }, [totalIngresosInmuebles, totalGastosInmuebles]);

  const comparativaResultado = declaracion && estimacionComparativa
    ? round2(estimacionComparativa.resultado - declaracion.resultado)
    : null;

  return (
    <PageLayout title="Resumen fiscal" subtitle="Histórico + situación del año en curso">
      <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'var(--font-ui)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s4)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
              <LayoutDashboard size={20} color="var(--blue)" />
              <h1 style={{ fontSize: 'var(--t-xl)', fontWeight: 600, color: 'var(--n-900)' }}>Dashboard fiscal</h1>
              {!loading && declaracion && (
                <span
                  style={{
                    ...badgeStyleByFuente[fuente],
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {badgeLabelByFuente[fuente]}
                </span>
              )}
            </div>
            <p style={{ fontSize: 'var(--t-base)', color: 'var(--n-500)' }}>Visión consolidada por ejercicio</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
            <select
              value={ejercicio}
              onChange={e => setEjercicio(Number(e.target.value))}
              style={{
                padding: '6px 10px', border: '1.5px solid var(--n-300)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-ui)',
                fontSize: 'var(--t-base)', color: 'var(--n-900)', transition: 'all 150ms ease',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button style={{ padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--blue)', color: 'var(--white)', transition: 'all 150ms ease' }}>
              Exportar declaración
            </button>
          </div>
        </header>

        {!loading && declaracion && (
          <>
            {fuente === 'declarado' && (
              <section style={{ ...cardStyle, display: 'grid', gap: 'var(--s3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 600 }}>Declaración importada como snapshot declarado</h3>
                    <p style={{ margin: '6px 0 0', color: 'var(--n-600)', fontSize: 'var(--t-sm)' }}>
                      Este ejercicio usa los datos reales presentados ante AEAT en lugar de recalcularse en vivo.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowComparativa((current) => !current)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--n-300)',
                      background: 'white',
                      color: 'var(--blue)',
                      cursor: 'pointer',
                    }}
                  >
                    {showComparativa ? 'Ocultar comparativa ATLAS' : 'Comparar con estimación ATLAS'}
                  </button>
                </div>

                {showComparativa && (
                  <div style={{ padding: 'var(--s3)', background: 'var(--n-100)', borderRadius: 'var(--r-md)' }}>
                    {loadingComparativa && <p style={{ margin: 0, color: 'var(--n-600)' }}>Calculando estimación ATLAS…</p>}
                    {!loadingComparativa && estimacionComparativa && comparativaResultado !== null && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--s3)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)', textTransform: 'uppercase' }}>Declarado</div>
                          <div style={{ fontSize: 'var(--t-lg)', fontWeight: 700, color: 'var(--n-900)' }}>{fmt(declaracion.resultado)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)', textTransform: 'uppercase' }}>ATLAS estimado</div>
                          <div style={{ fontSize: 'var(--t-lg)', fontWeight: 700, color: 'var(--n-900)' }}>{fmt(estimacionComparativa.resultado)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)', textTransform: 'uppercase' }}>Desviación</div>
                          <div style={{ fontSize: 'var(--t-lg)', fontWeight: 700, color: comparativaResultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)' }}>
                            {fmt(comparativaResultado)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--s3)' }}>
              <FiscalKpiCard label="Ingresos íntegros" value={fmt(totalIngresosInmuebles)} variant="default" />
              <FiscalKpiCard label="Gastos deducibles" value={fmt(totalGastosInmuebles)} variant="neutral" />
              <FiscalKpiCard label="Arrastres aplicados" value={fmt(totalArrastres)} variant="positive" />
              <FiscalKpiCard label={fuente === 'declarado' ? 'Cuota declarada' : 'Cuota estimada'} value={fmt(declaracion.liquidacion.cuotaLiquida)} variant="negative" />
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>
              <article style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s3)' }}>
                  <h3 style={{ fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 500 }}>Cobertura de datos</h3>
                  <FiscalChip label={`${Math.round(coverageReal * 100)}% cobertura`} variant="pos" />
                </div>
                <div style={{ display: 'grid', gap: 'var(--s3)' }}>
                  <FiscalCoverageBar label="Datos reales" value={coverageReal} colorVar="--blue" />
                  <FiscalCoverageBar label="Retenciones" value={coverageRet} colorVar="--c2" />
                  <FiscalCoverageBar label="Gastos" value={coverageGastos} colorVar="--s-warn" />
                </div>
              </article>

              <article style={cardStyle}>
                <h3 style={{ fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 500, marginBottom: 'var(--s3)' }}>Ingresos vs gastos mensuales</h3>
                <div style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s2)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)', fontSize: 'var(--t-xs)', color: 'var(--n-700)' }}><span style={{ width: '10px', height: '10px', background: 'var(--c1)', borderRadius: 'var(--r-sm)' }} />Ingresos</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)', fontSize: 'var(--t-xs)', color: 'var(--n-700)' }}><span style={{ width: '10px', height: '10px', background: 'var(--c5)', borderRadius: 'var(--r-sm)' }} />Gastos</span>
                </div>
                <Bar
                  data={{
                    labels: monthly.labels,
                    datasets: [
                      { label: 'Ingresos', data: monthly.ingresos, backgroundColor: 'var(--c1)' },
                      { label: 'Gastos', data: monthly.gastos, backgroundColor: 'var(--c5)' },
                    ],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              </article>
            </section>

            {declaracion.compensacionAhorro && (
              <article style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s3)', gap: 'var(--s3)', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 500 }}>Ganancias y pérdidas patrimoniales — Base del ahorro</h3>
                  <FiscalChip
                    label={fmt(declaracion.compensacionAhorro.saldoNetoTrasCompensar)}
                    variant={declaracion.compensacionAhorro.saldoNetoTrasCompensar > 0 ? 'pos' : 'neu'}
                  />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Fuente', 'Ganancias', 'Pérdidas', 'Saldo'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 'var(--s2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: 'Venta de inmuebles',
                        plusvalias: declaracion.compensacionAhorro.fuentes.inmuebles.plusvalias,
                        minusvalias: declaracion.compensacionAhorro.fuentes.inmuebles.minusvalias,
                      },
                      {
                        label: 'Inversiones y crypto',
                        plusvalias: declaracion.compensacionAhorro.fuentes.inversiones.plusvalias,
                        minusvalias: declaracion.compensacionAhorro.fuentes.inversiones.minusvalias,
                      },
                    ].map((row) => {
                      const saldo = row.plusvalias - row.minusvalias;
                      return (
                        <tr key={row.label} style={{ borderBottom: '0.5px solid var(--n-200)' }}>
                          <td style={{ padding: 'var(--s2) 0', color: 'var(--n-900)', fontWeight: 500 }}>{row.label}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: row.plusvalias > 0 ? 'var(--s-pos)' : 'var(--n-400)' }}>{row.plusvalias > 0 ? fmt(row.plusvalias) : '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: row.minusvalias > 0 ? 'var(--s-neg)' : 'var(--n-400)' }}>{row.minusvalias > 0 ? fmt(-row.minusvalias) : '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: saldo >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{fmt(saldo)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ paddingTop: 'var(--s2)', fontWeight: 600, color: 'var(--n-900)' }}>Saldo neto del ejercicio</td>
                      <td colSpan={2} />
                      <td style={{ paddingTop: 'var(--s2)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: declaracion.compensacionAhorro.saldoNetoEjercicio >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>{fmt(declaracion.compensacionAhorro.saldoNetoEjercicio)}</td>
                    </tr>
                  </tbody>
                </table>

                {declaracion.compensacionAhorro.compensacionAplicada.length > 0 && (
                  <div style={{ marginTop: 'var(--s4)' }}>
                    <h4 style={{ fontSize: 'var(--t-sm)', color: 'var(--n-900)', fontWeight: 600, marginBottom: 'var(--s2)' }}>Compensación con pérdidas pendientes</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Ejercicio origen', 'Importe aplicado', 'Pendiente restante', 'Caduca'].map(h => (
                            <th key={h} style={{ textAlign: 'left', fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 'var(--s2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {declaracion.compensacionAhorro.compensacionAplicada.map((item: CompensacionDetalle) => (
                          <tr key={item.ejercicioOrigen} style={{ borderBottom: '0.5px solid var(--n-200)' }}>
                            <td style={{ padding: 'var(--s2) 0', color: 'var(--n-900)' }}>{item.ejercicioOrigen}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-pos)' }}>{fmt(-item.importeAplicado)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--n-700)' }}>{fmt(item.importeRestanteTras)}</td>
                            <td style={{ color: 'var(--n-700)' }}>{item.ejercicioOrigen + 4}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ paddingTop: 'var(--s2)', fontWeight: 600, color: 'var(--n-900)' }}>Total compensado</td>
                          <td style={{ paddingTop: 'var(--s2)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--s-pos)' }}>{fmt(-declaracion.compensacionAhorro.totalCompensado)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop: 'var(--s4)', padding: 'var(--s3)', background: 'var(--n-100)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s3)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--n-900)' }}>G/P netas que tributan en base del ahorro</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: declaracion.compensacionAhorro.saldoNetoTrasCompensar > 0 ? 'var(--s-pos)' : 'var(--n-500)' }}>
                      {fmt(declaracion.compensacionAhorro.saldoNetoTrasCompensar)}
                    </span>
                  </div>
                  {declaracion.compensacionAhorro.compensacionConCapitalMobiliario > 0 && (
                    <div style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-xs)', color: 'var(--n-600)' }}>
                      Compensado contra capital mobiliario: {fmt(declaracion.compensacionAhorro.compensacionConCapitalMobiliario)}
                      {' · '}Límite 25%: {fmt(declaracion.compensacionAhorro.limiteCapitalMobiliario)}
                    </div>
                  )}
                  {declaracion.compensacionAhorro.totalCompensado > 0 && (
                    <div style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-xs)', color: 'var(--n-600)' }}>
                      Ahorro fiscal estimado al 19%: {fmt(declaracion.compensacionAhorro.totalCompensado * 0.19)}
                    </div>
                  )}
                </div>

                {declaracion.compensacionAhorro.perdidasCaducadas.length > 0 && (
                  <div style={{ marginTop: 'var(--s3)', padding: 'var(--s3)', background: 'var(--s-warn-bg)', borderRadius: 'var(--r-md)', color: 'var(--s-warn)', fontSize: 'var(--t-xs)' }}>
                    ⚠️ {declaracion.compensacionAhorro.perdidasCaducadas.length} pérdida(s) han caducado en este ejercicio.
                  </div>
                )}

                {declaracion.compensacionAhorro.perdidasPendientesDespues.length > 0 && (
                  <div style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-xs)', color: 'var(--n-500)' }}>
                    Pérdidas pendientes futuras: {declaracion.compensacionAhorro.perdidasPendientesDespues
                      .map((item: PerdidaResumen) => `${item.ejercicioOrigen}: ${fmt(item.importePendiente)} (caduca ${item.ejercicioCaducidad})`)
                      .join(' · ')}
                  </div>
                )}
              </article>
            )}

            {declaracion.ventasInmuebles && declaracion.ventasInmuebles.length > 0 && (
              <article style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s3)' }}>
                  <h3 style={{ fontSize: 'var(--t-md)', color: 'var(--n-900)', fontWeight: 500 }}>Ganancias y pérdidas patrimoniales — Inmuebles</h3>
                  <FiscalChip
                    label={fmt(declaracion.ventasInmuebles.reduce((sum, item) => sum + item.gananciaPatrimonial, 0))}
                    variant={declaracion.ventasInmuebles.reduce((sum, item) => sum + item.gananciaPatrimonial, 0) >= 0 ? 'pos' : 'neg'}
                  />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Inmueble', 'Fecha venta', 'V. transmisión', 'V. adquisición', 'Amortización', 'G/P patrimonial'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 'var(--s2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {declaracion.ventasInmuebles.map((venta) => (
                      <tr key={venta.inmuebleId} style={{ borderBottom: '0.5px solid var(--n-200)' }}>
                        <td style={{ padding: 'var(--s2) 0', color: 'var(--n-900)', fontWeight: 500 }}>{venta.alias}</td>
                        <td style={{ color: 'var(--n-700)' }}>{new Date(`${venta.fechaVenta}T00:00:00`).toLocaleDateString('es-ES')}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--n-900)' }}>{fmt(venta.valorTransmision)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--n-900)' }}>{fmt(venta.valorAdquisicion)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--n-700)' }}>{fmt(venta.amortizacionAplicada)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: venta.esPerdida ? 'var(--s-neg)' : 'var(--s-pos)' }}>{fmt(venta.gananciaPatrimonial)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            )}

            <article style={cardStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Inmueble', 'Ingresos', 'Gastos', 'Arrastre', 'Rendimiento neto', 'Estado'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 'var(--s2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {declaracion.baseGeneral.rendimientosInmuebles.map(item => {
                    const arrastre = item.arrastresAplicados ?? 0;
                    const variant = item.rendimientoNeto > 0 ? 'pos' : item.rendimientoNeto < 0 ? 'neg' : 'neu';
                    return (
                      <tr key={item.inmuebleId} style={{ borderBottom: '0.5px solid var(--n-200)' }}>
                        <td style={{ padding: 'var(--s2) 0' }}>
                          <div style={{ fontSize: 'var(--t-base)', fontWeight: 500, color: 'var(--n-900)' }}>{item.alias}</div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)' }}>Dirección no disponible</div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-pos)', fontSize: 'var(--t-base)' }}>{fmt(item.ingresosIntegros)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--n-900)', fontSize: 'var(--t-base)' }}>{fmt(item.gastosDeducibles + item.amortizacion)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: arrastre > 0 ? 'var(--s-pos)' : 'var(--n-300)', fontSize: 'var(--t-base)' }}>{arrastre > 0 ? fmt(arrastre) : '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: item.rendimientoNeto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)', fontSize: 'var(--t-base)' }}>{fmt(item.rendimientoNeto)}</td>
                        <td><FiscalChip label={item.rendimientoNeto > 0 ? 'Positivo' : item.rendimientoNeto < 0 ? 'Negativo' : 'Neutro'} variant={variant} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          </>
        )}
        {loading && <p style={{ color: 'var(--n-500)', fontSize: 'var(--t-base)' }}>Cargando…</p>}
      </div>
    </PageLayout>
  );
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default FiscalDashboard;
