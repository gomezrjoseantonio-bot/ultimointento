import React, { useState } from 'react';
import { EmptyState, Icons } from '../../../../../design-system/v5';
import type { Contract, Property } from '../../../../../services/db';
import PanelAnalitico from './PanelAnalitico';
import TablaExInquilinos from './TablaExInquilinos';
import DrawerExContrato from './DrawerExContrato';
import styles from './TabHistorico.module.css';

export interface TabHistoricoProps {
  contratos: Contract[];
  properties: Property[];
  inmuebleAliasById: Map<number, string>;
  onEliminar?: (c: Contract & { id: number }) => void;
}

const TabHistorico: React.FC<TabHistoricoProps> = ({
  contratos,
  properties,
  inmuebleAliasById,
  onEliminar,
}) => {
  const [contratoAbierto, setContratoAbierto] = useState<Contract | null>(null);

  if (contratos.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Archivo size={20} />}
        title="Sin contratos finalizados"
        sub="Cuando termines o archives un contrato aparecerá aquí su histórico, junto con el análisis de rotación y duración."
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <PanelAnalitico contratos={contratos} properties={properties} />

      <section className={styles.tablaSection}>
        <h3 className={styles.tablaTitle}>Contratos finalizados</h3>
        <TablaExInquilinos
          contratos={contratos}
          inmuebleAliasById={inmuebleAliasById}
          onAbrir={setContratoAbierto}
          onEliminar={onEliminar}
        />
      </section>

      {contratoAbierto && (
        <DrawerExContrato
          contrato={contratoAbierto}
          inmuebleAlias={inmuebleAliasById.get(contratoAbierto.inmuebleId)}
          open
          onClose={() => setContratoAbierto(null)}
        />
      )}
    </div>
  );
};

export default TabHistorico;
export { TabHistorico };
