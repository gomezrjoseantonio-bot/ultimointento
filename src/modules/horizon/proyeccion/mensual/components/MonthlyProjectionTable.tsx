// src/modules/horizon/proyeccion/mensual/components/MonthlyProjectionTable.tsx
// ATLAS HORIZON: Monthly projection table with collapsible sections

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatEuro } from '../../../../../utils/formatUtils';
import { ProyeccionAnual, MonthlyProjectionRow } from '../types/proyeccionMensual';

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
    bg: 'bg-green-50',
    headerText: 'text-green-900',
    totalBg: 'bg-green-100',
  },
  gastos: {
    label: 'GASTOS',
    bg: 'bg-red-50',
    headerText: 'text-red-900',
    totalBg: 'bg-red-100',
  },
  financiacion: {
    label: 'FINANCIACIÓN',
    bg: 'bg-blue-50',
    headerText: 'text-blue-900',
    totalBg: 'bg-blue-100',
  },
  tesoreria: {
    label: 'TESORERÍA',
    bg: 'bg-yellow-50',
    headerText: 'text-yellow-900',
    totalBg: 'bg-yellow-100',
  },
  patrimonio: {
    label: 'PATRIMONIO',
    bg: 'bg-purple-50',
    headerText: 'text-purple-900',
    totalBg: 'bg-purple-100',
  },
};

function formatValue(value: number, highlight?: 'positive-negative'): React.ReactNode {
  const formatted = formatEuro(value);
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
  /** When true, the row shows an expand/collapse toggle for drill-down sub-rows */
  hasDrilldown?: boolean;
}

const SECTION_ROWS: Record<SectionKey, RowDef[]> = {
  ingresos: [
    { label: 'Nómina', getValue: m => m.ingresos.nomina },
    { label: 'Servicios freelance', getValue: m => m.ingresos.serviciosFreelance },
    { label: 'Rentas alquiler', getValue: m => m.ingresos.rentasAlquiler },
    { label: 'Dividendos / Inversiones', getValue: m => m.ingresos.dividendosInversiones },
    { label: 'Otros ingresos', getValue: m => m.ingresos.otrosIngresos },
    {
      label: 'Total ingresos',
      getValue: m => m.ingresos.total,
      isTotal: true,
      bold: true,
    },
  ],
  gastos: [
    { label: 'Gastos operativos', getValue: m => m.gastos.gastosOperativos, hasDrilldown: true },
    { label: 'Gastos personales', getValue: m => m.gastos.gastosPersonales },
    { label: 'Gastos autónomo', getValue: m => m.gastos.gastosAutonomo },
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
      specialBg: 'bg-yellow-200',
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
      specialBg: 'bg-purple-200',
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
  const [opexExpanded, setOpexExpanded] = useState(false);

  const toggleSection = (section: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { months, year } = projection;

  // Collect unique property aliases that appear in any month's opex breakdown
  const opexPropertyAliases = useMemo(() => {
    const aliases = new Set<string>();
    for (const m of months) {
      for (const item of m.gastos.opexDesglose ?? []) {
        aliases.add(item.propertyAlias);
      }
    }
    return Array.from(aliases).sort();
  }, [months]);

  // Sum opex for a given property alias in a given month
  const getOpexForProperty = (m: MonthlyProjectionRow, alias: string): number =>
    (m.gastos.opexDesglose ?? [])
      .filter(item => item.propertyAlias === alias)
      .reduce((sum, item) => sum + item.importe, 0);

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            {/* Sticky label column */}
            <th
              className="sticky left-0 z-20 bg-gray-100 text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300 min-w-[200px]"
            >
              ATRIBUTO
            </th>
            {months.map((m, i) => (
              <th
                key={m.month}
                className="px-3 py-2 font-semibold text-gray-700 text-right min-w-[100px] whitespace-nowrap"
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
                      className={`sticky left-0 z-10 ${sectionCfg.bg} px-3 py-2 font-bold uppercase tracking-wide text-xs ${sectionCfg.headerText} border-r border-gray-300`}
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
                      <td key={m.month} className={`${sectionCfg.bg} px-3 py-2`} />
                    ))}
                  </tr>

                  {/* Section detail rows */}
                  {!isCollapsed &&
                    rows.map(row => {
                      const rowBg = row.isTotal
                        ? row.specialBg ?? sectionCfg.totalBg
                        : 'bg-white';
                      const isDrilldownRow = !!row.hasDrilldown;
                      const drilldownOpen = isDrilldownRow && opexExpanded && opexPropertyAliases.length > 0;

                      return (
                        <React.Fragment key={row.label}>
                          <tr
                            className={`${rowBg} border-b border-gray-100 hover:bg-gray-50 ${isDrilldownRow ? 'cursor-pointer' : ''}`}
                            onClick={isDrilldownRow ? () => setOpexExpanded(v => !v) : undefined}
                          >
                            <td
                              className={`sticky left-0 z-10 ${rowBg} px-3 py-1.5 border-r border-gray-200 ${row.bold ? 'font-semibold' : 'text-gray-600'} pl-6`}
                            >
                              <span className="flex items-center gap-1">
                                {isDrilldownRow && opexPropertyAliases.length > 0 && (
                                  drilldownOpen
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
                                  className={`px-3 py-1.5 text-right tabular-nums ${row.bold ? 'font-semibold' : ''}`}
                                >
                                  {formatValue(val, row.highlight)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Drill-down: per-property opex sub-rows */}
                          {drilldownOpen &&
                            opexPropertyAliases.map(alias => (
                              <tr
                                key={`opex-${alias}`}
                                className="bg-gray-50 border-b border-gray-100"
                              >
                                <td className="sticky left-0 z-10 bg-gray-50 pl-10 pr-3 py-1 text-xs text-gray-500 border-r border-gray-200">
                                  {alias}
                                </td>
                                {months.map(m => (
                                  <td
                                    key={m.month}
                                    className="px-3 py-1 text-right tabular-nums text-xs text-gray-600"
                                  >
                                    {formatEuro(getOpexForProperty(m, alias))}
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
