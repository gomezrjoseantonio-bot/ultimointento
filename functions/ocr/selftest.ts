export async function handler() {
  const host = process.env.DOC_AI_ENDPOINT;
  const pid = process.env.DOC_AI_PROJECT_ID;
  const loc = process.env.DOC_AI_LOCATION;
  const prc = process.env.DOC_AI_PROCESSOR_ID;
  const hasKey = !!process.env.DOC_AI_SA_JSON_B64;

  if (!host || !pid || !loc || !prc || !hasKey) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok:false, code:"CONFIG", message:"OCR: configuración incompleta" })
    };
  }

  const processorPath = `projects/${pid}/locations/${loc}/processors/${prc}:process`;
  const projectIsNumber = /^\d+$/.test(String(pid));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok:true, endpointHost: host, processorPath, projectIsNumber })
  };
}