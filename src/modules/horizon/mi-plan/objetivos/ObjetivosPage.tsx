import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, Home, Landmark, Target, Wallet, X, type LucideIcon } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { dashboardService } from '../../../../services/dashboardService';
import { getInformesData } from '../../../../services/informesDataService';
import {
  getObjetivos,
  ObjetivosFinancieros,
  resetObjetivos,
  saveObjetivos,
} from '../../../../services/objetivosService';
import styles from './ObjetivosPage.module.css';

const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type StatusTone = 'ok' | 'warn' | 'alert';

const clampProgress = (value: number): number => Math.max(0, Math.min(100, value));

interface ObjectiveCardProps {
  title: string;
  Icon: LucideIcon;
  status: StatusTone;
  objective: string;
  current: string;
  progress: number | null;
  progressInverted?: boolean;
  detail: string;
  action?: { label: string; href: string };
}

const ObjectiveCard: React.FC<ObjectiveCardProps> = ({
  title,
  Icon,
  status,
  objective,
  current,
  progress,
  progressInverted = false,
  detail,
  action,
}) => {
  const statusColor =
    status === 'ok'
      ? 'var(--ok)'
      : status === 'warn'
        ? 'var(--warn)'
        : 'var(--error)';

  const progressColor = progressInverted
    ? status === 'ok'
      ? 'var(--ok)'
      : status === 'warn'
        ? 'var(--warn)'
        : 'var(--error)'
    : 'var(--atlas-blue)';

  return (
    <article className={styles.objCard}>
      <div className={styles.objCardAccent} style={{ background: statusColor }} />

      <div className={styles.objCardBody}>
        <div className={styles.objCardHeader}>
          <span className={styles.objCardIcon} aria-hidden="true">
            <Icon size={16} />
          </span>
          <h3 className={styles.objCardTitle}>{title}</h3>
          <span className={styles.objCardDot} style={{ background: statusColor }} />
        </div>

        <div className={styles.objCardValues}>
          <div>
            <p className={styles.objCardLabel}>Objetivo</p>
            <p className={styles.objCardValue}>{objective}</p>
          </div>
          <div>
            <p className={styles.objCardLabel}>Actual</p>
            <p className={styles.objCardValue} style={{ color: statusColor }}>{current}</p>
          </div>
        </div>

        {progress !== null && (
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%`, background: progressColor }}
            />
          </div>
        )}

        <p className={styles.objCardDetail}>{detail}</p>

        {action && (
          <a href={action.href} className={styles.objCardAction}>{action.label} →</a>
        )}
      </div>
    </article>
  );
};

interface EditDrawerProps {
  obj: ObjetivosFinancieros;
  saving: boolean;
  dirty: boolean;
  onChange: <K extends keyof Omit<ObjetivosFinancieros, 'id' | 'updatedAt'>>(key: K, value: string) => void;
  onSave: () => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}

const EditDrawer: React.FC<EditDrawerProps> = ({
  obj,
  saving,
  dirty,
  onChange,
  onSave,
  onReset,
  onClose,
}) => (
  <div className={styles.drawerOverlay} onClick={onClose}>
    <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
      <div className={styles.drawerHeader}>
        <h2 className={styles.drawerTitle}>Editar objetivos</h2>
        <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Cerrar panel de edición">
          <X size={20} />
        </button>
      </div>

      <div className={styles.drawerBody}>
        <fieldset className={styles.drawerSection}>
          <legend className={styles.drawerSectionTitle}>Libertad financiera</legend>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Renta pasiva objetivo (€/mes)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={100}
              value={obj.rentaPasivaObjetivo}
              onChange={(event) => onChange('rentaPasivaObjetivo', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.drawerSection}>
          <legend className={styles.drawerSectionTitle}>Patrimonio</legend>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Patrimonio neto objetivo (€)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={10000}
              value={obj.patrimonioNetoObjetivo}
              onChange={(event) => onChange('patrimonioNetoObjetivo', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.drawerSection}>
          <legend className={styles.drawerSectionTitle}>Liquidez</legend>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Caja mínima de seguridad (€)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={1000}
              value={obj.cajaMinima}
              onChange={(event) => onChange('cajaMinima', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.drawerSection}>
          <legend className={styles.drawerSectionTitle}>Ratios bancarios</legend>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>DTI máximo (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.5}
              value={obj.dtiMaximo}
              onChange={(event) => onChange('dtiMaximo', event.target.value)}
            />
            <p className={styles.helpText}>% máximo de ingresos mensuales en cuotas de deuda</p>
          </label>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>LTV máximo (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.5}
              value={obj.ltvMaximo}
              onChange={(event) => onChange('ltvMaximo', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.drawerSection}>
          <legend className={styles.drawerSectionTitle}>Cartera inmobiliaria</legend>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Yield mínima (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.5}
              value={obj.yieldMinimaCartera}
              onChange={(event) => onChange('yieldMinimaCartera', event.target.value)}
            />
          </label>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Tasa de ahorro mínima (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.5}
              value={obj.tasaAhorroMinima}
              onChange={(event) => onChange('tasaAhorroMinima', event.target.value)}
            />
          </label>
        </fieldset>
      </div>

      <div className={styles.drawerFooter}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onSave}
          disabled={saving || !dirty}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          className={styles.textButton}
          onClick={onReset}
          disabled={saving}
        >
          Restaurar por defecto
        </button>
      </div>
    </aside>
  </div>
);

const ObjetivosPage: React.FC = () => {
  const [obj, setObj] = useState<ObjetivosFinancieros | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfActual, setCfActual] = useState(0);
  const [patrimonioActual, setPatrimonioActual] = useState(0);
  const [cajaActual, setCajaActual] = useState(0);
  const [dtiActual, setDtiActual] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const [objetivos, flujos, tesoreria, patrimonio, informes] = await Promise.all([
          getObjetivos(),
          dashboardService.getFlujosCaja(),
          dashboardService.getTesoreriaPanel(),
          dashboardService.getPatrimonioNeto(),
          getInformesData(currentYear),
        ]);

        if (!mounted) {
          return;
        }

        const monthlyIncome = informes.proyeccion.totalesAnuales.ingresosTotales / 12;
        const monthlyInstallments = informes.resumenFinanciacion.totalCuotasMensual;

        setObj(objetivos);
        setCfActual(flujos.inmuebles.cashflow);
        setPatrimonioActual(patrimonio.total);
        setCajaActual(tesoreria.totales.hoy);
        setDtiActual(monthlyIncome > 0 ? (monthlyInstallments / monthlyIncome) * 100 : 0);
        setDirty(false);
      } catch (error) {
        console.error('No se pudieron cargar los objetivos financieros', error);
        toast.error('No se pudieron cargar los objetivos financieros');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleNumberChange = <K extends keyof Omit<ObjetivosFinancieros, 'id' | 'updatedAt'>>(
    key: K,
    value: string,
  ) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;

    setObj((current) => (
      current
        ? {
            ...current,
            [key]: safeValue,
          }
        : current
    ));
    setDirty(true);
  };

  const cfStatus = useMemo<StatusTone>(() => {
    if (!obj) return 'alert';
    if (cfActual >= obj.rentaPasivaObjetivo) return 'ok';
    if (cfActual >= obj.rentaPasivaObjetivo * 0.7) return 'warn';
    return 'alert';
  }, [cfActual, obj]);

  const cajaStatus = useMemo<StatusTone>(() => {
    if (!obj) return 'alert';
    return cajaActual >= obj.cajaMinima ? 'ok' : 'alert';
  }, [cajaActual, obj]);

  const dtiStatus = useMemo<StatusTone>(() => {
    if (!obj) return 'alert';
    if (dtiActual <= obj.dtiMaximo) return 'ok';
    if (dtiActual <= obj.dtiMaximo * 1.15) return 'warn';
    return 'alert';
  }, [dtiActual, obj]);

  const patrimonioProgress = obj
    ? clampProgress((patrimonioActual / Math.max(obj.patrimonioNetoObjetivo, 1)) * 100)
    : 0;

  const handleSave = async () => {
    if (!obj) {
      return;
    }

    setSaving(true);
    try {
      const saved = await saveObjetivos(obj);
      setObj(saved);
      setDirty(false);
      toast.success('Objetivos guardados correctamente');
    } catch (error) {
      console.error('No se pudieron guardar los objetivos', error);
      toast.error('No se pudieron guardar los objetivos');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (dirty || !window.confirm('¿Restaurar los objetivos financieros por defecto?')) {
      return;
    }

    setSaving(true);
    try {
      const reset = await resetObjetivos();
      setObj(reset);
      setDirty(false);
      toast.success('Objetivos restaurados correctamente');
    } catch (error) {
      console.error('No se pudieron restaurar los objetivos', error);
      toast.error('No se pudieron restaurar los objetivos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout
        title="Mi Plan"
        subtitle="Seguimiento de tus metas financieras con datos reales de ATLAS."
      >
        <div className={styles.page}>
          <div className={`atlas-card ${styles.loading}`}>Cargando objetivos financieros...</div>
        </div>
      </PageLayout>
    );
  }

  if (!obj) {
    return (
      <PageLayout
        title="Mi Plan"
        subtitle="Seguimiento de tus metas financieras con datos reales de ATLAS."
      >
        <div className={styles.page}>
          <div className="atlas-card">No se pudieron cargar los objetivos.</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Mi Plan"
      subtitle="Seguimiento de tus metas financieras con datos reales de ATLAS."
    >
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <p className={styles.pageHeaderSub}>
              Actualizado {new Date().toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            className={styles.editButton}
            onClick={() => setEditOpen(true)}
          >
            Editar objetivos
          </button>
        </div>

        <div className={styles.cardsGrid}>
          <ObjectiveCard
            title="Libertad financiera"
            Icon={Target}
            status={cfStatus}
            objective={`${euroFormatter.format(obj.rentaPasivaObjetivo)}/mes`}
            current={`${euroFormatter.format(cfActual)}/mes`}
            progress={clampProgress((cfActual / Math.max(obj.rentaPasivaObjetivo, 1)) * 100)}
            detail={
              cfActual >= obj.rentaPasivaObjetivo
                ? `Superado en ${euroFormatter.format(cfActual - obj.rentaPasivaObjetivo)}/mes ✓`
                : `Faltan ${euroFormatter.format(obj.rentaPasivaObjetivo - cfActual)}/mes`
            }
            action={{ label: 'Simular hoja de ruta', href: '/mi-plan/libertad' }}
          />

          <ObjectiveCard
            title="Patrimonio neto"
            Icon={Wallet}
            status={
              patrimonioActual >= obj.patrimonioNetoObjetivo
                ? 'ok'
                : patrimonioActual >= obj.patrimonioNetoObjetivo * 0.7
                  ? 'warn'
                  : 'alert'
            }
            objective={euroFormatter.format(obj.patrimonioNetoObjetivo)}
            current={euroFormatter.format(patrimonioActual)}
            progress={patrimonioProgress}
            detail={
              patrimonioActual >= obj.patrimonioNetoObjetivo
                ? `Superado en ${euroFormatter.format(patrimonioActual - obj.patrimonioNetoObjetivo)} ✓`
                : `${percentFormatter.format(patrimonioProgress)}% del objetivo`
            }
          />

          <ObjectiveCard
            title="Liquidez"
            Icon={Landmark}
            status={cajaStatus}
            objective={`Mínimo ${euroFormatter.format(obj.cajaMinima)}`}
            current={euroFormatter.format(cajaActual)}
            progress={clampProgress((cajaActual / Math.max(obj.cajaMinima, 1)) * 100)}
            detail={
              cajaActual >= obj.cajaMinima
                ? 'Colchón de seguridad cubierto ✓'
                : `Déficit de ${euroFormatter.format(obj.cajaMinima - cajaActual)}`
            }
          />

          <ObjectiveCard
            title="Esfuerzo de deuda (DTI)"
            Icon={BarChart3}
            status={dtiStatus}
            objective={`Máximo ${percentFormatter.format(obj.dtiMaximo)}%`}
            current={`${percentFormatter.format(dtiActual)}%`}
            progress={clampProgress((dtiActual / Math.max(obj.dtiMaximo, 1)) * 100)}
            progressInverted
            detail={
              dtiActual <= obj.dtiMaximo
                ? `Dentro del umbral (${percentFormatter.format(obj.dtiMaximo - dtiActual)}pp de margen) ✓`
                : `Supera el umbral en ${percentFormatter.format(dtiActual - obj.dtiMaximo)}pp`
            }
          />

          <ObjectiveCard
            title="Calidad de cartera"
            Icon={Home}
            status="ok"
            objective={
              `Yield ≥ ${percentFormatter.format(obj.yieldMinimaCartera)}%  ·  Ahorro ≥ ${percentFormatter.format(obj.tasaAhorroMinima)}%`
            }
            current="Umbrales activos en informes"
            progress={null}
            detail="Estos umbrales colorean los semáforos del Informe de Solvencia y los informes PDF."
          />
        </div>

        {editOpen && (
          <EditDrawer
            obj={obj}
            saving={saving}
            dirty={dirty}
            onChange={handleNumberChange}
            onSave={async () => {
              await handleSave();
              setEditOpen(false);
            }}
            onReset={handleReset}
            onClose={() => {
              setEditOpen(false);
              setDirty(false);
            }}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default ObjetivosPage;
