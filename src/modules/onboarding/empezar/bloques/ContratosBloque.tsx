/**
 * Pantalla 03 · Bloque núcleo · contratos · doble vía.
 * REUTILIZA sin cambios los pasos internos del importador
 * (`/inmuebles/importar-contratos`) y del wizard de nuevo contrato
 * (`/contratos/nuevo`): solo les pasa `?from=empezar` para que SEPAN volver.
 *
 * FIX P1/P2 · al confirmar el import o guardar el contrato, los wizards vuelven
 * a `/empezar/contratos?done=…`; aquí se cierra el bucle: se marca el bloque
 * `contratos` completado, se recalcula el % (toast) y se vuelve al mapa. Al
 * cancelar vuelven a `/empezar/contratos` sin `done` → bloque sin marcar.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import { useOnboarding } from '../OnboardingContext';
import styles from '../empezar.module.css';

const ContratosBloque: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useOnboarding();
  const cierreLanzado = useRef(false);

  // FIX P2 · cierre del bucle al volver de una vía con éxito (`?done=…`).
  // `refresh()` reejecuta syncNucleoFromData, que marca `contratos` completado
  // en cuanto existe ≥1 contrato y recalcula el % (hub + widget Panel).
  const done = searchParams.get('done');
  useEffect(() => {
    if (!done || cierreLanzado.current) return;
    cierreLanzado.current = true;
    void (async () => {
      await refresh();
      showToastV5('Contratos guardados · bloque contratos completado', 'success');
      navigate('/empezar/hub', { replace: true });
    })();
  }, [done, refresh, navigate]);

  return (
    <DobleViaLayout
      kick="Bloque núcleo · quién te paga"
      title="Tus contratos vigentes"
      subtitle="Los contratos encienden las rentas previstas de todo el año. Elige tu vía · puedes combinar las dos."
    >
      <div className={styles.viaGrid}>
        <ViaCard
          variant="recommended"
          badge="Recomendado"
          Icon={Icons.Upload}
          title="Importar de una vez"
          desc="Sube tu export de Rentila o la plantilla Excel de Atlas con todos tus contratos."
          items={[
            'Multi-fichero · activos y archivados',
            'Detecta inmueble y habitación solos',
            'Revisión antes de crear nada',
          ]}
          time="2-5 min para todos"
          onClick={() => navigate('/inmuebles/importar-contratos?from=empezar')}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Uno a uno"
          desc="El asistente de contrato de siempre · inquilino · renta · fechas · tipo y reducción."
          items={['Sin ficheros · ideal con pocos contratos', 'Atlas te sugiere la reducción IRPF']}
          time="5 min por contrato"
          onClick={() => navigate('/contratos/nuevo?from=empezar')}
        />
      </div>
    </DobleViaLayout>
  );
};

export default ContratosBloque;
