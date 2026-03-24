import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { FuenteDeclaracion, obtenerDeclaracionParaEjercicio } from '../../../../services/declaracionResolverService';
import { cargarHistoricoFiscal } from '../../../../services/fiscalHistoryService';
import ColdStartFiscal from '../estado/ColdStartFiscal';
import FiscalPageShell from '../components/FiscalPageShell';
import PageLayout from '../../../../components/common/PageLayout';
import type { TaxState } from '../../../../store/taxSlice';
import { generarEventosFiscales } from '../../../../services/fiscalPaymentsService';
import { getAllEjercicios } from '../../../../services/ejercicioFiscalService';

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtMoney = (n: number) => `${fmtAmount(Math.abs(n))} €`;

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--n-900)',
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  lineHeight: 1,
  background: active ? 'rgba(188, 128, 36, 0.12)' : 'var(--n-100)',
  color: active ? '#A36400' : 'var(--n-500)',
  border: '1px solid transparent',
});

function getEstadoBadge(ejercicio: number, fuente: FuenteDeclaracion): { label: string; background: string; color: string } {
  const currentYear = new Date().getFullYear();
  if (ejercicio >= currentYear) {
    return { label: `${ejercicio} · en curso`, background: 'var(--s-pos-bg)', color: 'var(--s-pos)' };
  }
  if (fuente === 'declarado') {
    return { label: `${ejercicio} · finalizado`, background: 'var(--n-100)', color: 'var(--n-700)' };
  }
  return { label: `${ejercicio} · pendiente`, background: 'var(--s-warn-bg)', color: 'var(--s-warn)' };
}

const FiscalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [taxState, setTaxState] = useState<(Omit<TaxState, 'ejercicio'> & { ejercicio: number }) | null>(null);
  const [fuente, setFuente] = useState<FuenteDeclaracion>('vivo');
  const [loading, setLoading] = useState(true);
  const [showComparativa, setShowComparativa] = useState(false);
  const [estimacionComparativa, setEstimacionComparativa] = useState<DeclaracionIRPF | null>(null);
  const [loadingComparativa, setLoadingComparativa] = useState(false);
  const [isColdStart, setIsColdStart] = useState(false);
  const [coldStartDismissed, setColdStartDismissed] = useState(false);
  const [showColdStart, setShowColdStart] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [declResult, historico] = await Promise.all([
        obtenerDeclaracionParaEjercicio(ejercicio),
        cargarHistoricoFiscal(years),
      ]);
      setDeclaracion(declResult.declaracion);
      setFuente(declResult.fuente);
      setShowComparativa(false);
      setEstimacionComparativa(null);
      await generarEventosFiscales(ejercicio, declResult.declaracion);

      const hasAnyData = historico.some(
        (row) => row.cuotaLiquida !== 0 || row.retenciones !== 0 || row.resultado !== 0 || row.fuente === 'declarado',
      );
      setIsColdStart(!hasAnyData);
    } catch (e) {
      console.error('Error loading fiscal dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    getAllEjercicios()
      .then((ejercicios) => {
        if (cancelled) return;
        const tieneDatos = ejercicios.some((item) => {
          const resumen = item.declaracionAeat?.basesYCuotas ?? item.calculoAtlas?.basesYCuotas;
          return Boolean(
            item.declaracionAeat
            || item.declaracionAeatPdfRef
            || (resumen && ((resumen.cuotaLiquida ?? 0) !== 0 || (resumen.retencionesTotal ?? 0) !== 0 || (resumen.resultadoDeclaracion ?? 0) !== 0))
          );
        });
        const dismissColdStart = Boolean((location.state as { dismissColdStart?: boolean } | null)?.dismissColdStart);
        setShowColdStart(!tieneDatos && !dismissColdStart);
      })
      .catch((error) => console.error('Error comprobando cold start fiscal:', error));

    return () => {
      cancelled = true;
    };
  }, [location.state]);

  const badge = getEstadoBadge(ejercicio, fuente);

  const ingresosResumen = useMemo(() => {
    if (!taxState) return 0;
    const trabajo = taxState.workIncome.dinerarias + taxState.workIncome.especieValoracion;
    const inmuebles = taxState.inmuebles.reduce((sum, item) => sum + item.ingresosIntegros, 0);
    const actividad = taxState.actividades.reduce((sum, item) => sum + item.ingresosExplotacion, 0);
    return trabajo + inmuebles + actividad;
  }, [taxState]);

  const gastosResumen = useMemo(() => {
    if (!taxState) return 0;
    return taxState.inmuebles.reduce((sum, item) => (
      sum
      + item.interesesFinanciacion
      + item.gastosReparacion
      + item.gastosComunidad
      + item.serviciosPersonales
      + item.suministros
      + item.seguro
      + item.tributosRecargos
      + item.amortizacionInmueble
      + item.amortizacionMuebles
    ), 0) + taxState.actividades.reduce((sum, item) => (
      sum + item.seguridadSocialTitular + item.serviciosProfesionales + item.otrosGastos
    ), 0);
  }, [taxState]);

  const arrastresResumen = useMemo(() => taxState?.inmuebles.reduce((sum, item) => sum + item.arrastres.reduce((acc, arrastre) => acc + arrastre.aplicado, 0), 0) ?? 0, [taxState]);

  const alertas = useMemo(() => {
    if (!taxState) return [] as string[];
    const mensajes: string[] = [];

    taxState.saldosNegativosBIA
      .filter((item) => item.pendienteFuturo > 0 && item.ejercicio + 4 <= taxState.ejercicio)
      .forEach((item) => {
        mensajes.push(`Las pérdidas patrimoniales de ${item.ejercicio} (${fmtMoney(item.pendienteFuturo)}) caducan este ejercicio. Si no se compensan con ganancias, se pierden.`);
      });

    taxState.inmuebles
      .filter((item) => item.tipo !== 'disposicion')
      .forEach((item) => {
        const faltantes = [
          ['comunidad', item.gastosComunidad],
          ['IBI', item.tributosRecargos],
          ['seguro', item.seguro],
        ].filter(([, value]) => Number(value) === 0).map(([label]) => label);

        if (faltantes.length > 0) {
          mensajes.push(`${item.direccion || item.refCatastral} no tiene ${faltantes.join(', ')} dados de alta. Si los pagas, regístralos para que ATLAS los deduzca.`);
        }
      });

    return mensajes.slice(0, 3);
  }, [taxState]);

  if (!loading && isColdStart && !coldStartDismissed) {
    return (
      <PageLayout title="Estado fiscal" subtitle="Tu situación fiscal en ATLAS">
        <ColdStartFiscal onDismiss={() => setColdStartDismissed(true)} />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Estado fiscal" subtitle="Histórico + situación del año en curso">
      <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'var(--font-ui)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s4)', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--n-900)' }}>Estado fiscal</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--n-600)', fontSize: 14 }}>Estimación con los datos disponibles</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select value={ejercicio} onChange={(event) => setEjercicio(Number(event.target.value))} style={{ border: '1px solid var(--n-300)', borderRadius: 12, padding: '10px 12px', color: 'var(--n-700)', background: 'var(--white)' }}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <span style={{ borderRadius: 999, padding: '10px 18px', background: badge.background, color: badge.color, fontWeight: 500 }}>
              {badge.label}
            </span>
          </div>
        </header>

        {loading || !declaracion || !taxState ? (
          <div style={{ color: 'var(--n-500)' }}>Cargando estado fiscal…</div>
        ) : (
          <>
            <section style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ color: 'var(--n-700)', fontSize: 16, marginBottom: 12 }}>Resultado estimado</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 48, lineHeight: 1, color: declaracion.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}>
                    {fmtMoney(declaracion.resultado)}
                  </strong>
                  <span style={{ color: declaracion.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)', fontSize: 18 }}>
                    {declaracion.resultado > 0 ? 'a pagar' : 'a devolver'}
                  </span>
                </div>
                <p style={{ margin: '10px 0 0', color: 'var(--n-700)', fontSize: 14 }}>
                  Cuota {fmtMoney(declaracion.liquidacion.cuotaLiquida)} · Retenciones {fmtMoney(declaracion.retenciones.total)} = {fmtMoney(declaracion.resultado)} · Tipo medio {declaracion.tipoEfectivo.toFixed(1)}%
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
                {[
                  { label: 'Ingresos', value: ingresosResumen, helper: 'Trabajo + inmuebles + actividad' },
                  { label: 'Gastos deducibles', value: gastosResumen, helper: ingresosResumen > 0 ? `${Math.round((gastosResumen / ingresosResumen) * 100)}% de ingresos` : 'Sin ingresos' },
                  { label: 'Arrastres aplicados', value: arrastresResumen, helper: arrastresResumen > 0 ? 'Aplicados en este ejercicio' : 'Sin arrastres aplicados' },
                ].map((card) => (
                  <div key={card.label} style={{ background: 'var(--n-50)', borderRadius: 16, padding: '18px 22px' }}>
                    <div style={{ color: 'var(--n-500)', marginBottom: 8 }}>{card.label}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, color: 'var(--n-900)', marginBottom: 6 }}>{fmtMoney(card.value)}</div>
                    <div style={{ color: 'var(--n-600)', fontSize: 14 }}>{card.helper}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: 'grid', gap: 16 }}>
              <h2 style={{ ...sectionTitleStyle, fontSize: 18 }}>Inmuebles</h2>
              {taxState.inmuebles.map((inmueble) => {
                const chips = [
                  ['Comunidad', inmueble.gastosComunidad],
                  ['IBI', inmueble.tributosRecargos],
                  ['Seguro', inmueble.seguro],
                  ['Amortización', inmueble.amortizacionInmueble],
                  ['Intereses', inmueble.interesesFinanciacion],
                  ['Reparaciones', inmueble.gastosReparacion],
                  ['Suministros', inmueble.suministros],
                ];

                const arrastre = inmueble.arrastres.reduce((sum, item) => sum + item.aplicado, 0);
                return (
                  <article key={inmueble.id} style={{ border: '1px solid var(--n-200)', borderRadius: 18, padding: '18px 24px', background: 'var(--white)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--n-900)' }}>{inmueble.direccion || inmueble.refCatastral}</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--n-500)' }}>{inmueble.tipo} · {inmueble.diasArrendados} días arrendado</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--n-500)' }}>Rendimiento neto</div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: inmueble.rendimientoNeto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)', fontSize: 18, fontWeight: 500 }}>
                          {fmtMoney(inmueble.rendimientoNeto)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20, marginTop: 18, paddingBottom: 14, borderBottom: '1px solid var(--n-200)' }}>
                      <div>
                        <div style={{ color: 'var(--n-500)' }}>Ingresos</div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(inmueble.ingresosIntegros)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--n-500)' }}>Gastos</div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(
                          inmueble.interesesFinanciacion + inmueble.gastosReparacion + inmueble.gastosComunidad + inmueble.serviciosPersonales + inmueble.suministros + inmueble.seguro + inmueble.tributosRecargos + inmueble.amortizacionInmueble + inmueble.amortizacionMuebles,
                        )}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--n-500)' }}>Arrastre</div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{arrastre === 0 ? '–' : fmtMoney(arrastre)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                      {chips.map(([label, value]) => (
                        <span key={label} style={chipStyle(Number(value) > 0)}>
                          {Number(value) > 0 ? label : `+ ${label}`}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>

            {alertas.length > 0 && (
              <section style={{ display: 'grid', gap: 12 }}>
                <h2 style={{ ...sectionTitleStyle, fontSize: 18 }}>Atención</h2>
                {alertas.map((alerta) => (
                  <div key={alerta} style={{ borderRadius: 14, background: '#FFF3DC', color: '#A36400', padding: '16px 20px', fontSize: 14, lineHeight: 1.5 }}>
                    • {alerta}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default FiscalDashboard;
