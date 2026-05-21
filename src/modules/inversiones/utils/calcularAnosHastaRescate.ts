// Calcula años restantes hasta la edad objetivo de rescate del usuario.
// Sigue el patrón ya usado en `proyeccionActivoService` (combina edad
// objetivo del escenario `mi-plan` con `fechaNacimiento` de PersonalData).
//
// Devuelve también `esEstimacionPorDefecto = true` cuando se aplican los
// defaults educativos (sin fecha de nacimiento → asumir 45 años edad
// actual) para que la UI pueda etiquetar el KPI como estimación.

export interface ResultadoAnosHastaRescate {
  anos: number;
  esEstimacionPorDefecto: boolean;
}

export const EDAD_OBJETIVO_RESCATE_DEFAULT = 65;
export const EDAD_ACTUAL_DEFAULT = 45;

const MS_POR_ANO = 365.25 * 24 * 60 * 60 * 1000;

export function calcularAnosHastaRescate(
  escenario: { edadObjetivoRescate?: number } | null | undefined,
  fechaNacimientoUsuario: string | null | undefined,
  fechaReferencia: Date = new Date(),
): ResultadoAnosHastaRescate {
  const edadObjetivo =
    escenario?.edadObjetivoRescate ?? EDAD_OBJETIVO_RESCATE_DEFAULT;

  let edadActual: number;
  let esEstimacionPorDefecto = false;

  if (fechaNacimientoUsuario) {
    const nacimiento = new Date(fechaNacimientoUsuario);
    if (Number.isNaN(nacimiento.getTime()) || nacimiento > fechaReferencia) {
      edadActual = EDAD_ACTUAL_DEFAULT;
      esEstimacionPorDefecto = true;
    } else {
      edadActual =
        (fechaReferencia.getTime() - nacimiento.getTime()) / MS_POR_ANO;
    }
  } else {
    edadActual = EDAD_ACTUAL_DEFAULT;
    esEstimacionPorDefecto = true;
  }

  const anos = Math.max(1, Math.round(edadObjetivo - edadActual));
  return { anos, esEstimacionPorDefecto };
}
