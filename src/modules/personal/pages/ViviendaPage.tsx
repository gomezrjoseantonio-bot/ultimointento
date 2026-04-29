import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CardV5, Icons, showToastV5 } from '../../../design-system/v5';

/**
 * Mi vivienda · resumen de la vivienda habitual del hogar.
 *
 * El store `viviendaHabitual` se creará en sub-tarea follow-up cuando
 * se amplíe DB (regla §0.7 · esta sub-tarea NO toca DB). Mientras tanto
 * la página presenta los 5 tipos de compromisos asociados a vivienda
 * habitual (alquiler · hipoteca · IBI · comunidad · seguro) con CTAs
 * directos a los flujos donde se gestionan ·
 *
 *  - Alquiler · Inmuebles → Contrato (si la vivienda está dada de alta).
 *  - Hipoteca · Financiación → ficha del préstamo.
 *  - IBI/comunidad/seguro · Personal → Gastos (compromiso recurrente
 *    `personal` o derivado de Inmueble).
 *
 * Cuando el store esté disponible, la página persistirá los datos
 * (tipo régimen · dirección · ref. catastral) y derivará los
 * compromisos automáticamente.
 */

interface CategoriaVivienda {
  key: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  title: string;
  desc: string;
  cta: string;
  onClick: (navigate: ReturnType<typeof useNavigate>) => void;
}

const CATEGORIAS: CategoriaVivienda[] = [
  {
    key: 'regimen',
    icon: Icons.Inmuebles,
    title: 'Régimen y datos básicos',
    desc:
      'Define si vives en propiedad o alquiler · dirección · referencia catastral. Esta información determina los compromisos derivados.',
    cta: 'Configurar (próximamente)',
    onClick: () =>
      showToastV5(
        'Configuración del régimen de vivienda · sub-tarea follow-up cuando exista el store viviendaHabitual.',
      ),
  },
  {
    key: 'alquiler',
    icon: Icons.Contratos,
    title: 'Alquiler · si vives de alquiler',
    desc:
      'Si tu vivienda es de alquiler · gestiona el contrato y los pagos mensuales desde el módulo Contratos. Atlas detecta los recibos y los concilia con Tesorería.',
    cta: 'Ir a Contratos →',
    onClick: (nav) => nav('/contratos'),
  },
  {
    key: 'hipoteca',
    icon: Icons.Financiacion,
    title: 'Hipoteca · si tienes vivienda en propiedad',
    desc:
      'Si la vivienda está hipotecada · da de alta el préstamo en Financiación. Atlas calculará la cuota mensual y la imputará a Personal automáticamente.',
    cta: 'Ir a Financiación →',
    onClick: (nav) => nav('/financiacion'),
  },
  {
    key: 'ibi',
    icon: Icons.Fiscal,
    title: 'IBI · impuesto de bienes inmuebles',
    desc:
      'Crea el IBI como compromiso recurrente anual en Gastos. Atlas lo proyectará en Mi Plan automáticamente.',
    cta: 'Crear gasto IBI →',
    onClick: (nav) => nav('/personal/gastos'),
  },
  {
    key: 'comunidad',
    icon: Icons.Acumular,
    title: 'Comunidad y mantenimiento',
    desc:
      'Cuotas de comunidad · derramas · seguros del hogar. Crea cada uno como compromiso recurrente en Gastos.',
    cta: 'Crear gasto recurrente →',
    onClick: (nav) => nav('/personal/gastos'),
  },
];

const ViviendaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <CardV5 accent="gold-soft" style={{ marginBottom: 14 }}>
        <CardV5.Title>Mi vivienda habitual</CardV5.Title>
        <CardV5.Subtitle>
          datos de la vivienda donde vive el hogar · genera compromisos derivados automáticos
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '12px 8px 18px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            La vivienda habitual del hogar genera 5 tipos de compromisos
            financieros que Atlas usa para construir tu presupuesto y proyección
            de Mi Plan. Cada categoría se gestiona en su módulo correspondiente
            y se centraliza aquí cuando esté disponible el store dedicado.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {CATEGORIAS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => c.onClick(navigate)}
                  style={{
                    padding: '16px 18px',
                    background: 'var(--atlas-v5-card)',
                    border: '1px solid var(--atlas-v5-line)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'border-color 120ms, box-shadow 120ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--atlas-v5-ink-5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--atlas-v5-line)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--atlas-v5-ink-5)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--atlas-v5-line)';
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--atlas-v5-card-alt)',
                      color: 'var(--atlas-v5-ink-3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} strokeWidth={1.7} />
                  </span>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--atlas-v5-ink)',
                    }}
                  >
                    {c.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--atlas-v5-ink-3)', lineHeight: 1.5 }}>
                    {c.desc}
                  </div>
                  <span
                    style={{
                      marginTop: 'auto',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--atlas-v5-gold-ink)',
                    }}
                  >
                    {c.cta}
                  </span>
                </button>
              );
            })}
          </div>
        </CardV5.Body>
      </CardV5>
    </>
  );
};

export default ViviendaPage;
