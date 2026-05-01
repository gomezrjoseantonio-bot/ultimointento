// T23.6.3 · Wizard "Nueva posición" v5 · 11/12 tipos + dispatcher PlanFormV5 vs PosicionFormV5.
//
// Paso 1 · Grid 4 columnas con tarjetas seleccionables agrupadas:
//   - PLANES PENSIONES: Plan PP individual · Plan PP empresa
//   - EQUITY / FONDOS: Acciones · ETF · REIT · Fondo inversión
//   - RENTA FIJA / CRÉDITO: Préstamo P2P · Préstamo a empresa · Depósito a plazo · Cuenta remunerada
//   - OTROS: Crypto · Otro
//   + 2 atajos: [Importar IndexaCapital] · [Importar aportaciones]
//
// Paso 2 · Dispatcher:
//   - Plan PP individual / empresa → <PlanFormV5> con tipoAdministrativoInicial pre-seleccionado
//   - Resto → <PosicionFormV5> con tipoInicial pre-seleccionado
//
// Submit:
//   - PlanFormV5 escribe en planesPensionesService internamente · llama onPlanSaved()
//   - PosicionFormV5 delega en onSavePosicion() → inversionesService en InversionesGaleria
//
// Reglas inviolables · NUNCA mezclar destinos (planes vs inversiones).

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import type { PosicionInversion } from '../../../types/inversiones';
import type { PlanPensiones, TipoAdministrativo } from '../../../types/planesPensiones';
import PlanFormV5 from './wizard/PlanFormV5';
import PosicionFormV5, { type TipoUI_V5 } from './wizard/PosicionFormV5';
import styles from './WizardModal.module.css';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoWizard =
  | 'plan_pensiones'
  | 'plan_empleo'
  | TipoUI_V5;

interface Props {
  onSavePosicion: (
    data: Partial<PosicionInversion> & { importe_inicial?: number },
  ) => Promise<void | boolean> | void | boolean;
  /** Llamado cuando PlanFormV5 guarda con éxito · para recargar la galería. */
  onPlanSaved?: () => void;
  onClose: () => void;
}

// ── Configuración de grupos y tipos ──────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;

interface TipoConfig {
  key: TipoWizard;
  title: string;
  icon: LucideIcon;
}

interface GrupoConfig {
  label: string;
  tipos: TipoConfig[];
}

const GRUPOS: GrupoConfig[] = [
  {
    label: 'Planes pensiones',
    tipos: [
      { key: 'plan_pensiones', title: 'Plan PP individual', icon: Icons.PiggyBank },
      { key: 'plan_empleo', title: 'Plan PP empresa', icon: Icons.PiggyBank },
    ],
  },
  {
    label: 'Equity / Fondos',
    tipos: [
      { key: 'accion', title: 'Acciones', icon: Icons.ArrowUpRight },
      { key: 'etf', title: 'ETF', icon: Icons.Rendimientos },
      { key: 'reit', title: 'REIT', icon: Icons.Inmuebles },
      { key: 'fondo_inversion', title: 'Fondo inversión', icon: Icons.Fondos },
    ],
  },
  {
    label: 'Renta fija / Crédito',
    tipos: [
      { key: 'prestamo_p2p', title: 'Préstamo P2P', icon: Icons.Banknote },
      { key: 'prestamo_empresa', title: 'Préstamo empresa', icon: Icons.Banknote },
      { key: 'deposito_plazo', title: 'Depósito a plazo', icon: Icons.Financiacion },
      { key: 'cuenta_remunerada', title: 'Cuenta remunerada', icon: Icons.Tesoreria },
    ],
  },
  {
    label: 'Otros',
    tipos: [
      { key: 'crypto', title: 'Crypto', icon: Icons.Bitcoin },
      { key: 'otro', title: 'Otro', icon: Icons.Tag },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const esTipoPlan = (t: TipoWizard): t is 'plan_pensiones' | 'plan_empleo' =>
  t === 'plan_pensiones' || t === 'plan_empleo';

const tipoAdminFromWizard = (t: 'plan_pensiones' | 'plan_empleo'): TipoAdministrativo =>
  t === 'plan_empleo' ? 'PPE' : 'PPI';

// ── Componente ────────────────────────────────────────────────────────────────

const WizardNuevaPosicion: React.FC<Props> = ({ onSavePosicion, onPlanSaved, onClose }) => {
  const navigate = useNavigate();
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoWizard | null>(null);

  // Focus trap activo solo en paso 1
  const focusTrapRef = useFocusTrap(tipoSeleccionado === null);
  useEffect(() => {
    const node = focusTrapRef.current;
    if (!node) return;
    const handler = () => onClose();
    node.addEventListener('modal-escape', handler);
    return () => node.removeEventListener('modal-escape', handler);
  }, [focusTrapRef, onClose, tipoSeleccionado]);

  // ── Paso 2 · Plan PP ────────────────────────────────────────────────────

  if (tipoSeleccionado !== null && esTipoPlan(tipoSeleccionado)) {
    return (
      <PlanFormV5
        tipoAdministrativoInicial={tipoAdminFromWizard(tipoSeleccionado)}
        onSaved={(plan: PlanPensiones) => {
          onPlanSaved?.();
          onClose();
          // plan guardado · la galería ya recargó vía onPlanSaved
          void plan;
        }}
        onClose={onClose}
      />
    );
  }

  // ── Paso 2 · Posición no-plan ────────────────────────────────────────────

  if (tipoSeleccionado !== null && !esTipoPlan(tipoSeleccionado)) {
    return (
      <PosicionFormV5
        tipoInicial={tipoSeleccionado as TipoUI_V5}
        onSave={async (data) => {
          try {
            const result = await onSavePosicion(data);
            if (result === false) return;
            onClose();
          } catch {
            /* InversionesGaleria ya muestra toast de error */
          }
        }}
        onClose={onClose}
      />
    );
  }

  // ── Paso 1 · Selector de tipo ────────────────────────────────────────────

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      onClick={onClose}
    >
      <div
        ref={focusTrapRef}
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <h2 id="wizard-title" className={styles.modalTitle}>
              Nueva posición
            </h2>
            <div className={styles.modalSub}>
              ¿Qué tipo de posición quieres añadir?
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icons.Close size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Grid 4 columnas · tipos agrupados */}
        <div className={styles.gruposGrid}>
          {GRUPOS.map((grupo) => (
            <div key={grupo.label} className={styles.grupo}>
              <div className={styles.grupoLabel}>{grupo.label}</div>
              {grupo.tipos.map(({ key, title, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={styles.tipoCard}
                  onClick={() => setTipoSeleccionado(key)}
                >
                  <span className={styles.tipoCardIcon}>
                    <Icon size={14} strokeWidth={1.8} />
                  </span>
                  <span className={styles.tipoCardTitle}>{title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Atajos · importadores */}
        <div className={styles.atajos}>
          <button
            type="button"
            className={styles.atajo}
            onClick={() => {
              onClose();
              navigate('/inversiones/importar-indexa');
            }}
          >
            Importar IndexaCapital
          </button>
          <button
            type="button"
            className={styles.atajo}
            onClick={() => {
              onClose();
              navigate('/inversiones/importar-aportaciones');
            }}
          >
            Importar aportaciones
          </button>
        </div>
      </div>
    </div>
  );
};

export default WizardNuevaPosicion;

