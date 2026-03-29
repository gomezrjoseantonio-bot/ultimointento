import React, { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import ExportadorDatos from '../modules/horizon/herramientas/exporters/ExportadorDatos';

const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const HerramientasPage: React.FC = () => {
  const [aportacionMensualCompuesto, setAportacionMensualCompuesto] = useState(300);
  const [capitalInicialCompuesto, setCapitalInicialCompuesto] = useState(10000);
  const [rentabilidadAnualCompuesto, setRentabilidadAnualCompuesto] = useState(7);
  const [anosCompuesto, setAnosCompuesto] = useState(15);

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

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--n-50)' }}>
      <PageHeader
        title="Herramientas"
        subtitle="Calculadora de interés compuesto y simulaciones"
        icon={Wrench}
      />

      <div className="p-4 md:p-6 space-y-6">
        <section className="atlas-card">
          <h2 className="atlas-h2">Suite de herramientas</h2>
          <p className="atlas-caption mt-1">Herramienta de cálculo financiero. El simulador de libertad financiera ha sido movido a Mi Plan.</p>
        </section>

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
      </div>
      <ExportadorDatos />
    </div>
  );
};

export default HerramientasPage;
