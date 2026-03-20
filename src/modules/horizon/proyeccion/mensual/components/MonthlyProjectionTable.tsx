// src/modules/horizon/proyeccion/mensual/components/MonthlyProjectionTable.tsx
// ATLAS HORIZON: Monthly projection table with collapsible sections

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatInteger } from '../../../../../utils/formatUtils';
import { ProyeccionAnual, MonthlyProjectionRow, DrillDownItem } from '../types/proyeccionMensual';

interface MonthlyProjectionTableProps {
  projection: ProyeccionAnual;
}

const MONTH_ABBR = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

type SectionKey = 'ingresos' | 'gastos' | 'financiacion' | 'tesoreria';

interface SectionConfig {
  label: string;
  bg: string;
  headerText: string;
  totalBg: string;
}

const SECTIONS: Record<SectionKey, SectionConfig> = {
  ingresos: {
    label: 'INGRESOS',
    bg: 'bg-gray-50',
    headerText: 'text-gray-700',
    totalBg: 'bg-gray-100',
  },
  gastos: {
    label: 'GASTOS',
    bg: 'bg-gray-50',
    headerText: 'text-gray-700',
    totalBg: 'bg-gray-100',
  },
  financiacion: {
    label: 'FINANCIACIÓN',
    bg: 'bg-gray-50',
    headerText: 'text-gray-700',
    totalBg: 'bg-gray-100',
  },
  tesoreria: {
    label: 'TESORERÍA',
    bg: 'bg-gray-50',
    headerText: 'text-gray-700',
    totalBg: 'bg-gray-100',
  },
};

function formatValue(value: number, highlight?: 'positive-negative'): React.ReactNode {
  const formatted = formatInteger(value);
  if (highlight === 'positive-negative') {
    return (
      <span className={value < 0 ? 'text-red-600' : value > 0 ? 'text-green-700' : ''}>
        {formatted}
      </span>
    );
  }

  return <span className={value < 0 ? 'text-red-600' : ''}>{formatted}</span>;
}

interface RowDef {
  label: string | ((year: number) => string);
  getValue: (m: MonthlyProjectionRow) => number;
  isTotal?: boolean;
  highlight?: 'positive-negative';
  specialBg?: string;
  bold?: boolean;
  getDrillDownItems?: (m: MonthlyProjectionRow) => DrillDownItem[];
  drillDownGroupKey?: 'concepto' | 'fuente';
}

const SECTION_ROWS: Record<SectionKey, RowDef[]> = {
  ingresos: [
    {
      label: 'Nóminas',
      getValue: m => m.ingresos.nomina,
      getDrillDownItems: m => m.ingresos.drillDown?.nomina ?? [],
    },
    {
      label: 'Ingresos Autónomos',
      getValue: m => m.ingresos.serviciosFreelance,
      getDrillDownItems: m => m.ingresos.drillDown?.autonomos ?? [],
    },
    {
      label: 'Pensiones',
      getValue: m => m.ingresos.pensiones,
      getDrillDownItems: m => m.ingresos.drillDown?.pensiones ?? [],
    },
    {
      label: 'Rentas alquiler',
      getValue: m => m.ingresos.rentasAlquiler,
      getDrillDownItems: m => m.ingresos.drillDown?.rentasAlquiler ?? [],
      drillDownGroupKey: 'fuente',
    },
    { label: 'Intereses Inversiones', getValue: m => m.ingresos.dividendosInversiones },
    {
      label: 'Otros ingresos',
      getValue: m => m.ingresos.otrosIngresos,
      getDrillDownItems: m => m.ingresos.drillDown?.otrosIngresos ?? [],
    },
    {
      label: 'Total ingresos',
      getValue: m => m.ingresos.total,
      isTotal: true,
      bold: true,
    },
  ],
  gastos: [
    {
      label: 'Gastos Alquileres',
      getValue: m => m.gastos.gastosOperativos,
      getDrillDownItems: m => m.gastos.drillDown?.gastosOperativos ?? [],
      drillDownGroupKey: 'fuente',
    },
    { label: 'Gastos personales', getValue: m => m.gastos.gastosPersonales },
    {
      label: 'Gastos autónomo',
      getValue: m => m.gastos.gastosAutonomo,
      getDrillDownItems: m => m.gastos.drillDown?.gastosAutonomo ?? [],
    },
    {
      label: year => `IRPF ${year - 1}`,
      getValue: m => m.gastos.irpf,
    },
    {
      label: 'Total gastos',
      getValue: m => m.gastos.total,
      isTotal: true,
      bold: true,
    },
  ],
  financiacion: [
    { label: 'Cuotas hipotecas', getValue: m => m.financiacion.cuotasHipotecas },
    { label: 'Cuotas préstamos', getValue: m => m.financiacion.cuotasPrestamos },
    {
      label: 'Total financiación',
      getValue: m => m.financiacion.total,
      isTotal: true,
      bold: true,
    },
  ],
  tesoreria: [
    {
      label: 'Flujo caja del mes',
      getValue: m => m.tesoreria.flujoCajaMes,
      highlight: 'positive-negative',
      bold: true,
    },
    { label: 'Caja inicial', getValue: m => m.tesoreria.cajaInicial },
    {
      label: 'Caja final',
      getValue: m => m.tesoreria.cajaFinal,
      isTotal: true,
      specialBg: 'bg-gray-200',
      bold: true,
    },
  ],
};

const MonthlyProjectionTable: React.FC<MonthlyProjectionTableProps> = ({ projection }) => {
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    ingresos: false,
    gastos: false,
    financiacion: false,
    tesoreria: false,
  });
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleSection = (section: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleRow = (label: string) => {
    setExpandedRows(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const { months, year } = projection;
  const getRowLabel = (row: RowDef): string =>
    typeof row.label === 'function' ? row.label(year) : row.label;

  const getDrillDownItemKey = (item: DrillDownItem, keyField: 'concepto' | 'fuente'): string =>
    keyField === 'fuente' ? (item.fuente ?? item.concepto) : item.concepto;

  const getDrillDownKeys = useMemo(() => {
    return (row: RowDef): string[] => {
      if (!row.getDrillDownItems) return [];
      const keys = new Set<string>();
      const keyField = row.drillDownGroupKey ?? 'concepto';

      for (const month of months) {
        for (const item of row.getDrillDownItems(month)) {
          const key = getDrillDownItemKey(item, keyField);
          if (key) keys.add(key);
        }
      }

      return Array.from(keys).sort();
    };
  }, [months]);

  const getDrillDownValue = (month: MonthlyProjectionRow, row: RowDef, key: string): number => {
    if (!row.getDrillDownItems) return 0;
    const keyField = row.drillDownGroupKey ?? 'concepto';

    return row.getDrillDownItems(month)
      .filter(item => getDrillDownItemKey(item, keyField) === key)
      .reduce((sum, item) => sum + item.importe, 0);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100">
            <th className="sticky left-0 z-20 min-w-[140px] border-r border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold text-gray-700">
              ATRIBUTO
            </th>
            {months.map((month, index) => (
              <th
                key={month.month}
                className="min-w-[68px] whitespace-nowrap px-1 py-1 text-right font-semibold text-gray-700"
              >
                {MONTH_ABBR[index]}-{String(year).slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.entries(SECTIONS) as [SectionKey, SectionConfig][]).map(([sectionKey, sectionCfg]) => {
            const rows = SECTION_ROWS[sectionKey];
            const isCollapsed = collapsed[sectionKey];

            return (
              <React.Fragment key={sectionKey}>
                <tr
                  className={`${sectionCfg.bg} cursor-pointer select-none border-t-2 border-gray-300 hover:brightness-95`}
                  onClick={() => toggleSection(sectionKey)}
                >
                  <td className={`sticky left-0 z-10 ${sectionCfg.bg} border-r border-gray-300 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${sectionCfg.headerText}`}>
                    <span className="flex items-center gap-1">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {sectionCfg.label}
                    </span>
                  </td>
                  {months.map(month => (
                    <td key={month.month} className={`${sectionCfg.bg} px-1 py-0.5`} />
                  ))}
                </tr>

                {!isCollapsed && rows.map(row => {
                  if (!row.isTotal && months.every(month => row.getValue(month) === 0)) {
                    return null;
                  }

                  const rowBg = row.isTotal ? row.specialBg ?? sectionCfg.totalBg : 'bg-white';
                  const rowLabel = getRowLabel(row);
                  const drillDownKeys = getDrillDownKeys(row);
                  const hasDrillDown = drillDownKeys.length > 0;
                  const isExpanded = hasDrillDown && !!expandedRows[rowLabel];

                  return (
                    <React.Fragment key={rowLabel}>
                      <tr
                        className={`${rowBg} border-b border-gray-100 hover:bg-gray-50 ${hasDrillDown ? 'cursor-pointer' : ''}`}
                        onClick={hasDrillDown ? () => toggleRow(rowLabel) : undefined}
                      >
                        <td className={`sticky left-0 z-10 ${rowBg} border-r border-gray-200 px-2 py-0.5 pl-5 ${row.bold ? 'font-semibold' : 'text-gray-600'}`}>
                          <span className="flex items-center gap-1">
                            {hasDrillDown && (
                              isExpanded
                                ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                                : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                            )}
                            {rowLabel}
                          </span>
                        </td>
                        {months.map(month => (
                          <td
                            key={month.month}
                            className={`px-1 py-0.5 text-right tabular-nums ${row.bold ? 'font-semibold' : ''}`}
                          >
                            {formatValue(row.getValue(month), row.highlight)}
                          </td>
                        ))}
                      </tr>

                      {isExpanded && drillDownKeys.map(key => (
                        <tr key={`${rowLabel}-${key}`} className="border-b border-gray-100 bg-gray-50">
                          <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 py-0.5 pl-8 pr-2 text-xs text-gray-500">
                            {key}
                          </td>
                          {months.map(month => (
                            <td
                              key={month.month}
                              className="px-1 py-0.5 text-right text-xs tabular-nums text-gray-600"
                            >
                              {formatInteger(getDrillDownValue(month, row, key))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyProjectionTable;
