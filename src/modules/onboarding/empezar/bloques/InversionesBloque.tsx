/**
 * Pantalla 09 · Bloque inversiones · doble vía.
 * Plantilla Excel NUEVA (posiciones + valoración inicial) + alta manual
 * (galería de inversiones existente · /inversiones).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import ImportarPlantillaWizard, { type PlantillaRevisionView } from './ImportarPlantillaWizard';
import { useOnboarding } from '../OnboardingContext';
import {
  parseInversionesTemplateXlsx,
  InversionesTemplateFormatError,
  type FamiliaInversionTemplate,
  type InversionTemplateRow,
} from '../../../../services/inversionesTemplateParserService';
import { revisarRows, crearInversionesDesdeRows } from '../../../../services/inversionesImportCreationService';
import styles from '../empezar.module.css';

const FAMILIA_LABEL: Record<FamiliaInversionTemplate, string> = {
  plan_pensiones: 'Plan de pensiones',
  fondo: 'Fondo',
  accion_etf_reit: 'Acción/ETF/REIT',
  prestamo_activo: 'Préstamo',
  deposito_cuenta: 'Depósito/cuenta',
  crypto: 'Crypto',
  otro: 'Otro',
};

const InversionesBloque: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useOnboarding();
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const cierreLanzado = useRef(false);

  // Al aterrizar en el bloque, arrancar arriba (el topbar sticky no tapa el título).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // FIX P1/P2 · cierre del bucle al volver de la vía manual o de un importador
  // con éxito (`?done=…`). `refresh()` reejecuta syncNucleoFromData, que marca
  // `inversiones` completado en cuanto existe ≥1 posición y recalcula el %.
  // Cancelar vuelve sin `done` → no se marca nada. La vía plantilla cierra por
  // su cuenta (onCreated → refresh) mostrando su resumen inline.
  const done = searchParams.get('done');
  useEffect(() => {
    if (!done || cierreLanzado.current) return;
    cierreLanzado.current = true;
    void (async () => {
      try {
        await refresh();
        showToastV5('Posición guardada · bloque inversiones completado', 'success');
      } catch {
        showToastV5('Posición guardada · revisa el progreso en el mapa', 'warn');
      }
      navigate('/empezar/hub', { replace: true });
    })();
  }, [done, refresh, navigate]);

  const revisar = (rows: InversionTemplateRow[]): PlantillaRevisionView[] =>
    revisarRows(rows).map((r) => ({
      label: r.row.producto || '(sin producto)',
      sub: r.valido ? `${FAMILIA_LABEL[r.row.tipo]} · ${r.row.entidad ?? '—'}${r.row.unidades ? ' · ' + r.row.unidades + ' uds' : ''}` : `No se creará · ${r.motivo}`,
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
          onClick={() => navigate('/inversiones?from=empezar')}
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
