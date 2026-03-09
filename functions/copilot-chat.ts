import type { Handler, HandlerEvent } from '@netlify/functions';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CopilotRequestBody {
  message: string;
  history?: ChatMessage[];
  context?: {
    userName?: string;
    goals?: string[];
    monthlyIncome?: number;
    monthlyExpenses?: number;
    language?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const buildSystemPrompt = (context?: CopilotRequestBody['context']) => {
  const language = context?.language || 'es';

  return [
    'Eres Atlas Copilot, un consejero financiero digital para clientes particulares en España.',
    'Tu tono es claro, empático y accionable.',
    'Reglas de respuesta:',
    '1) No inventes datos, si falta contexto dilo explícitamente.',
    '2) Da respuestas breves y prácticas.',
    '3) Devuelve SIEMPRE en este formato:',
    '   - Resumen (1-2 frases)',
    '   - 3 Acciones recomendadas',
    '   - Riesgo/alerta principal',
    '4) Incluye una advertencia corta: "Orientación informativa, no asesoramiento legal/fiscal".',
    `5) Responde en idioma: ${language}.`,
    context?.userName ? `Nombre del cliente: ${context.userName}` : null,
    context?.goals?.length ? `Objetivos: ${context.goals.join(', ')}` : null,
    typeof context?.monthlyIncome === 'number' ? `Ingresos mensuales estimados: ${context.monthlyIncome} EUR` : null,
    typeof context?.monthlyExpenses === 'number' ? `Gastos mensuales estimados: ${context.monthlyExpenses} EUR` : null,
  ]
    .filter(Boolean)
    .join('\n');
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Falta OPENROUTER_API_KEY en variables de entorno',
      }),
    };
  }

  try {
    const parsed: CopilotRequestBody = JSON.parse(event.body || '{}');

    if (!parsed.message || !parsed.message.trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'El campo message es obligatorio' }),
      };
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(parsed.context) },
      ...(parsed.history || []).slice(-8).filter((m) => m.role !== 'system'),
      { role: 'user', content: parsed.message.trim() },
    ];

    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:8888',
        'X-Title': 'Atlas Copilot',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages,
      }),
    });

    const data = await llmResponse.json();

    if (!llmResponse.ok) {
      return {
        statusCode: llmResponse.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error?.message || 'Error al consultar el proveedor de IA',
        }),
      };
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Respuesta vacía del modelo' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        model,
        answer,
      }),
    };
  } catch (error) {
    console.error('copilot-chat error', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No se pudo procesar la solicitud' }),
    };
  }
};
