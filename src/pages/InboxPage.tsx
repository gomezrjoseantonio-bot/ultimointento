import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  FileUp,
  ExternalLink,
  FileText,
  MoreVertical,
  Search,
  Upload,
  XCircle
} from 'lucide-react';
import { deleteDocumentAndBlob, getDocumentBlob, initDB, saveDocumentWithBlob } from '../services/db';
import { processDocumentOCR } from '../services/documentAIService';
import toast from 'react-hot-toast';
import InboxV3DocumentList from '../components/inbox/InboxV3DocumentList';
import InboxV3Actions from '../components/inbox/InboxV3Actions';
import InboxV3ExtractedPanel from '../components/inbox/InboxV3ExtractedPanel';

const tabItems = ['Pendientes', 'Procesados', 'Todos'] as const;
const typeFilters = ['Todos', 'Facturas', 'Contratos'] as const;

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const [processingOCR, setProcessingOCR] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof tabItems)[number]>('Pendientes');
  const [activeType, setActiveType] = useState<(typeof typeFilters)[number]>('Todos');
  const [search, setSearch] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string>(''); // track for cleanup

  // ── tab badge counts ──────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { Pendientes: 0, Procesados: 0, Todos: documents.length };
    for (const doc of documents) {
      const status = String(doc.metadata?.queueStatus || 'pendiente').toLowerCase();
      if (status === 'pendiente') counts['Pendientes']++;
      if (status.includes('procesado')) counts['Procesados']++;
    }
    return counts;
  }, [documents]);

  const isPdfDocument = (document: any): boolean => {
    if (!document) return false;
    const mime = String(document.type || '').toLowerCase();
    const filename = String(document.filename || '').toLowerCase();
    return mime.includes('pdf') || filename.endsWith('.pdf');
  };

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const db = await initDB();
        const docs = await db.getAll('documents');
        setDocuments(docs);
        if (docs.length > 0) setSelectedDocument(docs[0]);
      } catch (_error) {
        const fallback = localStorage.getItem('atlas-inbox-documents');
        const parsed = fallback ? JSON.parse(fallback) : [];
        setDocuments(parsed);
        if (parsed.length > 0) setSelectedDocument(parsed[0]);
      }
    };
    loadDocuments();
  }, []);

  // ── PDF preview: blob URL + <embed> (evita bloqueo Chrome con data: en iframe) ──
  useEffect(() => {
    // Revocar blob anterior
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = '';
    }
    setPreviewBlobUrl('');

    const resolvePreview = async () => {
      if (!selectedDocument || !isPdfDocument(selectedDocument)) return;

      let blob: Blob | null = null;
      if (selectedDocument.id) blob = await getDocumentBlob(selectedDocument.id);
      if (!blob && selectedDocument.content) {
        blob = new Blob([selectedDocument.content], { type: selectedDocument.type || 'application/pdf' });
      }
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPreviewBlobUrl(url);
    };

    resolvePreview();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = '';
      }
    };
  }, [selectedDocument]);

  const handleOpenInNewTab = async () => {
    let blob: Blob | null = null;
    if (selectedDocument?.id) blob = await getDocumentBlob(selectedDocument.id);
    if (!blob && selectedDocument?.content) {
      blob = new Blob([selectedDocument.content], { type: selectedDocument.type || 'application/pdf' });
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    toast.error('No se encontró una URL para abrir este archivo');
  };

  const persistDocuments = async (updatedDocs: any[]) => {
    setDocuments(updatedDocs);
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocs));
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      for (const doc of updatedDocs) await tx.store.put(doc);
      await tx.done;
    } catch (_error) { /* fallback localStorage */ }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const status = String(doc.metadata?.queueStatus || 'pendiente').toLowerCase();
      const type = String(doc.metadata?.tipo || '').toLowerCase();
      const filename = String(doc.filename || '').toLowerCase();
      if (activeTab === 'Pendientes' && status !== 'pendiente') return false;
      if (activeTab === 'Procesados' && !status.includes('procesado')) return false;
      if (activeType === 'Facturas' && !type.includes('factura') && !type.includes('recibo')) return false;
      if (activeType === 'Contratos' && !type.includes('contrato')) return false;
      if (search && !filename.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [documents, activeTab, activeType, search]);

  useEffect(() => {
    if (!selectedDocument && filteredDocuments.length > 0) { setSelectedDocument(filteredDocuments[0]); return; }
    if (selectedDocument && !filteredDocuments.some((doc) => doc.id === selectedDocument.id)) {
      setSelectedDocument(filteredDocuments[0] || null);
    }
  }, [filteredDocuments, selectedDocument]);

  const handleProcessOCR = async () => {
    if (!selectedDocument) return;
    try {
      setProcessingOCR(true);
      let blob: Blob | null = null;
      if (selectedDocument.id) blob = await getDocumentBlob(selectedDocument.id);
      if (!blob && selectedDocument.content) {
        blob = new Blob([selectedDocument.content], { type: selectedDocument.type || 'application/pdf' });
      }
      if (!blob) throw new Error('No se encontró el archivo para OCR');

      const ocr = await processDocumentOCR(blob, selectedDocument.filename);
      const updated = {
        ...selectedDocument,
        metadata: { ...selectedDocument.metadata, ocr, queueStatus: ocr.status === 'error' ? 'error' : 'procesado' }
      };
      const updatedDocs = documents.map((doc) => (doc.id === updated.id ? updated : doc));
      await persistDocuments(updatedDocs);
      setSelectedDocument(updated);
      toast.success('OCR completado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en OCR');
    } finally {
      setProcessingOCR(false);
    }
  };

  const handleAssign = () => {
    toast('Asignación manual pendiente de implementar', { icon: 'ℹ️' });
  };

  const requestDelete = (documentToDelete?: any) => {
    if (documentToDelete) setSelectedDocument(documentToDelete);
    if (!documentToDelete && !selectedDocument) return;
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;
    await deleteDocumentAndBlob(selectedDocument.id);
    const updatedDocs = documents.filter((doc) => doc.id !== selectedDocument.id);
    setDocuments(updatedDocs);
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocs));
    setSelectedDocument(updatedDocs[0] || null);
    setShowDeleteModal(false);
    toast.success('Documento eliminado');
  };

  const processUploadedFiles = async (files: File[]) => {
    if (!files.length) return;
    try {
      const uploaded: any[] = [];
      for (const file of files) {
        const doc = {
          filename: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          lastModified: file.lastModified,
          content: file,
          uploadDate: new Date().toISOString(),
          metadata: { title: file.name.replace(/\.[^/.]+$/, ''), queueStatus: 'pendiente', status: 'Nuevo', tipo: 'Otros' }
        };
        const id = await saveDocumentWithBlob(doc as any);
        uploaded.push({ ...doc, id });
      }
      const updatedDocuments = [...uploaded, ...documents];
      await persistDocuments(updatedDocuments);
      if (!selectedDocument && uploaded.length > 0) setSelectedDocument(uploaded[0]);
      toast.success(`${uploaded.length} documento(s) subido(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron subir los documentos');
    }
  };

  const handleUploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFiles(Array.from(files));
    event.target.value = '';
  };

  const handleDropUpload = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    await processUploadedFiles(Array.from(event.dataTransfer.files || []));
  };

  const selectedId = selectedDocument?.id;

  return (
    <div className="space-y-4" style={{ fontFamily: 'var(--font-base)' }}>
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--n-500)' }}>
          <span>Docs</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--n-900)', fontWeight: 600 }}>Bandeja de entrada</span>
        </div>
      </div>

      <div className="p-6 border" style={{ borderRadius: 'var(--r-lg)', borderColor: 'var(--n-200)', background: 'var(--surface-card)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-semibold" style={{ color: 'var(--n-900)' }}>Bandeja de entrada</h1>
            <p className="mt-1 text-lg" style={{ color: 'var(--n-500)' }}>Sube, escanea y asigna facturas y documentos</p>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx,.zip" onChange={handleUploadFiles} />
          <button type="button" className="atlas-btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />Subir documentos
          </button>
        </div>

        {/* ── tabs con badges ── */}
        <div className="mt-5 flex items-center gap-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
          {tabItems.map((tab) => {
            const active = tab === activeTab;
            const count = tabCounts[tab] ?? 0;
            return (
              <button
                key={tab}
                type="button"
                className="pb-3 text-base font-medium flex items-center gap-2"
                style={{ color: active ? 'var(--blue)' : 'var(--n-500)', borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent' }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {count > 0 && (
                  <span
                    className="inline-flex items-center justify-center text-xs font-semibold"
                    style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-sm)', background: active ? 'var(--blue)' : 'var(--n-200)', color: active ? 'var(--white)' : 'var(--n-600)', fontFamily: 'var(--font-base)', lineHeight: 1 }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 h-[calc(100vh-330px)] min-h-[620px] border overflow-hidden" style={{ borderRadius: 'var(--r-md)', borderColor: 'var(--n-200)' }}>
          <div className="h-full flex">

            {/* ── Col 1 — lista (30%) ── */}
            <div className="h-full border-r" style={{ width: '30%', borderColor: 'var(--n-200)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--n-200)' }}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--n-500)' }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 border text-sm"
                    placeholder="Buscar documentos..."
                    style={{ borderColor: 'var(--n-300)', borderRadius: 'var(--r-md)', color: 'var(--n-900)', background: 'var(--white)' }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {typeFilters.map((type) => {
                    const active = type === activeType;
                    return (
                      <button key={type} type="button" onClick={() => setActiveType(type)} className="px-3 py-1.5 text-sm font-medium"
                        style={{ borderRadius: 'var(--r-sm)', background: active ? 'var(--blue)' : 'var(--n-100)', color: active ? 'var(--white)' : 'var(--n-700)' }}>
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-[calc(100%-138px)] overflow-hidden">
                <InboxV3DocumentList documents={filteredDocuments} selectedId={selectedId} onSelect={setSelectedDocument} onDelete={requestDelete} />
              </div>

              <div
                className="p-4 border-t"
                style={{ borderColor: 'var(--n-200)' }}
                onDragOver={(e) => { e.preventDefault(); if (!isDragActive) setIsDragActive(true); }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleDropUpload}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed px-4 py-5 text-sm text-center transition"
                  style={{ borderRadius: 'var(--r-md)', borderColor: isDragActive ? 'var(--blue)' : 'var(--n-300)', background: isDragActive ? 'var(--blue-50)' : 'var(--n-50)', color: 'var(--n-700)' }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileUp size={18} />
                    <span>Arrastra y suelta uno o varios documentos aquí</span>
                    <span className="text-xs" style={{ color: 'var(--n-500)' }}>o haz clic para subir</span>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Col 2 — preview PDF (40%) ── */}
            <div className="h-full border-r flex flex-col" style={{ width: '40%', borderColor: 'var(--n-200)' }}>
              <div className="h-14 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
                <div className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--n-900)' }}>
                  <FileText size={16} />
                  <span className="truncate max-w-[220px]">{selectedDocument?.filename || 'Documento'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--n-500)' }}>
                  <span>PDF</span>
                  <button type="button" style={{ color: 'var(--n-500)' }} onClick={handleOpenInNewTab}>Descargar</button>
                  <button type="button" style={{ color: 'var(--n-500)' }}><MoreVertical size={16} /></button>
                </div>
              </div>

              <div className="flex-1 p-4" style={{ background: 'var(--n-50)' }}>
                <div className="h-full border overflow-hidden" style={{ borderRadius: 'var(--r-md)', borderColor: 'var(--n-200)', background: 'var(--white)' }}>
                  {selectedDocument && isPdfDocument(selectedDocument) && previewBlobUrl ? (
                    // ── blob URL + <embed> — funciona en Chrome sin bloqueo CSP ──
                    <embed
                      src={previewBlobUrl}
                      type="application/pdf"
                      className="w-full h-full"
                      style={{ display: 'block' }}
                    />
                  ) : selectedDocument && isPdfDocument(selectedDocument) ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-sm" style={{ color: 'var(--n-500)' }}>
                      <span>El PDF no está disponible en este momento.</span>
                      <button type="button" className="atlas-btn-secondary atlas-btn-sm" onClick={handleOpenInNewTab}>
                        <ExternalLink size={14} />Abrir en nueva pestaña
                      </button>
                    </div>
                  ) : selectedDocument ? (
                    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--n-500)' }}>
                      Vista previa disponible solo para documentos PDF
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--n-500)' }}>
                      Selecciona un documento
                    </div>
                  )}
                </div>
              </div>

              <div className="h-16 px-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--n-200)', background: 'var(--white)' }}>
                <InboxV3Actions
                  onAssign={handleAssign}
                  onDelete={requestDelete}
                  onProcessOCR={handleProcessOCR}
                  disableActions={!selectedDocument || processingOCR}
                />
              </div>
            </div>

            {/* ── Col 3 — datos extraídos (30%) ── */}
            <div className="h-full" style={{ width: '30%', background: 'var(--white)' }}>
              <InboxV3ExtractedPanel
                document={selectedDocument}
                onConfirm={() => toast.success('Datos confirmados y guardados')}
                onProcessOCR={handleProcessOCR}
                processingOCR={processingOCR}
              />
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(26,35,50,.45)' }}>
          <div className="p-6 border w-full max-w-md" style={{ background: 'var(--surface-card)', borderColor: 'var(--n-200)', borderRadius: 'var(--r-lg)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--n-900)' }}>Confirmar eliminación</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--n-500)' }}>¿Seguro que deseas eliminar este documento?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="atlas-btn-secondary atlas-btn-sm" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button type="button" className="atlas-btn-destructive atlas-btn-sm" onClick={handleDelete}>
                <XCircle size={14} />Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
