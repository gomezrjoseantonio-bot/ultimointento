import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { addMonthsClampedUTC } from '../../../../utils/recurrenceDateUtils';
import { PeriodoPago } from '../../../../types/prestamos';

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
  /** Optional precomputed payment schedule (used to keep wizard + detail views consistent) */
  periodos?: PeriodoPago[];
}

const PAGE_SIZE = 25;

function parseISODateOnly(dateStr: string): Date {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function addMonthsWithClampedDay(baseDate: Date, monthsToAdd: number, dayOfMonth: number): Date {
  const baseIso = new Date(Date.UTC(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  )).toISOString();

  const nextDateUTC = addMonthsClampedUTC(baseIso, monthsToAdd, dayOfMonth);
  return new Date(nextDateUTC.getUTCFullYear(), nextDateUTC.getUTCMonth(), nextDateUTC.getUTCDate());
}

const CuadroAmortizacion: React.FC<CuadroAmortizacionProps> = ({
  capitalInicial,
  tinAnual,
  plazoMeses,
  fechaInicio,
  tramoFijoMeses,
  periodos
}) => {
  const [page, setPage] = useState(1);
  const [filtroAnio, setFiltroAnio] = useState<number | ''>('');

  // Generate amortization schedule (French system) or adapt a precomputed schedule.
  const rows = useMemo<AmortizacionRow[]>(() => {
    if (periodos && periodos.length > 0) {
      return periodos.map((p) => {
        const fecha = parseISODateOnly(p.fechaCargo);
        return {
          periodo: p.periodo,
          fecha: Number.isNaN(fecha.getTime()) ? p.fechaCargo : fecha.toLocaleDateString('es-ES'),
          anio: Number.isNaN(fecha.getTime()) ? Number(p.fechaCargo.slice(0, 4)) : fecha.getFullYear(),
          cuota: p.cuota,
          capital: p.amortizacion,
          intereses: p.interes,
          capitalPendiente: p.principalFinal,
          esMixto: tramoFijoMeses !== undefined && p.periodo <= tramoFijoMeses
        };
      });
    }

    const result: AmortizacionRow[] = [];
    const tasaMensual = tinAnual / 100 / 12;
    let capitalPendienteCentimos = Math.round(capitalInicial * 100);

    const cuotaCentimos = Math.round(
      (tasaMensual > 0
        ? capitalInicial * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) /
          (Math.pow(1 + tasaMensual, plazoMeses) - 1)
        : capitalInicial / plazoMeses) * 100,
    );

    const firstDate = parseISODateOnly(fechaInicio);
    if (isNaN(firstDate.getTime())) return result;
    const paymentDay = firstDate.getDate();
    let fechaCargo = new Date(firstDate);

    for (let i = 1; i <= plazoMeses; i++) {
      const interesesCentimos = Math.round((capitalPendienteCentimos / 100) * tasaMensual * 100);

      let capitalCentimos: number;
      let cuotaPeriodoCentimos: number;
      if (i === plazoMeses) {
        capitalCentimos = capitalPendienteCentimos;
        cuotaPeriodoCentimos = capitalCentimos + interesesCentimos;
      } else {
        cuotaPeriodoCentimos = cuotaCentimos;
        capitalCentimos = cuotaPeriodoCentimos - interesesCentimos;
        if (capitalCentimos < 0) {
          capitalCentimos = 0;
          cuotaPeriodoCentimos = interesesCentimos;
        }
      }

      capitalPendienteCentimos = Math.max(0, capitalPendienteCentimos - capitalCentimos);

      result.push({
        periodo: i,
        fecha: fechaCargo.toLocaleDateString('es-ES'),
        anio: fechaCargo.getFullYear(),
        cuota: cuotaPeriodoCentimos / 100,
        capital: capitalCentimos / 100,
        intereses: interesesCentimos / 100,
        capitalPendiente: capitalPendienteCentimos / 100,
        esMixto: tramoFijoMeses !== undefined && i <= tramoFijoMeses
      });

      fechaCargo = addMonthsWithClampedDay(fechaCargo, 1, paymentDay);
    }

    return result;
  }, [capitalInicial, tinAnual, plazoMeses, fechaInicio, tramoFijoMeses, periodos]);

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
  const totalCapital = rows.reduce((s, r) => s + Math.round(r.capital * 100), 0) / 100;
  const totalIntereses = rows.reduce((s, r) => s + Math.round(r.intereses * 100), 0) / 100;
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
      <div
        className="hide-scrollbar border border-gray-200 rounded-atlas"
        style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 400 }}
      >
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
