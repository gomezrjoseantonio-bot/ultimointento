import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, Download, FileText } from 'lucide-react';
import styles from './InformesPage.module.css';
import { informesDataService } from '../../../services/informesDataService';
import { generateDashboard } from './generators/generateDashboard';
import { generatePatrimonio } from './generators/generatePatrimonio';
import { generateSolvencia } from './generators/generateSolvencia';

type ReportKey = 'dashboard' | 'solvencia' | 'patrimonio';

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
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Informes</h1>
          <p className={styles.subtitle}>
            Genera PDFs estándar con datos reales de ATLAS Horizon para compartir, archivar o revisar.
          </p>
        </div>

        <div className={styles.yearControl}>
          <label htmlFor="informes-year" className={styles.yearLabel}>Año del informe</label>
          <select id="informes-year" className={styles.yearSelect} value={año} onChange={handleYearChange}>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
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
