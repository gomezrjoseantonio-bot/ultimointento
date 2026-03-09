// Netlify Function: OCR self-test (EU)
// URL: /.netlify/functions/ocr-selftest

export async function handler() {
  const host = "eu-documentai.googleapis.com"; // Fixed EU endpoint
  const pid  = process.env.DOC_AI_PROJECT_ID;
  const loc  = process.env.DOC_AI_LOCATION;
  const prc  = process.env.DOC_AI_PROCESSOR_ID;
  const hasKey = !!process.env.DOC_AI_SA_JSON_B64;

  const projectIsNumber = !!pid && /^[0-9]+$/.test(pid || "");

  // Config incompleta -> devolvemos CONFIG (no secretos)
  if (!pid || !loc || !prc || !hasKey || !projectIsNumber) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: false,
        code: "CONFIG",
        message: "OCR: configuración incompleta",
        details: {
          hasKey: hasKey,
          hasProjectId: !!pid,
          projectIsNumber: projectIsNumber,
          hasLocation: !!loc,
          hasProcessorId: !!prc,
          endpointHost: host
        }
      })
    };
  }

  // Fixed processor path construction for EU region
  const processorPath =
    "https://eu-documentai.googleapis.com/v1/projects/" + pid + "/locations/" + loc + "/processors/" + prc + ":process";

  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ok: true,
      endpointHost: host,
      processorPath: processorPath,
      projectIsNumber: projectIsNumber,
      location: loc
    })
  };
}
