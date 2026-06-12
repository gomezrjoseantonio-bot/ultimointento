// Selector "Nueva posición" · 6 familias · NO 12 tipos
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html líneas 2606-2678
// Spec · TAREA-CC-T-INVERSIONES-V5 §5.2
//
// Patrón ATLAS · header navy + cuerpo sin preview + footer con 2 hints.
// Cada card abre el wizard de alta de la familia correspondiente.
// PR 2 · los handlers dispatch al wizard legacy (PlanFormV5 / PosicionFormV5)
// con tipo preseleccionado · PR 3 los reemplaza por los nuevos modales.

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, { ModalAtlasButtonGhost } from './ModalAtlasFooter';
import shellStyles from '../../styles/atlas-inversiones.module.css';

export type Familia =
  | 'plan'
  | 'fondo'
  | 'accion'
  | 'prestamo'
  | 'deposito'
  | 'crypto';

export interface SelectorNuevaPosicionProps {
  /** Llamado tras seleccionar una familia · el padre decide qué wizard abrir. */
  onPickFamilia: (f: Familia) => void;
  onClose: () => void;
}

interface FamiliaCard {
  key: Familia;
  label: string;
  sub: string;
  icon: React.ReactNode;
}

const ICON_PROPS = { size: 22, strokeWidth: 1.6 } as const;

const FAMILIAS: FamiliaCard[] = [
  {
    key: 'plan',
    label: 'Plan de pensiones',
    sub: 'PPI · PPE · PPES · PPA',
    icon: <Icons.PiggyBank {...ICON_PROPS} />,
  },
  {
    key: 'fondo',
    label: 'Fondo de inversión',
    sub: 'FI español o UCITS · art. 94',
    icon: <Icons.Fondos {...ICON_PROPS} />,
  },
  {
    key: 'accion',
    label: 'Acción / ETF / REIT',
    sub: 'valores cotizados en bolsa',
    icon: <Icons.ArrowUpRight {...ICON_PROPS} />,
  },
  {
    key: 'prestamo',
    label: 'Préstamo',
    sub: 'P2P o a empresa',
    icon: <Icons.Banknote {...ICON_PROPS} />,
  },
  {
    key: 'deposito',
    label: 'Depósito o cuenta',
    sub: 'plazo fijo o remunerada · FGD',
    icon: <Icons.Tesoreria {...ICON_PROPS} />,
  },
  {
    key: 'crypto',
    label: 'Crypto u otros',
    sub: 'exchanges, carteras frías, oro',
    icon: <Icons.Bitcoin {...ICON_PROPS} />,
  },
];

const SelectorNuevaPosicion: React.FC<SelectorNuevaPosicionProps> = ({
  onPickFamilia,
  onClose,
}) => {
  const navigate = useNavigate();
  // FIX onboarding PUNTO 7 (P1) · si venimos de /empezar, propagamos
  // `?from=empezar` al importador para que sepa volver al flujo. La navegación
  // desmonta el modal · no se llama a `onClose()` antes (evita que el padre
  // interprete un "cancelar" y navegue a otro sitio).
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';
  const suffix = fromEmpezar ? '?from=empezar' : '';

  const handleIndexa = () => {
    showToastV5('Importer Indexa Capital · planes de pensiones');
    navigate(`/inversiones/importar-indexa${suffix}`);
  };

  const handleCSV = () => {
    showToastV5('Importer aportaciones · CSV genérico');
    navigate(`/inversiones/importar-aportaciones${suffix}`);
  };

  return (
    <ModalAtlas
      onClose={onClose}
      size="noPreview"
      ariaLabel="Nueva posición · selector de familia"
    >
      <ModalAtlasHeader
        icon={<Icons.Plus size={18} strokeWidth={2} />}
        title="Nueva posición"
        subtitle="elige la familia · el wizard te guía con los subtipos"
        onClose={onClose}
      />
      <ModalAtlasBody>
        <ModalAtlasForm>
          <div className={shellStyles.section}>
            <div className={shellStyles.sectionTitle}>
              ¿Qué tipo de activo quieres añadir?
            </div>
            <div
              className={`${shellStyles.selectorH} ${shellStyles.cols3}`}
              role="group"
              aria-label="Familias de posiciones"
            >
              {FAMILIAS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={shellStyles.tab}
                  onClick={() => onPickFamilia(f.key)}
                  data-familia={f.key}
                >
                  <span className={shellStyles.tabIcon}>{f.icon}</span>
                  <span className={shellStyles.tabLabel}>{f.label}</span>
                  <span className={shellStyles.tabSub}>{f.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </ModalAtlasForm>
      </ModalAtlasBody>
      <ModalAtlasFooter
        info={
          <>
            <Icons.Info size={13} strokeWidth={2} />
            O importa una cartera completa desde tu broker
          </>
        }
        actions={
          <>
            <ModalAtlasButtonGhost onClick={handleIndexa} data-action="import-indexa">
              <Icons.Download size={13} strokeWidth={2} /> Indexa Capital
            </ModalAtlasButtonGhost>
            <ModalAtlasButtonGhost onClick={handleCSV} data-action="import-csv">
              <Icons.Contratos size={13} strokeWidth={2} /> Aportaciones CSV
            </ModalAtlasButtonGhost>
          </>
        }
      />
    </ModalAtlas>
  );
};

export default SelectorNuevaPosicion;
