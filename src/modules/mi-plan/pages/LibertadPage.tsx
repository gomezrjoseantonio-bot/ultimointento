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
