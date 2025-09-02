export type Money = { value: number; currency: string; source: 'ocr'|'derived' };
export type Confidence = { score: number; sourceId?: string };

// Utility functions for extended OCR alignment
const TEXT = (r: any) => {
  // Texto plano del documento concatenado (para regex en fallback)
  return r.text || r.pages?.map((p: any) => p.layout?.textAnchor?.content).join('\n') || '';
};

const pick = (ents: any[], type: string) => ents.find(e => e.type === type);
const val = (e: any) => e?.normalizedValue?.text || e?.mentionText || '';

function normMoney(s: string) { 
  return Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0; 
}

// Regex útiles (ES):
const RE_IBAN = /\bES\d{2}\s?(?:\d{4}\s?){2}\d{2}\s?\d{10}\b/gi; // IBAN español
const RE_CUPS = /\bES\d{4}[A-Z0-9]{12,16}\b/gi;                  // CUPS típico

export type AlignedInvoice = {
  supplier: { name?: string; taxId?: string; address?: string; email?: string; phone?: string; };
  receiver?: { name?: string; taxId?: string; address?: string; };
  invoice: {
    id?: string; date?: string; dueDate?: string;
    currency: string;
    net: Money; tax: Money; total: Money;
    lineCount?: number;
  };
  service: {
    serviceAddress?: string;
    supplyPointId?: string;
  };
  payment: {
    method: 'SEPA' | 'Transfer' | 'Tarjeta' | 'Desconocido';
    iban?: string;
    paymentDate?: string;
  };
  meta: {
    pages: number;
    rawConfidenceSummary: Partial<Record<string, Confidence>>;
    warnings: string[];
    blockingErrors: string[];
  };
};

export function alignDocumentAI(result: any): AlignedInvoice {
  // Handle both raw DocumentAI result with entities and processed OCRResult with fields
  const ents = Array.isArray(result.entities) ? result.entities : 
               Array.isArray(result.fields) ? result.fields.map((f: any) => ({
                 type: f.name,
                 mentionText: f.value,
                 normalizedValue: { text: f.value },
                 confidence: f.confidence,
                 id: f.name
               })) : [];
  
  const t = TEXT(result);
  const get = (t: string) => ents.find((e:any) => e.type === t);
  const valOrig = (t: string) => get(t)?.normalizedValue?.text ?? get(t)?.mentionText ?? '';
  const conf = (t: string): Confidence|undefined =>
    get(t) ? { score: get(t).confidence ?? 0, sourceId: get(t).id } : undefined;

  // Dirección de servicio: preferir receiver_address; si no, busca palabras clave en texto
  const serviceAddress =
    val(pick(ents, 'service_address')) ||
    val(pick(ents, 'receiver_address')) ||
    (t.match(/(direcci[oó]n(?: de)? (servicio|suministro|instalaci[oó]n)[:\s]+(.+))/i)?.[3] || '') ||
    '';

  // CUPS / supply point:
  const supplyPointId =
    val(pick(ents, 'supply_point_id')) ||
    (t.match(RE_CUPS)?.[0] || '');

  // IBAN y método de pago:
  const iban = (t.match(RE_IBAN)?.[0] || '').replace(/\s+/g, '');
  let paymentMethod: 'SEPA' | 'Transfer' | 'Tarjeta' | 'Desconocido' = 'Desconocido';
  if (iban) paymentMethod = 'SEPA';
  else if (/transferencia|transfer/i.test(t)) paymentMethod = 'Transfer';
  else if (/tarjeta|visa|mastercard/i.test(t)) paymentMethod = 'Tarjeta';

  // Fechas
  const invoiceDate = val(pick(ents, 'invoice_date')) || val(pick(ents, 'issue_date')) || '';
  const dueDate = val(pick(ents, 'due_date')) || '';
  const explicitPay = (t.match(/(fecha de cargo|fecha de pago)[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[2]) || '';
  const paymentDate = explicitPay || dueDate || invoiceDate || '';

  const currency = (valOrig('currency') || 'EUR').replace('€','EUR');
  const net  = normMoney(valOrig('net_amount') || '');
  const tax  = normMoney(valOrig('total_tax_amount') || '');
  const tot  = normMoney(valOrig('total_amount') || '');

  const warnings:string[] = [];
  const blockingErrors:string[] = [];

  if (Math.abs((net + tax) - tot) > 0.02) blockingErrors.push('No cuadra: base + impuestos != total');

  const pickOrig = (t:string)=> {
    const v = valOrig(t);
    return v || undefined;
  };

  return {
    supplier: {
      name: pickOrig('supplier_name'),
      taxId: pickOrig('supplier_tax_id')?.toUpperCase(),
      address: pickOrig('supplier_address'),
      email: pickOrig('supplier_email')?.replace(/\/+$/,''),
      phone: pickOrig('supplier_phone'),
    },
    receiver: {
      name: pickOrig('receiver_name'),
      taxId: pickOrig('receiver_tax_id'),
      address: pickOrig('receiver_address'),
    },
    invoice: {
      id: pickOrig('invoice_id'),
      date: (get('invoice_date')?.normalizedValue?.text) || pickOrig('invoice_date'),
      dueDate: (get('due_date')?.normalizedValue?.text) || pickOrig('due_date'),
      currency,
      net:   { value: net, currency, source: 'ocr' },
      tax:   { value: tax, currency, source: 'ocr' },
      total: { value: tot, currency, source: 'ocr' },
      lineCount: ents.filter((e:any)=> e.type==='line_item').length || undefined,
    },
    service: {
      serviceAddress,
      supplyPointId
    },
    payment: {
      method: paymentMethod,
      iban,
      paymentDate
    },
    meta: {
      pages: result.pages?.length ?? result.pageInfo?.totalPages ?? result.meta?.pages ?? 1,
      rawConfidenceSummary: {
        invoice_date: conf('invoice_date'),
        invoice_id: conf('invoice_id'),
        total_amount: conf('total_amount'),
        net_amount: conf('net_amount'),
        total_tax_amount: conf('total_tax_amount'),
        supplier_tax_id: conf('supplier_tax_id'),
        supplier_name: conf('supplier_name'),
      },
      warnings,
      blockingErrors,
    }
  };
}