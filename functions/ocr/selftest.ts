// Netlify Function: OCR self-test (EU Document AI)
// Ruta pública tras el deploy:
//   https://<tu-sitio>.netlify.app/.netlify/functions/ocr-selftest

type Json = Record<string, unknown>;

export async function handler() {
  const host = process.env.DOC_AI_ENDPOINT;
  const pid = process.env.DOC_AI_PROJECT_ID;
  const loc = process.env.DOC_AI_LOCATION;
  const prc = process.env.DOC_AI_PROCESSOR_ID;
  const hasKey = !!process.env.DOC_AI_SA_JSON_B64;

  const projectIsNumber = /^\d+$/.test(String(pid || ""));

  // Validación mínima de configuración
  if (!host || !pid || !loc || !prc || !hasKey || !projectIsNumber) {
    const body: Json = {
      ok: false,
      code: "CONFIG",
      message: "OCR: configuración incompleta",
      details: {
        hasKey,
        hasProjectId: !!pid,
        projectIsNumber,
        hasLocation: !!loc,
        hasProcessorId: !!prc,
        hasEndpoint: !!host,
      },
    };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    };
  }

  // Construcción del path correcto (EU)
  const processorPath = projects/${pid}/locations/${loc}/processors/${prc}:process;

  const body: Json = {
    ok: true,
    endpointHost: host,
    processorPath,
    projectIsNumber,
    location: loc,
  };

  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
