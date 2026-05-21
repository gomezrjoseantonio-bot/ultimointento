import React from 'react';
import { Icons, MoneyValue, EmptyState, showToastV5 } from '../../../../design-system/v5';
import ContratosDrawer from './ContratosDrawer';
import drawerStyles from './ContratosDrawer.module.css';
import type { ContratoConVencimiento } from '../../utils/filtrosVencimiento';
import { formatFechaFinContrato } from '../../utils/formatFechaFin';

export type DrawerVencenVariant = 'd30' | 'd3090';

interface DrawerVencenProps {
  variant: DrawerVencenVariant;
  open: boolean;
  onClose: () => void;
  contratos: ContratoConVencimiento[];
  /** Mapa id de inmueble → alias para mostrar en filas. */
  inmuebleAliasById: Map<number, string>;
}

const COPY = {
  d30: {
    tone: 'warn' as const,
    label: 'Decisión urgente',
    titulo: 'Vencen en 30 días',
    sub: 'Decide renovar · proponer nueva renta · o buscar reposición.',
    btnFila: 'Proponer renovación',
    btnPrimary: 'Enviar renovación a todos',
    rowKpiClass: drawerStyles.rowKpiWarn,
  },
  d3090: {
    tone: 'muted' as const,
    label: 'Planificar',
    titulo: 'Vencen en 30-90 días',
    sub: 'Margen para decidir sin prisa · buen momento para reuniones con inquilinos.',
    btnFila: 'Planificar',
    btnPrimary: 'Agendar reuniones',
    rowKpiClass: drawerStyles.rowKpiMuted,
  },
};

const TOAST_PROXIMAMENTE = 'Funcionalidad disponible próximamente desde el Tablero';

const DrawerVencen: React.FC<DrawerVencenProps> = ({
  variant,
  open,
  onClose,
  contratos,
  inmuebleAliasById,
}) => {
  const copy = COPY[variant];
  const isEmpty = contratos.length === 0;
  const rentaTotal = contratos.reduce((s, c) => s + c.rentaMensual, 0);
  const minDias = contratos.length > 0 ? contratos[0].diasRestantes : 0;
  const maxDias = contratos.length > 0 ? contratos[contratos.length - 1].diasRestantes : 0;

  const stats = isEmpty
    ? undefined
    : variant === 'd30'
      ? [
          { label: 'Renta en juego', value: <MoneyValue value={rentaTotal} decimals={0} tone="ink" /> },
          { label: 'Más urgente', value: `${minDias} d` },
        ]
      : [
          { label: 'Renta mensual', value: <MoneyValue value={rentaTotal} decimals={0} tone="ink" /> },
          { label: 'Rango', value: `${minDias} – ${maxDias} d` },
        ];

  const titulo = `${copy.titulo} · ${contratos.length} ${contratos.length === 1 ? 'contrato' : 'contratos'}`;

  return (
    <ContratosDrawer
      open={open}
      onClose={onClose}
      tone={copy.tone}
      label={copy.label}
      title={titulo}
      sub={isEmpty ? undefined : copy.sub}
      stats={stats}
      footer={(
        <>
          <button type="button" className={drawerStyles.btnGhost} onClick={onClose}>
            Cerrar
          </button>
          {!isEmpty && (
            <button
              type="button"
              className={drawerStyles.btnPrimary}
              onClick={() => showToastV5(TOAST_PROXIMAMENTE)}
            >
              {copy.btnPrimary}
            </button>
          )}
        </>
      )}
    >
      {isEmpty ? (
        <EmptyState
          icon={<Icons.Success size={20} />}
          title="Sin contratos en este rango"
          sub={
            variant === 'd30'
              ? 'No hay contratos que venzan en los próximos 30 días.'
              : 'No hay contratos que venzan entre 31 y 90 días.'
          }
        />
      ) : (
        contratos.map((v) => {
          const alias = inmuebleAliasById.get(v.inmuebleId) ?? `Inmueble #${v.inmuebleId}`;
          return (
            <div className={drawerStyles.row} key={v.contrato.id}>
              <div className={drawerStyles.rowIcon}>
                <Icons.Contratos size={16} strokeWidth={1.8} />
              </div>
              <div className={drawerStyles.rowMain}>
                <div className={drawerStyles.rowTitle}>
                  {v.inquilinoNombre} · {alias}
                </div>
                <div className={drawerStyles.rowMeta}>
                  vence {formatFechaFinContrato(v.contrato.fechaFin)} · {v.modalidad} ·{' '}
                  <MoneyValue value={v.rentaMensual} decimals={0} tone="ink" /> €/mes
                </div>
              </div>
              <div className={drawerStyles.rowRight}>
                <div className={`${drawerStyles.rowKpi} ${copy.rowKpiClass}`}>
                  {v.diasRestantes} d
                </div>
                <button
                  type="button"
                  className={drawerStyles.rowBtn}
                  onClick={() => showToastV5(TOAST_PROXIMAMENTE)}
                >
                  {copy.btnFila}
                </button>
              </div>
            </div>
          );
        })
      )}
    </ContratosDrawer>
  );
};

export default DrawerVencen;
export { DrawerVencen };
