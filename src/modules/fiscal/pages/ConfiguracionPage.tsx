import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, Icons, showToastV5 } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';

const ConfiguracionPage: React.FC = () => {
  const navigate = useNavigate();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();

  // Ejercicio por defecto · el más reciente que NO esté prescrito.
  const ejerciciosOrdenados = useMemo(
    () =>
      [...ejercicios]
        .filter((e) => e.estado !== 'prescrito')
        .sort((a, b) => b.ejercicio - a.ejercicio),
    [ejercicios],
  );
  const [anio, setAnio] = useState<number | ''>(
    ejerciciosOrdenados[0]?.ejercicio ?? new Date().getFullYear(),
  );

  const goImportar = () => {
    if (!anio) {
      showToastV5('Selecciona un ejercicio antes de importar.');
      return;
    }
    navigate(`/fiscal/importar/${anio}`);
  };

  const goCorreccion = () => {
    if (!anio) {
      showToastV5('Selecciona un ejercicio antes de aplicar la paralela.');
      return;
    }
    navigate(`/fiscal/correccion/${anio}`);
  };

  const yearSelector = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: 'var(--atlas-v5-card-alt)',
        borderRadius: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <label
        htmlFor="anioSel"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--atlas-v5-ink-3)',
        }}
      >
        Ejercicio fiscal
      </label>
      <select
        id="anioSel"
        value={String(anio)}
        onChange={(e) => setAnio(parseInt(e.target.value, 10))}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--atlas-v5-line)',
          borderRadius: 6,
          fontFamily: 'var(--atlas-v5-font-mono-num)',
          fontSize: 13,
          background: 'var(--atlas-v5-card)',
          color: 'var(--atlas-v5-ink)',
        }}
      >
        {ejerciciosOrdenados.map((e) => (
          <option key={e.ejercicio} value={e.ejercicio}>
            {e.ejercicio} · {e.estado}
          </option>
        ))}
        {ejerciciosOrdenados.length === 0 && (
          <option value={new Date().getFullYear()}>{new Date().getFullYear()} · nuevo</option>
        )}
      </select>
      <span style={{ fontSize: 11.5, color: 'var(--atlas-v5-ink-4)' }}>
        las acciones se aplican al ejercicio seleccionado
      </span>
    </div>
  );

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
        <CardV5.Title>Importar declaración del Modelo 100</CardV5.Title>
        <CardV5.Subtitle>
          XML de DeclaVisor (Renta Web) · PDF · TXT · extracción automática
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '14px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            Sube el documento oficial de la declaración (XML DeclaVisor · PDF
            del Modelo 100 · TXT exportado desde Renta Web). Atlas extrae las
            casillas automáticamente · marca el ejercicio como{' '}
            <strong>declarado</strong> y archiva el documento para
            trazabilidad.
          </div>

          {yearSelector}

          <button
            type="button"
            onClick={goImportar}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              border: 'none',
              background: 'var(--atlas-v5-gold)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Upload size={14} strokeWidth={1.8} />
            Importar XML · PDF · TXT del Modelo 100
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Aplicar paralela AEAT</CardV5.Title>
        <CardV5.Subtitle>
          liquidación firmada por Hacienda · cascada años posteriores
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '14px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            Si Hacienda te ha enviado una propuesta de liquidación · acta · o
            liquidación y la has firmado en conformidad, aplícala en el wizard
            de 5 pasos para que Atlas registre la paralela y deje constancia
            del desfase en años posteriores.{' '}
            <strong>No apliques paralelas que estén en recurso.</strong>
          </div>

          {yearSelector}

          <button
            type="button"
            onClick={goCorreccion}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              color: 'var(--atlas-v5-ink)',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Refresh size={14} strokeWidth={1.8} />
            Iniciar wizard de corrección · 5 pasos
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5>
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
    </>
  );
};

export default ConfiguracionPage;
