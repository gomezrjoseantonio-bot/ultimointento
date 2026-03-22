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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function cleanBase64(base64Input) {
  if (!base64Input || typeof base64Input !== 'string') return null;
  const trimmed = base64Input.trim();
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex !== -1) return trimmed.slice(commaIndex + 1);
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
    body: JSON.stringify({ model, system, max_tokens: maxTokens, temperature, messages }),
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

  return { ok: true, status: response.status, text, raw: data };
}

exports.handler = async (event) => {
  console.log('API KEY existe:', !!process.env.ANTHROPIC_API_KEY);

  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST') return jsonResponse(405, { ok: false, error: 'Método no permitido' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse(500, { ok: false, error: 'Falta ANTHROPIC_API_KEY en variables de entorno' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const tipo = body?.tipo;

    // ── CHAT ──────────────────────────────────────────────────────────────
    if (tipo === 'chat') {
      const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
      const contexto = typeof body?.contexto === 'string' ? body.contexto.trim() : '';

      if (!mensaje) return jsonResponse(400, { ok: false, error: 'El campo "mensaje" es obligatorio para tipo "chat"' });

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
        messages: [{ role: 'user', content: [{ type: 'text', text: mensaje }] }],
      });

      if (!result.ok) return jsonResponse(result.status || 502, { ok: false, error: result.error, details: result.raw });

      return jsonResponse(200, { ok: true, tipo: 'chat', model: CHAT_MODEL, respuesta: result.text });
    }

    // ── SCAN ──────────────────────────────────────────────────────────────
    if (tipo === 'scan') {
      const base64Data = cleanBase64(body?.imagen);
      if (!base64Data) return jsonResponse(400, { ok: false, error: 'El campo "imagen" en base64 es obligatorio para tipo "scan"' });

      const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
        ? body.mimeType.trim()
        : 'image/jpeg';
      const normalizedMimeType = mimeType.toLowerCase();
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(normalizedMimeType);

      const mediaBlock = isImage
        ? { type: 'image', source: { type: 'base64', media_type: normalizedMimeType, data: base64Data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };

      const system = `Eres un experto en OCR de documentos fiscales españoles.
Analiza el documento y extrae datos con máxima precisión.

CAMPOS A EXTRAER:
- proveedor: nombre de la empresa emisora (quien emite la factura, NO el receptor).
- numero_factura: número o referencia del documento.
- fecha: fecha de emisión en formato DD/MM/YYYY.
- base_imponible: importe antes de IVA. Busca "BASE", "SUBTOTAL", "BASE IMPONIBLE". Número.
- iva: importe del IVA en euros (NO el porcentaje). Busca "IVA 21%", "Cuota IVA". Número.
- importe_total: importe final con IVA incluido. Busca "TOTAL", "TOTAL A PAGAR". Número.
- moneda: código ISO, EUR por defecto.
- direccion: dirección completa del RECEPTOR o cliente (a quien va dirigida la factura: calle, ciudad, CP). String o null. NO es la dirección del proveedor/emisor.
- tipo_gasto: categoría del gasto. Elige UNA de: "telecomunicaciones", "electricidad", "agua", "gas", "alquiler", "seguros", "mantenimiento", "transporte", "alimentacion", "material_oficina", "servicios_profesionales", "otros".
  Ejemplos: Orange/Simyo/Vodafone/Movistar → "telecomunicaciones"; Iberdrola/Endesa/Naturgy eléctrica → "electricidad"; Naturgy gas/Repsol gas → "gas"; Canal de Isabel/Aguas → "agua".
- confianza: número entre 0 y 1 según tu seguridad global.
- notas: campos dudosos o advertencias relevantes. String o null.

Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional.
Si un campo no aparece en el documento usa null.`;

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        maxTokens: 1400,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae todos los datos fiscales de este documento.' },
              mediaBlock,
            ],
          },
        ],
      });

      if (!result.ok) return jsonResponse(result.status || 502, { ok: false, error: result.error, details: result.raw });

      console.log('Claude raw text:', result.text);

      let extraido = result.text;
      try {
        extraido = JSON.parse(result.text);
      } catch (_e) {
        // Si el modelo no devuelve JSON parseable, se conserva el texto bruto.
      }

      return jsonResponse(200, { ok: true, tipo: 'scan', model: SCAN_MODEL, extraido });
    }

    // ── SCAN IRPF ────────────────────────────────────────────────────────────
    if (tipo === 'scan_irpf') {
      const promptOverride = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
      const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
        ? body.mimeType.trim()
        : 'application/pdf';
      const normalizedMimeType = mimeType.toLowerCase();
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(normalizedMimeType);

      const imagenes = Array.isArray(body?.imagenes)
        ? body.imagenes.map(cleanBase64).filter(Boolean)
        : [];
      const base64Data = cleanBase64(body?.imagen);

      const texto = typeof body?.texto === 'string' ? body.texto.trim() : '';

      const mediaBlocks = imagenes.length > 0
        ? imagenes.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: img },
          }))
        : base64Data
          ? [
              isImage
                ? { type: 'image', source: { type: 'base64', media_type: normalizedMimeType, data: base64Data } }
                : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
            ]
          : [];

      if (!mediaBlocks.length && !texto) {
        return jsonResponse(400, { ok: false, error: 'Campo "imagen", "imagenes" o "texto" obligatorio' });
      }

      const system = promptOverride || `Eres un experto en declaraciones de IRPF españolas (Modelo 100).
Analiza el documento y extrae los valores de las casillas AEAT con máxima precisión.

CASILLAS A EXTRAER (devuelve TODAS las que encuentres):

BASES IMPONIBLES:
- 0435: Base imponible general
- 0460: Base imponible del ahorro
- 0500 o 0505: Base liquidable general
- 0510: Base liquidable del ahorro

CUOTAS:
- 0545: Cuota íntegra estatal
- 0546: Cuota íntegra autonómica
- 0570: Cuota líquida estatal
- 0571: Cuota líquida autonómica
- 0587: Cuota líquida incrementada total
- 0595: Cuota resultante autoliquidación

RETENCIONES:
- 0596: Retenciones del trabajo
- 0597: Retenciones capital mobiliario
- 0599: Retenciones actividades económicas
- 0604: Pagos fraccionados
- 0609: Total pagos a cuenta

RESULTADO:
- 0610: Cuota diferencial
- 0670: Resultado de la declaración
- 0676: Regularización (si existe)

RENDIMIENTOS (opcionales pero valiosos):
- 0022 o 0025: Rendimiento neto del trabajo
- 0156: Rendimientos inmobiliarios netos reducidos
- 0224 o 0226: Rendimiento neto actividades económicas

INSTRUCCIONES:
- Los importes negativos deben incluir el signo negativo
- Usa el formato numérico con punto decimal (ej: 148505.78, no 148.505,78)
- Si una casilla no aparece en el documento, NO la incluyas
- Devuelve ÚNICAMENTE un objeto JSON con formato {"casilla": valor}
- Sin texto adicional, sin markdown, sin explicaciones

Ejemplo de respuesta:
{"0435": 148505.78, "0460": 357.63, "0545": 27638.03, "0670": 1859.88}`;

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        maxTokens: 8000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: texto || 'Extrae todas las casillas AEAT de esta declaración IRPF (Modelo 100) y devuelve solo JSON válido.' },
              ...mediaBlocks,
            ],
          },
        ],
      });

      if (!result.ok) return jsonResponse(result.status || 502, { ok: false, error: result.error, details: result.raw });

      let extraido = result.text;
      try {
        extraido = JSON.parse(result.text);
      } catch (_e) {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extraido = JSON.parse(jsonMatch[0]);
          } catch {
            // mantener texto original
          }
        }
      }

      return jsonResponse(200, { ok: true, tipo: 'scan_irpf', model: SCAN_MODEL, extraido });
    }

    return jsonResponse(400, { ok: false, error: 'El campo "tipo" debe ser "chat", "scan" o "scan_irpf"' });
  } catch (error) {
    console.error('netlify/functions/chat error:', error);
    return jsonResponse(500, { ok: false, error: 'No se pudo procesar la solicitud' });
  }
};
