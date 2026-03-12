import React, { useMemo, useState } from 'react';
import { BarChart3, Calculator, PieChart, Wrench } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../components/common/PageHeader';

const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const HerramientasPage: React.FC = () => {
  const [capitalInicial, setCapitalInicial] = useState(10000);
  const [aportacionMensual, setAportacionMensual] = useState(300);
  const [rentabilidadAnual, setRentabilidadAnual] = useState(7);
  const [plazoAnos, setPlazoAnos] = useState(12);

  const simulation = useMemo(() => {
    const monthlyRate = rentabilidadAnual / 100 / 12;
    const totalMonths = plazoAnos * 12;

    let balance = capitalInicial;
    const evolution = [] as { ano: string; invertido: number; intereses: number }[];

    for (let month = 1; month <= totalMonths; month += 1) {
      balance = balance * (1 + monthlyRate) + aportacionMensual;

      if (month % 12 === 0) {
        const totalContributed = capitalInicial + aportacionMensual * month;
        evolution.push({
          ano: `${month / 12}`,
          invertido: totalContributed,
          intereses: Math.max(balance - totalContributed, 0),
        });
      }
    }

    const invertido = capitalInicial + aportacionMensual * totalMonths;
    const capitalFinal = balance;
    const intereses = Math.max(capitalFinal - invertido, 0);
    const porcentajeInteres = capitalFinal > 0 ? intereses / capitalFinal : 0;

    return {
      invertido,
      intereses,
      capitalFinal,
      porcentajeInteres,
      evolution,
      composition: [
        { name: 'Capital invertido', value: invertido, color: 'var(--c1)' },
        { name: 'Intereses generados', value: intereses, color: 'var(--c5)' },
      ],
    };
  }, [aportacionMensual, capitalInicial, plazoAnos, rentabilidadAnual]);

  const stats = [
    { label: 'Capital invertido', value: simulation.invertido, hint: 'Lo que aportas tú' },
    { label: 'Intereses generados', value: simulation.intereses, hint: 'Lo que genera el mercado' },
    { label: 'Capital final', value: simulation.capitalFinal, hint: `En ${plazoAnos} años`, highlight: true },
  ];

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--n-50)' }}>
      <PageHeader
        title="Herramientas"
        subtitle="Utilidades prácticas para clientes. Primera versión: simulador de interés compuesto."
        breadcrumb={[
          { name: 'Panel', href: '/panel' },
          { name: 'Herramientas', href: '/herramientas' },
        ]}
      />

      <div className="p-4 md:p-6 space-y-6">
        <section className="atlas-card">
          <div className="flex items-start gap-3 mb-4">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--n-100)', color: 'var(--blue)' }}
              aria-hidden="true"
            >
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="atlas-h3">Simulador de interés compuesto</h2>
              <p className="atlas-caption">Configura los parámetros para visualizar la proyección de crecimiento.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="atlas-caption uppercase tracking-wide">Capital inicial</span>
              <p className="atlas-kpi mt-1">{euroFormatter.format(capitalInicial)}</p>
              <input
                type="range"
                min={0}
                max={200000}
                step={500}
                value={capitalInicial}
                onChange={(event) => setCapitalInicial(Number(event.target.value))}
                className="w-full mt-2"
                style={{ accentColor: 'var(--blue)' }}
                aria-label="Capital inicial"
              />
            </label>

            <label className="block">
              <span className="atlas-caption uppercase tracking-wide">Aportación mensual</span>
              <p className="atlas-kpi mt-1">{euroFormatter.format(aportacionMensual)}</p>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={aportacionMensual}
                onChange={(event) => setAportacionMensual(Number(event.target.value))}
                className="w-full mt-2"
                style={{ accentColor: 'var(--blue)' }}
                aria-label="Aportación mensual"
              />
            </label>

            <label className="block">
              <span className="atlas-caption uppercase tracking-wide">Rentabilidad anual</span>
              <p className="atlas-kpi mt-1">{rentabilidadAnual.toFixed(1)}%</p>
              <input
                type="range"
                min={0}
                max={20}
                step={0.1}
                value={rentabilidadAnual}
                onChange={(event) => setRentabilidadAnual(Number(event.target.value))}
                className="w-full mt-2"
                style={{ accentColor: 'var(--blue)' }}
                aria-label="Rentabilidad anual"
              />
            </label>

            <label className="block">
              <span className="atlas-caption uppercase tracking-wide">Plazo de inversión</span>
              <p className="atlas-kpi mt-1">{plazoAnos} años</p>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={plazoAnos}
                onChange={(event) => setPlazoAnos(Number(event.target.value))}
                className="w-full mt-2"
                style={{ accentColor: 'var(--blue)' }}
                aria-label="Plazo de inversión"
              />
            </label>
          </div>
        </section>

        <section className="atlas-card">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} style={{ color: 'var(--blue)' }} />
            <h3 className="atlas-h3">Tu proyección de crecimiento</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-lg border p-4"
                style={{
                  borderColor: stat.highlight ? 'var(--blue)' : 'var(--n-200)',
                  backgroundColor: stat.highlight ? 'var(--n-50)' : 'var(--white)',
                }}
              >
                <p className="atlas-caption uppercase tracking-wide">{stat.label}</p>
                <p
                  className="atlas-kpi-large mt-2"
                  style={{ color: stat.highlight ? 'var(--blue)' : 'var(--n-700)' }}
                >
                  {euroFormatter.format(stat.value)}
                </p>
                <p className="atlas-caption mt-1">{stat.hint}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
              <div className="flex items-center gap-2 mb-3">
                <PieChart size={16} style={{ color: 'var(--blue)' }} />
                <h4 className="atlas-body-strong">Composición del capital final</h4>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={simulation.composition}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {simulation.composition.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => euroFormatter.format(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <p className="atlas-caption">
                Intereses sobre el total: <strong style={{ color: 'var(--blue)' }}>{percentFormatter.format(simulation.porcentajeInteres)}</strong>
              </p>
            </article>

            <article className="rounded-lg border p-4" style={{ borderColor: 'var(--n-200)' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} style={{ color: 'var(--blue)' }} />
                <h4 className="atlas-body-strong">Evolución del capital por año</h4>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulation.evolution}>
                    <XAxis dataKey="ano" tick={{ fill: 'var(--n-500)' }} />
                    <YAxis tick={{ fill: 'var(--n-500)' }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <Tooltip formatter={(value: number) => euroFormatter.format(value)} />
                    <Bar dataKey="invertido" stackId="capital" fill="var(--c1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="intereses" stackId="capital" fill="var(--c5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HerramientasPage;
