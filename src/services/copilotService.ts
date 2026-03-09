import { dashboardService } from './dashboardService';

export type CopilotRole = 'user' | 'assistant';

export interface CopilotMessage {
  role: CopilotRole;
  content: string;
}

export interface CopilotContext {
  userName?: string;
  goals?: string[];
  monthlyIncome?: number;
  monthlyExpenses?: number;
  language?: string;
}

export interface CopilotReply {
  answer: string;
  model?: string;
}

const buildFinancialContext = async (): Promise<string> => {
  try {
    const [patrimonio, flujos, tesoreria] = await Promise.all([
      dashboardService.getPatrimonioNeto(),
      dashboardService.getFlujosCaja(),
      dashboardService.getTesoreriaPanel(),
    ]);

    const contexto = {
      patrimonioNeto: patrimonio.total,
      cashflow: {
        totalMensual: flujos.trabajo.netoMensual + flujos.inmuebles.cashflow + flujos.inversiones.rendimientoMes + flujos.inversiones.dividendosMes,
        trabajoNetoMensual: flujos.trabajo.netoMensual,
        inmueblesMensual: flujos.inmuebles.cashflow,
        inversionesMensual: flujos.inversiones.rendimientoMes + flujos.inversiones.dividendosMes,
      },
      tesoreriaPorBanco: tesoreria.filas.map((fila) => ({
        banco: fila.banco,
        saldoHoy: fila.hoy,
        proyeccionMes: fila.proyeccion,
      })),
      ocupacionInmuebles: flujos.inmuebles.ocupacion,
      deudaTotal: patrimonio.desglose.deuda,
      inversiones: {
        valorTotal: patrimonio.desglose.inversiones,
        rendimientoMes: flujos.inversiones.rendimientoMes,
        dividendosMes: flujos.inversiones.dividendosMes,
      },
      fechaCalculo: patrimonio.fechaCalculo,
    };

    return JSON.stringify(contexto);
  } catch (error) {
    console.warn('No se pudo construir el contexto financiero para Copilot:', error);
    return 'Datos financieros no disponibles';
  }
};

export const askCopilot = async (
  message: string,
  _history: CopilotMessage[],
  _context?: CopilotContext
): Promise<CopilotReply> => {
  const contexto = await buildFinancialContext();

  const response = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tipo: 'chat',
      mensaje: message,
      contexto,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo obtener respuesta del copiloto');
  }

  return {
    answer: data.respuesta,
    model: data.model,
  };
};
