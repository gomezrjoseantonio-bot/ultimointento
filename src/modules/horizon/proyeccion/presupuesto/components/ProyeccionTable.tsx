import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ProyeccionMensualData } from '../types/ProyeccionData';

interface ProyeccionTableProps {
  data: ProyeccionMensualData;
  year: number;
}

interface RowConfig {
  label: string;
  dataKey: keyof ProyeccionMensualData;
  isSubRow?: boolean;
}

interface SectionConfig {
  label: string;
  colorToken: string;
  rows: RowConfig[];
  totalKey: keyof ProyeccionMensualData;
  totalLabel: string;
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const formatNumber = (value: number): string => {
  if (value === 0) return '—';
  return Math.abs(value).toLocaleString('es-ES');
};

const formatSigned = (value: number): string => {
  if (value === 0) return '—';
  if (value > 0) return value.toLocaleString('es-ES');
  return `−${Math.abs(value).toLocaleString('es-ES')}`;
};

const rowTotal = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

export default function ProyeccionTable({ data, year }: ProyeccionTableProps) {
  const [expandedSections, setExpandedSections] = useState({
    ing: true,
    gas: true,
    fin: false,
    tes: true,
  });

  const sectionConfig = useMemo<Record<string, SectionConfig>>(() => ({
    ing: {
      label: 'Ingresos',
      colorToken: '--c1',
      rows: [
        { label: 'Nóminas', dataKey: 'nominas', isSubRow: true },
        { label: 'Ingresos Autónomos', dataKey: 'autonomos', isSubRow: true },
        { label: 'Rentas alquiler', dataKey: 'alquiler', isSubRow: true },
        { label: 'Intereses Inversiones', dataKey: 'intereses' },
        { label: 'Otros ingresos', dataKey: 'otrosIngresos' },
      ],
      totalKey: 'totalIngresos',
      totalLabel: 'Total ingresos',
    },
    gas: {
      label: 'Gastos',
      colorToken: '--c6',
      rows: [
        { label: 'Gastos Alquileres', dataKey: 'gastosAlquileres', isSubRow: true },
        { label: 'Gastos personales', dataKey: 'gastosPersonales' },
        { label: 'Gastos autónomo', dataKey: 'gastosAutonomo', isSubRow: true },
        { label: `IRPF ${year}`, dataKey: 'irpf' },
      ],
      totalKey: 'totalGastos',
      totalLabel: 'Total gastos',
    },
    fin: {
      label: 'Financiación',
      colorToken: '--c2',
      rows: [
        { label: 'Cuotas hipotecas', dataKey: 'hipotecas' },
        { label: 'Cuotas préstamos', dataKey: 'prestamos' },
      ],
      totalKey: 'totalFinanciacion',
      totalLabel: 'Total financiación',
    },
  }), [year]);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getTokenValue = (token: string) => `var(${token})`;

  return (
    <section className="proyeccion-table-wrapper" aria-label="Tabla de proyección mensual">
      <div className="proyeccion-table-scroll">
        <table className="proyeccion-table">
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              {MESES.map((mes) => <th key={mes} scope="col">{mes}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sectionConfig).map(([key, section]) => {
              const sectionExpanded = expandedSections[key as keyof typeof expandedSections];
              const totalValues = data[section.totalKey] as number[];
              const totalColor = getTokenValue(section.colorToken);

              return (
                <React.Fragment key={key}>
                  <tr className="section-header-row">
                    <td colSpan={14}>
                      <button
                        type="button"
                        className="section-header-label"
                        onClick={() => toggleSection(key as keyof typeof expandedSections)}
                        aria-expanded={sectionExpanded}
                        aria-controls={`section-${key}`}
                      >
                        <span className="expand-btn" aria-hidden="true">
                          {sectionExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="section-header-dot" style={{ background: totalColor }} />
                        <span>{section.label}</span>
                      </button>
                    </td>
                  </tr>

                  {sectionExpanded && (
                    <>
                      {section.rows.map((row, rowIndex) => {
                        const values = data[row.dataKey] as number[];
                        const total = rowTotal(values);

                        return (
                          <tr key={`${key}-${String(row.dataKey)}`} id={rowIndex === 0 ? `section-${key}` : undefined}>
                            <td className={row.isSubRow ? 'sub-row-label' : undefined}>{row.label}</td>
                            {values.map((value, index) => (
                              <td key={`${row.label}-${MESES[index]}`} className={value === 0 ? 'zero-value' : undefined}>
                                {formatNumber(value)}
                              </td>
                            ))}
                            <td className={`col-total ${total === 0 ? 'zero-value' : ''}`}>{formatNumber(total)}</td>
                          </tr>
                        );
                      })}

                      <tr className="total-row">
                        <td style={{ color: totalColor }}>{section.totalLabel}</td>
                        {totalValues.map((value, index) => (
                          <td key={`${section.totalLabel}-${MESES[index]}`} style={{ color: totalColor }}>
                            {formatNumber(value)}
                          </td>
                        ))}
                        <td className="col-total" style={{ color: totalColor }}>{formatNumber(rowTotal(totalValues))}</td>
                      </tr>
                    </>
                  )}
                </React.Fragment>
              );
            })}

            <tr className="section-header-row">
              <td colSpan={14}>
                <button
                  type="button"
                  className="section-header-label"
                  onClick={() => toggleSection('tes')}
                  aria-expanded={expandedSections.tes}
                  aria-controls="section-tes"
                >
                  <span className="expand-btn" aria-hidden="true">
                    {expandedSections.tes ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="section-header-dot" style={{ background: 'var(--c3)' }} />
                  <span>Tesorería</span>
                </button>
              </td>
            </tr>

            {expandedSections.tes && (
              <>
                <tr id="section-tes">
                  <td>Flujo caja del mes</td>
                  {data.flujoCaja.map((value, index) => (
                    <td key={`flujo-${MESES[index]}`} className={value > 0 ? 'flujo-positivo' : value < 0 ? 'flujo-negativo' : 'zero-value'}>
                      {formatSigned(value)}
                    </td>
                  ))}
                  <td className={rowTotal(data.flujoCaja) >= 0 ? 'col-total flujo-positivo' : 'col-total flujo-negativo'}>
                    {formatSigned(rowTotal(data.flujoCaja))}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--n-500)' }}>Caja inicial</td>
                  {data.cajaInicial.map((value, index) => (
                    <td key={`caja-inicial-${MESES[index]}`} style={{ color: 'var(--n-500)' }} className={value === 0 ? 'zero-value' : undefined}>
                      {formatNumber(value)}
                    </td>
                  ))}
                  <td className="col-total zero-value">—</td>
                </tr>
                <tr className="total-row">
                  <td style={{ color: 'var(--c3)' }}>Caja final</td>
                  {data.cajaFinal.map((value, index) => (
                    <td key={`caja-final-${MESES[index]}`} style={{ color: 'var(--c3)' }}>
                      {formatNumber(value)}
                    </td>
                  ))}
                  <td className="col-total" style={{ color: 'var(--c3)' }}>{formatNumber(data.cajaFinal[11] ?? 0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
