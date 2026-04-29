import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CardV5, Icons } from '../../../design-system/v5';

const ConfiguracionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Perfil fiscal</CardV5.Title>
        <CardV5.Subtitle>
          situación familiar · CCAA · obligaciones · arrastres
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '20px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            La configuración de tu perfil fiscal vive en{' '}
            <strong>Ajustes &gt; Perfil fiscal</strong>. Allí defines situación
            familiar, CCAA de tributación, fuentes de renta y arrastres recibidos
            de ejercicios anteriores.
          </div>
          <button
            type="button"
            onClick={() => navigate('/ajustes/fiscal')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              border: 'none',
              background: 'var(--atlas-v5-ink)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Ajustes size={14} strokeWidth={1.8} />
            Abrir ajustes fiscales
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Modelos y obligaciones</CardV5.Title>
        <CardV5.Subtitle>
          alta y baja de modelos · IVA · IRPF · informativos
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '16px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-4)',
            }}
          >
            Atlas detecta automáticamente las obligaciones según tus ingresos y
            actividades. Los modelos manuales se gestionan desde el Detalle del
            ejercicio.
          </div>
        </CardV5.Body>
      </CardV5>

      <CardV5>
        <CardV5.Title>Importación · paralelas AEAT</CardV5.Title>
        <CardV5.Subtitle>
          aplicar liquidaciones de Hacienda en cascada
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '16px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            El wizard para aplicar paralelas AEAT (5 pasos · cascada años posteriores)
            llega en la siguiente sub-tarea de T20 (3f-B). Mientras tanto, las
            modificaciones manuales se hacen desde el Detalle del ejercicio.
          </div>
        </CardV5.Body>
      </CardV5>
    </>
  );
};

export default ConfiguracionPage;
