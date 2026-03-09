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

export const askCopilot = async (
  message: string,
  _history: CopilotMessage[],
  _context?: CopilotContext
): Promise<CopilotReply> => {
  const response = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tipo: 'chat',
      mensaje: message,
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
