/**
 * Pantalla 04 · Bloque núcleo · inmuebles · doble vía.
 * Plantilla Excel NUEVA (acelerador · inline) + alta manual (InmueblePage).
 * Caja honestidad de la estructura de compra (mockup literal).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import ImportarPlantillaWizard, { type PlantillaRevisionView } from './ImportarPlantillaWizard';
import { useOnboarding } from '../OnboardingContext';
import {
  parseInmueblesTemplateXlsx,
  InmueblesTemplateFormatError,
  type InmuebleTemplateRow,
} from '../../../../services/inmueblesTemplateParserService';
import { revisarRows, crearInmueblesDesdeRows } from '../../../../services/inmueblesImportCreationService';
import styles from '../empezar.module.css';

const InmueblesBloque: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useOnboarding();
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const cierreLanzado = useRef(false);

  // P4 · al aterrizar en el bloque, arrancar arriba para que el topbar sticky
  // no tape el título (la navegación previa podía dejar scroll heredado).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // FIX P1 · cierre del bucle al volver de la vía manual con éxito (`?done=…`).
  // `refresh()` reejecuta syncNucleoFromData, que marca `inmuebles` completado en
  // cuanto existe ≥1 inmueble y recalcula el % (hub + widget Panel). Cancelar
  // vuelve sin `done` → no se marca nada. La vía plantilla cierra por su cuenta
  // (onCreated → refresh) mostrando su resumen inline.
  const done = searchParams.get('done');
  useEffect(() => {
    if (!done || cierreLanzado.current) return;
    cierreLanzado.current = true;
    void (async () => {
      try {
        await refresh();
        showToastV5('Inmueble guardado · bloque inmuebles completado', 'success');
      } catch {
        showToastV5('Inmueble guardado · revisa el progreso en el mapa', 'warn');
      }
      navigate('/empezar/hub', { replace: true });
    })();
  }, [done, refresh, navigate]);

  return (
    <DobleViaLayout
      kick="Bloque núcleo · qué tienes"
      title="Tus inmuebles"
      subtitle="Con la fecha y el coste de compra Atlas calcula la amortización de este año él solo. Si no lo tienes a mano · puedes completarlo después."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge="Recomendado con varios"
          Icon={Icons.Contratos}
          title="Plantilla Excel · en lote"
          desc="Descarga la plantilla · una fila por inmueble · súbela y Atlas los crea todos."
          items={[
            'Dirección · referencia catastral · modo de explotación',
            'Precio · gastos de compra · valor catastral · fecha',
            'Aportación propia e importe financiado',
            'Revisión antes de crear nada',
          ]}
          time="5-10 min para todos"
          onClick={() => setMostrarPlantilla((v) => !v)}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Uno a uno"
          desc="El formulario de inmueble de siempre · paso a paso."
          items={['Ideal con 1-2 inmuebles', 'Lo no imprescindible se completa después']}
          time="5-10 min por inmueble"
          onClick={() => navigate('/inmuebles/nuevo?from=empezar')}
        />
      </div>

      {mostrarPlantilla && (
        <ImportarPlantillaWizard<InmuebleTemplateRow>
          templateFilename="plantilla-inmuebles-atlas.xlsx"
          uploadSub="Una fila por inmueble · revisión antes de crear nada"
          entidad="inmueble(s)"
          parse={parseInmueblesTemplateXlsx}
          revisar={(rows): PlantillaRevisionView[] =>
            revisarRows(rows).map((r) => ({
              label: r.row.alias || '(sin alias)',
              sub: r.valido
                ? `${r.row.modoExplotacion === 'por_habitaciones' ? 'Por habitaciones' : 'Piso completo'}${r.avisos.length ? ' · ' + r.avisos.join(' · ') : ''}`
                : `No se creará · ${r.motivo}`,
              amount: r.row.precioCompra,
              valido: r.valido,
            }))
          }
          crear={async (rows) => {
            const res = await crearInmueblesDesdeRows(rows);
            return {
              creados: res.creados,
              resumen: `${res.creados} inmueble(s) creados${res.saltados ? ` · ${res.saltados} ya existían` : ''}${res.errores.length ? ` · ${res.errores.length} con error` : ''}.`,
              avisos: res.avisos.map((a) => `${a.alias} · ${a.aviso}`),
            };
          }}
          formatError={(e) => (e instanceof InmueblesTemplateFormatError ? e.message : 'No se pudo leer el fichero')}
          onCreated={() => void refresh()}
        />
      )}

      <div className={styles.honesty} style={{ marginTop: 16 }}>
        <strong>Estructura de compra · dato nuevo que Atlas te pide</strong>
        <ul className={styles.honestyList}>
          <li>
            <Icons.ChevronRight size={12} strokeWidth={2.5} />
            Ejemplo ·{' '}
            <span className={styles.mono}>
              precio 100.000 € · gastos 12.000 € · aportaste 32.000 € · financiaste 80.000 €
            </span>
          </li>
          <li>
            <Icons.ChevronRight size={12} strokeWidth={2.5} />
            Si financiaste · Atlas te pedirá vincular el préstamo en su bloque · y avisará en el semáforo si falta
          </li>
          <li>
            <Icons.ChevronRight size={12} strokeWidth={2.5} />
            La aportación propia se guarda para análisis futuros
          </li>
        </ul>
      </div>
    </DobleViaLayout>
  );
};

export default InmueblesBloque;
