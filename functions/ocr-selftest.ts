// Netlify Function: OCR self-test (EU Document AI)
// URL: /.netlify/functions/ocr-selftest

export const handler = async () => {
  const {
    DOC_AI_ENDPOINT,
    DOC_AI_PROJECT_ID,
    DOC_AI_LOCATION,
    DOC_AI_PROCESSOR_ID,
    DOC_AI_SA_JSON_B64,
  } = process.env as Record<string, string | undefined>;

  const host = DOC_AI_ENDPOINT;
  const pid  = DOC_AI_PROJECT_ID;
  const loc  = DOC_AI_LOCATION;
  const prc  = DOC_AI_PROCESSOR_ID;
  const hasKey = !!DOC_AI_SA_JSON_B64;
  const projectIsNumber = !!pid && /^\d+$/.test(pid);

  // Config incompleta -> no seguimos
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

  // 👇 OJO: backticks ( ` ) para la template literal
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
};
