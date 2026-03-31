import React from 'react';
import { Info, BarChart3, FileText } from 'lucide-react';

type BannerTipo = 'en_curso' | 'pendiente_incompleto' | 'declarado_atlas' | 'declarado_pdf' | 'declarado_xml';

interface BannerContextualProps {
  tipo: BannerTipo;
  onImportar?: () => void;
  onCompletar?: () => void;
}

const BANNER_CONFIG: Record<BannerTipo, {
  icon: React.ReactNode;
  text: string;
  bg: string;
  color: string;
  borderColor: string;
}> = {
  en_curso: {
    icon: <BarChart3 size={16} />,
    text: 'Estimación en curso · se actualiza con cada dato que añadas',
    bg: '#E6F7FA',
    color: 'var(--teal)',
    borderColor: 'var(--teal)',
  },
  pendiente_incompleto: {
    icon: <Info size={16} />,
    text: 'Faltan secciones por completar · importa el PDF o completa manualmente',
    bg: 'var(--s-warn-bg)',
    color: 'var(--s-warn)',
    borderColor: 'var(--s-warn)',
  },
  declarado_atlas: {
    icon: <Info size={16} />,
    text: 'Datos estimados por ATLAS · puedes importar el PDF o completar manualmente',
    bg: 'var(--n-50)',
    color: 'var(--n-700)',
    borderColor: 'var(--n-300)',
  },
  declarado_pdf: {
    icon: <FileText size={16} />,
    text: 'Declaración importada desde PDF AEAT',
    bg: 'var(--s-pos-bg)',
    color: 'var(--s-pos)',
    borderColor: 'var(--s-pos)',
  },
  declarado_xml: {
    icon: <FileText size={16} />,
    text: 'Declaración importada desde XML AEAT',
    bg: 'var(--s-pos-bg)',
    color: 'var(--s-pos)',
    borderColor: 'var(--s-pos)',
  },
};

const BannerContextual: React.FC<BannerContextualProps> = ({ tipo, onImportar, onCompletar }) => {
  const config = BANNER_CONFIG[tipo];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--r-md, 8px)',
      background: config.bg,
      borderLeft: `3px solid ${config.borderColor}`,
      color: config.color,
      fontSize: 'var(--t-sm, 13px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        {config.icon}
        <span>{config.text}</span>
      </div>
      {(onImportar || onCompletar) && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {onImportar && (
            <button
              type="button"
              onClick={onImportar}
              style={{
                border: 'none',
                background: 'transparent',
                color: config.color,
                fontWeight: 600,
                fontSize: 'var(--t-xs, 11px)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Importar
            </button>
          )}
          {onCompletar && (
            <button
              type="button"
              onClick={onCompletar}
              style={{
                border: 'none',
                background: 'transparent',
                color: config.color,
                fontWeight: 600,
                fontSize: 'var(--t-xs, 11px)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Completar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BannerContextual;
