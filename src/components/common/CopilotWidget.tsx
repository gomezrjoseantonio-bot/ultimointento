import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { askCopilot, CopilotMessage } from '../../services/copilotService';

const initialMessage: CopilotMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu Copiloto Atlas. Puedo ayudarte con recomendaciones financieras prácticas basadas en tus objetivos.',
};

const CopilotWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([initialMessage]);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const movedOnDrag = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPosition({
      x: window.innerWidth - 140,
      y: window.innerHeight - 80,
    });
  }, []);

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

  const onDragStart = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    movedOnDrag.current = false;
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setDragging(true);
  };

  const onDragMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const nextX = Math.min(window.innerWidth - 72, Math.max(8, event.clientX - dragOffset.current.x));
    const nextY = Math.min(window.innerHeight - 72, Math.max(8, event.clientY - dragOffset.current.y));
    movedOnDrag.current = true;
    setPosition({ x: nextX, y: nextY });
  };

  const onDragEnd = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  return (
    <div className="fixed z-40" style={{ left: position.x, top: position.y }}>
      {open && (
        <div
          className="w-[360px] max-w-[calc(100vw-2rem)] h-[520px] rounded-2xl shadow-xl border flex flex-col overflow-hidden"
          style={{ backgroundColor: 'white', borderColor: 'var(--hz-neutral-300)' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between cursor-move select-none"
            style={{ backgroundColor: 'var(--hz-primary)', color: 'white' }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
          >
            <div>
              <p className="font-semibold text-sm">Atlas Copilot</p>
              <p className="text-xs opacity-90">Ángel financiero (v1)</p>
            </div>
            <button
              className="text-white text-sm"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
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
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onClick={() => {
            if (movedOnDrag.current) {
              movedOnDrag.current = false;
              return;
            }
            setOpen(true);
          }}
          className="px-4 py-3 rounded-full shadow-lg text-white font-medium cursor-move select-none inline-flex items-center gap-2"
          style={{ backgroundColor: 'var(--hz-primary)' }}
          aria-label="Abrir Atlas Copilot"
        >
          <Bot size={18} aria-hidden="true" />
          <span>Copilot</span>
        </button>
      )}
    </div>
  );
};

export default CopilotWidget;
