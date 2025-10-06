import type { Handler } from '@netlify/functions';

interface PandaDocRequestBody {
  apiKey?: string;
  action?: 'test';
}

interface PandaDocSuccessResponse {
  ok: true;
  accountId?: string;
  accountName?: string;
  documentsFetched?: number;
  rateLimited?: boolean;
}

interface PandaDocErrorResponse {
  ok: false;
  code: string;
  message: string;
  status?: number;
  rateLimited?: boolean;
}

const PANDADOC_BASE_URL = 'https://api.pandadoc.com/public/v1';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are supported'
      } satisfies PandaDocErrorResponse)
    };
  }

  let body: PandaDocRequestBody = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        code: 'INVALID_BODY',
        message: 'El cuerpo de la petición no es un JSON válido'
      } satisfies PandaDocErrorResponse)
    };
  }

  const apiKey = body.apiKey?.trim();

  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        code: 'MISSING_API_KEY',
        message: 'Debes proporcionar una API Key de PandaDoc para realizar la prueba'
      } satisfies PandaDocErrorResponse)
    };
  }

  try {
    const response = await fetch(`${PANDADOC_BASE_URL}/documents?count=1`, {
      method: 'GET',
      headers: {
        Authorization: `API-Key ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const rateLimited = response.status === 429;

    if (!response.ok) {
      let errorMessage = 'No se pudo conectar con la API de PandaDoc';
      try {
        const errorBody = await response.json();
        if (errorBody?.detail) {
          errorMessage = Array.isArray(errorBody.detail)
            ? errorBody.detail.map((item: any) => item.msg || item.detail).filter(Boolean).join(' ')
            : errorBody.detail;
        } else if (errorBody?.message) {
          errorMessage = errorBody.message;
        }
      } catch (parseError) {
        // ignore parse errors and use default message
      }

      return {
        statusCode: response.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          ok: false,
          code: 'API_ERROR',
          message: errorMessage,
          status: response.status,
          rateLimited
        } satisfies PandaDocErrorResponse)
      };
    }

    const payload = await response.json();

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: true,
        accountId: payload?.data?.[0]?.account_id,
        accountName: payload?.data?.[0]?.account_name,
        documentsFetched: Array.isArray(payload?.data) ? payload.data.length : undefined,
        rateLimited
      } satisfies PandaDocSuccessResponse)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido al contactar con PandaDoc'
      } satisfies PandaDocErrorResponse)
    };
  }
};

export default handler;
