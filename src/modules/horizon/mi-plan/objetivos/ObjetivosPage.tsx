import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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

const getStatusClassName = (tone: StatusTone): string => {
  if (tone === 'ok') return styles.statusOk;
  if (tone === 'warn') return styles.statusWarn;
  return styles.statusAlert;
};

const clampProgress = (value: number): number => Math.max(0, Math.min(100, value));

const ObjetivosPage: React.FC = () => {
  const [obj, setObj] = useState<ObjetivosFinancieros | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cfActual, setCfActual] = useState(0);
  const [patrimonioActual, setPatrimonioActual] = useState(0);
  const [cajaActual, setCajaActual] = useState(0);
  const [dtiActual, setDtiActual] = useState(0);

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

  const patrimonioProgress = obj ? clampProgress((patrimonioActual / Math.max(obj.patrimonioNetoObjetivo, 1)) * 100) : 0;

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
      <PageLayout title="Objetivos" subtitle="Configura tus metas financieras y monitoriza el progreso con datos reales.">
        <div className={styles.page}>
          <div className={`atlas-card ${styles.loading}`}>Cargando objetivos financieros...</div>
        </div>
      </PageLayout>
    );
  }

  if (!obj) {
    return (
      <PageLayout title="Objetivos" subtitle="Configura tus metas financieras y monitoriza el progreso con datos reales.">
        <div className={styles.page}>
          <div className="atlas-card">No se pudieron cargar los objetivos.</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Objetivos" subtitle="Configura tus metas financieras y monitoriza el progreso con datos reales.">
      <div className={styles.page}>
        <section className={`atlas-card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Libertad financiera</h2>
          <div className={styles.sectionGrid}>
            <div className={styles.fields}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Renta pasiva objetivo (€/mes)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={100}
                  value={obj.rentaPasivaObjetivo}
                  onChange={(event) => handleNumberChange('rentaPasivaObjetivo', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.indicatorBox}>
              <div className={styles.indicatorHeader}>
                <span className={`${styles.indicatorDot} ${getStatusClassName(cfStatus)}`} />
                <p className={styles.indicatorText}>CF actual: {euroFormatter.format(cfActual)}/mes</p>
              </div>
              <p className={styles.indicatorSubtext}>Compara el cash flow inmobiliario actual frente a tu renta pasiva objetivo.</p>
            </div>
          </div>
        </section>

        <section className={`atlas-card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Patrimonio</h2>
          <div className={styles.sectionGrid}>
            <div className={styles.fields}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Patrimonio neto objetivo (€)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={1000}
                  value={obj.patrimonioNetoObjetivo}
                  onChange={(event) => handleNumberChange('patrimonioNetoObjetivo', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.indicatorBox}>
              <p className={styles.indicatorText}>Patrimonio actual: {euroFormatter.format(patrimonioActual)}</p>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${patrimonioProgress}%` }} />
              </div>
              <p className={styles.indicatorSubtext}>{percentFormatter.format(patrimonioProgress)}% del objetivo.</p>
            </div>
          </div>
        </section>

        <section className={`atlas-card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Liquidez</h2>
          <div className={styles.sectionGrid}>
            <div className={styles.fields}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Caja mínima de seguridad (€)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={500}
                  value={obj.cajaMinima}
                  onChange={(event) => handleNumberChange('cajaMinima', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.indicatorBox}>
              <div className={styles.indicatorHeader}>
                <span className={`${styles.indicatorDot} ${getStatusClassName(cajaStatus)}`} />
                <p className={styles.indicatorText}>Caja actual: {euroFormatter.format(cajaActual)}</p>
              </div>
              <p className={styles.indicatorSubtext}>Mantén una reserva por encima del umbral definido para absorber imprevistos.</p>
            </div>
          </div>
        </section>

        <section className={`atlas-card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Ratios bancarios</h2>
          <div className={styles.sectionGrid}>
            <div className={styles.fields}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>DTI máximo (%)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={0.5}
                  value={obj.dtiMaximo}
                  onChange={(event) => handleNumberChange('dtiMaximo', event.target.value)}
                />
                <p className={styles.helpText}>Porcentaje máximo de ingresos mensuales destinado a cuotas de deuda</p>
              </label>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>LTV máximo (%)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={0.5}
                  value={obj.ltvMaximo}
                  onChange={(event) => handleNumberChange('ltvMaximo', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.indicatorBox}>
              <div className={styles.indicatorHeader}>
                <span className={`${styles.indicatorDot} ${getStatusClassName(dtiStatus)}`} />
                <p className={styles.indicatorText}>DTI actual: {percentFormatter.format(dtiActual)}%</p>
              </div>
              <p className={styles.indicatorSubtext}>El semáforo usa tu umbral personalizado para señalar el nivel de esfuerzo mensual de deuda.</p>
            </div>
          </div>
        </section>

        <section className={`atlas-card ${styles.card}`}>
          <h2 className={styles.sectionTitle}>Cartera inmobiliaria</h2>
          <div className={styles.sectionGrid}>
            <div className={styles.fields}>
              <label className={styles.fieldGroup}>
                <span className={styles.label}>Yield mínima de cartera (%)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={0.5}
                  value={obj.yieldMinimaCartera}
                  onChange={(event) => handleNumberChange('yieldMinimaCartera', event.target.value)}
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
                  onChange={(event) => handleNumberChange('tasaAhorroMinima', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.indicatorBox}>
              <p className={styles.indicatorText}>Objetivos de calidad de cartera</p>
              <p className={styles.indicatorSubtext}>Usa estos umbrales en tus decisiones de inversión y en los informes exportados desde ATLAS.</p>
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <button className={styles.primaryButton} type="button" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Guardando objetivos...' : 'Guardar objetivos'}
          </button>
          {!dirty && (
            <button className={styles.textButton} type="button" onClick={handleReset} disabled={saving}>
              Restaurar valores por defecto
            </button>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default ObjetivosPage;
