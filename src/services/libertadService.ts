import type {
  DatosRealesLibertad,
  HitoLibertad,
  LibertadConfig,
  PuntoSerieLibertad,
  ResultadoLibertad,
  SupuestosLibertad,
} from '../types/libertad';
import {
  STANDARD_LIBERTAD_CONFIG,
  SUPUESTOS_NEUTROS_LIBERTAD,
} from '../types/libertad';
import { getAllContracts } from './contractService';
import { gastosInmuebleService } from './gastosInmuebleService';
import { prestamosService } from './prestamosService';
import { getEscenarioActivo } from './escenariosService';

/**
 * Función pura · proyecta renta pasiva mensual mes a mes hasta el horizonte
 * y detecta el cruce con gastos de vida según la regla configurada.
 *
 * NO accede a DB · NO hace fetch · NO tiene side effects · 100% testable.
 *
 * @param datos     datos reales del usuario en mesReferencia
 * @param supuestos macro (inflación · subida rentas) · default neutros
 * @param config    cómo calcular · default STANDARD
 */
export function proyectarRentaPasivaLibertad(
  datos: DatosRealesLibertad,
  supuestos: SupuestosLibertad = SUPUESTOS_NEUTROS_LIBERTAD,
  config: LibertadConfig = STANDARD_LIBERTAD_CONFIG,
): ResultadoLibertad {
  if (config.alcanceRentaPasiva !== 'alquiler-neto') {
    throw new Error(
      `T27.4.1 solo soporta alcanceRentaPasiva='alquiler-neto'. Recibido '${config.alcanceRentaPasiva}'. Se implementará en fases posteriores.`,
    );
  }
  if (config.reglaCruce !== 'simple') {
    throw new Error(
      `T27.4.1 solo soporta reglaCruce='simple'. Recibido '${config.reglaCruce}'. Se implementará en fases posteriores.`,
    );
  }

  const horizonteMeses = config.horizonteAnios * 12;
  const subidaGastosMensual =
    (supuestos.subidaAnualGastosVidaPct ?? supuestos.inflacionAnualPct) / 100 / 12;
  const subidaRentasMensual = supuestos.subidaAnualRentasPct / 100 / 12;

  let rentaActual = datos.rentaPasivaActualMensual;
  let gastosActuales = datos.gastosVidaMensual;
  let cruceLibertad: ResultadoLibertad['cruceLibertad'] = null;
  const serie: PuntoSerieLibertad[] = [];

  const [yRef, mRef] = datos.mesReferencia.split('-').map(Number);
  let yIter = yRef;
  let mIter = mRef;

  const hitosOrdenados = [...datos.hitos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((h) => ({ ...h, isoYM: h.fecha.substring(0, 7) }));

  for (let mes = 0; mes < horizonteMeses; mes++) {
    const isoYM = `${yIter}-${String(mIter).padStart(2, '0')}`;

    for (const h of hitosOrdenados) {
      if (h.isoYM === isoYM) {
        if (h.tipo === 'cambioGastosVida') {
          gastosActuales += h.impactoMensual;
        } else {
          rentaActual += h.impactoMensual;
        }
      }
    }

    // Registrar el punto del mes actual ANTES de aplicar crecimiento,
    // para que serie[0] esté alineada con pctCoberturaActual/faltaMensualActual
    // y el mes de cruce no quede desplazado por el factor de crecimiento.
    const cubierto = rentaActual >= gastosActuales;
    const pctCobertura =
      gastosActuales > 0 ? (rentaActual / gastosActuales) * 100 : 0;

    serie.push({
      isoYM,
      rentaPasiva: Math.round(rentaActual * 100) / 100,
      gastosVida: Math.round(gastosActuales * 100) / 100,
      cubierto,
      pctCobertura: Math.round(pctCobertura * 100) / 100,
    });

    if (cubierto && cruceLibertad === null) {
      cruceLibertad = { anio: yIter, mes: mIter, isoYM };
    }

    // Aplicar crecimiento al final para que afecte al mes siguiente
    rentaActual *= 1 + subidaRentasMensual;
    gastosActuales *= 1 + subidaGastosMensual;

    mIter++;
    if (mIter > 12) {
      mIter = 1;
      yIter++;
    }
  }

  const pctCoberturaActual =
    datos.gastosVidaMensual > 0
      ? (datos.rentaPasivaActualMensual / datos.gastosVidaMensual) * 100
      : 0;
  const faltaMensualActual = Math.max(
    0,
    datos.gastosVidaMensual - datos.rentaPasivaActualMensual,
  );

  let faltanTexto: string | null = null;
  if (cruceLibertad) {
    const totalMesesHastaCruce =
      (cruceLibertad.anio - yRef) * 12 + (cruceLibertad.mes - mRef);
    const anios = Math.floor(totalMesesHastaCruce / 12);
    const mesesRestantes = totalMesesHastaCruce % 12;
    if (anios === 0) {
      faltanTexto = `${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`;
    } else if (mesesRestantes === 0) {
      faltanTexto = `${anios} ${anios === 1 ? 'año' : 'años'}`;
    } else {
      faltanTexto = `${anios} ${anios === 1 ? 'año' : 'años'} y ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`;
    }
  }

  return {
    cruceLibertad,
    serie,
    pctCoberturaActual: Math.round(pctCoberturaActual * 100) / 100,
    faltaMensualActual: Math.round(faltaMensualActual * 100) / 100,
    faltanTexto,
  };
}

/**
 * Wrapper · carga datos reales del repo y llama a la función pura.
 * Es la API principal que consumirán componentes UI (T27.4.2).
 */
export async function proyectarLibertadDesdeRepo(
  supuestos: SupuestosLibertad = SUPUESTOS_NEUTROS_LIBERTAD,
  configOverride?: LibertadConfig,
): Promise<ResultadoLibertad> {
  const escenario = await getEscenarioActivo();

  // Merge defensivo: STANDARD como base, luego config persistida, luego override.
  // Garantiza que campos requeridos nunca sean undefined aunque IndexedDB entregue
  // un objeto parcial o corrupto.
  const config: LibertadConfig = {
    ...STANDARD_LIBERTAD_CONFIG,
    ...(escenario.libertadConfig ?? {}),
    ...(configOverride ?? {}),
  };

  const rentaPasivaActualMensual = await calcularRentaPasivaActual();

  const gastosVidaMensual = escenario.gastosVidaLibertadMensual;

  const hitos: HitoLibertad[] = escenario.hitos.map((h) => ({
    id: h.id,
    fecha: h.fecha,
    tipo: h.tipo,
    impactoMensual: h.impactoMensual,
  }));

  const ahora = new Date();
  const mesReferencia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  return proyectarRentaPasivaLibertad(
    { rentaPasivaActualMensual, gastosVidaMensual, hitos, mesReferencia },
    supuestos,
    config,
  );
}

/**
 * Calcula renta pasiva mensual real HOY: suma neta de contratos activos.
 *
 * Definición STANDARD: alquiler − OPEX mensualizado − cuota préstamo activo.
 *
 * OPEX: suma de gastosInmueble confirmados/declarados del año en curso
 * para los inmuebles con contratos activos, dividida entre 12.
 *
 * Cuota préstamo: calculada con fórmula francesa sobre préstamos activos
 * vinculados a inmuebles con contratos activos.
 *
 * Nota para préstamos variables: sin TIN vigente accesible en el store,
 * se usa 0% como aproximación conservadora (cuota = capital / plazo restante).
 */
async function calcularRentaPasivaActual(): Promise<number> {
  const [contratos, prestamos] = await Promise.all([
    getAllContracts(),
    prestamosService.getAllPrestamos(),
  ]);

  const contratosActivos = contratos.filter(
    (c) => c.estadoContrato === 'activo',
  );

  const rentaBruta = contratosActivos.reduce(
    (s, c) => s + (c.rentaMensual ?? 0),
    0,
  );

  const inmuebleIdsActivos = new Set(contratosActivos.map((c) => c.inmuebleId));
  // destinos[].inmuebleId en Prestamo es string · usamos set de strings para comparar
  const inmuebleIdsActivosStr = new Set(
    contratosActivos.map((c) => String(c.inmuebleId)),
  );

  const anioActual = new Date().getFullYear();
  const gastosArrays = await Promise.all(
    [...inmuebleIdsActivos].map((id) =>
      gastosInmuebleService.getByInmuebleYEjercicio(id, anioActual),
    ),
  );
  const opexAnualTotal = gastosArrays
    .flat()
    .filter((g) => g.estado === 'confirmado' || g.estado === 'declarado')
    .reduce((s, g) => s + g.importe, 0);
  const opexMensualEstimado = opexAnualTotal / 12;

  const prestamosActivos = prestamos.filter(
    (p) =>
      p.activo === true &&
      p.destinos?.some(
        (d) => d.inmuebleId != null && inmuebleIdsActivosStr.has(d.inmuebleId),
      ),
  );

  const cuotaTotalPrestamos = prestamosActivos.reduce(
    (s, p) => s + cuotaMensualFrances(p.principalVivo, p.plazoMesesTotal, p.cuotasPagadas, tinEfectivo(p)),
    0,
  );

  return Math.max(0, rentaBruta - opexMensualEstimado - cuotaTotalPrestamos);
}

function tinEfectivo(p: { tipo: string; tipoNominalAnualFijo?: number; tipoNominalAnualMixtoFijo?: number }): number {
  if (p.tipo === 'FIJO') return p.tipoNominalAnualFijo ?? 0;
  if (p.tipo === 'MIXTO') return p.tipoNominalAnualMixtoFijo ?? 0;
  return 0;
}

function cuotaMensualFrances(
  principalVivo: number,
  plazoMesesTotal: number,
  cuotasPagadas: number,
  tinAnualPct: number,
): number {
  const i = tinAnualPct / 100 / 12;
  const n = Math.max(1, plazoMesesTotal - cuotasPagadas);
  const C = principalVivo;
  if (i === 0) return C / n;
  return (C * i) / (1 - Math.pow(1 + i, -n));
}
