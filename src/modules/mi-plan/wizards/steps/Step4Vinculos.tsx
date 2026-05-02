import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoDraft } from '../types';
import type { FondoAhorro, FondoTipo } from '../../../../types/miPlan';

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

const ICON_BY_FONDO: Record<
  FondoTipo,
  React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>
> = {
  colchon: Icons.Colchon,
  compra: Icons.Compra,
  reforma: Icons.Reforma,
  impuestos: Icons.Impuestos,
  capricho: Icons.Capricho,
  custom: Icons.Fondos,
};

const ICON_CLASS_BY_FONDO: Record<FondoTipo, string> = {
  colchon: styles.fondoIconColchon,
  compra: styles.fondoIconCompra,
  reforma: styles.fondoIconReforma,
  impuestos: styles.fondoIconImpuestos,
  capricho: styles.fondoIconCapricho,
  custom: '',
};

interface Props {
  draft: ObjetivoDraft;
  fondos: FondoAhorro[];
  saldosFondos: Record<string, number>;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
  /**
   * T27.3 (G.2 opción A) · si presente · "Crear fondo nuevo" llama a esta
   * callback en lugar de mostrar el toast de pendiente. El padre (wizard
   * objetivo) gestiona la apertura del wizard fondo y la pre-selección al
   * volver.
   */
  onCrearFondoNuevo?: () => void;
}

const Step4Vinculos: React.FC<Props> = ({
  draft,
  fondos,
  saldosFondos,
  onPatch,
  onCrearFondoNuevo,
}) => {
  const tipo = draft.tipo;
  const fondoAplicable = tipo === 'acumular' || tipo === 'comprar';

  const onSelectFondo = (id: string) => {
    if (tipo === 'acumular') {
      const saldo = saldosFondos[id] ?? 0;
      onPatch({
        fondoId: id,
        acumularValorActual: saldo > 0 ? String(Math.round(saldo)) : draft.acumularValorActual,
      });
    } else {
      onPatch({ fondoId: id });
    }
  };

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>04</span> Vínculos del objetivo
      </div>
      <div className={styles.stepSubText}>
        Conecta el objetivo a un fondo de ahorro. Esto permite que ATLAS actualice el progreso
        automáticamente cada vez que entren ingresos al fondo.
      </div>

      {!fondoAplicable && (
        <div className={styles.formSection}>
          <div className={styles.formSectionTit}>Fondo de ahorro</div>
          <div className={styles.emptyState}>
            Para objetivos de tipo <strong>{tipo === 'amortizar' ? 'Amortizar' : 'Reducir'}</strong>{' '}
            no se vincula un fondo de ahorro. El progreso se calcula desde{' '}
            {tipo === 'amortizar' ? 'el préstamo seleccionado' : 'tus movimientos categorizados'}.
            Continúa al siguiente paso.
          </div>
        </div>
      )}

      {fondoAplicable && (
        <div className={styles.formSection}>
          <div className={styles.formSectionTit}>
            Fondo de ahorro
            <span className={styles.formSectionTitNote}>· alimenta este objetivo</span>
          </div>

          {fondos.length === 0 ? (
            <div className={styles.emptyState}>
              No tienes fondos de ahorro creados. Crea uno desde{' '}
              <strong>Mi Plan · Fondos de ahorro</strong> y vuelve a este wizard.
            </div>
          ) : (
            <div className={styles.itemList}>
              {fondos.map((f) => {
                const isSel = draft.fondoId === f.id;
                const saldo = saldosFondos[f.id] ?? 0;
                const Icon = ICON_BY_FONDO[f.tipo] ?? Icons.Fondos;
                const iconCls = `${styles.fondoIcon} ${ICON_CLASS_BY_FONDO[f.tipo] ?? ''}`;
                const cuentas = f.cuentasAsignadas.length;
                const cuentasTxt =
                  cuentas === 0
                    ? 'sin cuentas asignadas'
                    : `${cuentas} cuenta${cuentas > 1 ? 's' : ''}`;
                const meta = f.metaImporte ?? 0;
                const prog = meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.item} ${isSel ? styles.itemSelectedGold : ''}`}
                    onClick={() => onSelectFondo(f.id)}
                    aria-pressed={isSel}
                  >
                    <div className={iconCls}>
                      <Icon size={16} strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className={styles.itemTit}>{f.nombre}</div>
                      <div className={styles.itemSub}>
                        {fmtEur(saldo)} · {cuentasTxt}
                      </div>
                    </div>
                    <div>
                      {prog !== null ? (
                        <>
                          <div className={styles.itemRightGoldInk}>{prog}%</div>
                          <div className={styles.itemRightLab}>progreso</div>
                        </>
                      ) : (
                        <div className={styles.itemRightLab}>sin meta</div>
                      )}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  if (onCrearFondoNuevo) onCrearFondoNuevo();
                }}
              >
                <div
                  className={styles.fondoIcon}
                  style={{ borderStyle: 'dashed', background: 'var(--atlas-v5-card)' }}
                >
                  <Icons.Plus size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <div className={styles.itemTit} style={{ color: 'var(--atlas-v5-ink-3)' }}>
                    Crear fondo nuevo
                  </div>
                  <div className={styles.itemSub}>
                    se abre el wizard de fondo · al volver lo dejamos vinculado
                  </div>
                </div>
                <div />
              </button>
            </div>
          )}

          <div className={styles.formHelp} style={{ marginTop: 10 }}>
            En T27.1 vincular un fondo es <strong>obligatorio</strong> para tipos Acumular y
            Comprar. El valor actual del objetivo se sincroniza automáticamente con el saldo
            del fondo.
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Vinculos;
