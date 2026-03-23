import React from 'react';
import { Edit3, FileText, HelpCircle, Image } from 'lucide-react';

interface ColdStartFiscalProps {
  onImportarDeclaracion: () => void;
  onImportarDatosFiscales: () => void;
  onRellenarManualmente: () => void;
  onExplorar: () => void;
}

const cardStyle: React.CSSProperties = {
  border: '2px solid var(--blue)',
  borderRadius: '24px',
  background: 'var(--white)',
  padding: 'var(--s6)',
  display: 'grid',
  gap: 'var(--s5)',
};

const badgeBase: React.CSSProperties = {
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
};

const actionCardStyle: React.CSSProperties = {
  border: '1px solid var(--n-200)',
  borderRadius: '18px',
  padding: 'var(--s4)',
  background: 'var(--white)',
  textAlign: 'left',
  display: 'grid',
  gap: 'var(--s2)',
  cursor: 'pointer',
};

const steps = [
  { number: 1, title: 'Sube tus declaraciones anteriores', badge: 'Recomendado', badgeStyle: { background: 'var(--n-100)', color: 'var(--blue)' } },
  { number: 2, title: 'Sube tus datos fiscales de Hacienda', badge: 'Recomendado', badgeStyle: { background: 'var(--n-100)', color: 'var(--blue)' } },
  { number: 3, title: 'Completa los gastos que Hacienda no tiene', badge: 'Cuando puedas', badgeStyle: { background: 'var(--n-100)', color: 'var(--n-500)' } },
  { number: 4, title: 'Revisa y presenta', badge: 'Abril-junio 2026', badgeStyle: { background: 'var(--n-100)', color: 'var(--n-700)' } },
] as const;

const ColdStartFiscal: React.FC<ColdStartFiscalProps> = ({
  onImportarDeclaracion,
  onImportarDatosFiscales,
  onRellenarManualmente,
  onExplorar,
}) => {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'grid', gap: 'var(--s2)' }}>
        <h2 style={{ margin: 0, color: 'var(--n-900)', fontSize: 'var(--t-xl)', fontWeight: 600 }}>
          Prepara tu declaración 2025
        </h2>
        <p style={{ margin: 0, color: 'var(--n-600)', maxWidth: 760 }}>
          Empieza por lo más importante y completa el resto cuando te venga bien. ATLAS puede trabajar paso a paso sin pedirte toda la información de golpe.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--s3)' }}>
        {steps.map((step) => (
          <div key={step.number} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap' }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '999px',
                background: 'var(--n-100)',
                color: 'var(--n-700)',
                display: 'inline-grid',
                placeItems: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {step.number}
            </span>
            <span style={{ color: 'var(--n-900)', fontWeight: 500 }}>{step.title}</span>
            <span style={{ ...badgeBase, ...step.badgeStyle }}>{step.badge}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 'var(--s3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--n-200)' }} />
          <span style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm)' }}>O empieza directamente por donde prefieras</span>
          <div style={{ flex: 1, height: 1, background: 'var(--n-200)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--s3)' }}>
          <button type="button" onClick={onImportarDeclaracion} style={actionCardStyle}>
            <FileText size={20} color="var(--blue)" />
            <strong>Importar declaración PDF</strong>
            <span style={{ color: 'var(--n-600)' }}>Sube tu Modelo 100 para recuperar ejercicios pasados.</span>
          </button>

          <button type="button" onClick={onImportarDatosFiscales} style={actionCardStyle}>
            <Image size={20} color="var(--blue)" />
            <strong>Importar datos fiscales</strong>
            <span style={{ color: 'var(--n-600)' }}>Trae la información base de Hacienda y complétala después.</span>
          </button>

          <button type="button" onClick={onRellenarManualmente} style={actionCardStyle}>
            <Edit3 size={20} color="var(--blue)" />
            <strong>Rellenar manualmente</strong>
            <span style={{ color: 'var(--n-600)' }}>Introduce solo las casillas clave y continúa más tarde.</span>
          </button>

          <button type="button" onClick={onExplorar} style={actionCardStyle}>
            <HelpCircle size={20} color="var(--blue)" />
            <strong>Solo explorar</strong>
            <span style={{ color: 'var(--n-600)' }}>Entra al módulo vacío y revisa la estructura antes de importar nada.</span>
          </button>
        </div>
      </div>

      <p style={{ margin: 0, color: 'var(--n-500)', fontSize: 'var(--t-sm)' }}>
        ATLAS no necesita todos los datos de golpe.
      </p>
    </section>
  );
};

export default ColdStartFiscal;
