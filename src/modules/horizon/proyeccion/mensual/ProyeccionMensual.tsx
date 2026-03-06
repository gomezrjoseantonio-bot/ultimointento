// src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx
// ATLAS HORIZON: Monthly financial projection page (Phase 1)

import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { generateProyeccionMensual } from './services/proyeccionMensualService';
import type { ProyeccionAnual, MonthlyProjectionRow } from './types/proyeccionMensual';
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

type SectionKey = 'ingresos' | 'gastos' | 'financiacion' | 'tesoreria' | 'patrimonio';

interface ExportRowDef {
  label: string;
  getValue: (m: MonthlyProjectionRow) => number;
  isTotal?: boolean;
}

const EXPORT_SECTION_ROWS: Record<SectionKey, ExportRowDef[]> = {
  ingresos: [
    { label: 'Nóminas', getValue: m => m.ingresos.nomina },
    { label: 'Ingresos Autónomos', getValue: m => m.ingresos.serviciosFreelance },
    { label: 'Pensiones', getValue: m => m.ingresos.pensiones },
    { label: 'Rentas alquiler', getValue: m => m.ingresos.rentasAlquiler },
    { label: 'Intereses Inversiones', getValue: m => m.ingresos.dividendosInversiones },
    { label: 'Otros ingresos', getValue: m => m.ingresos.otrosIngresos },
    { label: 'Total ingresos', getValue: m => m.ingresos.total, isTotal: true },
  ],
  gastos: [
    { label: 'Gastos Alquileres', getValue: m => m.gastos.gastosOperativos },
    { label: 'Gastos personales', getValue: m => m.gastos.gastosPersonales },
    { label: 'Gastos autónomo', getValue: m => m.gastos.gastosAutonomo },
    { label: 'IRPF devengado', getValue: m => m.gastos.irpfDevengado },
    { label: 'IRPF a pagar (trim.)', getValue: m => m.gastos.irpfAPagar },
    { label: 'Total gastos', getValue: m => m.gastos.total, isTotal: true },
  ],
  financiacion: [
    { label: 'Cuotas hipotecas', getValue: m => m.financiacion.cuotasHipotecas },
    { label: 'Cuotas préstamos', getValue: m => m.financiacion.cuotasPrestamos },
    { label: 'Total financiación', getValue: m => m.financiacion.total, isTotal: true },
  ],
  tesoreria: [
    { label: 'Flujo caja del mes', getValue: m => m.tesoreria.flujoCajaMes },
    { label: 'Caja inicial', getValue: m => m.tesoreria.cajaInicial },
    { label: 'Caja final', getValue: m => m.tesoreria.cajaFinal, isTotal: true },
  ],
  patrimonio: [
    { label: 'Caja', getValue: m => m.patrimonio.caja },
    { label: 'Inmuebles', getValue: m => m.patrimonio.inmuebles },
    { label: 'Planes de pensión', getValue: m => m.patrimonio.planesPension },
    { label: 'Otras inversiones', getValue: m => m.patrimonio.otrasInversiones },
    { label: 'Deuda inmuebles', getValue: m => -m.patrimonio.deudaInmuebles },
    { label: 'Deuda personal', getValue: m => -m.patrimonio.deudaPersonal },
    { label: 'Deuda total', getValue: m => -m.patrimonio.deudaTotal },
    { label: 'Patrimonio neto', getValue: m => m.patrimonio.patrimonioNeto, isTotal: true },
  ],
};


const SECTION_ORDER: SectionKey[] = ['ingresos', 'gastos', 'financiacion', 'tesoreria', 'patrimonio'];

const SECTION_LABELS: Record<SectionKey, string> = {
  ingresos: 'INGRESOS',
  gastos: 'GASTOS',
  financiacion: 'FINANCIACIÓN',
  tesoreria: 'TESORERÍA',
  patrimonio: 'PATRIMONIO',
};

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

  const handleExportToExcel = useCallback(() => {
    if (!currentProjection) {
      return;
    }

    const header = [
      'ATRIBUTO',
      ...currentProjection.months.map((_, i) => `${MONTH_ABBR[i]}-${String(selectedYear).slice(2)}`),
    ];

    const sheetData: (string | number)[][] = [header];

    SECTION_ORDER.forEach(sectionKey => {
      sheetData.push([SECTION_LABELS[sectionKey], ...Array(currentProjection.months.length).fill('')]);

      EXPORT_SECTION_ROWS[sectionKey].forEach(row => {
        if (!row.isTotal && currentProjection.months.every(m => row.getValue(m) === 0)) {
          return;
        }

        sheetData.push([
          row.label,
          ...currentProjection.months.map(m => Math.round(row.getValue(m))),
        ]);
      });
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    worksheet['!cols'] = [
      { wch: 24 },
      ...currentProjection.months.map(() => ({ wch: 12 })),
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      for (let col = range.s.c + 1; col <= range.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0';
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, `Proyección ${selectedYear}`);
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
              title="Descargar proyección en formato Excel (.xlsx)"
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
              patrimonioNeto={currentProjection.totalesAnuales.patrimonioNetoFinal}
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
