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
    const esComplementaria = Boolean(decl?.meta?.esComplementaria);
    if (!esComplementaria) return DEFAULT_INFO;
    return {
      esComplementaria: true,
      justificanteAnterior: decl?.meta?.declaracionPrevia?.justificante,
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
