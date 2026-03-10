const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CHAT_MODEL = 'claude-haiku-4-5-20251001';
const SCAN_MODEL = 'claude-sonnet-4-6';

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function cleanBase64(base64Input) {
  if (!base64Input || typeof base64Input !== 'string') return null;
  const trimmed = base64Input.trim();
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex !== -1) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

async function callAnthropic({ model, system, messages, maxTokens = 800, temperature = 0.2 }) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error?.message || 'Error al consultar Anthropic',
      raw: data,
    };
  }

  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim()
    : '';

  return {
    ok: true,
    status: response.status,
    text,
    raw: data,
  };
}

exports.handler = async (event) => {
  console.log('API KEY existe:', !!process.env.ANTHROPIC_API_KEY);

  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Método no permitido' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse(500, {
      ok: false,
      error: 'Falta ANTHROPIC_API_KEY en variables de entorno',
    });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const tipo = body?.tipo;

    if (tipo === 'chat') {
      const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
      const contexto = typeof body?.contexto === 'string' ? body.contexto.trim() : '';

      if (!mensaje) {
        return jsonResponse(400, { ok: false, error: 'El campo "mensaje" es obligatorio para tipo "chat"' });
      }

      const system = [
        'Eres un asesor financiero personal en España.',
        'Responde en español claro, práctico y responsable.',
        'No inventes datos; si falta información, indica qué falta.',
        'Incluye advertencias breves cuando exista riesgo financiero o fiscal.',
        'No sustituyes asesoramiento profesional legal/fiscal.',
        `Datos financieros actuales del usuario: ${contexto || 'No disponible'}`,
      ].join(' ');

      const result = await callAnthropic({
        model: CHAT_MODEL,
        system,
        maxTokens: 700,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: mensaje }],
          },
        ],
      });

      if (!result.ok) {
        return jsonResponse(result.status || 502, { ok: false, error: result.error, details: result.raw });
      }

      return jsonResponse(200, {
        ok: true,
        tipo: 'chat',
        model: CHAT_MODEL,
        respuesta: result.text,
      });
    }

    if (tipo === 'scan') {
      const base64Data = cleanBase64(body?.imagen);

      if (!base64Data) {
        return jsonResponse(400, { ok: false, error: 'El campo "imagen" en base64 es obligatorio para tipo "scan"' });
      }

      const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
        ? body.mimeType.trim()
        : 'image/jpeg';
      const normalizedMimeType = mimeType.toLowerCase();
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(normalizedMimeType);
      const mediaBlock = isImage
        ? {
            type: 'image',
            source: {
              type: 'base64',
              media_type: normalizedMimeType,
              data: base64Data,
            },
          }
        : {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
          };

      const system = `Eres un experto en OCR de documentos fiscales españoles.
Analiza la imagen y extrae datos con máxima precisión.

REGLAS:
- importe_total: importe final con IVA incluido. Busca "TOTAL", "TOTAL A PAGAR", "IMPORTE TOTAL". Devuelve número, no string.
- iva: importe del IVA en euros (NO el porcentaje). Busca "IVA 21%", "IVA 10%", "Cuota IVA". Devuelve número.
- base_imponible: importe antes de IVA. Busca "BASE", "SUBTOTAL", "BASE IMPONIBLE". Devuelve número.
- proveedor: nombre de la empresa emisora, NO del receptor ni del cliente.
- fecha: fecha de emisión en formato DD/MM/YYYY.
- numero_factura: número o referencia del documento.
- moneda: código ISO, EUR por defecto.
- confianza: número entre 0 y 1 según tu seguridad global.
- notas: campos dudosos o advertencias relevantes.

Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional.
Si un campo no aparece en el documento usa null.`;

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        maxTokens: 1200,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae todos los datos fiscales de este documento.',
              },
              mediaBlock,
            ],
          },
        ],
      });

      if (!result.ok) {
        return jsonResponse(result.status || 502, { ok: false, error: result.error, details: result.raw });
      }

      let extraido = result.text;
      try {
        extraido = JSON.parse(result.text);
      } catch (_e) {
        // Si el modelo no devuelve JSON parseable, se conserva el texto bruto.
      }

      return jsonResponse(200, {
        ok: true,
        tipo: 'scan',
        model: SCAN_MODEL,
        extraido,
      });
    }

    return jsonResponse(400, {
      ok: false,
      error: 'El campo "tipo" debe ser "chat" o "scan"',
    });
  } catch (error) {
    console.error('netlify/functions/chat error:', error);
    return jsonResponse(500, {
      ok: false,
      error: 'No se pudo procesar la solicitud',
    });
  }
};
