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

export const getMesaAtlasRecommendations = (
  input: MesaAtlasInput,
  result: MesaAtlasResult
): MesaAtlasRecommendation[] => {
  const recommendations: MesaAtlasRecommendation[] = [];

  if (result.riesgoConcentracion >= 70) {
    recommendations.push({
      id: 'diversificacion-ingresos',
      titulo: 'Diversificar ingresos en 90 días',
      descripcion: 'Define una segunda fuente con objetivo mínimo de 10% de tus ingresos mensuales.',
      impacto: 'alto'
    });
  }

  if (input.colchonMeses < 3) {
    recommendations.push({
      id: 'colchon-liquidez',
      titulo: 'Subir colchón a 3 meses',
      descripcion: 'Automatiza ahorro mensual para alcanzar un colchón de liquidez estable.',
      impacto: 'alto'
    });
  }

  const totalIngresos = input.ingresos.trabajo + input.ingresos.inmuebles + input.ingresos.inversiones;
  if (totalIngresos > 0 && input.gastoMedioMensual / totalIngresos > 0.85) {
    recommendations.push({
      id: 'optimizar-gasto',
      titulo: 'Reducir ratio gasto/ingreso',
      descripcion: 'Revisa gastos recurrentes para liberar al menos 10% de capacidad de ahorro.',
      impacto: 'medio'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'consolidacion',
      titulo: 'Consolidar la estabilidad actual',
      descripcion: 'Mantén seguimiento semanal y refuerza la pata más débil con una meta trimestral.',
      impacto: 'medio'
    });
  }

  return recommendations.slice(0, 3);
};

export const getMesaAtlasInstabilityAlerts = (
  input: MesaAtlasInput,
  result: MesaAtlasResult
): Array<{ id: string; titulo: string; descripcion: string; urgencia: 'alta' | 'media' }> => {
  const alerts: Array<{ id: string; titulo: string; descripcion: string; urgencia: 'alta' | 'media' }> = [];

  if (result.riesgoConcentracion >= 75) {
    alerts.push({
      id: 'mesa-riesgo-concentracion',
      titulo: 'Dependencia alta de una sola pata',
      descripcion: `${result.riesgoConcentracion}% de tus ingresos provienen de una sola fuente.`,
      urgencia: 'alta'
    });
  }

  if (input.colchonMeses < 2) {
    alerts.push({
      id: 'mesa-colchon-bajo',
      titulo: 'Colchón por debajo del mínimo',
      descripcion: 'Tu liquidez está por debajo de 2 meses recomendados para contingencias.',
      urgencia: 'alta'
    });
  }

  if (result.score < 45) {
    alerts.push({
      id: 'mesa-score-critico',
      titulo: 'Estabilidad general en zona crítica',
      descripcion: 'Activa el plan de 90 días para reforzar patas débiles.',
      urgencia: 'media'
    });
  }

  return alerts;
};

export const simulateMesaAtlasResilience = (input: MesaAtlasInput): ResilienceScenario[] => {
  const baseMeses = clamp(input.colchonMeses, 0, 24);
  const ingresoTotal = input.ingresos.trabajo + input.ingresos.inmuebles + input.ingresos.inversiones;
  const ingresoSinPrincipal = ingresoTotal - Math.max(input.ingresos.trabajo, input.ingresos.inmuebles, input.ingresos.inversiones);
  const coberturaSinPrincipal = input.gastoMedioMensual > 0 ? ingresoSinPrincipal / input.gastoMedioMensual : 0;

  return [
    {
      id: 'loss-main-income',
      nombre: 'Pérdida del ingreso principal',
      mesesEstabilidad: clamp(Math.round(baseMeses + coberturaSinPrincipal * 3), 0, 24)
    },
    {
      id: 'extraordinary-expense',
      nombre: 'Gasto extraordinario equivalente a 1 mes',
      mesesEstabilidad: clamp(Math.round(baseMeses - 1), 0, 24)
    },
    {
      id: 'temporary-drop',
      nombre: 'Caída temporal del 20% de ingresos',
      mesesEstabilidad: clamp(Math.round(baseMeses - 0.5), 0, 24)
    }
  ];
};
