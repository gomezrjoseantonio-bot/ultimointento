import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue, Icons } from '../../../design-system/v5';
import type { PersonalOutletContext } from '../PersonalContext';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

const computeMonthly = (c: CompromisoRecurrente): number => {
  switch (c.importe.modo) {
    case 'fijo':
      return c.importe.importe;
    case 'variable':
      return c.importe.importeMedio;
    case 'diferenciadoPorMes':
      return c.importe.importesPorMes.reduce((s: number, v: number) => s + v, 0) / 12;
    case 'porPago':
      return Object.values(c.importe.importesPorPago).reduce((s, v) => s + v, 0) / 12;
    default:
      return 0;
  }
};

/**
 * Presupuesto · método 50/30/20 estándar.
 *
 * 50% Necesidades · vivienda + suministros + alimentación + transporte + salud
 * 30% Deseos · ocio + suscripciones + restaurantes
 * 20% Ahorro · ingresos − gastos
 *
 * Categorización simplificada · usuario podría reclasificar en sub-tarea
 * follow-up.
 */
const PresupuestoPage: React.FC = () => {
  const { nominas, autonomos, compromisos } = useOutletContext<PersonalOutletContext>();

  const ingresosMes =
    nominas.filter((n) => n.activa).reduce((sum, n) => sum + n.salarioBrutoAnual / 12, 0) +
    autonomos
      .filter((a) => a.activo)
      .reduce((sum, a) => {
        const i = (a as { ingresoBrutoAnualEstimado?: number }).ingresoBrutoAnualEstimado ?? 0;
        return sum + i / 12;
      }, 0);

  const NECESIDADES = ['suministro', 'seguro', 'alquiler', 'salud', 'transporte', 'alimentacion'];
  const DESEOS = ['suscripcion', 'cuota', 'ocio'];

  let necesidades = 0;
  let deseos = 0;
  compromisos
    .filter((c) => c.ambito === 'personal' && c.estado === 'activo')
    .forEach((c) => {
      const monthly = computeMonthly(c);
      if (NECESIDADES.includes(c.tipo)) necesidades += monthly;
      else if (DESEOS.includes(c.tipo)) deseos += monthly;
      else necesidades += monthly; // default · necesidades
    });

  const meta50 = ingresosMes * 0.5;
  const meta30 = ingresosMes * 0.3;
  const meta20 = ingresosMes * 0.2;
  const ahorro = ingresosMes - necesidades - deseos;

  const rows: Array<{
    label: string;
    actual: number;
    meta: number;
    color: string;
    isAhorro?: boolean;
  }> = [
    { label: 'Necesidades · 50%', actual: necesidades, meta: meta50, color: 'var(--atlas-v5-brand)' },
    { label: 'Deseos · 30%', actual: deseos, meta: meta30, color: 'var(--atlas-v5-gold)' },
    { label: 'Ahorro · 20%', actual: ahorro, meta: meta20, color: 'var(--atlas-v5-pos)', isAhorro: true },
  ];

  return (
    <CardV5 accent="gold">
      <CardV5.Title>Presupuesto · método 50/30/20</CardV5.Title>
      <CardV5.Subtitle>
        cumplimiento del mes en curso · ingresos del hogar{' '}
        <MoneyValue value={ingresosMes} decimals={0} tone="ink" />
      </CardV5.Subtitle>
      <CardV5.Body>
        {ingresosMes === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--atlas-v5-ink-4)', fontSize: 13 }}>
            <Icons.Info size={18} strokeWidth={1.6} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Sin ingresos registrados · da de alta nóminas o actividad de autónomo para activar el presupuesto.
          </div>
        ) : (
          rows.map((row) => {
            const pct = row.meta > 0 ? Math.min(100, (row.actual / row.meta) * 100) : 0;
            const superado = row.isAhorro && row.actual > row.meta;
            return (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--atlas-v5-ink)' }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                      color: superado ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-ink-4)',
                      fontWeight: superado ? 700 : 400,
                    }}
                  >
                    {superado ? (
                      <>
                        <MoneyValue value={row.actual} decimals={0} tone="pos" /> · superado
                      </>
                    ) : (
                      <>
                        <MoneyValue value={row.actual} decimals={0} /> de{' '}
                        <MoneyValue value={row.meta} decimals={0} /> meta
                      </>
                    )}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: 'var(--atlas-v5-line-2)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: row.color,
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardV5.Body>
    </CardV5>
  );
};

export default PresupuestoPage;
