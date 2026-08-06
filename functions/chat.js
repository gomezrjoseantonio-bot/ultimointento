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

function detectMimeFromBase64(base64Data) {
  if (!base64Data) return 'image/png';
  const header = base64Data.slice(0, 16);
  if (header.startsWith('iVBOR')) return 'image/png';
  if (header.startsWith('/9j/')) return 'image/jpeg';
  if (header.startsWith('R0lG')) return 'image/gif';
  if (header.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
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

      const mimeTypes = Array.isArray(body?.mimeTypes) ? body.mimeTypes : [];
      const mediaBlocks = imagenes.length > 0
        ? imagenes.map((img, i) => ({
            type: 'image',
            source: { type: 'base64', media_type: (mimeTypes[i] || detectMimeFromBase64(img)).toLowerCase(), data: img },
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

      const system = promptOverride || (texto ? texto : `Estás analizando una declaración completa de la Renta española (Modelo 100 — IRPF) en PDF.

TAREA: Extrae TODAS las casillas con su número y valor. Cada casilla tiene un número de 4 dígitos (como 0003, 0435, 0670, 1224) seguido de un valor numérico o de texto.

FORMATO DE RESPUESTA: Devuelve SOLO un JSON válido, sin markdown, sin explicación, sin preámbulo. El JSON debe ser un objeto donde:
- La clave es el número de casilla (string de 4 dígitos, ej: "0003")
- El valor es el número (como number, sin puntos de miles — usa punto decimal) o texto (string)

REGLAS:
1. Extrae ABSOLUTAMENTE TODAS las casillas que veas, sin excepción.
2. Recorre todas las páginas del PDF antes de responder.
3. Los importes en euros: quita los puntos de miles y usa punto como decimal (ej: "133.350,85" → 133350.85).
4. Las fechas déjalas como string: "28/09/1980".
5. Los NIF/NIE déjalos como string: "53069494F".
6. Los porcentajes como número: "100,00" → 100.
7. Si una casilla tiene "X" o una marca de selección, usa true.
8. Si una casilla está vacía o con "—", no la incluyas.
9. Las casillas de texto libre (direcciones, nombres, encabezados identificativos) como string.
10. Para casillas repetidas (varios inmuebles, varios titulares o bloques repetidos), usa sufijo: "0102_1", "0102_2", etc.
11. Para la sección "Información adicional" incluye también las casillas 1211-1423 si aparecen.
12. Incluye metadatos identificativos si los ves: ejercicio, nif, nombre, estado_civil, comunidad_autonoma, fecha_nacimiento, fecha_presentacion, numero_justificante, csv.
13. Las referencias catastrales son strings de ~20 caracteres y nunca deben convertirse a número.

Ejemplo de respuesta:
{
  "0001": "GOMEZ RAMIREZ JOSE ANTONIO",
  "0003": 133350.85,
  "0006": true,
  "0066_1": "7949807TP6074N0006YM",
  "0069_1": "CL FUERTES ACEVEDO 0032 1 02 DR OVIEDO",
  "0074_2": true,
  "0090_2": "7949807TP6074N0006YM",
  "0102_1": 19675,
  "0435": 150924.07,
  "0670": 2899.75,
  "1212_1": "7949807TP6074N0006YM",
  "1224_1": 28239.24,
  "estado_civil": "Soltero/a",
  "comunidad_autonoma": "Madrid",
  "fecha_nacimiento": "28/09/1980"
}`);

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        maxTokens: 16000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: mediaBlocks.length > 0
              ? [
                  { type: 'text', text: texto || 'Extrae todas las casillas AEAT de esta declaración IRPF (Modelo 100) y devuelve solo JSON válido.' },
                  ...mediaBlocks,
                ]
              : (promptOverride
                  ? 'Analiza el texto proporcionado en el system prompt y extrae todas las casillas AEAT devolviendo solo JSON válido.'
                  : texto),
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

    // ── SCAN DATOS FISCALES ──────────────────────────────────────────────────
    if (tipo === 'scan_datos_fiscales') {
      const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
        ? body.mimeType.trim()
        : 'image/jpeg';

      const imagenes = Array.isArray(body?.imagenes)
        ? body.imagenes.map(cleanBase64).filter(Boolean)
        : [];
      const base64Data = cleanBase64(body?.imagen);

      const mimeTypes = Array.isArray(body?.mimeTypes) ? body.mimeTypes : [];
      const mediaBlocks = imagenes.length > 0
        ? imagenes.map((img, i) => ({
            type: 'image',
            source: { type: 'base64', media_type: (mimeTypes[i] || detectMimeFromBase64(img)).toLowerCase(), data: img },
          }))
        : base64Data
          ? [{ type: 'image', source: { type: 'base64', media_type: mimeType.toLowerCase(), data: base64Data } }]
          : [];

      if (!mediaBlocks.length) {
        return jsonResponse(400, { ok: false, error: 'Campo "imagen" o "imagenes" obligatorio para scan_datos_fiscales' });
      }

      const system = `Eres un experto en fiscalidad española. Analiza las capturas de pantalla de los Datos Fiscales de la AEAT y extrae TODOS los datos estructurados.

Devuelve ÚNICAMENTE un objeto JSON con esta estructura:
{
  "ejercicio": 2025,
  "trabajo": [{
    "pagador": "nombre empresa",
    "nif": "A12345678",
    "retribucionDineraria": 118981.06,
    "retribucionEspecie": 2472.73,
    "retencionIRPF": 40990.88,
    "ingresosACuenta": 851.85
  }],
  "actividades": [{
    "tipo": "profesional",
    "epigrafe": "724",
    "pagador": "nombre",
    "nif": "B12345678",
    "ingresos": 5040.66,
    "retencion": 756.11
  }],
  "cuentasBancarias": [{
    "entidad": "ING Direct",
    "cuenta": "ES12...",
    "intereses": 464.65,
    "retencion": 88.08
  }],
  "planesPensiones": [{
    "entidad": "nombre",
    "aportacion": 3259.00
  }],
  "inmuebles": [{
    "refCatastral": "7949807TP6074N0006YM",
    "direccion": "CL FUERTES ACEVEDO 32...",
    "valorCatastral": 89432.00,
    "valorConstruccion": 52180.00,
    "porcentajeParticipacion": 100,
    "diasEnEjercicio": 365,
    "uso": "arrendado",
    "revisado": true,
    "situacion": "1"
  }],
  "prestamos": [{
    "entidad": "ING Direct",
    "nifEntidad": "...",
    "saldoPendiente": 89432.00,
    "interesesPagados": 1201.17,
    "tipo": "hipoteca_vivienda"
  }],
  "entidades": [{
    "nombre": "Residencial Smart Santa Catalina CB",
    "nif": "E25904640",
    "tipoEntidad": "CB",
    "participacion": 10,
    "rendimientos": 1682.80,
    "retenciones": 136.05
  }],
  "arrastres": {
    "gastosPendientes": [{
      "inmueble": "referencia o nombre",
      "importe": 28239.24,
      "origenEjercicio": 2024
    }],
    "perdidasPatrimoniales": [{
      "importe": 1344.99,
      "origenEjercicio": 2022,
      "tipo": "ahorro"
    }]
  },
  "pagosFraccionados": [{
    "modelo": "130",
    "trimestre": "T1",
    "importe": 730.15
  }],
  "ventasInmuebles": [{
    "refCatastral": "...",
    "fechaVenta": "2025-11-27",
    "valorTransmision": 185000
  }]
}

INSTRUCCIONES:
- Usa punto decimal para números (148505.78, no 148.505,78)
- Si un dato no aparece en las capturas, NO lo inventes
- Si una captura está borrosa o ilegible, indica qué campo no se pudo leer
- Las capturas pueden venir desordenadas — reorganiza por sección
- Devuelve ÚNICAMENTE el JSON, sin texto adicional`;

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        maxTokens: 16000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analiza estas capturas de pantalla de los Datos Fiscales de la AEAT y extrae todos los datos estructurados en JSON.' },
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

      return jsonResponse(200, { ok: true, tipo: 'scan_datos_fiscales', model: SCAN_MODEL, extraido });
    }

    // ── SCAN FEIN ─────────────────────────────────────────────────────────
    //
    // La FEIN está normalizada en CONTENIDO por la Ley 5/2019, no en forma:
    // cada banco la maqueta como quiere. La de Unicaja tiene 9 páginas y
    // numera «3. CARACTERÍSTICAS / 4. TIPO DE INTERÉS»; la del Santander tiene
    // 16 y llama «3.- TIPO DE INTERÉS» a lo mismo. Un extractor de entidades
    // —entrenado para facturas, con su etiqueta al lado del dato— no sirve
    // aquí: lo que hace falta está escrito en frases.
    //
    // Medido sobre esas dos FEIN reales, la vía de regex sacaba CERO campos de
    // una y tres equivocados de la otra.
    if (tipo === 'scan_fein') {
      const base64Data = cleanBase64(body?.imagen);
      if (!base64Data) return jsonResponse(400, { ok: false, error: 'El campo "imagen" en base64 es obligatorio para tipo "scan_fein"' });

      const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
        ? body.mimeType.trim().toLowerCase()
        : 'application/pdf';
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
      const mediaBlock = isImage
        ? { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };

      const system = `Eres un experto en préstamos hipotecarios españoles. Lees una FEIN (Ficha Europea de Información Normalizada) y extraes sus condiciones.

REGLA PRINCIPAL, POR ENCIMA DE TODAS: si un dato no está en el documento, devuelve null. No lo deduzcas, no uses valores típicos del mercado, no lo copies de otro campo. Un hueco se ve; un dato inventado no, y aquí de estos números sale el cuadro de amortización de una persona.

Devuelve SOLO un objeto JSON, sin texto alrededor y sin markdown, con esta forma:

{
  "banco": string|null,
  "capitalInicial": number|null,          // euros
  "plazoMeses": number|null,
  "fechaFirmaPrevista": "YYYY-MM-DD"|null,
  "tipo": "FIJO"|"VARIABLE"|"MIXTO"|null,
  "tinFijo": number|null,                 // % del tramo fijo, o del préstamo si es FIJO
  "tramoFijoMeses": number|null,          // solo MIXTO · «durante los primeros 36 meses» → 36
  "indiceReferencia": "EURIBOR"|"IRPH"|null,
  "valorIndiceActual": number|null,       // % del índice que la FEIN usa como hipótesis
  "diferencial": number|null,             // puntos porcentuales
  "revisionMeses": 6|12|null,
  "baseCalculoIntereses": "30/360"|"ACT/360"|"ACT/365"|null,
  "comisionAperturaPct": number|null,     // % · si dice «exenta» o «0,00», devuelve 0
  "comisionMantenimientoMes": number|null,// EUROS AL MES
  "amortizacionAnticipadaPct": number|null,
  "tasacion": number|null,                // euros
  "taeSinBonificaciones": number|null,    // %
  "taeConBonificaciones": number|null,    // %
  "cuotaEstimada": number|null,           // euros
  "importeTotalAReembolsar": number|null, // euros
  "topeBonificacionPuntos": number|null,  // p.ej. 1.00 · «bonificación máxima de 1,00 p.p.»
  "primaSegurosAnual": number|null,       // euros/año del seguro que el banco EXIGE
  "hipotecario": true|false|null,         // ¿es un préstamo con garantía hipotecaria?
  "bonificaciones": [
    { "etiqueta": string, "puntos": number, "criterio": string|null }
  ],
  "notas": string|null
}

SÉ BREVE. Esto se genera contra reloj: la función tiene diez segundos y una FEIN
puede traer catorce bonificaciones. El criterio, en OCHO PALABRAS como mucho
—«nómina de 2.500 € o más» basta— y las notas, en UNA frase. Nada de repetir el
texto del documento ni de explicar lo que ya dice el campo.

CÓMO LEER LO QUE NO VIENE EN UNA CASILLA:

1. BASE DE CÁLCULO. Búscala en la fórmula de los intereses, que va en prosa:
   · «dividido por treinta y seis mil quinientos» o «año de 365 días» → "ACT/365"
   · «dividido por treinta y seis mil» o «año de 360 días» → "ACT/360"
   · «meses de 30 días» / «mes comercial» → "30/360"

2. TRAMO FIJO. «Durante los primeros TREINTA Y SEIS MESES», «36 MESES DESDE FORMALIZ.» → 36. En meses siempre, aunque el documento hable de años.

3. BONIFICACIONES. Son las que el banco OFRECE, con sus puntos tal como están impresos: 0,500000 son 0.5 puntos porcentuales, NO 0.005. Recógelas TODAS, aunque sean catorce. No marques ninguna como contratada: eso no lo dice la FEIN.

4. LAS DOS TAE. Muchas FEIN dan una «sin bonificaciones» y otra «con máxima bonificación». Van a campos distintos. Si solo hay una y no dice cuál es, ponla en taeSinBonificaciones.

5. LOS CEROS SON DATOS. «Exenta de comisión de apertura» o «Comisión de apertura: 0,00 euros» es 0, no null. Null es «no lo dice».

6. TIPOS. Un préstamo con un tramo inicial a un tipo y el resto a otro FIJO no es MIXTO: suele ser FIJO con una bonificación aplicada al principio. MIXTO es fijo primero y luego ligado a un índice.

7. EL TOPE DE LAS BONIFICACIONES. Búscalo con ellas: «podrán ser acumulativas entre sí, con una bonificación máxima de 1,00 p.p. sobre el diferencial» → 1.00. Es lo que impide que la suma de los bloques se coma el tipo entero.

8. SEGUROS EXIGIDOS. Solo los que el banco EXIGE, no los que ofrece para bonificar. Si la FEIN los mete en su propio cálculo de la TAE «sin bonificaciones», son exigidos. Suma sus primas anuales.

9. HIPOTECARIO. Si el préstamo lleva garantía hipotecaria o dice «adquisición de vivienda», es true.

En "notas" escribe, en una o dos frases: qué campos no has encontrado y dónde has tenido dudas. Es tan útil como los datos.`;

      const result = await callAnthropic({
        model: SCAN_MODEL,
        system,
        // 1.500 y no 4.000 · MEDIDO: con 4.000 la función se pasaba de los diez
        // segundos de Netlify y devolvía un 504 «Inactivity Timeout». Los campos
        // caben de sobra —veintiún escalares y catorce bonificaciones cortas son
        // unos 750—; lo que sobraba era sitio para irse por las ramas.
        maxTokens: 1500,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae las condiciones de esta FEIN.' },
              mediaBlock,
            ],
          },
        ],
      });

      if (!result.ok) {
        // El detalle crudo del proveedor se queda en el servidor: puede traer
        // metadatos de la respuesta y no le hace falta a nadie en el navegador.
        // El motivo sí viaja, porque sin él quien lo sufre no sabe qué pasó.
        console.error('scan_fein · error del proveedor:', JSON.stringify(result.raw));
        return jsonResponse(result.status || 502, { ok: false, error: result.error });
      }

      let extraido = result.text;
      try {
        extraido = JSON.parse(result.text);
      } catch (_e) {
        // El modelo a veces envuelve el JSON en un bloque de código.
        const m = typeof result.text === 'string' ? result.text.match(/\{[\s\S]*\}/) : null;
        if (m) { try { extraido = JSON.parse(m[0]); } catch (_e2) { /* se conserva el texto bruto */ } }
      }

      return jsonResponse(200, { ok: true, tipo: 'scan_fein', model: SCAN_MODEL, extraido });
    }

    return jsonResponse(400, { ok: false, error: 'El campo "tipo" debe ser "chat", "scan", "scan_fein", "scan_irpf" o "scan_datos_fiscales"' });
  } catch (error) {
    console.error('netlify/functions/chat error:', error);
    return jsonResponse(500, { ok: false, error: 'No se pudo procesar la solicitud' });
  }
};
