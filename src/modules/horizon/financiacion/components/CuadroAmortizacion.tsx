import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface AmortizacionRow {
  periodo: number;
  fecha: string;
  anio: number;
  cuota: number;
  capital: number;
  intereses: number;
  capitalPendiente: number;
  esMixto?: boolean;
}

interface CuadroAmortizacionProps {
  capitalInicial: number;
  tinAnual: number;
  plazoMeses: number;
  fechaInicio: string;
  /** Marks rows up to this month index as the fixed tranche (for mixed loans) */
  tramoFijoMeses?: number;
}

const PAGE_SIZE = 25;

const CuadroAmortizacion: React.FC<CuadroAmortizacionProps> = ({
  capitalInicial,
  tinAnual,
  plazoMeses,
  fechaInicio,
  tramoFijoMeses
}) => {
  const [page, setPage] = useState(1);
  const [filtroAnio, setFiltroAnio] = useState<number | ''>('');

  // Generate amortization schedule (French system)
  const rows = useMemo<AmortizacionRow[]>(() => {
    const result: AmortizacionRow[] = [];
    const tasaMensual = tinAnual / 100 / 12;
    let capitalPendiente = capitalInicial;

    const cuota =
      tasaMensual > 0
        ? capitalInicial * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) /
          (Math.pow(1 + tasaMensual, plazoMeses) - 1)
        : capitalInicial / plazoMeses;

    const fechaBase = new Date(fechaInicio);

    for (let i = 1; i <= plazoMeses; i++) {
      const intereses = capitalPendiente * tasaMensual;
      const capital = cuota - intereses;
      capitalPendiente = Math.max(0, capitalPendiente - capital);

      fechaBase.setMonth(fechaBase.getMonth() + 1);

      result.push({
        periodo: i,
        fecha: fechaBase.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit' }),
        anio: fechaBase.getFullYear(),
        cuota: Math.round(cuota * 100) / 100,
        capital: Math.round(capital * 100) / 100,
        intereses: Math.round(intereses * 100) / 100,
        capitalPendiente: Math.round(capitalPendiente * 100) / 100,
        esMixto: tramoFijoMeses !== undefined && i <= tramoFijoMeses
      });
    }

    return result;
  }, [capitalInicial, tinAnual, plazoMeses, fechaInicio, tramoFijoMeses]);

  // Available years for filter
  const years = useMemo(() => {
    const set = new Set<number>(rows.map(r => r.anio));
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!filtroAnio) return rows;
    return rows.filter(r => r.anio === filtroAnio);
  }, [rows, filtroAnio]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary totals
  const totalCapital = rows.reduce((s, r) => s + r.capital, 0);
  const totalIntereses = rows.reduce((s, r) => s + r.intereses, 0);
  const fechaFin = rows[rows.length - 1]?.fecha ?? '-';

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-primary-50 border border-primary-200 rounded-atlas">
        <div>
          <span className="text-sm text-text-gray block">Capital total amortizado</span>
          <span className="font-semibold text-atlas-navy-1">{fmt(totalCapital)} €</span>
        </div>
        <div>
          <span className="text-sm text-text-gray block">Intereses totales</span>
          <span className="font-semibold text-atlas-navy-1">{fmt(totalIntereses)} €</span>
        </div>
        <div>
          <span className="text-sm text-text-gray block">Fecha fin estimada</span>
          <span className="font-semibold text-atlas-navy-1">{fechaFin}</span>
        </div>
      </div>

      {/* Year filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-text-gray" />
        <label className="text-sm text-atlas-navy-1">Filtrar por año:</label>
        <select
          value={filtroAnio}
          onChange={(e) => { setFiltroAnio(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
          className="border border-gray-300 rounded-atlas px-2 py-1 text-sm focus:border-atlas-blue focus:ring-atlas-blue"
        >
          <option value="">Todos</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-atlas">
        <table className="w-full text-sm">
          <thead className="bg-primary-50 text-atlas-navy-1">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Período</th>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-right font-medium">Cuota</th>
              <th className="px-3 py-2 text-right font-medium">Capital</th>
              <th className="px-3 py-2 text-right font-medium">Intereses</th>
              <th className="px-3 py-2 text-right font-medium">Cap. Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.periodo}
                className={`border-t border-gray-100 ${row.esMixto ? 'bg-primary-50' : row.periodo % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
              >
                <td className="px-3 py-2 text-atlas-navy-1">{row.periodo}</td>
                <td className="px-3 py-2 text-atlas-navy-1">{row.fecha}</td>
                <td className="px-3 py-2 text-right text-atlas-navy-1">{fmt(row.cuota)} €</td>
                <td className="px-3 py-2 text-right text-atlas-navy-1">{fmt(row.capital)} €</td>
                <td className="px-3 py-2 text-right text-atlas-navy-1">{fmt(row.intereses)} €</td>
                <td className="px-3 py-2 text-right text-atlas-navy-1">{fmt(row.capitalPendiente)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-gray">
            Página {page} de {totalPages} ({filteredRows.length} filas)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:border-atlas-blue"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:border-atlas-blue"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {tramoFijoMeses && (
        <p className="text-xs text-text-gray">
          <span className="inline-block w-3 h-3 bg-primary-50 border border-primary-200 mr-1 align-middle" />
          Filas sombreadas = tramo fijo del préstamo mixto
        </p>
      )}
    </div>
  );
};

export default CuadroAmortizacion;
