import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue, Icons } from '../../../design-system/v5';
import type { PersonalOutletContext } from '../PersonalContext';
import {
  computeAutonomoIngresoEnMes,
  computeCompromisoMonthly,
  computeNominaBrutoEnMes,
  bolsaForCategoria,
} from '../helpers';

/**
 * Presupuesto · método 50/30/20.
 *
 * Reparto basado en `c.bolsaPresupuesto` cuando está informada (campo
 * canónico del modelo) · si no, se infiere desde `c.categoria` con
 * `bolsaForCategoria`.
 *
 * - 50% Necesidades · vivienda.* + alimentacion + transporte + salud + educacion
 * - 30% Deseos      · ocio + viajes + suscripciones + personal + regalos + tecnologia
 * - 20% Ahorro      · ahorro.* (aporteFondo · aportePension · amortizacionExtra · etc)
 *
 * Categoría 'obligaciones.*' NO entra en el reparto 50/30/20 (se ven como
 * cargas fiscales aparte).
 */
const PresupuestoPage: React.FC = () => {
  const { nominas, autonomos, compromisos } = useOutletContext<PersonalOutletContext>();

  // Ingreso del mes EN CURSO · spec v1.1 regla 4 (calendario REAL · no plano).
  // Las metas 50/30/20 se calculan sobre este mes real, no sobre bruto/12.
  const mesActual = new Date().getMonth() + 1;
  const ingresosMes =
    nominas.reduce((sum, n) => sum + computeNominaBrutoEnMes(n, mesActual), 0) +
    autonomos.reduce((sum, a) => sum + computeAutonomoIngresoEnMes(a, mesActual), 0);

  let necesidades = 0;
  let deseos = 0;
  let obligaciones = 0;
  compromisos
    .filter((c) => c.ambito === 'personal' && c.estado === 'activo')
    .forEach((c) => {
      const monthly = computeCompromisoMonthly(c);
      const bolsa =
        c.bolsaPresupuesto ??
        (c.categoria ? bolsaForCategoria(c.categoria) : 'necesidades');
      if (bolsa === 'necesidades') necesidades += monthly;
      else if (bolsa === 'deseos') deseos += monthly;
      else if (bolsa === 'obligaciones') obligaciones += monthly;
      // ahorroInversion · va sumado en `ahorro` del usuario · no en gastos
      // inmueble · no entra en 50/30/20 personal (excluido)
    });

  const meta50 = ingresosMes * 0.5;
  const meta30 = ingresosMes * 0.3;
  const meta20 = ingresosMes * 0.2;
  const ahorro = ingresosMes - necesidades - deseos - obligaciones;

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
          <>
            {rows.map((row) => {
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
            })}
            {obligaciones > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 12px',
                  background: 'var(--atlas-v5-warn-wash)',
                  border: '1px solid var(--atlas-v5-warn-border)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--atlas-v5-warn)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <Icons.Info size={14} strokeWidth={1.7} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Obligaciones fiscales (IRPF · M130 · cuota RETA · etc.) · NO entran en 50/30/20
                </span>
                <span style={{ fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 600 }}>
                  <MoneyValue value={obligaciones} decimals={0} tone="warn" /> /mes
                </span>
              </div>
            )}
          </>
        )}
      </CardV5.Body>
    </CardV5>
  );
};

export default PresupuestoPage;
