import React, { useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { eliminarCompromiso } from '../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../services/treasuryBootstrapService';
import { ListadoGastosRecurrentes } from '../../../modules/shared/components/ListadoGastos';
import { TIPOS_GASTO_PERSONAL } from '../wizards/utils/tiposDeGastoPersonal';
import type { PersonalOutletContext } from '../PersonalContext';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

const GastosPage: React.FC = () => {
  const navigate = useNavigate();
  const { compromisos, reload } = useOutletContext<PersonalOutletContext>();

  const personalCompromisos = compromisos.filter((c) => c.ambito === 'personal');

  const handleDelete = useCallback(
    async (c: CompromisoRecurrente) => {
      if (!c.id) return;
      await eliminarCompromiso(c.id);
      await regenerateForecastsForward({ force: true }).catch(() => {});
      reload();
    },
    [reload],
  );

  return (
    <ListadoGastosRecurrentes
      catalog={TIPOS_GASTO_PERSONAL}
      compromisos={personalCompromisos}
      mode="personal"
      onEdit={(c) => navigate(`/personal/gastos/${c.id}/editar`)}
      onDelete={handleDelete}
      onReload={reload}
    />
  );
};

export default GastosPage;
