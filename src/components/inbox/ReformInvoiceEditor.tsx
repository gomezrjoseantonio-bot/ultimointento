import React, { useState, useEffect, useCallback } from 'react';
import { X, Calculator, AlertCircle, Check, Euro, Percent } from 'lucide-react';

interface ReformInvoiceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onSave: (splitData: ReformSplitData) => void;
}

interface ReformSplitData {
  mejora: { amount: number; percentage: number; description: string; };
  mobiliario: { amount: number; percentage: number; description: string; };
  reparacionConservacion: { amount: number; percentage: number; description: string; };
  totalAmount: number;
  splitMethod: 'amount' | 'percentage';
  notes?: string;
}

const ReformInvoiceEditor: React.FC<ReformInvoiceEditorProps> = ({ isOpen, onClose, document, onSave }) => {
  const [splitMethod, setSplitMethod] = useState<'amount' | 'percentage'>('percentage');
  const [splitData, setSplitData] = useState<ReformSplitData>({
    mejora: { amount: 0, percentage: 0, description: '' },
    mobiliario: { amount: 0, percentage: 0, description: '' },
    reparacionConservacion: { amount: 0, percentage: 100, description: '' },
    totalAmount: 0,
    splitMethod: 'percentage'
  });
  const [errors, setErrors] = useState<string[]>([]);

  const totalAmount = document?.metadata?.financialData?.amount ||
                     document?.metadata?.importe ||
                     parseFloat(document?.metadata?.ocr?.fields?.find((f: any) => f.name === 'total_amount')?.value || '0');

  useEffect(() => {
    if (isOpen && totalAmount > 0) {
      setSplitData(prev => ({
        ...prev, totalAmount,
        reparacionConservacion: { ...prev.reparacionConservacion, amount: totalAmount, percentage: 100 }
      }));
    }
  }, [isOpen, totalAmount]);

  const validateSplit = useCallback((): string[] => {
    const errors: string[] = [];
    if (splitMethod === 'percentage') {
      const total = splitData.mejora.percentage + splitData.mobiliario.percentage + splitData.reparacionConservacion.percentage;
      if (Math.abs(total - 100) > 0.01) errors.push(`El total debe ser 100%. Actual: ${total.toFixed(2)}%`);
    } else {
      const total = splitData.mejora.amount + splitData.mobiliario.amount + splitData.reparacionConservacion.amount;
      if (Math.abs(total - totalAmount) > 0.01) errors.push(`El total debe ser ${fmtEur(totalAmount)}. Actual: ${fmtEur(total)}`);
    }
    return errors;
  }, [splitData, splitMethod, totalAmount]);

  useEffect(() => { setErrors(validateSplit()); }, [validateSplit]);

  const fmtEur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  const handlePctChange = (cat: keyof Omit<ReformSplitData, 'totalAmount' | 'splitMethod' | 'notes'>, value: number) => {
    setSplitData(prev => ({ ...prev, [cat]: { ...prev[cat], percentage: value, amount: (value / 100) * totalAmount } }));
  };
  const handleAmtChange = (cat: keyof Omit<ReformSplitData, 'totalAmount' | 'splitMethod' | 'notes'>, value: number) => {
    setSplitData(prev => ({ ...prev, [cat]: { ...prev[cat], amount: value, percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0 } }));
  };

  const autoDistribute = () => {
    const desc = (document?.metadata?.concepto || '').toLowerCase();
    let m = 0, mob = 0, r = 100;
    if (desc.includes('cocina') || desc.includes('baño') || desc.includes('reforma integral')) { m = 60; mob = 20; r = 20; }
    else if (desc.includes('mueble') || desc.includes('electrodoméstico')) { mob = 100; r = 0; }
    else if (desc.includes('instalación') || desc.includes('mejora')) { m = 80; r = 20; }
    setSplitData(prev => ({
      ...prev,
      mejora: { ...prev.mejora, percentage: m, amount: (m / 100) * totalAmount },
      mobiliario: { ...prev.mobiliario, percentage: mob, amount: (mob / 100) * totalAmount },
      reparacionConservacion: { ...prev.reparacionConservacion, percentage: r, amount: (r / 100) * totalAmount },
    }));
  };

  const handleSave = () => { if (validateSplit().length === 0) onSave({ ...splitData, splitMethod }); };

  if (!isOpen) return null;

  const inputStyle = { width: '100%', border: '1.5px solid var(--n-300)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontFamily: 'var(--font-base)', fontSize: 'var(--t-sm)' };
  const sectionColors: Record<string, string> = { mejora: 'var(--s-pos)', mobiliario: 'var(--teal)', reparacion: 'var(--s-warn)' };

  const categories = [
    { key: 'mejora' as const, label: 'Mejora', sub: 'Obras que aumentan el valor del inmueble de forma permanente', color: sectionColors.mejora },
    { key: 'mobiliario' as const, label: 'Mobiliario (10a)', sub: 'Muebles, electrodomésticos y equipamiento', color: sectionColors.mobiliario },
    { key: 'reparacionConservacion' as const, label: 'Reparación y Conservación', sub: 'Mantenimiento, pintura, reparaciones menores', color: sectionColors.reparacion },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(26,35,50,.45)' }}>
      <div className="bg-white shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" style={{ borderRadius: 'var(--r-lg)' }}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Editor de Reformas</h2>
            <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>Reparto en categorías AEAT: Mejora, Mobiliario y Reparación &amp; Conservación</p>
          </div>
          <button onClick={onClose} className="p-2" style={{ color: 'var(--n-500)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-6 p-4" style={{ background: 'var(--n-50)', borderRadius: 'var(--r-md)' }}>
            <h3 className="font-medium mb-2 text-sm" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Documento</h3>
            <div className="space-y-0.5 text-sm" style={{ color: 'var(--n-500)' }}>
              <div>Archivo: {document?.filename}</div>
              <div>Proveedor: {document?.metadata?.proveedor || 'No identificado'}</div>
              <div>Total: <strong style={{ color: 'var(--n-900)' }}>{fmtEur(totalAmount)}</strong></div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-3 text-sm" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Método de reparto</h3>
            <div className="flex gap-4">
              {[{ val: 'percentage', label: 'Por porcentaje', icon: Percent }, { val: 'amount', label: 'Por importe', icon: Euro }].map(({ val, label, icon: Icon }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>
                  <input type="radio" value={val} checked={splitMethod === val} onChange={() => setSplitMethod(val as any)} />
                  <Icon className="w-4 h-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <button onClick={autoDistribute} className="atlas-btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
              <Calculator className="w-4 h-4" />Distribución automática
            </button>
            <p className="text-xs mt-1" style={{ color: 'var(--n-500)' }}>Distribuye automáticamente según el concepto del documento</p>
          </div>

          <div className="space-y-4">
            {categories.map(({ key, label, sub, color }) => (
              <div key={key} className="border p-4" style={{ borderColor: 'var(--n-200)', borderRadius: 'var(--r-md)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-sm" style={{ color, fontFamily: 'var(--font-base)' }}>{label}</h4>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--n-500)' }}>{sub}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm font-mono" style={{ color }}>{fmtEur(splitData[key].amount)}</div>
                    <div className="text-xs" style={{ color: 'var(--n-500)' }}>{fmtPct(splitData[key].percentage)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>
                      {splitMethod === 'percentage' ? 'Porcentaje (%)' : 'Importe (€)'}
                    </label>
                    <input
                      type="number" min="0" step="0.01"
                      value={splitMethod === 'percentage' ? splitData[key].percentage : splitData[key].amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        splitMethod === 'percentage' ? handlePctChange(key, v) : handleAmtChange(key, v);
                      }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Descripción (opcional)</label>
                    <input
                      type="text"
                      value={splitData[key].description}
                      onChange={(e) => setSplitData(prev => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4" style={{ background: 'var(--n-50)', borderRadius: 'var(--r-md)' }}>
            <h4 className="font-medium mb-3 text-sm" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Resumen</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Mejora', amount: splitData.mejora.amount, color: sectionColors.mejora },
                { label: 'Mobiliario', amount: splitData.mobiliario.amount, color: sectionColors.mobiliario },
                { label: 'R&C (Gastos)', amount: splitData.reparacionConservacion.amount, color: sectionColors.reparacion },
                { label: 'Total', amount: splitData.mejora.amount + splitData.mobiliario.amount + splitData.reparacionConservacion.amount, color: 'var(--n-900)' },
              ].map(({ label, amount, color }) => (
                <div key={label}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--n-500)' }}>{label}</div>
                  <div className="font-semibold font-mono" style={{ color }}>{fmtEur(amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mt-4 p-4 border" style={{ background: 'var(--s-neg-bg)', borderColor: 'var(--s-neg)', borderRadius: 'var(--r-md)' }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--s-neg)' }}>
                <AlertCircle className="w-4 h-4" /><span className="font-medium text-sm">Errores de validación</span>
              </div>
              <ul className="text-sm space-y-1" style={{ color: 'var(--s-neg)' }}>
                {errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {errors.length === 0 && totalAmount > 0 && (
            <div className="mt-4 p-3 border" style={{ background: 'var(--s-pos-bg)', borderColor: 'var(--s-pos)', borderRadius: 'var(--r-md)' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--s-pos)' }}>
                <Check className="w-4 h-4" /><span className="text-sm font-medium">Reparto válido — Listo para publicar</span>
              </div>
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>Notas adicionales (opcional)</label>
            <textarea
              value={splitData.notes || ''}
              onChange={(e) => setSplitData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Información adicional sobre el reparto..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--n-200)' }}>
          <div className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
            Se crearán {[splitData.mejora.amount, splitData.mobiliario.amount, splitData.reparacionConservacion.amount].filter(a => a > 0).length} apuntes contables
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="atlas-btn-secondary px-4 py-2">Cancelar</button>
            <button onClick={handleSave} disabled={errors.length > 0} className="atlas-btn-primary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              Guardar reparto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReformInvoiceEditor;
