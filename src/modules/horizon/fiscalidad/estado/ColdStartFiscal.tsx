import React from 'react';
import { Edit3, FileText, HelpCircle, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ColdStartFiscalProps {
  onDismiss: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

const steps = [
  {
    number: 1,
    title: 'Sube tus declaraciones anteriores',
    description: 'Importa los PDFs del Modelo 100 de años anteriores para que ATLAS tenga tu base fiscal completa.',
    badge: 'Recomendado',
    badgeType: 'recommended' as const,
  },
  {
    number: 2,
    title: 'Sube tus datos fiscales de Hacienda',
    description: 'Importa los datos fiscales de la AEAT para completar la información.',
    badge: 'Recomendado',
    badgeType: 'recommended' as const,
  },
  {
    number: 3,
    title: 'Completa los gastos que Hacienda no tiene',
    description: 'Comunidad, seguros, reparaciones, suministros… todo lo que reduce tu base imponible.',
    badge: 'Cuando puedas',
    badgeType: 'optional' as const,
  },
  {
    number: 4,
    title: 'Revisa y presenta',
    description: 'ATLAS prepara tu borrador. Tú revisas y presentas cuando quieras.',
    badge: `Abril-junio ${CURRENT_YEAR + 1}`,
    badgeType: 'optional' as const,
  },
];

const quickActions = [
  {
    icon: FileText,
    title: 'Importar declaración PDF',
    description: 'Sube un PDF del Modelo 100',
    action: 'import-pdf' as const,
  },
  {
    icon: Image,
    title: 'Importar datos fiscales',
    description: 'Datos fiscales de la AEAT',
    action: 'import-datos' as const,
  },
  {
    icon: Edit3,
    title: 'Rellenar manualmente',
    description: 'Introduce los datos a mano',
    action: 'manual' as const,
  },
  {
    icon: HelpCircle,
    title: 'Solo explorar',
    description: 'Ver cómo funciona ATLAS',
    action: 'explore' as const,
  },
];

const ColdStartFiscal: React.FC<ColdStartFiscalProps> = ({ onDismiss }) => {
  const navigate = useNavigate();

  const handleQuickAction = (action: typeof quickActions[number]['action']) => {
    switch (action) {
      case 'import-pdf':
        navigate('/fiscalidad/historial');
        break;
      case 'import-datos':
        navigate('/fiscalidad/historial');
        break;
      case 'manual':
        navigate('/fiscalidad/historial');
        break;
      case 'explore':
        onDismiss();
        break;
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '720px', margin: '0 auto' }}>
      {/* Main card */}
      <div style={{
        border: '2px solid var(--blue, #042C5E)',
        borderRadius: 'var(--r-lg, 16px)',
        padding: '2rem',
        background: 'white',
      }}>
        <h2 style={{
          margin: '0 0 0.5rem',
          fontSize: '1.5rem',
          color: 'var(--blue, #042C5E)',
        }}>
          Prepara tu declaración {CURRENT_YEAR}
        </h2>
        <p style={{
          margin: '0 0 1.5rem',
          color: 'var(--n-500, #6C757D)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
        }}>
          ATLAS calcula tu IRPF en tiempo real. Cuantos más datos tenga, mejor será el resultado. Puedes empezar por donde quieras.
        </p>

        {/* Steps */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {steps.map((step) => (
            <div key={step.number} style={{
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--n-100, #F0F2F5)', color: 'var(--n-700, #495057)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
              }}>
                {step.number}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--n-700, #495057)' }}>{step.title}</span>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                    ...(step.badgeType === 'recommended'
                      ? { background: 'rgba(4, 44, 94, 0.08)', color: 'var(--blue, #042C5E)' }
                      : { background: 'var(--n-100, #F0F2F5)', color: 'var(--n-500, #6C757D)' }),
                  }}>
                    {step.badge}
                  </span>
                </div>
                <p style={{
                  margin: '0.25rem 0 0', color: 'var(--n-500, #6C757D)',
                  fontSize: '0.85rem', lineHeight: 1.4,
                }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        color: 'var(--n-500, #6C757D)', fontSize: '0.85rem',
      }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--n-200, #DEE2E6)' }} />
        <span>O empieza directamente por donde prefieras</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--n-200, #DEE2E6)' }} />
      </div>

      {/* Quick actions grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
      }}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.action}
              type="button"
              onClick={() => handleQuickAction(action.action)}
              style={{
                border: '1px solid var(--n-200, #DEE2E6)',
                borderRadius: 'var(--r-lg, 16px)',
                padding: '1.25rem',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--blue, #042C5E)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--n-200, #DEE2E6)'; }}
            >
              <Icon size={20} style={{ color: 'var(--blue, #042C5E)', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--n-700, #495057)' }}>{action.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--n-500, #6C757D)', marginTop: '0.15rem' }}>
                  {action.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Note */}
      <p style={{
        margin: 0, textAlign: 'center',
        color: 'var(--n-500, #6C757D)', fontSize: '0.85rem',
      }}>
        ATLAS no necesita todos los datos de golpe. Importa lo que tengas y vuelve cuando quieras.
      </p>
    </div>
  );
};

export default ColdStartFiscal;
