// src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx
// ATLAS HORIZON: Monthly financial projection page (Phase 1)

import React, { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { generateProyeccionMensual } from './services/proyeccionMensualService';
import type { MonthlyProjectionRow, ProyeccionAnual } from './types/proyeccionMensual';
import MonthlyProjectionTable from './components/MonthlyProjectionTable';
import YearSelector from './components/YearSelector';
import SummaryCards from './components/SummaryCards';

const START_YEAR = new Date().getFullYear();
const PROJECTION_YEARS = 20;

const ALL_YEARS = Array.from(
  { length: PROJECTION_YEARS },
  (_, i) => START_YEAR + i,
);

const MONTH_ABBR = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

interface ExportRowDef {
  label: string | ((year: number) => string);
  getValue: (m: MonthlyProjectionRow) => number;
  isTotal?: boolean;
  specialBg?: 'total' | 'highlight';
  highlight?: 'positive-negative';
}

interface ExportSectionDef {
  label: string;
  rows: ExportRowDef[];
}

const EXPORT_SECTIONS: ExportSectionDef[] = [
  {
    label: 'INGRESOS',
    rows: [
      { label: 'Nóminas', getValue: m => m.ingresos.nomina },
      { label: 'Ingresos Autónomos', getValue: m => m.ingresos.serviciosFreelance },
      { label: 'Pensiones', getValue: m => m.ingresos.pensiones },
      { label: 'Rentas alquiler', getValue: m => m.ingresos.rentasAlquiler },
      { label: 'Intereses Inversiones', getValue: m => m.ingresos.dividendosInversiones },
      { label: 'Otros ingresos', getValue: m => m.ingresos.otrosIngresos },
      { label: 'Total ingresos', getValue: m => m.ingresos.total, isTotal: true, specialBg: 'total' },
    ],
  },
  {
    label: 'GASTOS',
    rows: [
      { label: 'Gastos Alquileres', getValue: m => m.gastos.gastosOperativos },
      { label: 'Gastos personales', getValue: m => m.gastos.gastosPersonales },
      { label: 'Gastos autónomo', getValue: m => m.gastos.gastosAutonomo },
      { label: (year) => `IRPF ${year - 1}`, getValue: m => m.gastos.irpf },
      { label: 'Total gastos', getValue: m => m.gastos.total, isTotal: true, specialBg: 'total' },
    ],
  },
  {
    label: 'FINANCIACIÓN',
    rows: [
      { label: 'Cuotas hipotecas', getValue: m => m.financiacion.cuotasHipotecas },
      { label: 'Cuotas préstamos', getValue: m => m.financiacion.cuotasPrestamos },
      { label: 'Total financiación', getValue: m => m.financiacion.total, isTotal: true, specialBg: 'total' },
    ],
  },
  {
    label: 'TESORERÍA',
    rows: [
      {
        label: 'Flujo caja del mes',
        getValue: m => m.tesoreria.flujoCajaMes,
        highlight: 'positive-negative',
      },
      { label: 'Caja inicial', getValue: m => m.tesoreria.cajaInicial },
      { label: 'Caja final', getValue: m => m.tesoreria.cajaFinal, isTotal: true, specialBg: 'highlight' },
    ],
  },
];

const ProyeccionMensual: React.FC = () => {
  const [proyecciones, setProyecciones] = useState<ProyeccionAnual[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(START_YEAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateProyeccionMensual();
      setProyecciones(data);
    } catch (err) {
      console.error('[ProyeccionMensual] Error loading projections:', err);
      setError(
        'No se pudieron calcular las proyecciones. Verifica que tienes datos configurados en los módulos de Nómina, Inmuebles y Préstamos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentProjection = proyecciones.find(p => p.year === selectedYear);

  const handleExportToExcel = useCallback(async () => {
    if (!currentProjection) {
      return;
    }

    const XLSXStyle = await import('sheetjs-style');
    const XLSX = (XLSXStyle.default ?? XLSXStyle) as any;

    const headerRow = [
      'ATRIBUTO',
      ...currentProjection.months.map((_, i) => `${MONTH_ABBR[i]}-${String(selectedYear).slice(2)}`),
    ];

    const sheetData: (string | number)[][] = [headerRow];
    const rowMeta: Array<{ kind: 'header' | 'section' | 'value'; rowDef?: ExportRowDef }> = [
      { kind: 'header' },
    ];

    EXPORT_SECTIONS.forEach(section => {
      sheetData.push([section.label, ...Array(currentProjection.months.length).fill('')]);
      rowMeta.push({ kind: 'section' });

      section.rows.forEach(row => {
        if (!row.isTotal && currentProjection.months.every(m => row.getValue(m) === 0)) {
          return;
        }

        const rowLabel = typeof row.label === 'function'
          ? row.label(currentProjection.year)
          : row.label;
        sheetData.push([rowLabel, ...currentProjection.months.map(m => row.getValue(m))]);
        rowMeta.push({ kind: 'value', rowDef: row });
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    const monthCols = currentProjection.months.length;
    const totalCols = monthCols + 1;
    worksheet['!cols'] = [{ wch: 32 }, ...Array(monthCols).fill({ wch: 12 })];

    const borders = {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    };

    const baseStyle = {
      border: borders,
      font: { name: 'Calibri', sz: 11, color: { rgb: '1F2937' } },
      alignment: { vertical: 'center', horizontal: 'right' },
    };

    rowMeta.forEach((meta, rowIndex) => {
      const excelRow = rowIndex + 1;
      for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = worksheet[ref] ?? { t: 's', v: '' };
        const isLabelCol = colIndex === 0;

        const style: any = {
          ...baseStyle,
          alignment: {
            ...baseStyle.alignment,
            horizontal: isLabelCol ? 'left' : 'right',
          },
        };

        if (!isLabelCol && meta.kind === 'value') {
          style.numFmt = '#,##0';
        }

        if (meta.kind === 'header') {
          style.font = { ...style.font, bold: true, color: { rgb: '374151' } };
          style.fill = { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } };
        }

        if (meta.kind === 'section') {
          style.font = { ...style.font, bold: true, color: { rgb: '374151' } };
          style.fill = { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } };
          style.border = {
            ...borders,
            top: { style: 'medium', color: { rgb: 'D1D5DB' } },
          };
        }

        if (meta.kind === 'value' && meta.rowDef?.specialBg === 'total') {
          style.fill = { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } };
          style.font = { ...style.font, bold: true };
        }

        if (meta.kind === 'value' && meta.rowDef?.specialBg === 'highlight') {
          style.fill = { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } };
          style.font = { ...style.font, bold: true };
        }

        if (meta.kind === 'value' && !meta.rowDef?.specialBg && meta.rowDef?.isTotal) {
          style.font = { ...style.font, bold: true };
        }

        if (meta.kind === 'value' && !isLabelCol && meta.rowDef?.highlight === 'positive-negative') {
          const value = Number(cell.v ?? 0);
          if (value > 0) {
            style.font = { ...style.font, color: { rgb: '15803D' }, bold: true };
          } else if (value < 0) {
            style.font = { ...style.font, color: { rgb: 'DC2626' }, bold: true };
          }
        }

        if (meta.kind === 'value' && !isLabelCol && Number(cell.v ?? 0) < 0 && meta.rowDef?.highlight !== 'positive-negative') {
          style.font = { ...style.font, color: { rgb: 'DC2626' }, bold: style.font?.bold };
        }

        cell.s = style;
        worksheet[ref] = cell;
      }

      worksheet['!rows'] = worksheet['!rows'] || [];
      worksheet['!rows'][rowIndex] = { hpt: excelRow === 1 ? 22 : 20 };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedYear}`);
    XLSX.writeFile(workbook, `proyeccion_mensual_${selectedYear}.xlsx`);
  }, [currentProjection, selectedYear]);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proyección Mensual</h1>
        <p className="mt-1 text-sm text-gray-500">
          Proyección financiera detallada basada en tu situación actual
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <span className="text-sm">Calculando proyecciones…</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && proyecciones.length > 0 && (
        <>
          {/* Controls: year selector + export */}
          <div className="flex items-center justify-between">
            <YearSelector
              selectedYear={selectedYear}
              years={ALL_YEARS}
              onChange={setSelectedYear}
            />
            <button
              onClick={handleExportToExcel}
              disabled={!currentProjection}
              title="Descargar proyección en formato Excel"
              className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Exportar a Excel
            </button>
          </div>

          {/* Summary cards */}
          {currentProjection && (
            <SummaryCards
              ingresos={currentProjection.totalesAnuales.ingresosTotales}
              gastos={currentProjection.totalesAnuales.gastosTotales}
              flujoNeto={currentProjection.totalesAnuales.flujoNetoAnual}
            />
          )}

          {/* Projection table */}
          {currentProjection ? (
            <MonthlyProjectionTable projection={currentProjection} />
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center text-sm text-yellow-800">
              No hay datos de proyección para el año {selectedYear}.
            </div>
          )}
        </>
      )}

      {/* Empty state (no data, no error) */}
      {!loading && !error && proyecciones.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-gray-500 text-sm">
            No se encontraron datos para generar la proyección. Configura al menos una
            nómina, contrato de alquiler o préstamo para ver resultados.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProyeccionMensual;
