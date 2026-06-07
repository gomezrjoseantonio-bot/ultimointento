/**
 * Pantalla 09 · Bloque inversiones · doble vía.
 * Plantilla Excel NUEVA (posiciones + valoración inicial) + alta manual
 * (galería de inversiones existente · /inversiones).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import ImportarPlantillaWizard, { type PlantillaRevisionView } from './ImportarPlantillaWizard';
import { useOnboarding } from '../OnboardingContext';
import {
  parseInversionesTemplateXlsx,
  InversionesTemplateFormatError,
  type InversionTemplateRow,
} from '../../../../services/inversionesTemplateParserService';
import { revisarRows, crearInversionesDesdeRows } from '../../../../services/inversionesImportCreationService';
import styles from '../empezar.module.css';

const InversionesBloque: React.FC = () => {
  const navigate = useNavigate();
  const { refresh } = useOnboarding();
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);

  const revisar = (rows: InversionTemplateRow[]): PlantillaRevisionView[] =>
    revisarRows(rows).map((r) => ({
      label: r.row.producto || '(sin producto)',
      sub: r.valido ? `${r.row.tipo} · ${r.row.entidad ?? '—'}${r.row.unidades ? ' · ' + r.row.unidades + ' uds' : ''}` : `No se creará · ${r.motivo}`,
      amount: r.row.valorHoy || r.row.costeAdquisicion,
      valido: r.valido,
    }));

  const crear = async (rows: InversionTemplateRow[]) => {
    const res = await crearInversionesDesdeRows(rows);
    return {
      creados: res.creadas,
      resumen: `${res.creadas} posición(es) creadas${res.errores.length ? ` · ${res.errores.length} con error` : ''}.`,
      avisos: res.errores.map((e) => `${e.producto} · ${e.motivo}`),
    };
  };

  return (
    <DobleViaLayout
      kick="Bloque · el resto de tu patrimonio"
      title="Tus inversiones"
      subtitle="Fondos · acciones · ETFs · crypto · planes de pensiones · depósitos · participaciones. Cada posición con su coste y fecha de compra · sin eso una venta futura no puede calcular su ganancia."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge="Recomendado con varias"
          Icon={Icons.Contratos}
          title="Plantilla Excel · en lote"
          desc="Descarga la plantilla · una fila por posición · súbela y Atlas las crea todas con su valoración inicial."
          items={['Tipo · entidad · producto · unidades', 'Coste de adquisición y fecha · valor de hoy', 'Revisión antes de crear nada']}
          time="5-10 min para todas"
          onClick={() => setMostrarPlantilla((v) => !v)}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Una a una"
          desc="El alta de posición de siempre · ideal con pocas posiciones."
          items={['Plan de pensiones de empresa · se vincula a tu nómina', 'Participaciones (CB · sociedades) · con su % y atribución']}
          time="3 min por posición"
          onClick={() => navigate('/inversiones')}
        />
      </div>

      {mostrarPlantilla && (
        <ImportarPlantillaWizard<InversionTemplateRow>
          templateFilename="plantilla-inversiones-atlas.xlsx"
          uploadSub="Una fila por posición · revisión antes de crear nada"
          entidad="posición(es)"
          parse={parseInversionesTemplateXlsx}
          revisar={revisar}
          crear={crear}
          formatError={(e) => (e instanceof InversionesTemplateFormatError ? e.message : 'No se pudo leer el fichero')}
          onCreated={() => void refresh()}
        />
      )}
    </DobleViaLayout>
  );
};

export default InversionesBloque;
