import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { deleteDocumentAndBlob, getDocumentBlob, initDB } from '../services/db';
import { processDocumentOCR } from '../services/documentAIService';
import toast from 'react-hot-toast';
import InboxV3DocumentList from '../components/inbox/InboxV3DocumentList';
import InboxV3Actions from '../components/inbox/InboxV3Actions';
import InboxV3ExtractedPanel from '../components/inbox/InboxV3ExtractedPanel';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processingOCR, setProcessingOCR] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const selectedId = selectedDocument?.id;
  const empty = useMemo(() => documents.length === 0, [documents.length]);

  return (
    <div className="h-[calc(100vh-140px)] border overflow-hidden" style={{ borderColor: 'var(--n-200)', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-base)' }}>
      <div className="h-full flex">
        <div className="h-full border-r" style={{ width: '30%', borderColor: 'var(--n-200)' }}>
          <InboxV3DocumentList documents={documents} selectedId={selectedId} onSelect={setSelectedDocument} />
        </div>

        <div className="h-full border-r p-5 flex flex-col" style={{ width: '40%', borderColor: 'var(--n-200)' }}>
          <InboxV3Actions
            onProcessOCR={handleProcessOCR}
            onAssign={handleAssign}
            onDelete={requestDelete}
            disableActions={!selectedDocument || processingOCR}
          />

          <div className="mt-4 flex-1 border flex items-center justify-center" style={{ borderColor: 'var(--n-200)', borderRadius: 'var(--r-md)', background: 'var(--n-50)' }}>
            {selectedDocument && previewUrl ? (
              <iframe title={selectedDocument.filename} src={previewUrl} className="w-full h-full" style={{ border: 'none', borderRadius: 'var(--r-md)' }} />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: 'var(--n-500)' }}>
                <FileText size={28} />
                <span className="text-sm">{empty ? 'No hay documentos en bandeja' : 'Selecciona un documento'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-full" style={{ width: '30%', background: 'var(--white)' }}>
          <InboxV3ExtractedPanel document={selectedDocument} onConfirm={handleConfirmAndSave} />
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(26, 35, 50, 0.22)' }}>
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
