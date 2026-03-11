import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

// ── PDF.js se carga desde CDN en el primer uso ────────────────────────────────
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfJsLoaded = false;
let pdfJsLoading: Promise<void> | null = null;

const loadPdfJs = (): Promise<void> => {
  if (pdfJsLoaded) return Promise.resolve();
  if (pdfJsLoading) return pdfJsLoading;

  pdfJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
        pdfJsLoaded = true;
        resolve();
      } else {
        reject(new Error('PDF.js no disponible tras carga'));
      }
    };
    script.onerror = () => reject(new Error('Error al cargar PDF.js'));
    document.head.appendChild(script);
  });

  return pdfJsLoading;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface PdfPreviewProps {
  blob: Blob | null;
  filename?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
const PdfPreview: React.FC<PdfPreviewProps> = ({ blob, filename }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pdfDocRef = useRef<any>(null);

  // ── Cargar PDF cuando cambia el blob ─────────────────────────────────────
  useEffect(() => {
    if (!blob) { setStatus('idle'); return; }

    let cancelled = false;
    setStatus('loading');
    setCurrentPage(1);
    setTotalPages(0);
    pdfDocRef.current = null;

    const load = async () => {
      try {
        await loadPdfJs();
        if (cancelled) return;

        const pdfjsLib = (window as any).pdfjsLib;
        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) { pdfDoc.destroy(); return; }

        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Error al procesar PDF');
          setStatus('error');
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [blob]);

  // ── Renderizar página cuando cambia currentPage o status ─────────────────
  useEffect(() => {
    if (status !== 'ready' || !pdfDocRef.current || !canvasRef.current) return;

    // Cancelar render anterior si existe
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    let cancelled = false;

    const render = async () => {
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current!;
        const container = containerRef.current;
        const containerWidth = container?.clientWidth || 600;

        // Escalar para ocupar el ancho disponible
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d')!;
        const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setErrorMsg('Error al renderizar página');
          setStatus('error');
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [status, currentPage]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const goTo = (n: number) => setCurrentPage(Math.max(1, Math.min(n, totalPages)));

  // ── Render ────────────────────────────────────────────────────────────────
  if (!blob) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--n-400)' }}>
        Selecciona un documento PDF
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col" style={{ background: 'var(--n-100)' }}>

      {/* ── Estado: cargando ── */}
      {status === 'loading' && (
        <div className="h-full flex flex-col items-center justify-center gap-3" style={{ color: 'var(--n-500)' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--blue)' }} />
          <span className="text-sm">Cargando PDF…</span>
        </div>
      )}

      {/* ── Estado: error ── */}
      {status === 'error' && (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: 'var(--n-500)' }}>
          <AlertCircle size={22} style={{ color: 'var(--s-neg)' }} />
          <span className="text-sm">{errorMsg || 'No se pudo mostrar el PDF.'}</span>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ display: status === 'ready' ? 'block' : 'none', scrollbarWidth: 'thin' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>

      {/* ── Paginación ── */}
      {status === 'ready' && totalPages > 1 && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-3 py-2 border-t text-sm"
          style={{ borderColor: 'var(--n-200)', background: 'var(--white)', color: 'var(--n-600)' }}
        >
          <button
            type="button"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{ opacity: currentPage <= 1 ? 0.35 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: 'var(--font-base)' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{ opacity: currentPage >= totalPages ? 0.35 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfPreview;
