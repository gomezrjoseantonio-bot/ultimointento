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
  history: CopilotMessage[],
  context?: CopilotContext
): Promise<CopilotReply> => {
  const response = await fetch('/.netlify/functions/copilot-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history,
      context,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo obtener respuesta del copiloto');
  }

  return {
    answer: data.answer,
    model: data.model,
  };
};
