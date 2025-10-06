export interface PandaDocConnectionResponse {
  ok: boolean;
  accountId?: string;
  accountName?: string;
  documentsFetched?: number;
  rateLimited?: boolean;
  code?: string;
  message?: string;
  status?: number;
}

export async function testPandaDocConnection(apiKey: string): Promise<PandaDocConnectionResponse> {
  const response = await fetch('/.netlify/functions/pandadoc-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiKey })
  });

  const data: PandaDocConnectionResponse = await response.json();
  return data;
}
