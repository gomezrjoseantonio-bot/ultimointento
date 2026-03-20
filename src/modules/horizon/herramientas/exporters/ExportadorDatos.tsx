import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  exportarCarteraInmuebles,
  exportarFiscal,
  exportarPrestamos,
  exportarProyeccionMensual,
  exportarTesoreria,
} from './atlasExportService';
import styles from './ExportadorDatos.module.css';

type ExportState = 'idle' | 'loading' | 'error';

type ExportKey = 'proyeccion' | 'cartera' | 'fiscal' | 'prestamos' | 'tesoreria';

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const TESORERIA_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

const ExportadorDatos: React.FC = () => {
  const [states, setStates] = useState<Record<ExportKey, ExportState>>({
    proyeccion: 'idle',
    cartera: 'idle',
    fiscal: 'idle',
    prestamos: 'idle',
    tesoreria: 'idle',
  });
  const [errors, setErrors] = useState<Partial<Record<ExportKey, string>>>({});
  const [añoProyeccion, setAñoProyeccion] = useState(CURRENT_YEAR);
  const [añoFiscal, setAñoFiscal] = useState(CURRENT_YEAR);
  const [mesesTesoreria, setMesesTesoreria] = useState(6);

  const handleExport = async (key: ExportKey, fn: () => Promise<void>) => {
    setStates((prev) => ({ ...prev, [key]: 'loading' }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      await fn();
      setStates((prev) => ({ ...prev, [key]: 'idle' }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      setStates((prev) => ({ ...prev, [key]: 'error' }));
      setErrors((prev) => ({ ...prev, [key]: msg }));
    }
  };

  const cards = useMemo(() => ([
    {
      key: 'proyeccion' as const,
      title: 'Proyección mensual',
      description: 'Ingresos, gastos, financiación, tesorería y patrimonio mes a mes.',
      controls: (
        <select
          className={styles.select}
          value={añoProyeccion}
          onChange={(event) => setAñoProyeccion(Number(event.target.value))}
          aria-label="Seleccionar año de proyección"
        >
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      ),
      onClick: () => handleExport('proyeccion', () => exportarProyeccionMensual(añoProyeccion)),
    },
    {
      key: 'cartera' as const,
      title: 'Cartera inmobiliaria',
      description: 'Todos los activos con coste, valor, plusvalía, renta, hipoteca y datos fiscales.',
      controls: null,
      onClick: () => handleExport('cartera', exportarCarteraInmuebles),
    },
    {
      key: 'fiscal' as const,
      title: 'Cuadro fiscal',
      description: 'Resumen IRPF, rendimientos por inmueble y calendario de pagos del ejercicio.',
      controls: (
        <select
          className={styles.select}
          value={añoFiscal}
          onChange={(event) => setAñoFiscal(Number(event.target.value))}
          aria-label="Seleccionar año fiscal"
        >
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      ),
      onClick: () => handleExport('fiscal', () => exportarFiscal(añoFiscal)),
    },
    {
      key: 'prestamos' as const,
      title: 'Préstamos y financiación',
      description: 'Todos los préstamos activos con cuadro de amortización del año en curso.',
      controls: null,
      onClick: () => handleExport('prestamos', exportarPrestamos),
    },
    {
      key: 'tesoreria' as const,
      title: 'Movimientos de tesorería',
      description: 'Extracto de movimientos de todas las cuentas.',
      controls: (
        <select
          className={styles.select}
          value={mesesTesoreria}
          onChange={(event) => setMesesTesoreria(Number(event.target.value))}
          aria-label="Seleccionar período de tesorería"
        >
          {TESORERIA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
      onClick: () => handleExport('tesoreria', () => exportarTesoreria(mesesTesoreria)),
    },
  ]), [añoFiscal, añoProyeccion, mesesTesoreria]);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Exportar datos</h2>
        <p className={styles.subtitle}>
          Descarga tus datos en formato Excel para análisis externo, informes o auditoría.
        </p>
      </div>

      <div className={styles.grid}>
        {cards.map((card) => {
          const isLoading = states[card.key] === 'loading';
          return (
            <article key={card.key} className={styles.card}>
              <div className={styles.iconRow}>
                <span className={styles.iconWrap}>
                  <FileSpreadsheet size={20} />
                </span>
                <div>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardDescription}>{card.description}</p>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={card.onClick}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={16} className={styles.spinner} /> : <FileSpreadsheet size={16} />}
                  Descargar Excel
                </button>
                {card.controls}
              </div>

              {errors[card.key] ? <p className={styles.error}>{errors[card.key]}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ExportadorDatos;
