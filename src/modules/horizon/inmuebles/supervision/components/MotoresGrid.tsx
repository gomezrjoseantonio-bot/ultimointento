import React from 'react';
import { TrendingUp, Banknote, Target } from 'lucide-react';
import type { InmuebleSupervision } from '../hooks/useSupervisionData';

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
const fmtPct = (n: number): string =>
  (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtX = (n: number): string => n.toFixed(2) + 'x';

interface MotoresGridProps {
  inmueble: InmuebleSupervision;
  tasaRev: number;
  crecRentas: number;
  horizonte: number;
}

const MotoresGrid: React.FC<MotoresGridProps> = ({ inmueble, tasaRev, crecRentas, horizonte }) => {
  const safeDiv = (a: number, b: number) => (b !== 0 ? a / b : 0);

  // Proyección valor
  const valorProy = inmueble.valorActual * Math.pow(1 + tasaRev / 100, horizonte);
  const plusvaliaProyectada = valorProy - inmueble.costeAdquisicion;

  // Proyección cashflow
  const lastD = inmueble.datosPorAno[inmueble.datosPorAno.length - 1];
  const baseRentas = lastD?.rentas ?? 0;
  const baseGastos = lastD?.gastosOp ?? 0;
  const baseIntereses = lastD?.intereses ?? 0;

  let cfProy = 0;
  let rentasEstTotal = 0;
  for (let y = 1; y <= horizonte; y++) {
    const rentasY = baseRentas * Math.pow(1 + crecRentas / 100, y);
    rentasEstTotal += rentasY;
    cfProy += rentasY - baseGastos - baseIntereses;
  }

  const yieldProy = safeDiv(
    baseRentas * Math.pow(1 + crecRentas / 100, horizonte),
    inmueble.costeAdquisicion,
  ) * 100;

  // Resultado total
  const gananciaEst = (valorProy + inmueble.cashflowAcumulado + cfProy) - inmueble.inversionTotal;
  const multiploProyectado = safeDiv(valorProy + inmueble.cashflowAcumulado + cfProy, inmueble.inversionTotal);

  const motors = [
    {
      icon: TrendingUp,
      title: 'Revalorización',
      rows: [
        { label: 'Coste de adquisición', value: fmt(inmueble.costeAdquisicion) },
        { label: 'Valor actual', value: fmt(inmueble.valorActual) },
        { label: 'Plusvalía latente', value: fmt(inmueble.plusvaliaLatente), highlight: true },
        { label: `Proyección ${horizonte}a`, value: fmt(valorProy) },
        { label: `Plusv. proyectada ${horizonte}a`, value: fmt(plusvaliaProyectada) },
      ],
    },
    {
      icon: Banknote,
      title: 'Rentas',
      rows: [
        { label: 'Cashflow acumulado', value: fmt(inmueble.cashflowAcumulado) },
        { label: 'Yield s/adq.', value: fmtPct(inmueble.yieldCosteAdquisicion) },
        { label: `CF proyectado ${horizonte}a`, value: fmt(cfProy), highlight: true },
        { label: `Yield proy. ${horizonte}a`, value: fmtPct(yieldProy) },
        { label: `Rentas est. ${horizonte}a`, value: fmt(rentasEstTotal) },
      ],
    },
    {
      icon: Target,
      title: `Resultado total ${horizonte}a`,
      rows: [
        { label: 'Inversión total', value: fmt(inmueble.inversionTotal) },
        { label: `Valor proy. + CF`, value: fmt(valorProy + inmueble.cashflowAcumulado + cfProy) },
        { label: 'Ganancia estimada', value: fmt(gananciaEst), highlight: true },
        { label: 'Múltiplo proyectado', value: fmtX(multiploProyectado) },
      ],
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
      {motors.map((motor) => (
        <div
          key={motor.title}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--grey-200)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--space-5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
            <motor.icon size={16} style={{ color: 'var(--grey-500)' }} />
            <h4 style={{
              fontSize: 'var(--t-sm)',
              fontWeight: 600,
              color: 'var(--grey-900)',
              margin: 0,
            }}>
              {motor.title}
            </h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {motor.rows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: row.highlight ? '4px 6px' : '0 6px',
                  borderRadius: row.highlight ? 'var(--r-sm)' : 0,
                  background: row.highlight ? 'var(--grey-50)' : 'transparent',
                }}
              >
                <span style={{
                  fontSize: 'var(--t-xs)',
                  color: 'var(--grey-500)',
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 'var(--t-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: row.highlight ? 600 : 400,
                  color: row.highlight ? 'var(--navy-900)' : 'var(--grey-700)',
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MotoresGrid;
