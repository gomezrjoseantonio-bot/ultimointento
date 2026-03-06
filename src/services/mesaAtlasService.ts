export interface MesaAtlasInput {
  ingresos: {
    trabajo: number;
    inmuebles: number;
    inversiones: number;
  };
  gastoMedioMensual: number;
  colchonMeses: number;
  variacionMensualPorcentaje: number;
}

export interface MesaAtlasResult {
  score: number;
  patasActivas: number;
  riesgoConcentracion: number;
  principalRiesgo: string;
}

export interface MesaAtlasRecommendation {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface ResilienceScenario {
  id: string;
  nombre: string;
  mesesEstabilidad: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const toPercent = (value: number): number => clamp(Math.round(value * 100), 0, 100);

const diversificationScore = (ingresos: MesaAtlasInput['ingresos']): number => {
  const values = [ingresos.trabajo, ingresos.inmuebles, ingresos.inversiones].map((v) => Math.max(v, 0));
  const total = values.reduce((acc, value) => acc + value, 0);

  if (total <= 0) return 0;

  const maxShare = Math.max(...values) / total;
  return toPercent(1 - maxShare);
};

const liquidityScore = (colchonMeses: number): number => {
  // 6+ meses se considera óptimo en esta v0
  return toPercent(clamp(colchonMeses, 0, 6) / 6);
};

const expenseStabilityScore = (gastoMedioMensual: number, totalIngresos: number): number => {
  if (totalIngresos <= 0 || gastoMedioMensual <= 0) return 0;

  const ratio = gastoMedioMensual / totalIngresos;

  // Ratio <= 0.7 excelente, 1.0 límite, >1 crítico
  if (ratio <= 0.7) return 100;
  if (ratio >= 1.1) return 0;

  return toPercent((1.1 - ratio) / 0.4);
};

const trendScore = (variacionMensualPorcentaje: number): number => {
  // Normaliza de -20% a +20%
  const normalized = (clamp(variacionMensualPorcentaje, -20, 20) + 20) / 40;
  return toPercent(normalized);
};

const principalRiskLabel = (riesgoConcentracion: number, colchonMeses: number): string => {
  if (riesgoConcentracion >= 70) {
    return `Alta dependencia: ${riesgoConcentracion}% de tus ingresos dependen de 1 fuente`;
  }

  if (colchonMeses < 3) {
    return 'Liquidez limitada: tu colchón es menor a 3 meses';
  }

  return 'Riesgo controlado: mantiene diversificación y colchón estable';
};

export const calculateMesaAtlasIndex = (input: MesaAtlasInput): MesaAtlasResult => {
  const ingresos = {
    trabajo: Math.max(input.ingresos.trabajo, 0),
    inmuebles: Math.max(input.ingresos.inmuebles, 0),
    inversiones: Math.max(input.ingresos.inversiones, 0)
  };

  const totalIngresos = ingresos.trabajo + ingresos.inmuebles + ingresos.inversiones;

  const diversification = diversificationScore(ingresos);
  const liquidity = liquidityScore(input.colchonMeses);
  const expenseStability = expenseStabilityScore(input.gastoMedioMensual, totalIngresos);
  const trend = trendScore(input.variacionMensualPorcentaje);

  const weighted =
    diversification * 0.4 +
    liquidity * 0.3 +
    expenseStability * 0.2 +
    trend * 0.1;

  const activeIncomePatas = [ingresos.trabajo, ingresos.inmuebles, ingresos.inversiones].filter((v) => v > 0).length;
  const safetyPata = input.colchonMeses >= 1 ? 1 : 0;
  const patasActivas = Math.min(4, activeIncomePatas + safetyPata);

  const riesgoConcentracion = totalIngresos > 0
    ? toPercent(Math.max(ingresos.trabajo, ingresos.inmuebles, ingresos.inversiones) / totalIngresos)
    : 100;

  return {
    score: clamp(Math.round(weighted), 0, 100),
    patasActivas,
    riesgoConcentracion,
    principalRiesgo: principalRiskLabel(riesgoConcentracion, input.colchonMeses)
  };
};
