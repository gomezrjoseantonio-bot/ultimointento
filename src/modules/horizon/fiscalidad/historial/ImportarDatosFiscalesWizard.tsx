import React, { useState, useCallback, useRef } from 'react';
import {
  Image,
  Briefcase,
  Home,
  Landmark,
  ArrowRightLeft,
  Users,
  X,
  Check,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { callScanChatImages } from '../../../../services/scanChatService';
import type { DatosFiscalesExtraidos } from '../../../../services/datosFiscalesService';
import { ejecutarImportacionDatosFiscales } from '../../../../services/datosFiscalesService';
import type { CambioDetectado } from '../../../../services/datosFiscalesComparisonService';
import { detectarCambios, compararInmuebles } from '../../../../services/datosFiscalesComparisonService';
import type { InmuebleComparacion } from '../../../../services/datosFiscalesComparisonService';

// ── Helpers ──────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const EJERCICIOS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);
const MAX_IMAGES = 10;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const fmtMono = (n: number): React.ReactNode => (
  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(n)}</span>
);

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma !== -1 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ── Styles ───────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1200,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: 'white', borderRadius: 'var(--r-lg, 16px)',
  padding: '2rem', maxWidth: '720px', width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--blue)', color: 'var(--white, #fff)',
  border: 'none', borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.9rem',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--n-700)',
  border: 'none', borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem',
  cursor: 'pointer',
};

const badgeBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '3px 10px', borderRadius: 'var(--r-sm, 6px)',
  fontSize: 'var(--t-xs, 0.75rem)', fontWeight: 500,
};

const sectionIconStyle: React.CSSProperties = { flexShrink: 0, marginTop: '2px' };

// ── Badge colors ─────────────────────────────────────────────

const badgeStyles: Record<CambioDetectado['tipo'], React.CSSProperties> = {
  nuevo: { background: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  actualizado: { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  diferencia: { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  solo_atlas: { background: 'var(--n-100)', color: 'var(--n-700)' },
};

const badgeLabels: Record<CambioDetectado['tipo'], string> = {
  nuevo: 'Nuevo',
  actualizado: 'Actualizado',
  diferencia: 'Diferencia',
  solo_atlas: 'Solo ATLAS',
};

// ── Component ────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const ImportarDatosFiscalesWizard: React.FC<Props> = ({ onClose, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [ejercicio, setEjercicio] = useState(CURRENT_YEAR);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [datos, setDatos] = useState<DatosFiscalesExtraidos | null>(null);
  const [cambios, setCambios] = useState<CambioDetectado[]>([]);
  const [inmuebleComps, setInmuebleComps] = useState<InmuebleComparacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(
      (f) => ACCEPTED_TYPES.includes(f.type),
    );
    if (valid.length === 0) {
      toast.error('Solo se aceptan imágenes PNG o JPG');
      return;
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, MAX_IMAGES);
      // Generate previews
      const newPreviews: string[] = [];
      combined.forEach((f) => {
        const url = URL.createObjectURL(f);
        newPreviews.push(url);
      });
      setPreviews(newPreviews);
      return combined;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const newPreviews = next.map((f) => URL.createObjectURL(f));
      setPreviews(newPreviews);
      return next;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // ── Analyze ────────────────────────────────────────────────

  const handleAnalizar = useCallback(async () => {
    if (files.length === 0) return;
    setStep(2);
    setError(null);
    setTotalImages(files.length);
    setProgress(0);

    try {
      // Convert all files to base64
      const base64Images: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(i);
        base64Images.push(await toBase64(files[i]));
      }

      setProgress(files.length); // All converted

      const response = await callScanChatImages({
        tipo: 'scan_datos_fiscales',
        imagenes: base64Images,
        mimeTypes: files.map(f => f.type || 'image/png'),
      });

      if (!response.ok || !response.extraido) {
        throw new Error(response.error || 'No se pudieron analizar las capturas');
      }

      const extracted: DatosFiscalesExtraidos = typeof response.extraido === 'string'
        ? JSON.parse(response.extraido)
        : response.extraido;

      // Set ejercicio from extraction if available
      if (extracted.ejercicio) setEjercicio(extracted.ejercicio);
      if (!extracted.ejercicio) extracted.ejercicio = ejercicio;

      setDatos(extracted);

      // T22: Detect changes
      const [detectedChanges, inmComps] = await Promise.all([
        detectarCambios(extracted),
        compararInmuebles(extracted),
      ]);
      setCambios(detectedChanges);
      setInmuebleComps(inmComps);

      setStep(3);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setStep(1);
      toast.error('Error al analizar las capturas');
    }
  }, [files, ejercicio]);

  // ── Import ─────────────────────────────────────────────────

  const handleImportar = useCallback(async () => {
    if (!datos) return;
    setStep(4);

    try {
      const resumen = await ejecutarImportacionDatosFiscales(datos);

      if (resumen.exito) {
        toast.success(
          `Importados: ${resumen.inmueblesCreados} inmuebles nuevos, ${resumen.inmueblesActualizados} actualizados, ${resumen.prestamosCreados} préstamos, ${resumen.entidadesCreadas} entidades`,
        );
        onImported();
        onClose();
      } else {
        toast.error(`Importación con errores: ${resumen.errores[0]}`);
        setStep(3);
      }
    } catch (err) {
      toast.error('Error al importar datos fiscales');
      setStep(3);
    }
  }, [datos, onImported, onClose]);

  // ── Render: Step 1 — Upload ────────────────────────────────

  const renderStep1 = () => (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: 'var(--t-sm, 0.875rem)', fontWeight: 500, color: 'var(--n-700)', marginBottom: '0.5rem' }}>
          Ejercicio fiscal
        </label>
        <select
          value={ejercicio}
          onChange={(e) => setEjercicio(Number(e.target.value))}
          style={{
            border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 10px)',
            padding: '0.5rem 0.75rem', fontSize: '0.9rem', color: 'var(--n-700)',
            background: 'white', outline: 'none',
          }}
        >
          {EJERCICIOS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragOver ? 'var(--blue)' : 'var(--n-300)'}`,
          borderRadius: 'var(--r-lg, 16px)',
          background: dragOver ? 'var(--n-50)' : 'transparent',
          padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <Image size={48} color="var(--n-300)" style={{ marginBottom: '1rem' }} />
        <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-500)', margin: 0 }}>
          Arrastra las capturas aquí o haz clic para seleccionar
        </p>
        <p style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-400)', marginTop: '0.5rem' }}>
          PNG o JPG · Máximo {MAX_IMAGES} imágenes
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
        />
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '0.75rem', marginTop: '1.5rem',
        }}>
          {files.map((file, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={previews[i]}
                alt={`Captura ${i + 1}`}
                style={{
                  width: '100%', height: '80px', objectFit: 'cover',
                  borderRadius: 'var(--r-md, 10px)',
                  border: '1px solid var(--n-200)',
                }}
              />
              <span style={{
                position: 'absolute', bottom: '4px', left: '6px',
                background: 'var(--n-700)', color: 'white',
                fontSize: '0.65rem', padding: '1px 5px',
                borderRadius: 'var(--r-sm, 6px)', fontWeight: 600,
              }}>
                {i + 1}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'var(--n-700)', color: 'white',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
                aria-label={`Eliminar captura ${i + 1}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--s-neg)', fontSize: 'var(--t-sm, 0.875rem)', marginTop: '1rem' }}>
          {error}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
        <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
        <button
          type="button"
          disabled={files.length === 0}
          onClick={handleAnalizar}
          style={{
            ...btnPrimary,
            opacity: files.length === 0 ? 0.5 : 1,
            cursor: files.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Image size={16} />
            Analizar capturas
          </span>
        </button>
      </div>
    </>
  );

  // ── Render: Step 2 — Processing ────────────────────────────

  const renderStep2 = () => (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{
        borderColor: 'var(--blue)', borderTopColor: 'transparent',
        margin: '0 auto 1.5rem',
      }} />
      <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-700)', margin: '0 0 1rem' }}>
        Analizando captura {Math.min(progress + 1, totalImages)} de {totalImages}...
      </p>
      <div style={{
        background: 'var(--n-100)', borderRadius: 'var(--r-sm, 6px)',
        height: '8px', overflow: 'hidden', maxWidth: '300px', margin: '0 auto',
      }}>
        <div style={{
          background: 'var(--blue)', height: '100%',
          borderRadius: 'var(--r-sm, 6px)',
          width: `${Math.round(((progress + 1) / totalImages) * 100)}%`,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );

  // ── Render: Step 3 — Verification ──────────────────────────

  const renderStep3 = () => {
    if (!datos) return null;

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* T22: Changes detected */}
        {cambios.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--t-sm, 0.875rem)', fontWeight: 500, color: 'var(--n-900)' }}>
                Cambios detectados
              </h3>
              <span style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-500)' }}>
                {cambios.length} cambio{cambios.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ border: '1px solid var(--n-200)', borderRadius: 'var(--r-md, 10px)', overflow: 'hidden' }}>
              {cambios.map((cambio, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '8px 12px',
                    borderBottom: i < cambios.length - 1 ? '1px solid var(--n-100)' : 'none',
                  }}
                >
                  <span style={{ ...badgeBase, ...badgeStyles[cambio.tipo] }}>
                    {cambio.tipo === 'solo_atlas' && <Check size={14} style={{ color: 'var(--s-pos)' }} />}
                    {badgeLabels[cambio.tipo]}
                  </span>
                  <span style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-700)', flex: 1 }}>
                    {cambio.descripcion}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trabajo */}
        {datos.trabajo && datos.trabajo.length > 0 && (
          <SectionBlock icon={<Briefcase size={20} style={sectionIconStyle} />} title="Trabajo">
            {datos.trabajo.map((t, i) => (
              <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)' }}>
                <div style={{ fontWeight: 500, color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                  {t.pagador}
                </div>
                <div style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-500)', marginTop: '0.25rem' }}>
                  {t.nif && <span>{t.nif} · </span>}
                  {t.retribucionDineraria != null && <span>{fmtMono(t.retribucionDineraria)} brutos</span>}
                  {t.retencionIRPF != null && <span> · {fmtMono(t.retencionIRPF)} retenidos</span>}
                </div>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* Actividades */}
        {datos.actividades && datos.actividades.length > 0 && (
          <SectionBlock icon={<Briefcase size={20} style={sectionIconStyle} />} title="Actividades económicas">
            {datos.actividades.map((a, i) => (
              <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)' }}>
                <div style={{ fontWeight: 500, color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                  {a.pagador || a.tipo || 'Actividad'}
                </div>
                <div style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-500)', marginTop: '0.25rem' }}>
                  {a.epigrafe && <span>IAE {a.epigrafe} · </span>}
                  {a.ingresos != null && <span>{fmtMono(a.ingresos)} facturado</span>}
                  {a.retencion != null && <span> · {fmtMono(a.retencion)} retenidos</span>}
                </div>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* T20: Inmuebles table */}
        {inmuebleComps.length > 0 && (
          <SectionBlock icon={<Home size={20} style={sectionIconStyle} />} title="Inmuebles">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs, 0.75rem)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--n-200)' }}>
                    {['Ref. catastral', 'Dirección', 'VC total', 'VC constr.', '%', 'Días', 'Uso'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '0.5rem 0.4rem',
                        fontWeight: 500, color: 'var(--n-500)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        fontSize: 'var(--t-xs, 0.75rem)',
                      }}>
                        {h}
                      </th>
                    ))}
                    <th style={{ width: '80px' }} />
                  </tr>
                </thead>
                <tbody>
                  {inmuebleComps.map((inm, i) => (
                    <React.Fragment key={i}>
                      <tr style={{ borderBottom: '1px solid var(--n-200)' }}>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {inm.refCatastral.slice(0, 14)}...
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', color: 'var(--n-900)' }}>
                          {inm.direccion?.slice(0, 30)}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {inm.valorCatastralNuevo ? fmt(inm.valorCatastralNuevo) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {inm.valorConstruccionNuevo ? fmt(inm.valorConstruccionNuevo) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {inm.valorCatastralNuevo && inm.valorConstruccionNuevo
                            ? `${((inm.valorConstruccionNuevo / inm.valorCatastralNuevo) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {inm.dias ?? '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem', color: 'var(--n-700)' }}>
                          {inm.uso ? inm.uso.slice(0, 5) + '.' : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.4rem' }}>
                          <span style={{
                            ...badgeBase,
                            ...(inm.esNuevo
                              ? { background: 'var(--s-pos-bg)', color: 'var(--s-pos)' }
                              : { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' }),
                          }}>
                            {inm.esNuevo ? 'Nuevo' : 'Actualizar'}
                          </span>
                        </td>
                      </tr>
                      {/* T20: Show what will change */}
                      {!inm.esNuevo && inm.valorCatastralAnterior != null && inm.valorCatastralNuevo != null
                        && Math.abs((inm.valorCatastralAnterior || 0) - (inm.valorCatastralNuevo || 0)) > 1 && (
                        <tr>
                          <td colSpan={8} style={{
                            padding: '0.25rem 0.4rem 0.5rem',
                            fontSize: 'var(--t-xs, 0.75rem)',
                            color: 'var(--s-warn)',
                            fontStyle: 'italic',
                          }}>
                            En ATLAS: VC={fmt(inm.valorCatastralAnterior || 0)} → se actualizará a {fmt(inm.valorCatastralNuevo || 0)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionBlock>
        )}

        {/* Préstamos */}
        {datos.prestamos && datos.prestamos.length > 0 && (
          <SectionBlock icon={<Landmark size={20} style={sectionIconStyle} />} title="Préstamos">
            {datos.prestamos.map((p, i) => (
              <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)' }}>
                <div style={{ fontWeight: 500, color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                  {p.entidad}
                </div>
                <div style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-500)', marginTop: '0.25rem' }}>
                  Saldo: {fmtMono(p.saldoPendiente || 0)} · Intereses: {fmtMono(p.interesesPagados || 0)}
                  {p.tipo && <span> · {p.tipo === 'hipoteca_vivienda' ? 'Hipoteca vivienda' : p.tipo}</span>}
                </div>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* Arrastres */}
        {datos.arrastres && (
          (datos.arrastres.gastosPendientes?.length || 0) + (datos.arrastres.perdidasPatrimoniales?.length || 0) > 0
        ) && (
          <SectionBlock icon={<ArrowRightLeft size={20} style={sectionIconStyle} />} title="Arrastres">
            {datos.arrastres.gastosPendientes?.map((g, i) => (
              <div key={`g${i}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                <span style={{ color: 'var(--n-700)' }}>{g.inmueble}: </span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                  {fmt(g.importe || 0)}
                </span>
                <span style={{ color: 'var(--n-500)' }}> gastos pendientes</span>
              </div>
            ))}
            {datos.arrastres.perdidasPatrimoniales?.map((p, i) => (
              <div key={`p${i}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                <span style={{ color: 'var(--n-700)' }}>Pérdidas patrimoniales ({p.origenEjercicio}): </span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                  {fmt(p.importe || 0)}
                </span>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* Entidades */}
        {datos.entidades && datos.entidades.length > 0 && (
          <SectionBlock icon={<Users size={20} style={sectionIconStyle} />} title="Entidades en atribución">
            {datos.entidades.map((e, i) => (
              <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--n-100)' }}>
                <div style={{ fontWeight: 500, color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                  {e.nombre}
                </div>
                <div style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-500)', marginTop: '0.25rem' }}>
                  {e.tipoEntidad} · {e.participacion}% · Rtos: {fmtMono(e.rendimientos || 0)} · Ret: {fmtMono(e.retenciones || 0)}
                </div>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* T21: Loan advisory message */}
        {datos.prestamos && datos.prestamos.some((p) => p.tipo === 'hipoteca_vivienda') && (
          <div style={{
            background: 'var(--s-neu-bg, #F3F4F6)',
            borderRadius: 'var(--r-md, 10px)',
            padding: '1rem 1.25rem',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <Info size={16} color="var(--n-500)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--s-neu, #374151)' }}>
              Hacienda solo reporta hipotecas de vivienda habitual. Si tienes préstamos vinculados a tus inmuebles de inversión, regístralos en Financiación para que ATLAS los deduzca en casilla 0105.
              <div style={{ marginTop: '0.5rem' }}>
                <a
                  href="/financiacion"
                  style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                >
                  Ir a Financiación →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={() => setStep(1)} style={btnGhost}>Atrás</button>
          <button type="button" onClick={handleImportar} style={btnPrimary}>
            Importar datos
          </button>
        </div>
      </div>
    );
  };

  // ── Render: Step 4 — Importing ─────────────────────────────

  const renderStep4 = () => (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{
        borderColor: 'var(--blue)', borderTopColor: 'transparent',
        margin: '0 auto 1.5rem',
      }} />
      <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-700)' }}>
        Importando datos fiscales...
      </p>
    </div>
  );

  // ── Main render ────────────────────────────────────────────

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h1 style={{
          margin: '0 0 0.25rem', fontSize: 'var(--t-lg, 1.125rem)',
          fontWeight: 500, color: 'var(--n-900)',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          Importar datos fiscales
        </h1>
        <p style={{
          margin: '0 0 1.5rem', fontSize: 'var(--t-sm, 0.875rem)',
          color: 'var(--n-500)',
        }}>
          Capturas de pantalla de la web de Hacienda
        </p>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

// ── Section block sub-component ──────────────────────────────

const SectionBlock: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      {icon}
      <h3 style={{
        margin: 0, fontSize: 'var(--t-sm, 0.875rem)',
        fontWeight: 500, color: 'var(--n-900)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}>
        {title}
      </h3>
    </div>
    <div style={{
      border: '1px solid var(--n-200)',
      borderRadius: 'var(--r-md, 10px)',
      padding: '0.5rem 0.75rem',
    }}>
      {children}
    </div>
  </div>
);

export default ImportarDatosFiscalesWizard;
