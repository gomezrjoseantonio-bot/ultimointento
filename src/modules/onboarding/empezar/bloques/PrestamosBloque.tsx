/**
 * Pantalla 07 · Bloque préstamos · doble vía + banner de detección.
 * Plantilla Excel NUEVA (con vínculo a inmueble que cierra el pendiente del
 * semáforo) + alta manual (wizard de préstamo existente · /financiacion/nuevo).
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import ImportarPlantillaWizard, { type PlantillaRevisionView } from './ImportarPlantillaWizard';
import { useOnboarding } from '../OnboardingContext';
import {
  detectarSugerencias,
  descartarSugerencia,
  type Sugerencia,
} from '../../../../services/onboardingDetectionService';
import {
  parsePrestamosTemplateXlsx,
  PrestamosTemplateFormatError,
  type PrestamoTemplateRow,
} from '../../../../services/prestamosTemplateParserService';
import { revisarRows, crearPrestamosDesdeRows } from '../../../../services/prestamosImportCreationService';
import styles from '../empezar.module.css';

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const PrestamosBloque: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useOnboarding();
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const [banner, setBanner] = useState<Sugerencia | null>(
    (location.state as { prefill?: Sugerencia } | null)?.prefill ?? null,
  );

  // Si no llega por la pantalla de sugerencias · detectar al entrar.
  useEffect(() => {
    if (banner) return;
    let alive = true;
    void detectarSugerencias().then((sugs) => {
      const prestamo = sugs.find((s) => s.tipo === 'prestamo');
      if (alive && prestamo) setBanner(prestamo);
    });
    return () => {
      alive = false;
    };
  }, [banner]);

  const revisar = async (rows: PrestamoTemplateRow[]): Promise<PlantillaRevisionView[]> => {
    const revs = await revisarRows(rows);
    return revs.map((r) => ({
      label: r.row.nombre || '(sin nombre)',
      sub: r.valido
        ? `Principal ${r.row.principalInicial.toLocaleString('es-ES')} € · TIN ${r.row.tin}% · ${r.row.plazoMeses} meses${r.row.inmuebleRef ? ' · ' + r.row.inmuebleRef : ''}`
        : `No se creará · ${r.motivo}`,
      amount: r.row.principalInicial,
      valido: r.valido,
    }));
  };

  const crear = async (rows: PrestamoTemplateRow[]) => {
    const res = await crearPrestamosDesdeRows(rows);
    return {
      creados: res.creados,
      resumen: `${res.creados} préstamo(s) creados${res.vinculados > 0 ? ` · ${res.vinculados} vinculados a su inmueble (pendiente cerrado)` : ''}${res.errores.length ? ` · ${res.errores.length} con error` : ''}.`,
      avisos: res.errores.map((e) => `${e.nombre} · ${e.motivo}`),
    };
  };

  return (
    <DobleViaLayout
      kick="Bloque · qué debes"
      title="Tus préstamos e hipotecas"
      subtitle="Con el cuadro de cada préstamo Atlas separa solo capital e intereses · proyecta tus cuotas y deduce los intereses en tu IRPF."
    >
      {banner && (
        <div className={`${styles.sugRow} ${styles.needs}`} style={{ marginTop: 22 }}>
          <div className={styles.sugConcept}>
            <div className={styles.sugName}>Detectado en tus extractos · "{banner.nombre}"</div>
            <div className={styles.sugMeta}>{banner.meta}</div>
          </div>
          <div className={`${styles.sugAmount} ${styles.mono}`}>{eur(banner.importe)}</div>
          <div className={styles.sugPeriod}>{banner.cadencia}</div>
          <div className={styles.sugActions}>
            <button
              type="button"
              className={`${styles.btnMini} ${styles.complete}`}
              onClick={() => navigate('/financiacion/nuevo?from=empezar', { state: { prefill: banner } })}
            >
              Completar
            </button>
            <button
              type="button"
              className={`${styles.btnMini} ${styles.no}`}
              onClick={async () => {
                await descartarSugerencia(banner);
                setBanner(null);
                showToastV5('Sugerencia descartada', 'info');
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge="Recomendado con varios"
          Icon={Icons.Contratos}
          title="Plantilla Excel · en lote"
          desc="Descarga la plantilla · una fila por préstamo · súbela y Atlas crea todos con su cuadro de amortización."
          items={[
            'Nombre · inmueble vinculado · cuenta de cargo',
            'Principal inicial y vivo · TIN · plazo · día de cargo',
            'Revisión antes de crear nada',
          ]}
          time="5-10 min para todos"
          onClick={() => setMostrarPlantilla((v) => !v)}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Uno a uno"
          desc="El wizard de préstamo de siempre · con tu escritura o el cuadro del banco delante."
          items={['Ideal con 1-2 préstamos', 'Fijo · variable · mixto · con carencia']}
          time="10 min por préstamo"
          onClick={() => navigate('/financiacion/nuevo?from=empezar')}
        />
      </div>

      {mostrarPlantilla && (
        <ImportarPlantillaWizard<PrestamoTemplateRow>
          templateFilename="plantilla-prestamos-atlas.xlsx"
          uploadSub="Una fila por préstamo · revisión antes de crear nada"
          entidad="préstamo(s)"
          parse={parsePrestamosTemplateXlsx}
          revisar={revisar}
          crear={crear}
          formatError={(e) => (e instanceof PrestamosTemplateFormatError ? e.message : 'No se pudo leer el fichero')}
          onCreated={() => void refresh()}
        />
      )}

      <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>
        Vincula cada préstamo a su inmueble · así se cierra el aviso de "compra financiada sin préstamo" del semáforo
        y los intereses se deducen en el inmueble correcto.
      </div>
    </DobleViaLayout>
  );
};

export default PrestamosBloque;
