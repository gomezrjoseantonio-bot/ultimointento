// src/modules/horizon/proyeccion/mensual/components/MonthlyProjectionTable.tsx
// ATLAS HORIZON: Monthly projection table with collapsible sections

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatInteger } from '../../../../../utils/formatUtils';
import { ProyeccionAnual, MonthlyProjectionRow, DrillDownItem } from '../types/proyeccionMensual';

interface MonthlyProjectionTableProps {
  projection: ProyeccionAnual;
}

// Spanish month abbreviations
const MONTH_ABBR = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

type SectionKey = 'ingresos' | 'gastos' | 'financiacion' | 'tesoreria' | 'patrimonio';

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
  patrimonio: {
    label: 'PATRIMONIO',
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
  return (
    <span className={value < 0 ? 'text-red-600' : ''}>{formatted}</span>
  );
}

interface RowDef {
  label: string;
  getValue: (m: MonthlyProjectionRow) => number;
  isTotal?: boolean;
  highlight?: 'positive-negative';
  specialBg?: string;
  bold?: boolean;
  /**
   * Returns drill-down items for a given month. Presence enables expand/collapse.
   * Sub-rows are grouped by the specified key field (default: 'concepto').
   */
  getDrillDownItems?: (m: MonthlyProjectionRow) => DrillDownItem[];
  /** Key field to group sub-rows by. Defaults to 'concepto'. */
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
    },
    { label: 'Dividendos / Inversiones', getValue: m => m.ingresos.dividendosInversiones },
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
      label: 'Gastos operativos',
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
    { label: 'IRPF devengado', getValue: m => m.gastos.irpfDevengado },
    { label: 'IRPF a pagar (trim.)', getValue: m => m.gastos.irpfAPagar },
    { label: 'Seguridad Social', getValue: m => m.gastos.seguridadSocial },
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
    { label: 'Amortización capital', getValue: m => m.financiacion.amortizacionCapital },
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
  patrimonio: [
    { label: 'Caja', getValue: m => m.patrimonio.caja },
    { label: 'Inmuebles', getValue: m => m.patrimonio.inmuebles },
    { label: 'Planes de pensión', getValue: m => m.patrimonio.planesPension },
    { label: 'Otras inversiones', getValue: m => m.patrimonio.otrasInversiones },
    { label: 'Deuda inmuebles', getValue: m => -m.patrimonio.deudaInmuebles },
    { label: 'Deuda personal', getValue: m => -m.patrimonio.deudaPersonal },
    { label: 'Deuda total', getValue: m => -m.patrimonio.deudaTotal, bold: true },
    {
      label: 'Patrimonio neto',
      getValue: m => m.patrimonio.patrimonioNeto,
      isTotal: true,
      specialBg: 'bg-gray-200',
      bold: true,
      highlight: 'positive-negative',
    },
  ],
};

const MonthlyProjectionTable: React.FC<MonthlyProjectionTableProps> = ({
  projection,
}) => {
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    ingresos: false,
    gastos: false,
    financiacion: false,
    tesoreria: false,
    patrimonio: false,
  });
  // Map of row label → expanded state for drill-down rows
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleSection = (section: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleRow = (label: string) => {
    setExpandedRows(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const { months, year } = projection;

  /**
   * Extracts the grouping key from a DrillDownItem based on the row's drillDownGroupKey.
   */
  const getDrillDownItemKey = (item: DrillDownItem, keyField: 'concepto' | 'fuente'): string =>
    keyField === 'fuente' ? (item.fuente ?? item.concepto) : item.concepto;

  /**
   * For a given drilldown-capable row, collect the unique sub-row keys
   * (grouped by drillDownGroupKey) that appear in any month.
   */
  const getDrillDownKeys = useMemo(() => {
    return (row: RowDef): string[] => {
      if (!row.getDrillDownItems) return [];
      const keys = new Set<string>();
      const keyField = row.drillDownGroupKey ?? 'concepto';
      for (const m of months) {
        for (const item of row.getDrillDownItems(m)) {
          const k = getDrillDownItemKey(item, keyField);
          if (k) keys.add(k);
        }
      }
      return Array.from(keys).sort();
    };
  }, [months]);

  /**
   * Get the summed value for a specific drill-down key in a given month.
   */
  const getDrillDownValue = (
    m: MonthlyProjectionRow,
    row: RowDef,
    key: string,
  ): number => {
    if (!row.getDrillDownItems) return 0;
    const keyField = row.drillDownGroupKey ?? 'concepto';
    return row.getDrillDownItems(m)
      .filter(item => getDrillDownItemKey(item, keyField) === key)
      .reduce((sum, item) => sum + item.importe, 0);
  };

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            {/* Sticky label column */}
            <th
              className="sticky left-0 z-20 bg-gray-100 text-left px-2 py-1 font-semibold text-gray-700 border-r border-gray-300 min-w-[140px]"
            >
              ATRIBUTO
            </th>
            {months.map((m, i) => (
              <th
                key={m.month}
                className="px-1 py-1 font-semibold text-gray-700 text-right min-w-[68px] whitespace-nowrap"
              >
                {MONTH_ABBR[i]}-{String(year).slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.entries(SECTIONS) as [SectionKey, SectionConfig][]).map(
            ([sectionKey, sectionCfg]) => {
              const rows = SECTION_ROWS[sectionKey];
              const isCollapsed = collapsed[sectionKey];

              return (
                <React.Fragment key={sectionKey}>
                  {/* Section header row */}
                  <tr
                    className={`${sectionCfg.bg} border-t-2 border-gray-300 cursor-pointer select-none hover:brightness-95`}
                    onClick={() => toggleSection(sectionKey)}
                  >
                    <td
                      className={`sticky left-0 z-10 ${sectionCfg.bg} px-2 py-0.5 font-bold uppercase tracking-wide text-xs ${sectionCfg.headerText} border-r border-gray-300`}
                    >
                      <span className="flex items-center gap-1">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {sectionCfg.label}
                      </span>
                    </td>
                    {months.map(m => (
                      <td key={m.month} className={`${sectionCfg.bg} px-1 py-0.5`} />
                    ))}
                  </tr>

                  {/* Section detail rows */}
                  {!isCollapsed &&
                    rows.map(row => {
                      // Hide non-total rows where all months have a zero value
                      if (!row.isTotal && months.every(m => row.getValue(m) === 0)) {
                        return null;
                      }

                      const rowBg = row.isTotal
                        ? row.specialBg ?? sectionCfg.totalBg
                        : 'bg-white';

                      const drillDownKeys = getDrillDownKeys(row);
                      const hasDrilldown = drillDownKeys.length > 0;
                      const isExpanded = hasDrilldown && !!expandedRows[row.label];

                      return (
                        <React.Fragment key={row.label}>
                          <tr
                            className={`${rowBg} border-b border-gray-100 hover:bg-gray-50 ${hasDrilldown ? 'cursor-pointer' : ''}`}
                            onClick={hasDrilldown ? () => toggleRow(row.label) : undefined}
                          >
                            <td
                              className={`sticky left-0 z-10 ${rowBg} px-2 py-0.5 border-r border-gray-200 ${row.bold ? 'font-semibold' : 'text-gray-600'} pl-5`}
                            >
                              <span className="flex items-center gap-1">
                                {hasDrilldown && (
                                  isExpanded
                                    ? <ChevronDown className="w-3 h-3 shrink-0 text-gray-400" />
                                    : <ChevronRight className="w-3 h-3 shrink-0 text-gray-400" />
                                )}
                                {row.label}
                              </span>
                            </td>
                            {months.map(m => {
                              const val = row.getValue(m);
                              return (
                                <td
                                  key={m.month}
                                  className={`px-1 py-0.5 text-right tabular-nums ${row.bold ? 'font-semibold' : ''}`}
                                >
                                  {formatValue(val, row.highlight)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Drill-down sub-rows */}
                          {isExpanded &&
                            drillDownKeys.map(key => (
                              <tr
                                key={`${row.label}-${key}`}
                                className="bg-gray-50 border-b border-gray-100"
                              >
                                <td className="sticky left-0 z-10 bg-gray-50 pl-8 pr-2 py-0.5 text-xs text-gray-500 border-r border-gray-200">
                                  {key}
                                </td>
                                {months.map(m => (
                                  <td
                                    key={m.month}
                                    className="px-1 py-0.5 text-right tabular-nums text-xs text-gray-600"
                                  >
                                    {formatInteger(getDrillDownValue(m, row, key))}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyProjectionTable;
