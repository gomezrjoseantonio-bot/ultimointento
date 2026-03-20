import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from 'lucide-react';
import { AtlasButton } from '../../../../components/atlas/AtlasButton';
import ProyeccionAutomaticaView from './components/ProyeccionAutomaticaView';
import type { ProyeccionMensualData } from './types/ProyeccionData';
import ProyeccionPresupuesto from './ProyeccionPresupuesto';
import ProyeccionComparativa from '../comparativa/ProyeccionComparativa';
import './components/proyeccion-automatica.css';

type PresupuestosTab = 'proyeccion' | 'presupuesto' | 'comparativa';

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const formatNumber = (value: number) => (value === 0 ? '—' : Math.round(value));

export default function PresupuestosView() {
  const [activeTab, setActiveTab] = useState<PresupuestosTab>('proyeccion');
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [projectionData, setProjectionData] = useState<ProyeccionMensualData | null>(null);
  const [exporting, setExporting] = useState(false);

  const tabs = useMemo(() => [
    { id: 'proyeccion' as const, label: 'Proyección Automática', icon: Activity },
    { id: 'presupuesto' as const, label: 'Crear Presupuesto', icon: Plus },
    { id: 'comparativa' as const, label: 'Real vs Previsión', icon: ArrowLeftRight },
  ], []);

  const handleExport = async () => {
    if (!projectionData || exporting) return;

    setExporting(true);

    try {
      const XLSXStyle = await import('sheetjs-style');
      const XLSX = (XLSXStyle.default ?? XLSXStyle) as any;

      const rows: (string | number)[][] = [
        ['ATRIBUTO', ...MONTH_ABBR.map((month) => `${month}-${String(year).slice(2)}`), 'TOTAL'],
        ['INGRESOS', ...Array(13).fill('')],
        ['Nóminas', ...projectionData.nominas.map(formatNumber), formatNumber(projectionData.nominas.reduce((acc, value) => acc + value, 0))],
        ['Ingresos Autónomos', ...projectionData.autonomos.map(formatNumber), formatNumber(projectionData.autonomos.reduce((acc, value) => acc + value, 0))],
        ['Rentas alquiler', ...projectionData.alquiler.map(formatNumber), formatNumber(projectionData.alquiler.reduce((acc, value) => acc + value, 0))],
        ['Intereses Inversiones', ...projectionData.intereses.map(formatNumber), formatNumber(projectionData.intereses.reduce((acc, value) => acc + value, 0))],
        ['Otros ingresos', ...projectionData.otrosIngresos.map(formatNumber), formatNumber(projectionData.otrosIngresos.reduce((acc, value) => acc + value, 0))],
        ['Total ingresos', ...projectionData.totalIngresos.map(formatNumber), formatNumber(projectionData.totalIngresos.reduce((acc, value) => acc + value, 0))],
        ['GASTOS', ...Array(13).fill('')],
        ['Gastos Alquileres', ...projectionData.gastosAlquileres.map(formatNumber), formatNumber(projectionData.gastosAlquileres.reduce((acc, value) => acc + value, 0))],
        ['Gastos personales', ...projectionData.gastosPersonales.map(formatNumber), formatNumber(projectionData.gastosPersonales.reduce((acc, value) => acc + value, 0))],
        ['Gastos autónomo', ...projectionData.gastosAutonomo.map(formatNumber), formatNumber(projectionData.gastosAutonomo.reduce((acc, value) => acc + value, 0))],
        [`IRPF ${year}`, ...projectionData.irpf.map(formatNumber), formatNumber(projectionData.irpf.reduce((acc, value) => acc + value, 0))],
        ['Total gastos', ...projectionData.totalGastos.map(formatNumber), formatNumber(projectionData.totalGastos.reduce((acc, value) => acc + value, 0))],
        ['FINANCIACIÓN', ...Array(13).fill('')],
        ['Cuotas hipotecas', ...projectionData.hipotecas.map(formatNumber), formatNumber(projectionData.hipotecas.reduce((acc, value) => acc + value, 0))],
        ['Cuotas préstamos', ...projectionData.prestamos.map(formatNumber), formatNumber(projectionData.prestamos.reduce((acc, value) => acc + value, 0))],
        ['Total financiación', ...projectionData.totalFinanciacion.map(formatNumber), formatNumber(projectionData.totalFinanciacion.reduce((acc, value) => acc + value, 0))],
        ['TESORERÍA', ...Array(13).fill('')],
        ['Flujo caja del mes', ...projectionData.flujoCaja.map(formatNumber), formatNumber(projectionData.flujoCaja.reduce((acc, value) => acc + value, 0))],
        ['Caja inicial', ...projectionData.cajaInicial.map(formatNumber), '—'],
        ['Caja final', ...projectionData.cajaFinal.map(formatNumber), formatNumber(projectionData.cajaFinal[11] ?? 0)],
      ];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = [{ wch: 28 }, ...Array(12).fill({ wch: 12 }), { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, `Proyeccion ${year}`);
      XLSX.writeFile(workbook, `proyeccion_automatica_${year}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'proyeccion':
        return <ProyeccionAutomaticaView year={year} onDataReady={setProjectionData} />;
      case 'presupuesto':
        return <ProyeccionPresupuesto />;
      case 'comparativa':
        return <ProyeccionComparativa />;
      default:
        return null;
    }
  };

  return (
    <div className="proyeccion-automatica-page">
      <section className="proyeccion-hero">
        <div className="proyeccion-hero__intro">
          <div className="proyeccion-hero__icon">
            <BarChart3 size={40} />
          </div>
          <div>
            <p className="proyeccion-hero__eyebrow">Horizon · Presupuesto</p>
            <h1 className="proyeccion-hero__title">Proyección Mensual</h1>
          </div>
        </div>

        {activeTab === 'proyeccion' ? (
          <div className="proyeccion-hero__actions">
            <AtlasButton variant="secondary" size="sm" className="gap-2" onClick={() => setYear((value) => value - 1)}>
              <ChevronLeft size={16} />
              <span>{year - 1}</span>
            </AtlasButton>
            <span className="proyeccion-year-pill">{year}</span>
            <AtlasButton variant="secondary" size="sm" className="gap-2" onClick={() => setYear((value) => value + 1)}>
              <span>{year + 1}</span>
              <ChevronRight size={16} />
            </AtlasButton>
            <AtlasButton variant="secondary" size="sm" className="gap-2" onClick={handleExport} disabled={!projectionData || exporting}>
              <Download size={16} />
              <span>{exporting ? 'Exportando…' : 'Exportar'}</span>
            </AtlasButton>
          </div>
        ) : null}
      </section>

      <nav className="proyeccion-tabs" aria-label="Navegación de presupuesto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`proyeccion-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div>{renderContent()}</div>
    </div>
  );
}
