interface ScanChatPayload {
  tipo: 'scan' | 'scan_irpf';
  imagen?: string;
  imagenes?: string[];
  mimeType: string;
  prompt?: string;
}

interface CallScanChatOptions {
  prompt?: string;
}

export interface ScanChatResponse {
  ok: boolean;
  tipo?: 'scan' | 'scan_irpf';
  model?: string;
  extraido?: any;
  error?: string;
}

const toBase64 = async (fileOrBlob: Blob): Promise<string> => {
  const buffer = await fileOrBlob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkStr = '';
    for (let j = 0; j < chunk.length; j += 1) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    binary += chunkStr;
  }

  return btoa(binary);
};

export const callScanChat = async (
  fileOrBlob: Blob,
  mimeType?: string,
  tipo: ScanChatPayload['tipo'] = 'scan',
  options?: CallScanChatOptions,
): Promise<ScanChatResponse> => {
  const base64Image = await toBase64(fileOrBlob);
  const payload: ScanChatPayload = {
    tipo,
    imagen: base64Image,
    mimeType: mimeType || fileOrBlob.type || 'application/octet-stream',
    ...(options?.prompt ? { prompt: options.prompt } : {}),
  };

  const response = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let data: ScanChatResponse = { ok: false, error: 'Respuesta inválida del servicio de escaneo' };

  try {
    data = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      throw new Error(`OCR error ${response.status}: ${responseText.slice(0, 180)}`);
    }
    throw new Error('El servicio de escaneo devolvió una respuesta no JSON');
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `OCR error ${response.status}`);
  }

  return data;
};


export const callScanChatImages = async (payload: {
  tipo: ScanChatPayload['tipo'];
  imagenes: string[];
  mimeType?: string;
  prompt?: string;
}): Promise<ScanChatResponse> => {
  const response = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tipo: payload.tipo,
      imagenes: payload.imagenes,
      mimeType: payload.mimeType || 'image/jpeg',
      ...(payload.prompt ? { prompt: payload.prompt } : {}),
    }),
  });

  const responseText = await response.text();
  let data: ScanChatResponse = { ok: false, error: 'Respuesta inválida del servicio de escaneo' };

  try {
    data = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      throw new Error(`OCR error ${response.status}: ${responseText.slice(0, 180)}`);
    }
    throw new Error('El servicio de escaneo devolvió una respuesta no JSON');
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `OCR error ${response.status}`);
  }

  return data;
};
