import React, { useState, ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * ATLAS Tooltip Component
 * Sprint 1: UX Improvement for technical terminology
 * 
 * Provides contextual help for complex terms and features
 */

interface TooltipProps {
  content: string;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  trigger?: 'hover' | 'click';
  showIcon?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  maxWidth = 280,
  trigger = 'hover',
  showIcon = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseEnter = () => {
    if (trigger === 'hover') setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') setIsVisible(false);
  };

  const handleClick = () => {
    if (trigger === 'click') setIsVisible(!isVisible);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {showIcon && (
        <button 
          className="ml-1.5 p-0.5 rounded transition-colors focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--hz-neutral-500)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hz-neutral-100)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Ver información"
          type="button"
        >
          <Info size={16} />
        </button>
      )}
      
      {isVisible && (
        <div
          className={`absolute ${positionClasses[position]} z-50 px-3 py-2 text-sm rounded-lg border shadow-lg pointer-events-none transition-opacity`}
          style={{
            backgroundColor: 'var(--hz-card-bg)',
            borderColor: 'var(--hz-neutral-300)',
            color: 'var(--atlas-navy-1)',
            maxWidth: `${maxWidth}px`,
          }}
        >
          {content}
          {/* Arrow indicator */}
          <div
            className="absolute w-2 h-2 rotate-45"
            style={{
              backgroundColor: 'var(--hz-card-bg)',
              borderColor: 'var(--hz-neutral-300)',
              ...(position === 'top' && {
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                borderRight: '1px solid',
                borderBottom: '1px solid',
              }),
              ...(position === 'bottom' && {
                top: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                borderLeft: '1px solid',
                borderTop: '1px solid',
              }),
              ...(position === 'left' && {
                right: '-4px',
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                borderTop: '1px solid',
                borderRight: '1px solid',
              }),
              ...(position === 'right' && {
                left: '-4px',
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                borderBottom: '1px solid',
                borderLeft: '1px solid',
              }),
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Technical Term Tooltip - Pre-configured for common financial terms
 */
interface TechnicalTermTooltipProps {
  term: keyof typeof TECHNICAL_TERMS;
  children: ReactNode;
}

export const TechnicalTermTooltip: React.FC<TechnicalTermTooltipProps> = ({
  term,
  children,
}) => {
  const definition = TECHNICAL_TERMS[term];
  
  return (
    <Tooltip content={definition} showIcon>
      {children}
    </Tooltip>
  );
};

/**
 * Top 20 Technical Terms - Glossary for ATLAS
 * Sprint 1: UX improvement for terminology comprehension
 */
export const TECHNICAL_TERMS = {
  // Financial & Property Management (Top 10)
  'inmueble': 'Propiedad inmobiliaria gestionada en el sistema. Incluye datos de ubicación, coste, rentabilidad y documentación.',
  'vacacional': 'Inmueble destinado al alquiler por periodos cortos (días o semanas) para turismo.',
  'lar': 'Alquiler de larga duración. Contrato de arrendamiento de mínimo 12 meses.',
  'rentabilidad': 'Porcentaje de ganancia obtenida sobre la inversión inicial. Se calcula dividiendo beneficio neto entre inversión.',
  'reforma': 'Obras de mejora o modificación realizadas en un inmueble. Se capitalizan en el valor del inmueble.',
  'tesorería': 'Gestión de flujos de entrada y salida de dinero. Controla saldo disponible y proyecciones.',
  'conciliación': 'Proceso de validar que los movimientos bancarios coinciden con los registros internos.',
  'extracto': 'Documento bancario que lista todos los movimientos de una cuenta en un periodo.',
  'ocr': 'Reconocimiento Óptico de Caracteres. Tecnología que extrae texto de documentos escaneados o fotografiados.',
  'fein': 'Federal Employer Identification Number. Número de identificación fiscal empresarial en USA.',
  
  // Horizon Module Concepts (5)
  'horizon': 'Módulo de supervisión financiera. Vista ejecutiva para inversores y gestores de alto nivel.',
  'pulse': 'Módulo de gestión operativa diaria. Herramientas para tareas administrativas y documentación.',
  'dashboard': 'Panel principal que muestra KPIs y métricas clave de forma visual y resumida.',
  'kpi': 'Key Performance Indicator. Métrica principal para medir rendimiento (ej: ocupación, rentabilidad).',
  'proyección': 'Estimación de ingresos y gastos futuros basada en datos históricos y expectativas.',
  
  // Tax & Accounting (3)
  'irpf': 'Impuesto sobre la Renta de Personas Físicas. Se aplica a ingresos de alquileres y ganancias patrimoniales.',
  'tributación': 'Conjunto de impuestos que debe pagar un propietario (IRPF, plusvalía, IBI, etc.).',
  'iae': 'Impuesto de Actividades Económicas. Grava el ejercicio de actividades empresariales.',
  
  // Document Management (2)
  'inbox': 'Bandeja de entrada de documentos. Centraliza facturas, contratos y extractos pendientes de procesar.',
  'clasificación': 'Proceso de identificar el tipo de documento (factura, contrato, extracto) y extraer datos relevantes.',
} as const;

export default Tooltip;
