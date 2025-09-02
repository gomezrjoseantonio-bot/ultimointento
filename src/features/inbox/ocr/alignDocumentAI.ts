export type Money = { value: number; currency: string; source: 'ocr'|'derived' };
export type Confidence = { score: number; sourceId?: string };

export type AlignedInvoice = {
  supplier: { name?: string; taxId?: string; address?: string; email?: string; phone?: string; };
  receiver?: { name?: string; taxId?: string; address?: string; };
  invoice: {
    id?: string; date?: string; dueDate?: string;
    currency: string;
    net: Money; tax: Money; total: Money;
    lineCount?: number;
  };
  meta: {
    pages: number;
    rawConfidenceSummary: Partial<Record<string, Confidence>>;
    warnings: string[];
    blockingErrors: string[];
  };
};

function parseMoney(txt?: string, fallback = 0): number {
  if (!txt) return fallback;
  return Number(txt.replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g,'')) || fallback;
}

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
  
  const get = (t: string) => ents.find((e:any) => e.type === t);
  const val = (t: string) => get(t)?.normalizedValue?.text ?? get(t)?.mentionText ?? '';
  const conf = (t: string): Confidence|undefined =>
    get(t) ? { score: get(t).confidence ?? 0, sourceId: get(t).id } : undefined;

  const currency = (val('currency') || 'EUR').replace('€','EUR');
  const net  = parseMoney(val('net_amount'));
  const tax  = parseMoney(val('total_tax_amount'));
  const tot  = parseMoney(val('total_amount'));

  const warnings:string[] = [];
  const blockingErrors:string[] = [];

  if (Math.abs((net + tax) - tot) > 0.02) blockingErrors.push('No cuadra: base + impuestos != total');

  const pick = (t:string)=> {
    const v = val(t);
    return v || undefined;
  };

  return {
    supplier: {
      name: pick('supplier_name'),
      taxId: pick('supplier_tax_id')?.toUpperCase(),
      address: pick('supplier_address'),
      email: pick('supplier_email')?.replace(/\/+$/,''),
      phone: pick('supplier_phone'),
    },
    receiver: {
      name: pick('receiver_name'),
      taxId: pick('receiver_tax_id'),
      address: pick('receiver_address'),
    },
    invoice: {
      id: pick('invoice_id'),
      date: (get('invoice_date')?.normalizedValue?.text) || pick('invoice_date'),
      dueDate: (get('due_date')?.normalizedValue?.text) || pick('due_date'),
      currency,
      net:   { value: net, currency, source: 'ocr' },
      tax:   { value: tax, currency, source: 'ocr' },
      total: { value: tot, currency, source: 'ocr' },
      lineCount: ents.filter((e:any)=> e.type==='line_item').length || undefined,
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