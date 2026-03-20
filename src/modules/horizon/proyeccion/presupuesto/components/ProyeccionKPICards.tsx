import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { ProyeccionMensualData } from '../types/ProyeccionData';

interface ProyeccionKPICardsProps {
  data: ProyeccionMensualData;
}

const formatCurrency = (value: number): string => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value);

const percentageText = (base: number, value: number) => {
  if (base <= 0) return '0% de ingresos';
  return `${Math.round((value / base) * 100)}% de ingresos`;
};

const neutralChipStyle = (color: string): React.CSSProperties => ({
  background: 'var(--n-100)',
  color,
});

export default function ProyeccionKPICards({ data }: ProyeccionKPICardsProps) {
  const totalIngresosAnual = data.totalIngresos.reduce((acc, value) => acc + value, 0);
  const totalGastosAnual = data.totalGastos.reduce((acc, value) => acc + value, 0);
  const totalFinanciacionAnual = data.totalFinanciacion.reduce((acc, value) => acc + value, 0);
  const flujoNetoAnual = data.flujoCaja.reduce((acc, value) => acc + value, 0);
  const mesesNegativos = data.flujoCaja.filter((value) => value < 0).length;
  const cajaFinalAnual = data.cajaFinal[11] ?? 0;
  const mediaIngMensual = Math.round(totalIngresosAnual / 12);

  const cards = [
    {
      label: 'Ingresos totales',
      value: formatCurrency(totalIngresosAnual),
      color: 'var(--c1)',
      chip: `Media mensual: ${formatCurrency(mediaIngMensual)}`,
      chipStyle: neutralChipStyle('var(--c1)'),
      subtitle: 'Suma de nóminas, rentas, rendimientos y otros ingresos.',
    },
    {
      label: 'Gastos totales',
      value: formatCurrency(totalGastosAnual),
      color: 'var(--c6)',
      chip: percentageText(totalIngresosAnual, totalGastosAnual),
      chipStyle: neutralChipStyle('var(--c6)'),
      subtitle: 'Incluye operativos, personales, actividad e IRPF.',
    },
    {
      label: 'Financiación',
      value: formatCurrency(totalFinanciacionAnual),
      color: 'var(--c2)',
      chip: percentageText(totalIngresosAnual, totalFinanciacionAnual),
      chipStyle: neutralChipStyle('var(--c2)'),
      subtitle: 'Cuotas agregadas de hipotecas y préstamos.',
    },
    {
      label: 'Flujo neto acumulado',
      value: formatCurrency(flujoNetoAnual),
      color: flujoNetoAnual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)',
      chip: `Caja final: ${formatCurrency(cajaFinalAnual)} · ${mesesNegativos} meses negativos`,
      chipStyle: {
        background: flujoNetoAnual >= 0 ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)',
        color: flujoNetoAnual >= 0 ? 'var(--s-pos)' : 'var(--s-neg)',
      },
      subtitle: mesesNegativos > 0
        ? 'Hay meses con tensión de caja durante el ejercicio.'
        : 'Todos los meses mantienen flujo de caja no negativo.',
      icon: mesesNegativos > 0 ? <AlertCircle size={14} /> : null,
    },
  ];

  return (
    <section className="proyeccion-metrics-grid" aria-label="KPIs de la proyección automática">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <p className="metric-card__label">{card.label}</p>
          <p className="metric-card__value" style={{ color: card.color }}>{card.value}</p>
          <div className="metric-card__chip" style={card.chipStyle}>
            {card.icon}
            <span>{card.chip}</span>
          </div>
          <p className="metric-card__subtext">{card.subtitle}</p>
        </article>
      ))}
    </section>
  );
}
