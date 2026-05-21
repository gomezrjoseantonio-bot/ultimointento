import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, MoneyValue, EmptyState } from '../../../../design-system/v5';
import ContratosDrawer from './ContratosDrawer';
import drawerStyles from './ContratosDrawer.module.css';
import type { ResultadoLibresAhora } from '../../utils/calcularLibresAhora';

interface DrawerLibresProps {
  open: boolean;
  onClose: () => void;
  data: ResultadoLibresAhora;
}

const DrawerLibres: React.FC<DrawerLibresProps> = ({ open, onClose, data }) => {
  const navigate = useNavigate();
  const goToWizard = (inmuebleId?: number): void => {
    onClose();
    if (inmuebleId != null) {
      navigate(`/contratos/nuevo?inmueble=${inmuebleId}`);
    } else {
      navigate('/contratos/nuevo');
    }
  };

  const isEmpty = data.total === 0;

  return (
    <ContratosDrawer
      open={open}
      onClose={onClose}
      tone="neg"
      label="Requieren atención"
      title={`Libres ahora · ${data.total} ${data.total === 1 ? 'unidad' : 'unidades'}`}
      sub={isEmpty
        ? undefined
        : 'Unidades sin contrato activo · generando renta perdida a diario'}
      stats={isEmpty ? undefined : [
        {
          label: 'Días totales',
          value: `${data.diasTotalesAcumulados} d`,
        },
        {
          label: 'Renta perdida',
          value: (
            <MoneyValue value={-data.rentaPerdidaAcumulada} decimals={0} tone="neg" />
          ),
        },
      ]}
      footer={(
        <>
          <button type="button" className={drawerStyles.btnGhost} onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className={drawerStyles.btnPrimary}
            onClick={() => goToWizard()}
          >
            <Icons.Plus size={13} strokeWidth={2} />
            Nuevo contrato
          </button>
        </>
      )}
    >
      {isEmpty ? (
        <EmptyState
          icon={<Icons.Success size={20} />}
          title="Todo ocupado"
          sub="No hay unidades libres en este momento."
        />
      ) : (
        data.unidades.map((u, idx) => (
          <div className={drawerStyles.row} key={`${u.inmuebleId}-${idx}`}>
            <div className={drawerStyles.rowIcon}>
              <Icons.Inmuebles size={16} strokeWidth={1.8} />
            </div>
            <div className={drawerStyles.rowMain}>
              <div className={drawerStyles.rowTitle}>
                {u.unidadLabel} · {u.inmuebleAlias}
              </div>
              <div className={drawerStyles.rowMeta}>
                {u.diasLibre != null
                  ? `libre ${u.diasLibre} ${u.diasLibre === 1 ? 'día' : 'días'}`
                  : 'sin contrato previo'}
                {u.rentaPotencial != null && (
                  <>
                    {' · renta ref. '}
                    <MoneyValue value={u.rentaPotencial} decimals={0} tone="ink" />
                    {' €/mes'}
                  </>
                )}
              </div>
            </div>
            <div className={drawerStyles.rowRight}>
              {u.rentaPerdidaAcumulada != null && u.rentaPerdidaAcumulada > 0 && (
                <div className={`${drawerStyles.rowKpi} ${drawerStyles.rowKpiNeg}`}>
                  <MoneyValue value={-u.rentaPerdidaAcumulada} decimals={0} tone="neg" />
                </div>
              )}
              <button
                type="button"
                className={drawerStyles.rowBtn}
                onClick={() => goToWizard(u.inmuebleId)}
              >
                + Nuevo contrato
              </button>
            </div>
          </div>
        ))
      )}
    </ContratosDrawer>
  );
};

export default DrawerLibres;
export { DrawerLibres };
