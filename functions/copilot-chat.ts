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
    profileType?: 'particular' | 'autonomo' | 'sociedad';
    goals?: string[];
    monthlyIncome?: number;
    monthlyExpenses?: number;
    cashAvailable?: number;
    emergencyFundMonths?: number;
    debt?: {
      total?: number;
      monthlyPayment?: number;
      averageInterestRate?: number;
    };
    realEstate?: {
      propertiesOwned?: number;
      occupancyRate?: number;
      monthlyRentIncome?: number;
      monthlyPropertyCosts?: number;
      netCashflow?: number;
      targetYield?: number;
    };
    alerts?: {
      minLiquidityMonths?: number;
      maxDebtToIncome?: number;
      minNetYield?: number;
    };
    preferredHorizon?: 'corto' | 'medio' | 'largo';
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
  const contextSnapshot = {
    userName: context?.userName || null,
    profileType: context?.profileType || null,
    goals: context?.goals || [],
    monthlyIncome: context?.monthlyIncome ?? null,
    monthlyExpenses: context?.monthlyExpenses ?? null,
    cashAvailable: context?.cashAvailable ?? null,
    emergencyFundMonths: context?.emergencyFundMonths ?? null,
    debt: context?.debt || null,
    realEstate: context?.realEstate || null,
    alerts: context?.alerts || null,
    preferredHorizon: context?.preferredHorizon || null,
  };

  const contextJson = JSON.stringify(contextSnapshot, null, 2);

  return [
    'Eres Atlas Copilot, asistente financiero para el día a día de clientes en España con foco en finanzas personales, tesorería e inversión en inmuebles para alquiler.',
    `Responde en idioma: ${language}.`,
    'Tono: claro, directo, empático y accionable.',
    'Prioridad: ayudar a tomar decisiones, dar feedback y disparar alertas tempranas.',
    '',
    'REGLAS DE ORO:',
    '1) No inventes datos ni supuestos ocultos. Si faltan datos críticos, dilo y pide exactamente qué falta.',
    '2) Usa SIEMPRE primero el contexto disponible del cliente (adjunto abajo) antes de recomendar.',
    '3) Si hay objetivos declarados, alinea recomendaciones a esos objetivos y al horizonte temporal.',
    '4) Señala riesgos de liquidez, sobreendeudamiento, concentración inmobiliaria o rentabilidad insuficiente cuando aplique.',
    '5) Si detectas incoherencias numéricas, repórtalas explícitamente.',
    '6) Nunca des asesoramiento legal/fiscal vinculante. Incluye la frase exacta al final: "Orientación informativa, no asesoramiento legal/fiscal".',
    '',
    'FORMATO OBLIGATORIO DE RESPUESTA:',
    '- Resumen ejecutivo (máx. 3 frases).',
    '- Decisión o feedback principal (1 bloque claro).',
    '- 3 acciones recomendadas priorizadas (Alta/Media/Baja).',
    '- Alertas y umbrales vigilados (si no hay alertas, indica "Sin alertas críticas").',
    '- Datos faltantes para mejorar la recomendación (máx. 5 puntos).',
    '- Cierre obligatorio: "Orientación informativa, no asesoramiento legal/fiscal".',
    '',
    'CONTEXTO ESTRUCTURADO DEL CLIENTE (fuente de verdad para esta conversación):',
    contextJson,
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
