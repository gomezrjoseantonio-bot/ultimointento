import React, { useMemo, useState } from 'react';
import { askCopilot, CopilotMessage } from '../../services/copilotService';

const initialMessage: CopilotMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu Copiloto Atlas 😊. Puedo ayudarte con recomendaciones financieras prácticas basadas en tus objetivos.',
};

const CopilotWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([initialMessage]);
  const [error, setError] = useState<string | null>(null);

  const historyForApi = useMemo(
    () => messages.filter((m) => m !== initialMessage).slice(-8),
    [messages]
  );

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextUserMessage: CopilotMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, nextUserMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const result = await askCopilot(trimmed, historyForApi, {
        language: 'es',
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Error desconocido al consultar IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div
          className="w-[360px] max-w-[calc(100vw-2rem)] h-[520px] rounded-2xl shadow-xl border flex flex-col overflow-hidden"
          style={{ backgroundColor: 'white', borderColor: 'var(--hz-neutral-300)' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: 'var(--hz-primary)', color: 'white' }}
          >
            <div>
              <p className="font-semibold text-sm">Atlas Copilot</p>
              <p className="text-xs opacity-90">Ángel financiero (v1)</p>
            </div>
            <button
              className="text-white text-sm"
              onClick={() => setOpen(false)}
              aria-label="Cerrar copiloto"
            >
              Cerrar
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3" aria-live="polite">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  message.role === 'assistant' ? 'bg-slate-100 text-slate-900' : 'bg-blue-50 text-blue-900 ml-8'
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Pensando...</div>}
            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>

          <div className="p-3 border-t" style={{ borderColor: 'var(--hz-neutral-300)' }}>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              style={{ borderColor: 'var(--hz-neutral-300)' }}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cómo puedo mejorar mi liquidez este mes?"
            />
            <div className="mt-2 flex justify-between items-center gap-2">
              <p className="text-[11px] text-slate-500">Orientación informativa, no asesoramiento legal/fiscal.</p>
              <button
                className="px-3 py-1.5 rounded-lg text-white text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--hz-primary)' }}
                onClick={onSend}
                disabled={loading || !input.trim()}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-3 rounded-full shadow-lg text-white font-medium"
          style={{ backgroundColor: 'var(--hz-primary)' }}
          aria-label="Abrir Atlas Copilot"
        >
          Copilot 😊
        </button>
      )}
    </div>
  );
};

export default CopilotWidget;
