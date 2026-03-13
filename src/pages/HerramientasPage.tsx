import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, Goal, Home, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import PageHeader from '../components/common/PageHeader';
import { dashboardService } from '../services/dashboardService';

const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const monthYearFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});

type AtlasFinancialSnapshot = {
  ingresoAlquilerNeto: number;
  ahorroMensualTotal: number;
  capitalLiquido: number;
};

type SimulationConfig = {
  ingresoObjetivo: number;
  cashflowActual: number;
  ahorroMensualNomina: number;
  capitalInicial: number;
  costeEntradaPiso: number;
  rentabilidadNetaAnual: number;
};

type SimulationResult = {
  mesesTotales: number;
  anosTotales: number;
  pisosComprados: number;
  pisosPendientes: number;
  logrado: boolean;
  progress: number;
  cashflowFinal: number;
  rentabilidadNetaPisoMensual: number;
  hitos: Array<{ mes: number; evento: string; nuevoCashflow: number }>;
  mesMitad: number | null;
  fechaIndependencia: Date | null;
};

type HerramientaActiva = 'planner' | 'compuesto';

const MAX_MONTHS = 600;

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const addMonths = (base: Date, monthsToAdd: number): Date => {
  const copy = new Date(base.getTime());
  copy.setMonth(copy.getMonth() + monthsToAdd);
  return copy;
};

const calcularPlanLibertad = ({
  ingresoObjetivo,
  cashflowActual,
  ahorroMensualNomina,
  capitalInicial,
  costeEntradaPiso,
  rentabilidadNetaAnual,
}: SimulationConfig): SimulationResult => {
  const rentabilidadNetaPisoMensual = (costeEntradaPiso * (rentabilidadNetaAnual / 100)) / 12;
  let meses = 0;
  let cashflowAcumulado = Math.max(cashflowActual, 0);
  let capitalEnCuenta = Math.max(capitalInicial, 0);
  let pisosComprados = 0;
  const hitos: SimulationResult['hitos'] = [];
  const objetivoNormalizado = Math.max(ingresoObjetivo, 0);
  let mesMitad: number | null = cashflowAcumulado >= objetivoNormalizado * 0.5 ? 0 : null;

  while (cashflowAcumulado < objetivoNormalizado && meses < MAX_MONTHS) {
    meses += 1;
    capitalEnCuenta += Math.max(ahorroMensualNomina, 0) + cashflowAcumulado;

    while (capitalEnCuenta >= costeEntradaPiso && costeEntradaPiso > 0) {
      pisosComprados += 1;
      capitalEnCuenta -= costeEntradaPiso;
      cashflowAcumulado += rentabilidadNetaPisoMensual;
      hitos.push({
        mes: meses,
        evento: `Compra inmueble #${pisosComprados}`,
        nuevoCashflow: cashflowAcumulado,
      });
    }

    if (mesMitad === null && cashflowAcumulado >= objetivoNormalizado * 0.5) {
      mesMitad = meses;
    }
  }

  const logrado = objetivoNormalizado <= 0 ? false : cashflowAcumulado >= objetivoNormalizado;
  const pisosPendientes = rentabilidadNetaPisoMensual > 0
    ? Math.max(Math.ceil(Math.max(objetivoNormalizado - cashflowAcumulado, 0) / rentabilidadNetaPisoMensual), 0)
    : 0;

  return {
    mesesTotales: meses,
    anosTotales: Number((meses / 12).toFixed(1)),
    pisosComprados,
    pisosPendientes,
    logrado,
    progress: objetivoNormalizado > 0 ? Math.min((cashflowAcumulado / objetivoNormalizado) * 100, 100) : 0,
    cashflowFinal: cashflowAcumulado,
    rentabilidadNetaPisoMensual,
    hitos,
    mesMitad,
    fechaIndependencia: logrado ? addMonths(new Date(), meses) : null,
  };
};

const calcularMesesSinBolaNieve = ({
  ingresoObjetivo,
  cashflowActual,
  ahorroMensualNomina,
  capitalInicial,
  costeEntradaPiso,
  rentabilidadNetaAnual,
}: SimulationConfig): number => {
  const rentabilidadNetaPisoMensual = (costeEntradaPiso * (rentabilidadNetaAnual / 100)) / 12;
  let meses = 0;
  let capital = Math.max(capitalInicial, 0);
  let cashflow = Math.max(cashflowActual, 0);

  while (cashflow < ingresoObjetivo && meses < MAX_MONTHS) {
    meses += 1;
    capital += Math.max(ahorroMensualNomina, 0);

    while (capital >= costeEntradaPiso && costeEntradaPiso > 0) {
      capital -= costeEntradaPiso;
      cashflow += rentabilidadNetaPisoMensual;
    }
  }

  return meses;
};

const HerramientasPage: React.FC = () => {
  const [herramientaActiva, setHerramientaActiva] = useState<HerramientaActiva>('planner');
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState<AtlasFinancialSnapshot>({
    ingresoAlquilerNeto: 0,
    ahorroMensualTotal: 0,
    capitalLiquido: 0,
  });
  const [metaIngresoMensual, setMetaIngresoMensual] = useState(10000);
  const [rentabilidadNetaEstimada, setRentabilidadNetaEstimada] = useState(6);
  const [costeEntrada, setCosteEntrada] = useState(35000);
  const [aportacionMensualCompuesto, setAportacionMensualCompuesto] = useState(300);
  const [capitalInicialCompuesto, setCapitalInicialCompuesto] = useState(10000);
  const [rentabilidadAnualCompuesto, setRentabilidadAnualCompuesto] = useState(7);
  const [anosCompuesto, setAnosCompuesto] = useState(15);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [flujosCaja, tesoreria] = await Promise.all([
          dashboardService.getFlujosCaja(),
          dashboardService.getTesoreriaPanel(),
        ]);

        if (!mounted) {
          return;
        }

        setFinancialData({
          ingresoAlquilerNeto: toFiniteNumber(flujosCaja.inmuebles.cashflow),
          ahorroMensualTotal:
            toFiniteNumber(flujosCaja.trabajo.netoMensual) +
            toFiniteNumber(flujosCaja.inmuebles.cashflow) +
            toFiniteNumber(flujosCaja.inversiones.rendimientoMes) +
            toFiniteNumber(flujosCaja.inversiones.dividendosMes),
          capitalLiquido: toFiniteNumber(tesoreria.totales.hoy),
        });
      } catch (error) {
        console.warn('No se pudieron cargar los datos para el planificador ATLAS', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const hasValidData =
    financialData.ahorroMensualTotal > 0 ||
    financialData.ingresoAlquilerNeto > 0 ||
    financialData.capitalLiquido > 0;

  const ahorroMensualNomina = Math.max(
    financialData.ahorroMensualTotal - financialData.ingresoAlquilerNeto,
    financialData.ahorroMensualTotal > 0 ? 0 : financialData.ahorroMensualTotal,
  );

  const simulationConfig = useMemo<SimulationConfig>(
    () => ({
      ingresoObjetivo: metaIngresoMensual,
      cashflowActual: financialData.ingresoAlquilerNeto,
      ahorroMensualNomina,
      capitalInicial: financialData.capitalLiquido,
      costeEntradaPiso: costeEntrada,
      rentabilidadNetaAnual: rentabilidadNetaEstimada,
    }),
    [ahorroMensualNomina, costeEntrada, financialData.capitalLiquido, financialData.ingresoAlquilerNeto, metaIngresoMensual, rentabilidadNetaEstimada],
  );

  const simulation = useMemo(() => calcularPlanLibertad(simulationConfig), [simulationConfig]);

  const mesesSinBolaNieve = useMemo(
    () => calcularMesesSinBolaNieve(simulationConfig),
    [simulationConfig],
  );

  const ahorroMeses = Math.max(mesesSinBolaNieve - simulation.mesesTotales, 0);

  const simulacionCompuesto = useMemo(() => {
    const capitalInicial = Math.max(capitalInicialCompuesto, 0);
    const aportacionMensual = Math.max(aportacionMensualCompuesto, 0);
    const anos = Math.max(anosCompuesto, 1);
    const interesMensual = Math.max(rentabilidadAnualCompuesto, 0) / 100 / 12;
    const meses = anos * 12;

    let capital = capitalInicial;
    for (let mes = 1; mes <= meses; mes += 1) {
      capital = capital * (1 + interesMensual) + aportacionMensual;
    }

    const invertido = capitalInicial + aportacionMensual * meses;
    const intereses = Math.max(capital - invertido, 0);

    return {
      capitalFinal: capital,
      totalInvertido: invertido,
      interesesGanados: intereses,
      multiplicador: invertido > 0 ? capital / invertido : 0,
    };
  }, [anosCompuesto, aportacionMensualCompuesto, capitalInicialCompuesto, rentabilidadAnualCompuesto]);

  const exportarPlanRetiroPdf = async () => {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(20);
    doc.text('ATLAS · Plan de Libertad Financiera', 14, 18);

    try {
      const logoResponse = await fetch('/icon-192x192.png');
      const logoBlob = await logoResponse.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        doc.addImage(base64, 'PNG', 165, 10, 30, 30);

        doc.setFontSize(12);
        doc.text(`Fecha de generación: ${now.toLocaleDateString('es-ES')}`, 14, 30);
        doc.text(`Meta mensual objetivo: ${euroFormatter.format(metaIngresoMensual)}`, 14, 38);
        doc.text(`Cashflow alquiler actual: ${euroFormatter.format(financialData.ingresoAlquilerNeto)}`, 14, 46);
        doc.text(`Capital líquido actual: ${euroFormatter.format(financialData.capitalLiquido)}`, 14, 54);

        const independencia = simulation.fechaIndependencia
          ? monthYearFormatter.format(simulation.fechaIndependencia)
          : 'No alcanzable con los parámetros actuales';

        doc.setFontSize(13);
        doc.text(`Día estimado de independencia: ${independencia}`, 14, 68);
        doc.text(`Años para retiro: ${simulation.logrado ? simulation.anosTotales : 'N/A'}`, 14, 76);
        doc.text(`Pisos pendientes: ${simulation.pisosPendientes}`, 14, 84);

        doc.setFontSize(11);
        doc.text('Motor de cálculo: Bola de Nieve Inmobiliaria ATLAS', 14, 95);

        let lineY = 106;
        simulation.hitos.slice(0, 12).forEach((hito) => {
          doc.text(`• Mes ${hito.mes}: ${hito.evento} → cashflow ${euroFormatter.format(hito.nuevoCashflow)}`, 16, lineY);
          lineY += 7;
        });

        doc.save(`atlas-plan-retiro-${now.toISOString().slice(0, 10)}.pdf`);
      };
      reader.readAsDataURL(logoBlob);
    } catch (error) {
      console.warn('No se pudo insertar el logo en el PDF, exportando versión simplificada', error);
      doc.setFontSize(12);
      doc.text('Logo ATLAS no disponible en este entorno.', 14, 28);
      doc.save(`atlas-plan-retiro-${now.toISOString().slice(0, 10)}.pdf`);
    }
  };

  const mensajeVeredicto = simulation.logrado
    ? `A este ritmo, alcanzarás tu libertad financiera en aproximadamente ${simulation.anosTotales} años. Tu dinero ya trabaja más rápido que tu nómina.`
    : 'Para alcanzar tu meta en la fecha deseada, considera optimizar tu rentabilidad neta o aumentar tu capital inicial.';

  const fechaProximoInmueble = simulation.hitos[0] ? addMonths(new Date(), simulation.hitos[0].mes) : null;
  const fechaMitad = simulation.mesMitad !== null ? addMonths(new Date(), simulation.mesMitad) : null;

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--n-50)' }}>
      <PageHeader
        title="Herramientas"
        subtitle="ATLAS Planner Suite · Simulaciones avanzadas integradas con tus datos financieros reales."
        breadcrumb={[
          { name: 'Panel', href: '/panel' },
          { name: 'Herramientas', href: '/herramientas' },
        ]}
      />

      <div className="p-4 md:p-6 space-y-6">
        <section className="atlas-card">
          <h2 className="atlas-h2">Suite de herramientas</h2>
          <p className="atlas-caption mt-1">Esta sección irá creciendo con más utilidades. De momento, mantienes activas las dos: planner y simulador de interés compuesto.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setHerramientaActiva('planner')}
              className="rounded-lg border p-4 text-left transition"
              style={{
                borderColor: herramientaActiva === 'planner' ? 'var(--blue)' : 'var(--n-200)',
                backgroundColor: herramientaActiva === 'planner' ? 'var(--blue-50)' : 'var(--white)',
              }}
            >
              <p className="atlas-body-strong">ATLAS Planner Suite</p>
              <p className="atlas-caption mt-1">Plan de libertad financiera con efecto bola de nieve inmobiliaria.</p>
            </button>

            <button
              type="button"
              onClick={() => setHerramientaActiva('compuesto')}
              className="rounded-lg border p-4 text-left transition"
              style={{
                borderColor: herramientaActiva === 'compuesto' ? 'var(--blue)' : 'var(--n-200)',
                backgroundColor: herramientaActiva === 'compuesto' ? 'var(--blue-50)' : 'var(--white)',
              }}
            >
              <p className="atlas-body-strong">Simulación de interés compuesto</p>
              <p className="atlas-caption mt-1">Calcula el crecimiento de una inversión con aportaciones mensuales.</p>
            </button>
          </div>
        </section>

        {herramientaActiva === 'planner' ? (
        <section className="atlas-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="atlas-h2">Tu Mapa de Ruta hacia la Libertad</h2>
              <p className="atlas-caption mt-1">Cada euro que ahorras y reinviertes acelera el siguiente hito.</p>
            </div>
            <button
              type="button"
              onClick={exportarPlanRetiroPdf}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 atlas-caption uppercase tracking-wide"
              style={{ backgroundColor: 'var(--blue)', color: 'var(--white)' }}
            >
              <Download size={16} />
              Exportar Plan de Retiro en PDF
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-lg border p-6 mt-5 flex items-center gap-3" style={{ borderColor: 'var(--n-200)' }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--blue)' }} />
              <p className="atlas-body">Cargando tus métricas reales para calcular el plan ATLAS...</p>
            </div>
          ) : !hasValidData ? (
            <div className="rounded-lg border p-6 mt-5" style={{ borderColor: 'var(--n-200)', backgroundColor: 'var(--white)' }}>
              <p className="atlas-body-strong">Todavía no hay datos suficientes para simular.</p>
              <p className="atlas-caption mt-1">Conecta tesorería y flujos para activar una proyección personalizada.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <p className="atlas-caption">Ingreso alquiler neto</p>
                  <p className="atlas-kpi-large mt-1">{euroFormatter.format(financialData.ingresoAlquilerNeto)}</p>
                </article>
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <p className="atlas-caption">Ahorro mensual total</p>
                  <p className="atlas-kpi-large mt-1">{euroFormatter.format(financialData.ahorroMensualTotal)}</p>
                </article>
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <p className="atlas-caption">Capital líquido</p>
                  <p className="atlas-kpi-large mt-1">{euroFormatter.format(financialData.capitalLiquido)}</p>
                </article>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                  <span className="atlas-caption uppercase tracking-wide">Meta de ingreso mensual</span>
                  <p className="atlas-kpi mt-2">{euroFormatter.format(metaIngresoMensual)}</p>
                  <input
                    type="range"
                    min={1500}
                    max={30000}
                    step={100}
                    value={metaIngresoMensual}
                    onChange={(event) => setMetaIngresoMensual(Number(event.target.value))}
                    className="w-full mt-3"
                    style={{ accentColor: 'var(--blue)' }}
                  />
                </label>

                <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                  <span className="atlas-caption uppercase tracking-wide">Rentabilidad neta estimada</span>
                  <p className="atlas-kpi mt-2">{rentabilidadNetaEstimada.toFixed(1)}%</p>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={0.1}
                    value={rentabilidadNetaEstimada}
                    onChange={(event) => setRentabilidadNetaEstimada(Number(event.target.value))}
                    className="w-full mt-3"
                    style={{ accentColor: 'var(--blue)' }}
                  />
                </label>

                <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                  <span className="atlas-caption uppercase tracking-wide">Coste medio entrada + gastos</span>
                  <p className="atlas-kpi mt-2">{euroFormatter.format(costeEntrada)}</p>
                  <input
                    type="range"
                    min={10000}
                    max={120000}
                    step={1000}
                    value={costeEntrada}
                    onChange={(event) => setCosteEntrada(Number(event.target.value))}
                    className="w-full mt-3"
                    style={{ accentColor: 'var(--blue)' }}
                  />
                </label>
              </div>

              <div className="rounded-lg border p-4 mt-6" style={{ borderColor: 'var(--n-200)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="atlas-body-strong">Progreso de independencia</p>
                  <p className="atlas-caption">{simulation.progress.toFixed(1)}% de tu objetivo mensual</p>
                </div>
                <div className="h-3 rounded-full mt-3" style={{ backgroundColor: 'var(--n-200)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${simulation.progress}%`, backgroundColor: 'var(--blue)', transition: 'width 280ms ease' }}
                  />
                </div>
                <p className="atlas-caption mt-2">
                  {euroFormatter.format(financialData.ingresoAlquilerNeto)} / {euroFormatter.format(metaIngresoMensual)}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} style={{ color: 'var(--blue)' }} />
                    <p className="atlas-caption uppercase tracking-wide">Años para el retiro</p>
                  </div>
                  <p className="atlas-kpi-large mt-2">{simulation.logrado ? simulation.anosTotales : '—'}</p>
                </article>
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <div className="flex items-center gap-2">
                    <Home size={16} style={{ color: 'var(--blue)' }} />
                    <p className="atlas-caption uppercase tracking-wide">Pisos pendientes</p>
                  </div>
                  <p className="atlas-kpi-large mt-2">{simulation.pisosPendientes}</p>
                </article>
                <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: 'var(--blue)' }} />
                    <p className="atlas-caption uppercase tracking-wide">Ahorro por bola de nieve</p>
                  </div>
                  <p className="atlas-kpi-large mt-2">{(ahorroMeses / 12).toFixed(1)} años</p>
                </article>
              </div>

              <div className="rounded-lg border p-4 mt-6" style={{ borderColor: 'var(--n-200)', backgroundColor: 'var(--white)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: 'var(--blue)' }} />
                  <h3 className="atlas-body-strong">Veredicto de ATLAS</h3>
                </div>
                <p className="atlas-body mt-2">{mensajeVeredicto}</p>
              </div>

              <div className="rounded-lg border p-4 mt-6" style={{ borderColor: 'var(--n-200)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Goal size={16} style={{ color: 'var(--blue)' }} />
                  <h3 className="atlas-body-strong">Timeline de hitos estimados</h3>
                </div>
                <ul className="space-y-2 atlas-body">
                  <li className="flex items-center gap-2">
                    <Target size={14} style={{ color: 'var(--blue)' }} />
                    Próximo inmueble:{' '}
                    <strong>{fechaProximoInmueble ? monthYearFormatter.format(fechaProximoInmueble) : 'Pendiente de capital suficiente'}</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Target size={14} style={{ color: 'var(--blue)' }} />
                    50% de libertad:{' '}
                    <strong>{fechaMitad ? monthYearFormatter.format(fechaMitad) : 'Sin fecha estimada todavía'}</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Target size={14} style={{ color: 'var(--blue)' }} />
                    Día de la independencia:{' '}
                    <strong>{simulation.fechaIndependencia ? monthYearFormatter.format(simulation.fechaIndependencia) : 'No alcanzable con la configuración actual'}</strong>
                  </li>
                </ul>
              </div>
            </>
          )}
        </section>
        ) : (
          <section className="atlas-card">
            <div>
              <h2 className="atlas-h2">Simulación de interés compuesto</h2>
              <p className="atlas-caption mt-1">Proyección base con capital inicial, aportación periódica y rentabilidad anual estimada.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-5">
              <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                <span className="atlas-caption uppercase tracking-wide">Capital inicial</span>
                <p className="atlas-kpi mt-2">{euroFormatter.format(capitalInicialCompuesto)}</p>
                <input type="range" min={0} max={200000} step={1000} value={capitalInicialCompuesto} onChange={(event) => setCapitalInicialCompuesto(Number(event.target.value))} className="w-full mt-3" style={{ accentColor: 'var(--blue)' }} />
              </label>

              <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                <span className="atlas-caption uppercase tracking-wide">Aportación mensual</span>
                <p className="atlas-kpi mt-2">{euroFormatter.format(aportacionMensualCompuesto)}</p>
                <input type="range" min={0} max={5000} step={50} value={aportacionMensualCompuesto} onChange={(event) => setAportacionMensualCompuesto(Number(event.target.value))} className="w-full mt-3" style={{ accentColor: 'var(--blue)' }} />
              </label>

              <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                <span className="atlas-caption uppercase tracking-wide">Rentabilidad anual</span>
                <p className="atlas-kpi mt-2">{rentabilidadAnualCompuesto.toFixed(1)}%</p>
                <input type="range" min={0} max={20} step={0.1} value={rentabilidadAnualCompuesto} onChange={(event) => setRentabilidadAnualCompuesto(Number(event.target.value))} className="w-full mt-3" style={{ accentColor: 'var(--blue)' }} />
              </label>

              <label className="rounded-lg border p-4 block" style={{ borderColor: 'var(--n-200)' }}>
                <span className="atlas-caption uppercase tracking-wide">Horizonte temporal</span>
                <p className="atlas-kpi mt-2">{anosCompuesto} años</p>
                <input type="range" min={1} max={40} step={1} value={anosCompuesto} onChange={(event) => setAnosCompuesto(Number(event.target.value))} className="w-full mt-3" style={{ accentColor: 'var(--blue)' }} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                <p className="atlas-caption">Capital final estimado</p>
                <p className="atlas-kpi-large mt-2">{euroFormatter.format(simulacionCompuesto.capitalFinal)}</p>
              </article>
              <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                <p className="atlas-caption">Total aportado</p>
                <p className="atlas-kpi-large mt-2">{euroFormatter.format(simulacionCompuesto.totalInvertido)}</p>
              </article>
              <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                <p className="atlas-caption">Intereses generados</p>
                <p className="atlas-kpi-large mt-2">{euroFormatter.format(simulacionCompuesto.interesesGanados)}</p>
              </article>
              <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
                <p className="atlas-caption">Multiplicador</p>
                <p className="atlas-kpi-large mt-2">{simulacionCompuesto.multiplicador.toFixed(2)}x</p>
              </article>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default HerramientasPage;
