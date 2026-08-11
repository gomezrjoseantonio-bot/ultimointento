import React, { useMemo, useState } from 'react';
import type { Contract, Property } from '../../../../services/db';
import { EmptyState, Icons } from '../../../../design-system/v5';
import {
  filtrarContratos,
  FILTROS_INICIALES,
} from '../../utils/filtrosActivos';
import { useFiltrosActivos } from '../../hooks/useFiltrosActivos';
import ToolbarVigentes from './ToolbarVigentes';
import TablaActivos from './TablaActivos';
import EmptyStateSinResultados from './EmptyStateSinResultados';
import DrawerFichaContrato from './DrawerFichaContrato';

export interface TabActivosProps {
  contratos: Contract[];
  inmuebleAliasById: Map<number, string>;
  inmuebleModoById?: Map<number, Property['modoExplotacion']>;
  onNuevoContrato: () => void;
  /** Fase F.2 · recarga la lista tras renovar/finalizar desde el drawer. */
  onContratoActualizado?: () => void;
  /** Corregir un error · editar el contrato (abre el wizard en modo edición). */
  onEditarContrato?: (id: number) => void;
  /** Corregir un error · eliminar el contrato (con cascada + confirmación). */
  onEliminarContrato?: (contrato: Contract & { id: number }) => void;
}

const TabActivos: React.FC<TabActivosProps> = ({
  contratos,
  inmuebleAliasById,
  inmuebleModoById,
  onNuevoContrato,
  onContratoActualizado,
  onEditarContrato,
  onEliminarContrato,
}) => {
  const [filtros, setFiltros] = useFiltrosActivos();
  const hoy = useMemo(() => new Date(), []);

  const filtrados = useMemo(
    () => filtrarContratos(contratos, filtros, hoy),
    [contratos, filtros, hoy],
  );

  // Inmuebles con contratos vigentes · alimentan el selector del toolbar.
  const inmuebles = useMemo<Array<[number, string]>>(() => {
    const ids = new Set<number>();
    contratos.forEach((c) => ids.add(c.inmuebleId));
    return Array.from(ids)
      .map((id): [number, string] => [id, inmuebleAliasById.get(id) ?? `#${id}`])
      .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [contratos, inmuebleAliasById]);

  const [contratoAbierto, setContratoAbierto] = useState<
    (Contract & { id: number }) | null
  >(null);

  const algunFiltroActivo =
    filtros.busqueda.trim() !== '' || filtros.inmueble !== 'todos';

  // Caso 1 · NO hay contratos activos en absoluto · empty state global del módulo
  if (contratos.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Contratos size={20} />}
        title="Sin contratos activos"
        sub="No hay contratos en vigor a fecha de hoy."
        ctaLabel="+ nuevo contrato"
        onCtaClick={onNuevoContrato}
      />
    );
  }

  return (
    <>
      <ToolbarVigentes
        filtros={filtros}
        onChange={setFiltros}
        inmuebles={inmuebles}
      />
      {filtrados.length === 0 && algunFiltroActivo ? (
        <EmptyStateSinResultados onLimpiar={() => setFiltros(FILTROS_INICIALES)} />
      ) : (
        <TablaActivos
          contratos={filtrados}
          inmuebleAliasById={inmuebleAliasById}
          inmuebleModoById={inmuebleModoById}
          onAbrirFicha={setContratoAbierto}
        />
      )}
      {contratoAbierto && (
        <DrawerFichaContrato
          contrato={contratoAbierto}
          inmuebleAlias={inmuebleAliasById.get(contratoAbierto.inmuebleId)}
          open
          onClose={() => setContratoAbierto(null)}
          onContratoActualizado={onContratoActualizado}
          onEditarContrato={onEditarContrato}
          onEliminarContrato={onEliminarContrato}
        />
      )}
    </>
  );
};

export default TabActivos;
export { TabActivos };
