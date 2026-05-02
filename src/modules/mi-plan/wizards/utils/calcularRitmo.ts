// T27.1 · cálculo del "ritmo necesario" mostrado en el paso 3 del wizard.
//
// La capacidad de ahorro mensual real se calcula automáticamente en T8
// (cuando cierre el módulo de capacidad). Mientras tanto T27.1 acepta input
// manual del usuario · ver wiz Step3.

export type RitmoEstado = 'ok' | 'tight' | 'no';

export interface RitmoResult {
  mesesRestantes: number;
  faltaImporte: number;             // valorMeta - valorActual · mínimo 0
  ritmoNecesarioMensual: number;    // €/mes
  margen: number;                    // capacidad - ritmo
  estado: RitmoEstado;
  mensaje: string;
}

const MES_MS = 1000 * 60 * 60 * 24 * 30.4375;

export function mesesEntre(desde: Date, hasta: Date): number {
  if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime())) return 0;
  const diff = hasta.getTime() - desde.getTime();
  return Math.max(0, Math.round(diff / MES_MS));
}

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

export function calcularRitmo(params: {
  valorActual: number;
  valorMeta: number;
  fechaObjetivo: Date | null;
  capacidadAhorroActual: number;
}): RitmoResult {
  const { valorActual, valorMeta, fechaObjetivo, capacidadAhorroActual } = params;
  const falta = Math.max(0, valorMeta - valorActual);
  const meses = fechaObjetivo ? mesesEntre(new Date(), fechaObjetivo) : 0;
  const ritmo = meses > 0 ? falta / meses : 0;
  const margen = capacidadAhorroActual - ritmo;

  let estado: RitmoEstado;
  if (capacidadAhorroActual <= 0) {
    estado = 'no';
  } else if (margen <= 0) {
    estado = 'no';
  } else if (margen / Math.max(capacidadAhorroActual, 1) < 0.10) {
    estado = 'tight';
  } else {
    estado = 'ok';
  }

  let mensaje: string;
  if (meses === 0) {
    mensaje = 'Elige una fecha objetivo en el futuro para calcular el ritmo necesario.';
  } else if (capacidadAhorroActual <= 0) {
    mensaje = `Para reunir ${fmtEur(falta)} en ${meses} meses necesitas aportar ${fmtEur(ritmo)} al mes. Indica tu capacidad de ahorro mensual estimada para validar si vas en ruta.`;
  } else if (estado === 'ok') {
    mensaje = `Para reunir ${fmtEur(falta)} faltantes en ${meses} meses necesitas aportar ${fmtEur(ritmo)} al mes. Tu capacidad de ahorro indicada es ${fmtEur(capacidadAhorroActual)} · llegas con margen.`;
  } else if (estado === 'tight') {
    mensaje = `Llegarás justo · margen apretado de ${fmtEur(margen)}/mes. Pequeñas desviaciones rompen la ruta. Considera alargar la fecha o subir aportación.`;
  } else {
    const deficit = Math.max(0, -margen);
    mensaje = `No llegas con tu capacidad actual · te faltan ${fmtEur(deficit)}/mes. Sugerencia · alargar fecha objetivo o subir capacidad de ahorro.`;
  }

  return {
    mesesRestantes: meses,
    faltaImporte: falta,
    ritmoNecesarioMensual: ritmo,
    margen,
    estado,
    mensaje,
  };
}
