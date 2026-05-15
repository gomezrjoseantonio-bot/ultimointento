/**
 * paralelaService.ts · detección de declaración complementaria/paralela.
 *
 * Lee el flag `meta.esComplementaria` y `meta.declaracionPrevia` de la
 * `DeclaracionCompleta` persistida en `ejerciciosFiscalesCoord[año].aeat`
 * (la rellena el parser XML AEAT vía `irpfXmlParserService` y la guarda
 * `declaracionDistributorService.guardarEjercicioFiscal`).
 *
 * Sub-tarea 3.x ajuste 1 · sustituye el "v1 sin paralelas" hardcoded para
 * 2022/2023 que tienen <Complementaria> + <nroJustificanteAnterior>.
 */

import { getEjercicio } from '../../../../services/ejercicioResolverService';

export interface ParalelaInfo {
  esComplementaria: boolean;
  justificanteAnterior?: string;
  /** "v1" original (no complementaria) · "v2" hay declaración previa */
  versionLabel: 'v1' | 'v2';
}

const DEFAULT_INFO: ParalelaInfo = {
  esComplementaria: false,
  versionLabel: 'v1',
};

export async function getParalelaInfo(año: number): Promise<ParalelaInfo> {
  try {
    const coord = await getEjercicio(año);
    const decl = coord?.aeat?.declaracionCompleta as
      | { meta?: { esComplementaria?: boolean; declaracionPrevia?: { justificante?: string } } }
      | undefined;
    const flag = Boolean(decl?.meta?.esComplementaria);
    const justAnterior = decl?.meta?.declaracionPrevia?.justificante?.trim();
    // Requerimos AMBOS para considerar la declaración "Complementaria":
    // (1) el flag `esComplementaria` que el parser XML deriva de los nodos
    //     `Z9`/`Z24` en `OtraDeclaracion`, y
    // (2) un `declaracionPrevia.justificante` no vacío (toda complementaria
    //     real corrige una previa identificada por justificante).
    // Z9/Z24 también puede aparecer en declaraciones con autoliquidación
    // rectificativa parcial sin que sea realmente una complementaria — sin
    // justificante anterior no la marcamos. Esto evita la falsa positiva
    // observada en la 2024 de Jose (cuyas paralelas reales son 2022 y 2023).
    const esComplementaria = flag && Boolean(justAnterior);
    if (!esComplementaria) return DEFAULT_INFO;
    return {
      esComplementaria: true,
      justificanteAnterior: justAnterior,
      versionLabel: 'v2',
    };
  } catch {
    return DEFAULT_INFO;
  }
}

export async function getParalelaInfoMultiAño(años: number[]): Promise<Map<number, ParalelaInfo>> {
  const entries = await Promise.all(
    años.map(async (año) => [año, await getParalelaInfo(año)] as const),
  );
  return new Map(entries);
}
