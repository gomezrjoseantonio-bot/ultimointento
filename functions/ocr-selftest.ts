// Netlify Function: OCR self-test (EU Document AI)
// URL tras deploy: /.netlify/functions/ocr-selftest

export async function handler() {
  const host = process.env.DOC_AI_ENDPOINT;
  const pid  = process.env.DOC_AI_PROJECT_ID;
  const loc  = process.env.DOC_AI_LOCATION;
  const prc  = process.env.DOC_AI_PROCESSOR_ID;
  const hasKey = !!process.env.DOC_AI_SA_JSON_B64;

  const projectIsNumber = !!pid && /^\d+$/.test(pid);

  // Si falta alguna variable → devolvemos CONFIG
  if (!host || !pid || !loc || !prc || !hasKey || !projectIsNumber) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
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
      }),
    };
  }

  // Si todo está bien → devolvemos OK
  const processorPath = projects/${pid}/locations/${loc}/processors/${prc}:process;

  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ok: true,
      endpointHost: host,
      processorPath,
      projectIsNumber,
      location: loc,
    }),
  };
}
