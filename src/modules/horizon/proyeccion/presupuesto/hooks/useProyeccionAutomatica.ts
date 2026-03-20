import { useCallback, useEffect, useState } from 'react';
import { generateProyeccionMensual } from '../../mensual/services/proyeccionMensualService';
import type { ProyeccionAnual } from '../../mensual/types/proyeccionMensual';
import type { ProyeccionMensualData } from '../types/ProyeccionData';

const EMPTY_MONTHS = () => Array.from({ length: 12 }, () => 0);

function sumMonths(...series: number[][]): number[] {
  return Array.from({ length: 12 }, (_, index) => series.reduce((acc, values) => acc + (values[index] ?? 0), 0));
}

function buildProyeccionData(proyeccion: ProyeccionAnual): ProyeccionMensualData {
  const nominas = proyeccion.months.map((month) => month.ingresos.nomina ?? 0);
  const autonomos = proyeccion.months.map((month) => month.ingresos.serviciosFreelance ?? 0);
  const alquiler = proyeccion.months.map((month) => month.ingresos.rentasAlquiler ?? 0);
  const intereses = proyeccion.months.map((month) => month.ingresos.dividendosInversiones ?? 0);
  const pensiones = proyeccion.months.map((month) => month.ingresos.pensiones ?? 0);
  const otrosBase = proyeccion.months.map((month) => month.ingresos.otrosIngresos ?? 0);
  const otrosIngresos = sumMonths(otrosBase, pensiones);

  const gastosAlquileres = proyeccion.months.map((month) => month.gastos.gastosOperativos ?? 0);
  const gastosPersonales = proyeccion.months.map((month) => month.gastos.gastosPersonales ?? 0);
  const gastosAutonomo = proyeccion.months.map((month) => month.gastos.gastosAutonomo ?? 0);
  const irpf = proyeccion.months.map((month) => month.gastos.irpf ?? 0);

  const hipotecas = proyeccion.months.map((month) => month.financiacion.cuotasHipotecas ?? 0);
  const prestamos = proyeccion.months.map((month) => month.financiacion.cuotasPrestamos ?? 0);

  const totalIngresos = sumMonths(nominas, autonomos, alquiler, intereses, otrosIngresos);
  const totalGastos = sumMonths(gastosAlquileres, gastosPersonales, gastosAutonomo, irpf);
  const totalFinanciacion = sumMonths(hipotecas, prestamos);
  const flujoCaja = Array.from({ length: 12 }, (_, index) => totalIngresos[index] - totalGastos[index] - totalFinanciacion[index]);

  const initialCash = proyeccion.months[0]?.tesoreria.cajaInicial ?? 0;
  const cajaInicial = EMPTY_MONTHS();
  const cajaFinal = EMPTY_MONTHS();

  cajaInicial[0] = initialCash;
  cajaFinal[0] = cajaInicial[0] + flujoCaja[0];

  for (let index = 1; index < 12; index += 1) {
    cajaInicial[index] = cajaFinal[index - 1];
    cajaFinal[index] = cajaInicial[index] + flujoCaja[index];
  }

  return {
    nominas,
    autonomos,
    alquiler,
    intereses,
    otrosIngresos,
    totalIngresos,
    gastosAlquileres,
    gastosPersonales,
    gastosAutonomo,
    irpf,
    totalGastos,
    hipotecas,
    prestamos,
    totalFinanciacion,
    flujoCaja,
    cajaInicial,
    cajaFinal,
  };
}

export function useProyeccionAutomatica(year: number): {
  data: ProyeccionMensualData | null;
  isLoading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<ProyeccionMensualData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const proyecciones = await generateProyeccionMensual();
      const proyeccionYear = proyecciones.find((item) => item.year === year);

      if (!proyeccionYear) {
        setData(null);
        return;
      }

      setData(buildProyeccionData(proyeccionYear));
    } catch (err) {
      console.error('[useProyeccionAutomatica] Error loading projection:', err);
      setError('No se pudieron cargar los datos de la proyección automática.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return { data, isLoading, error };
}
