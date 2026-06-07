/**
 * Pantalla 03 · Bloque núcleo · contratos · doble vía.
 * REUTILIZA sin cambios el importador (`/inmuebles/importar-contratos`) y el
 * wizard de nuevo contrato (`/contratos/nuevo`).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import DobleViaLayout from './DobleViaLayout';
import ViaCard from './ViaCard';
import styles from '../empezar.module.css';

const ContratosBloque: React.FC = () => {
  const navigate = useNavigate();
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
          onClick={() => navigate('/inmuebles/importar-contratos')}
        />
        <ViaCard
          variant="manual"
          Icon={Icons.Edit}
          title="Uno a uno"
          desc="El asistente de contrato de siempre · inquilino · renta · fechas · tipo y reducción."
          items={['Sin ficheros · ideal con pocos contratos', 'Atlas te sugiere la reducción IRPF']}
          time="5 min por contrato"
          onClick={() => navigate('/contratos/nuevo')}
        />
      </div>
    </DobleViaLayout>
  );
};

export default ContratosBloque;
