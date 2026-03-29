import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, Download, FileText, Receipt, TrendingUp, Wallet, CreditCard } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import styles from './InformesPage.module.css';
import { informesDataService } from '../../../services/informesDataService';
import { generateDashboard } from './generators/generateDashboard';
import { generatePatrimonio } from './generators/generatePatrimonio';
import { generateSolvencia } from './generators/generateSolvencia';
import { generateFiscal } from './generators/generateFiscal';
import { generateCartera } from './generators/generateCartera';
import { generatePrestamos } from './generators/generatePrestamos';
import { generateLibertad } from './generators/generateLibertad';
import { generateTesoreria } from './generators/generateTesoreria';

type ReportKey = 'dashboard' | 'solvencia' | 'patrimonio' | 'fiscal' | 'cartera' | 'prestamos' | 'libertad' | 'tesoreria';

interface ReportDefinition {
  key: ReportKey;
  name: string;
  description: string;
  sections: string[];
  icon: typeof FileText;
}

const REPORTS: ReportDefinition[] = [
  {
    key: 'dashboard',
    name: 'Dashboard Ejecutivo',
    description: 'Resumen anual en una página: KPIs, flujo mensual y tabla de proyección.',
    sections: [
      'KPIs anuales de ingresos, gastos, flujo neto y patrimonio.',
      'Tabla mensual completa de proyección de caja.',
      'Formato A4 horizontal listo para compartir.',
    ],
    icon: BarChart3,
  },
  {
    key: 'solvencia',
    name: 'Informe de Solvencia',
    description: '3 páginas para presentar al banco: ratios, ingresos, cartera y financiación.',
    sections: [
      'Portada con titular, métricas clave y resumen ejecutivo.',
      'Perfil financiero con ratios bancarios y desglose de ingresos.',
      'Cartera inmobiliaria, hipotecas y préstamos vigentes.',
    ],
    icon: FileText,
  },
  {
    key: 'patrimonio',
    name: 'Informe Patrimonial',
    description: 'Composición y evolución del patrimonio neto. Activos, pasivos y equity.',
    sections: [
      'Resumen patrimonial con composición de activos y pasivos.',
      'Evolución mensual del patrimonio neto.',
      'Detalle inmobiliario y evolución de la deuda.',
    ],
    icon: Building2,
  },
  {
    key: 'fiscal',
    name: 'Cuadro Fiscal Anual',
    description: 'Resumen IRPF, rendimientos por inmueble y calendario de pagos del ejercicio.',
    sections: [
      'Resumen completo de la declaración IRPF con resultado a pagar o devolver.',
      'Detalle de rendimientos por inmueble con reducción 60% aplicada.',
      'Calendario de pagos: Modelo 130 trimestral y fraccionamiento de la declaración.',
    ],
    icon: Receipt,
  },
  {
    key: 'cartera',
    name: 'Informe de Cartera Inmobiliaria',
    description: 'Rentabilidad, datos fiscales y proyección a 10 años de los activos activos.',
    sections: [
      'KPIs de cartera: valor, equity, LTV, renta, yield y cash flow mensual.',
      'Datos fiscales y catastrales por inmueble activo.',
      'Proyección de valor, equity y deuda a 10 años con hipótesis conservadoras.',
    ],
    icon: Building2,
  },
  {
    key: 'prestamos',
    name: 'Informe de Préstamos',
    description: 'Coste total de financiación, calendario de vencimientos y estrategia de cancelación.',
    sections: [
      'Resumen de deuda hipotecaria y personal con intereses pendientes estimados.',
      'Calendario de vencimientos y coste anual por año.',
      'Estrategia de cancelación anticipada ordenada por ahorro real.',
    ],
    icon: CreditCard,
  },
  {
    key: 'libertad',
    name: 'Proyección de Libertad Financiera',
    description: 'Simulación de bola de nieve inmobiliaria hasta alcanzar tu objetivo de renta pasiva.',
    sections: [
      'Situación actual: CF de alquileres, ahorro mensual y capital líquido.',
      'Hoja de ruta de hitos hasta alcanzar 3.000 €/mes en renta pasiva.',
      'Escenarios de sensibilidad y palancas de aceleración.',
    ],
    icon: TrendingUp,
  },
  {
    key: 'tesoreria',
    name: 'Informe de Tesorería',
    description: 'Panel de cuentas bancarias y extracto de movimientos de los últimos 6 meses.',
    sections: [
      'Saldo actual, proyección de fin de mes y flujos pendientes por cuenta.',
      'Resumen mensual de ingresos y gastos de los últimos 6 meses.',
      'Extracto de los 50 movimientos más recientes.',
    ],
    icon: Wallet,
  },
];

const currentYear = new Date().getFullYear();
const availableYears = [currentYear, currentYear - 1, currentYear - 2];

const InformesPage: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportKey | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [año, setAño] = useState<number>(currentYear);

  const selectedDefinition = useMemo(
    () => REPORTS.find((report) => report.key === selectedReport) ?? null,
    [selectedReport],
  );

  const handleSelectReport = (report: ReportKey): void => {
    setSelectedReport(report);
    setError(null);
  };

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setAño(Number(event.target.value));
    setSelectedReport(null);
    setError(null);
    setLoading(false);
  };

  const handleDownload = async (): Promise<void> => {
    if (!selectedReport) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await informesDataService.getInformesData(año);

      if (selectedReport === 'dashboard') {
        await generateDashboard(data);
      } else if (selectedReport === 'solvencia') {
        await generateSolvencia(data);
      } else if (selectedReport === 'fiscal') {
        await generateFiscal(data);
      } else if (selectedReport === 'cartera') {
        await generateCartera(data);
      } else if (selectedReport === 'prestamos') {
        await generatePrestamos(data);
      } else if (selectedReport === 'libertad') {
        await generateLibertad(data);
      } else if (selectedReport === 'tesoreria') {
        await generateTesoreria(data);
      } else {
        await generatePatrimonio(data);
      }

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo generar el PDF.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Informes"
        icon={FileText}
      />

      <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor="informes-year" style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>Año:</label>
        <select id="informes-year" className={styles.yearSelect} value={año} onChange={handleYearChange}>
          {availableYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Informes disponibles</h2>
          <div className={styles.reportList}>
            {REPORTS.map((report) => {
              const Icon = report.icon;
              const selected = report.key === selectedReport;
              return (
                <button
                  key={report.key}
                  type="button"
                  className={`${styles.reportCard} ${selected ? styles.reportCardSelected : ''}`.trim()}
                  onClick={() => handleSelectReport(report.key)}
                >
                  <span className={styles.iconWrap}>
                    <Icon size={20} />
                  </span>
                  <span className={styles.reportContent}>
                    <span className={styles.reportTitle}>{report.name}</span>
                    <span className={styles.reportDescription}>{report.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.panel}>
          {selectedDefinition ? (
            <>
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>{selectedDefinition.name}</h2>
                <p className={styles.detailDescription}>{selectedDefinition.description}</p>
                <p className={styles.meta}>Ejercicio seleccionado: {año}</p>
              </div>

              <ul className={styles.detailList}>
                {selectedDefinition.sections.map((section) => (
                  <li key={section}>{section}</li>
                ))}
              </ul>

              <div className={styles.actions}>
                <button type="button" className={styles.button} onClick={handleDownload} disabled={loading}>
                  {loading ? <span className={styles.spinner} aria-hidden="true" /> : <Download size={18} />}
                  {loading ? 'Generando PDF…' : 'Descargar PDF'}
                </button>
                {error ? <p className={styles.error}>{error}</p> : null}
              </div>
            </>
          ) : (
            <div className={styles.placeholder}>
              <p className={styles.placeholderText}>
                Selecciona un informe para ver su alcance y descargar el PDF del ejercicio elegido.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InformesPage;
