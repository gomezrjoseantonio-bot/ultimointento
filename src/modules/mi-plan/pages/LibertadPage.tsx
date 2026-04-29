import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  HeroBanner,
  CardV5,
  KPIStrip,
  KPI,
  MoneyValue,
  EmptyState,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';

type Escenario = 'alquiler' | 'propia';

const LibertadPage: React.FC = () => {
  const { escenario } = useOutletContext<MiPlanOutletContext>();
  const escenarioPersistido = escenario?.modoVivienda ?? 'alquiler';
  const [escenarioActivo, setEscenarioActivo] = useState<Escenario>(escenarioPersistido as Escenario);

  if (!escenario) {
    return (
      <EmptyState
        icon={<Icons.Libertad size={20} />}
        title="Sin escenario configurado"
        sub="Configura tu escenario de libertad financiera (modo vivienda · gastos vida · estrategia) en Ajustes para activar la trayectoria."
        ctaLabel="Configurar escenario"
        onCtaClick={() => showToastV5('Editar escenario · sub-tarea follow-up')}
      />
    );
  }

  const gastosVida = escenario.gastosVidaLibertadMensual ?? 0;
  const rentaPasivaObjetivo = escenario.rentaPasivaObjetivo ?? 0;
  const cobertura = gastosVida > 0 ? (rentaPasivaObjetivo / gastosVida) * 100 : 0;
  const hitos = escenario.hitos ?? [];

  return (
    <>
      <HeroBanner
        variant="toggle"
        tag="Trayectoria · 18 años · escenario activo"
        title={
          <>
            Tu camino a la libertad financiera ·{' '}
            <strong>
              {escenarioActivo === 'propia' ? 'casa propia' : 'alquiler en Madrid'}
            </strong>
          </>
        }
        sub={
          <>
            renta pasiva objetivo <strong><MoneyValue value={rentaPasivaObjetivo} decimals={0} tone="ink" /> /mes</strong> ·
            gastos vida <strong><MoneyValue value={gastosVida} decimals={0} tone="ink" /> /mes</strong> ·
            cobertura <strong>{cobertura.toFixed(0)}%</strong>
          </>
        }
        toggleLabel="Escenario"
        options={[
          { key: 'alquiler', label: 'Alquiler en Madrid', icon: <Icons.Compra size={14} /> },
          { key: 'propia', label: 'Casa propia (objetivo)', icon: <Icons.Colchon size={14} /> },
        ]}
        active={escenarioActivo}
        onChange={(k) => setEscenarioActivo(k as Escenario)}
        toggleInfo={
          <>
            estrategia · <strong>{escenario.estrategia ?? '—'}</strong>
          </>
        }
      />

      <KPIStrip columns={4}>
        <KPI
          star
          starAccent="brand"
          label="Renta pasiva objetivo"
          value={
            <MoneyValue
              value={rentaPasivaObjetivo}
              decimals={0}
              size="kpiStar"
              tone="brand"
            />
          }
          sub="objetivo libertad · €/mes"
        />
        <KPI
          star
          starAccent="gold"
          label="Gastos vida"
          value={
            <MoneyValue
              value={gastosVida}
              decimals={0}
              size="kpiStar"
              tone="gold"
            />
          }
          sub="estimación al cierre de hoy"
        />
        <KPI
          star
          starAccent="pos"
          label="Cobertura"
          value={`${cobertura.toFixed(0)}%`}
          tone="pos"
          sub="renta pasiva / gastos vida"
        />
        <KPI
          star
          starAccent="warn"
          label="Hitos previstos"
          value={`${hitos.length}`}
          tone="warn"
          sub="compras · ventas · revisiones"
        />
      </KPIStrip>

      <CardV5 style={{ marginTop: 14 }}>
        <CardV5.Title>Trayectoria · 18 años</CardV5.Title>
        <CardV5.Subtitle>
          renta pasiva proyectada vs gastos vida · libertad alcanzada cuando se
          cruzan las líneas
        </CardV5.Subtitle>
        <CardV5.Body>
          {(() => {
            const yearStart = new Date().getFullYear();
            const horizonYears = 18;
            // Punto de partida 0 € · los hitos van sumando renta pasiva
            // mensual proyectada hasta cada año.
            const rentaActual = 0;
            // Construye serie proyectada · valor inicial + impacto acumulado
            // de hitos a fecha de cada año.
            const serie: { year: number; renta: number }[] = [];
            for (let i = 0; i <= horizonYears; i++) {
              const year = yearStart + i;
              let renta = rentaActual;
              for (const h of hitos) {
                if (h.fecha) {
                  const yh = new Date(h.fecha).getFullYear();
                  if (!Number.isNaN(yh) && yh <= year) {
                    renta += h.impactoMensual ?? 0;
                  }
                }
              }
              serie.push({ year, renta: Math.max(0, renta) });
            }
            // maxY · incluye objetivo + gastosVida + serie con un 20% de
            // margen · garantiza que ambas líneas (objetivo · gastos vida)
            // y el cruce "libertad" siempre quedan dentro del viewBox.
            const maxY = Math.max(
              rentaPasivaObjetivo * 1.2,
              gastosVida * 1.2,
              ...serie.map((s) => s.renta),
            );
            const minY = 0;
            const W = 840;
            const H = 240;
            const PAD_L = 56;
            const PAD_R = 14;
            const PAD_T = 16;
            const PAD_B = 32;
            const innerW = W - PAD_L - PAD_R;
            const innerH = H - PAD_T - PAD_B;
            const x = (i: number) => PAD_L + (i / horizonYears) * innerW;
            const y = (v: number) =>
              PAD_T + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;
            const objetivoY = y(rentaPasivaObjetivo);
            const gastosY = y(gastosVida);
            const path = serie
              .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.renta).toFixed(1)}`)
              .join(' ');
            // Año de "libertad" · primer punto donde renta >= gastosVida.
            const libertadIdx = serie.findIndex((s) => s.renta >= gastosVida);
            const libertadX = libertadIdx >= 0 ? x(libertadIdx) : null;
            const libertadY = libertadIdx >= 0 ? y(serie[libertadIdx].renta) : null;

            return (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ width: '100%', height: 240, display: 'block' }}
                role="img"
                aria-label="Trayectoria libertad financiera"
              >
                {/* Grid horizontal · 4 lineas */}
                {[0.25, 0.5, 0.75, 1].map((p, i) => (
                  <line
                    key={i}
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={PAD_T + innerH * (1 - p)}
                    y2={PAD_T + innerH * (1 - p)}
                    stroke="var(--atlas-v5-line-2)"
                    strokeWidth={1}
                  />
                ))}
                {/* Eje Y · valores */}
                {[0, 0.5, 1].map((p, i) => {
                  const v = minY + (maxY - minY) * p;
                  return (
                    <text
                      key={i}
                      x={PAD_L - 8}
                      y={PAD_T + innerH * (1 - p) + 3}
                      textAnchor="end"
                      style={{
                        fontSize: 10,
                        fill: 'var(--atlas-v5-ink-4)',
                        fontFamily: 'var(--atlas-v5-font-mono-num)',
                      }}
                    >
                      {Math.round(v / 100) * 100} €
                    </text>
                  );
                })}
                {/* Eje X · años cada 3 */}
                {serie
                  .filter((_, i) => i % 3 === 0 || i === serie.length - 1)
                  .map((s) => {
                    const idx = serie.indexOf(s);
                    return (
                      <text
                        key={s.year}
                        x={x(idx)}
                        y={H - PAD_B + 16}
                        textAnchor="middle"
                        style={{
                          fontSize: 10,
                          fill: 'var(--atlas-v5-ink-4)',
                          fontFamily: 'var(--atlas-v5-font-mono-num)',
                        }}
                      >
                        {s.year}
                      </text>
                    );
                  })}
                {/* Línea gastos vida · neutra */}
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={gastosY}
                  y2={gastosY}
                  stroke="var(--atlas-v5-ink-4)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                <text
                  x={W - PAD_R - 4}
                  y={gastosY - 6}
                  textAnchor="end"
                  style={{
                    fontSize: 10.5,
                    fill: 'var(--atlas-v5-ink-3)',
                    fontFamily: 'var(--atlas-v5-font-ui)',
                    fontWeight: 600,
                  }}
                >
                  Gastos vida
                </text>
                {/* Línea objetivo · oro */}
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={objetivoY}
                  y2={objetivoY}
                  stroke="var(--atlas-v5-gold)"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                />
                <text
                  x={W - PAD_R - 4}
                  y={objetivoY - 6}
                  textAnchor="end"
                  style={{
                    fontSize: 10.5,
                    fill: 'var(--atlas-v5-gold-ink)',
                    fontFamily: 'var(--atlas-v5-font-ui)',
                    fontWeight: 600,
                  }}
                >
                  Objetivo
                </text>
                {/* Trayectoria renta pasiva */}
                <path
                  d={path}
                  stroke="var(--atlas-v5-pos)"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Punto libertad · si lo alcanza */}
                {libertadX !== null && libertadY !== null && (
                  <>
                    <circle
                      cx={libertadX}
                      cy={libertadY}
                      r={6}
                      fill="var(--atlas-v5-card)"
                      stroke="var(--atlas-v5-pos)"
                      strokeWidth={2.5}
                    />
                    <text
                      x={libertadX}
                      y={libertadY - 12}
                      textAnchor="middle"
                      style={{
                        fontSize: 10.5,
                        fill: 'var(--atlas-v5-pos)',
                        fontFamily: 'var(--atlas-v5-font-mono-num)',
                        fontWeight: 700,
                      }}
                    >
                      Libertad · {serie[libertadIdx].year}
                    </text>
                  </>
                )}
                {/* Puntos hitos · marca cada hito en el eje X */}
                {hitos.map((h) => {
                  if (!h.fecha) return null;
                  const yh = new Date(h.fecha).getFullYear();
                  const idx = serie.findIndex((s) => s.year === yh);
                  if (idx < 0) return null;
                  return (
                    <g key={h.id}>
                      <line
                        x1={x(idx)}
                        x2={x(idx)}
                        y1={H - PAD_B}
                        y2={H - PAD_B + 4}
                        stroke="var(--atlas-v5-gold)"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </CardV5.Body>
      </CardV5>

      <CardV5 style={{ marginTop: 14 }}>
        <CardV5.Title>Hitos del escenario</CardV5.Title>
        <CardV5.Subtitle>
          eventos planificados · cada uno cambia la trayectoria de renta pasiva
        </CardV5.Subtitle>
        <CardV5.Body>
          {hitos.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--atlas-v5-ink-4)', fontSize: 13 }}>
              Sin hitos planificados · añade compras · ventas · amortizaciones extraordinarias para ver el efecto sobre tu libertad.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--atlas-v5-ink-4)' }}>Fecha</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--atlas-v5-ink-4)' }}>Tipo</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--atlas-v5-ink-4)' }}>Descripción</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--atlas-v5-ink-4)' }}>Impacto/mes</th>
                </tr>
              </thead>
              <tbody>
                {hitos.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>{h.fecha}</td>
                    <td style={{ padding: '10px 12px' }}>{h.tipo}</td>
                    <td style={{ padding: '10px 12px' }}>{h.descripcion}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                      <MoneyValue value={h.impactoMensual} decimals={0} showSign tone="auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardV5.Body>
      </CardV5>
    </>
  );
};

export default LibertadPage;
