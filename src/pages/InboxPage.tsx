import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processingOCR, setProcessingOCR] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof tabItems)[number]>('Pendientes');
  const [activeType, setActiveType] = useState<(typeof typeFilters)[number]>('Todos');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    let currentUrl = '';

    const resolvePreview = async () => {
      if (!selectedDocument) {
        setPreviewUrl('');
        return;
      }

      let blob: Blob | null = null;
      if (selectedDocument.id) {
        blob = await getDocumentBlob(selectedDocument.id);
      }

      if (!blob && selectedDocument.content) {
        blob = new Blob([selectedDocument.content], { type: selectedDocument.type || 'application/pdf' });
      }

      if (!blob) {
        setPreviewUrl('');
        return;
      }

      const url = URL.createObjectURL(blob);
      currentUrl = url;
      setPreviewUrl(url);
    };

    resolvePreview();

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [selectedDocument]);

  const persistDocuments = async (updatedDocs: any[]) => {
    setDocuments(updatedDocs);
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocs));
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      for (const doc of updatedDocs) {
        await tx.store.put(doc);
      }
      await tx.done;
    } catch (_error) {
      // fallback already persisted in localStorage
    }
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
    if (!selectedDocument && filteredDocuments.length > 0) {
      setSelectedDocument(filteredDocuments[0]);
      return;
    }

    if (selectedDocument && !filteredDocuments.some((doc) => doc.id === selectedDocument.id)) {
      setSelectedDocument(filteredDocuments[0] || null);
    }
  }, [filteredDocuments, selectedDocument]);

  const handleProcessOCR = async () => {
    if (!selectedDocument) return;

    try {
      setProcessingOCR(true);
      let blob: Blob | null = null;
      if (selectedDocument.id) {
        blob = await getDocumentBlob(selectedDocument.id);
      }
      if (!blob && selectedDocument.content) {
        blob = new Blob([selectedDocument.content], { type: selectedDocument.type || 'application/pdf' });
      }
      if (!blob) throw new Error('No se encontró el archivo para OCR');

      const ocr = await processDocumentOCR(blob, selectedDocument.filename);
      const updated = {
        ...selectedDocument,
        metadata: {
          ...selectedDocument.metadata,
          ocr,
          queueStatus: ocr.status === 'error' ? 'error' : 'procesado'
        }
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

  const requestDelete = () => {
    if (!selectedDocument) return;
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

  const handleConfirmAndSave = () => {
    toast.success('Datos confirmados y guardados');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    try {
      const uploadedDocuments: any[] = [];

      for (const file of Array.from(selectedFiles)) {
        const documentToSave = {
          filename: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          lastModified: file.lastModified,
          content: file,
          uploadDate: new Date().toISOString(),
          metadata: {
            title: file.name.replace(/\.[^/.]+$/, ''),
            queueStatus: 'pendiente',
            status: 'Nuevo',
            tipo: 'Otros'
          }
        };

        const id = await saveDocumentWithBlob(documentToSave as any);
        uploadedDocuments.push({ ...documentToSave, id });
      }

      const updatedDocuments = [...uploadedDocuments, ...documents];
      await persistDocuments(updatedDocuments);

      if (!selectedDocument && uploadedDocuments.length > 0) {
        setSelectedDocument(uploadedDocuments[0]);
      }

      toast.success(`${uploadedDocuments.length} documento(s) subido(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron subir los documentos');
    } finally {
      event.target.value = '';
    }
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx,.zip"
            onChange={handleUploadFiles}
          />
          <button type="button" className="atlas-btn-primary" onClick={handleUploadClick}>
            <Upload size={16} />
            Subir documentos
          </button>
        </div>

        <div className="mt-5 flex items-center gap-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
          {tabItems.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                className="pb-3 text-base font-medium"
                style={{
                  color: active ? 'var(--blue)' : 'var(--n-500)',
                  borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent'
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="mt-4 h-[calc(100vh-330px)] min-h-[620px] border overflow-hidden" style={{ borderRadius: 'var(--r-md)', borderColor: 'var(--n-200)' }}>
          <div className="h-full flex">
            <div className="h-full border-r" style={{ width: '30%', borderColor: 'var(--n-200)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--n-200)' }}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--n-500)' }} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full h-10 pl-9 pr-3 border text-sm"
                    placeholder="Buscar documentos..."
                    style={{
                      borderColor: 'var(--n-300)',
                      borderRadius: 'var(--r-md)',
                      color: 'var(--n-900)',
                      background: 'var(--white)'
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {typeFilters.map((type) => {
                    const active = type === activeType;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className="px-3 py-1.5 text-sm font-medium"
                        style={{
                          borderRadius: 'var(--r-sm)',
                          background: active ? 'var(--blue)' : 'var(--n-100)',
                          color: active ? 'var(--white)' : 'var(--n-700)'
                        }}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <InboxV3DocumentList documents={filteredDocuments} selectedId={selectedId} onSelect={setSelectedDocument} />
            </div>

            <div className="h-full border-r flex flex-col" style={{ width: '40%', borderColor: 'var(--n-200)' }}>
              <div className="h-14 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
                <div className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--n-900)' }}>
                  <FileText size={16} />
                  <span className="truncate max-w-[220px]">{selectedDocument?.filename || 'Documento'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--n-500)' }}>
                  <span>PDF</span>
                  <button type="button" style={{ color: 'var(--n-500)' }}>Descargar</button>
                  <button type="button" style={{ color: 'var(--n-500)' }}><MoreVertical size={16} /></button>
                </div>
              </div>

              <div className="flex-1 p-4" style={{ background: 'var(--n-50)' }}>
                <div className="h-full border" style={{ borderRadius: 'var(--r-md)', borderColor: 'var(--n-200)', background: 'var(--white)' }}>
                  {selectedDocument && previewUrl ? (
                    <iframe title={selectedDocument.filename} src={previewUrl} className="w-full h-full" style={{ border: 'none', borderRadius: 'var(--r-md)' }} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--n-500)' }}>
                      Selecciona un documento
                    </div>
                  )}
                </div>
              </div>

              <div className="h-16 px-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--n-200)', background: 'var(--white)' }}>
                <InboxV3Actions
                  onProcessOCR={handleProcessOCR}
                  onAssign={handleAssign}
                  onDelete={requestDelete}
                  disableActions={!selectedDocument || processingOCR}
                />
              </div>
            </div>

            <div className="h-full" style={{ width: '30%', background: 'var(--white)' }}>
              <InboxV3ExtractedPanel document={selectedDocument} onConfirm={handleConfirmAndSave} />
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--focus-ring)' }}>
          <div className="p-6 border w-full max-w-md" style={{ background: 'var(--surface-card)', borderColor: 'var(--n-200)', borderRadius: 'var(--r-lg)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--n-900)' }}>Confirmar eliminación</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--n-500)' }}>
              ¿Seguro que deseas eliminar este documento?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="atlas-btn-secondary atlas-btn-sm" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="atlas-btn-destructive atlas-btn-sm" onClick={handleDelete}>
                <XCircle size={14} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
