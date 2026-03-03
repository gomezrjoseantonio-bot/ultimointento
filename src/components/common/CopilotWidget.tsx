import React, { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { askCopilot, CopilotMessage } from '../../services/copilotService';
import { AtlasButton } from '../atlas/AtlasButton';

const initialMessage: CopilotMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu Copiloto Atlas. Puedo ayudarte con recomendaciones financieras prácticas basadas en tus objetivos.',
};

const AtlasAIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div
    className="relative inline-flex items-center justify-center rounded-full"
    style={{
      width: size,
      height: size,
      background: 'radial-gradient(circle at 30% 30%, #14b8a6 0%, #0d6efd 55%, #0b2a5c 100%)',
      boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 8px 26px rgba(13, 110, 253, 0.35)',
    }}
    aria-hidden="true"
  >
    <span
      className="font-extrabold"
      style={{
        color: '#ffffff',
        fontSize: Math.round(size * 0.48),
        lineHeight: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }}
    >
      A
    </span>
    <span
      className="absolute rounded-full pointer-events-none"
      style={{
        inset: -6,
        background: 'radial-gradient(circle, rgba(20,184,166,0.35) 0%, rgba(20,184,166,0) 70%)',
        filter: 'blur(4px)',
      }}
    />
  </div>
);

const CopilotWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([initialMessage]);
  const [error, setError] = useState<string | null>(null);

  const historyForApi = useMemo(() => messages.filter((m) => m !== initialMessage).slice(-8), [messages]);

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
        <section
          className="w-[380px] max-w-[calc(100vw-1.5rem)] h-[560px] rounded-2xl border flex flex-col overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'var(--hz-neutral-300)',
            boxShadow: '0 18px 45px rgba(2, 10, 26, 0.18)',
          }}
          aria-label="Chat Atlas Copilot"
        >
          <header
            className="px-4 py-3 flex items-center justify-between"
            style={{
              background: 'linear-gradient(90deg, var(--atlas-blue), #0b2a5c)',
              color: '#fff',
            }}
          >
            <div className="flex items-center gap-3">
              <AtlasAIcon size={34} />
              <div>
                <p className="font-semibold text-sm leading-tight">Atlas Copilot</p>
                <p className="text-xs opacity-90">Asistente financiero inteligente</p>
              </div>
            </div>
            <AtlasButton
              variant="ghost"
              size="sm"
              className="!text-white !bg-transparent hover:!bg-white/10"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={16} aria-hidden="true" />
              Cerrar
            </AtlasButton>
          </header>

          <div className="flex-1 p-3 overflow-y-auto space-y-3" aria-live="polite">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-xl px-3 py-2.5 text-sm whitespace-pre-wrap leading-relaxed border ${
                  message.role === 'assistant'
                    ? 'mr-6 text-slate-900 bg-slate-50 border-slate-200'
                    : 'ml-8 text-blue-950 bg-blue-50 border-blue-200'
                }`}
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Sparkles size={13} /> Pensando…
              </div>
            )}

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-white" style={{ borderColor: 'var(--hz-neutral-300)' }}>
            <label htmlFor="copilot-input" className="sr-only">
              Mensaje para Atlas Copilot
            </label>
            <textarea
              id="copilot-input"
              className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--hz-neutral-300)', color: 'var(--atlas-navy-1)' }}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ej: ¿Qué alquileres vencen el próximo mes?"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px]" style={{ color: 'var(--text-gray)' }}>
                Orientación informativa, no asesoramiento legal/fiscal.
              </p>
              <AtlasButton
                size="sm"
                onClick={onSend}
                disabled={loading || !input.trim()}
                type="button"
                className="min-w-[92px]"
              >
                Enviar
              </AtlasButton>
            </div>
          </div>
        </section>
      )}

      {!open && (
        <AtlasButton
          onClick={() => setOpen(true)}
          className="rounded-full pl-2.5 pr-4 py-2.5 shadow-xl"
          type="button"
        >
          <AtlasAIcon size={28} />
          <span className="text-sm font-semibold">Atlas Chat</span>
        </AtlasButton>
      )}
    </div>
  );
};

export default CopilotWidget;
