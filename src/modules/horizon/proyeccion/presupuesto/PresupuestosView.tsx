import React, { useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { AtlasButton } from '../../../../components/atlas/AtlasButton';
import PageHeader, { HeaderSecondaryButton } from '../../../../components/shared/PageHeader';
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
      <PageHeader
        icon={BarChart3}
        title="Proyección mensual"
        tabs={[
          { id: 'proyeccion', label: 'Proyección Automática' },
          { id: 'presupuesto', label: 'Crear Presupuesto' },
          { id: 'comparativa', label: 'Real vs Previsión' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as PresupuestosTab)}
        actions={activeTab === 'proyeccion' ? <HeaderSecondaryButton icon={Download} label={exporting ? 'Exportando…' : 'Exportar'} onClick={handleExport} /> : undefined}
      />

      {/* Year selector — only for projection tab */}
      {activeTab === 'proyeccion' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px 0' }}>
          <AtlasButton variant="secondary" size="sm" className="gap-2" onClick={() => setYear((value) => value - 1)}>
            <ChevronLeft size={16} />
            <span>{year - 1}</span>
          </AtlasButton>
          <span className="proyeccion-year-pill">{year}</span>
          <AtlasButton variant="secondary" size="sm" className="gap-2" onClick={() => setYear((value) => value + 1)}>
            <span>{year + 1}</span>
            <ChevronRight size={16} />
          </AtlasButton>
        </div>
      )}

      <div>{renderContent()}</div>
    </div>
  );
}
