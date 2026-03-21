import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CasillaInput from '../../../../components/fiscal/ui/CasillaInput';
import { saveDocumentWithBlob } from '../../../../services/db';
import {
  CasillaExtraida,
  ImportacionManualData,
  crearImportacionManualVacia,
  extraerCasillasDeModeloPDF,
  extraerTextoDeModeloPDF,
  mapearCasillasAImportacion,
} from '../../../../services/aeatPdfParserService';
import { importarDeclaracionManual } from '../../../../services/fiscalLifecycleService';
import {
  DatosActivosExtraidos,
  InmuebleParsedFromPDF,
  extraerDatosActivos,
  parsearInmueblesDesdeTexto,
  reconstruirDeclaracionDesdeCasillas,
} from '../../../../services/declaracionFromCasillasService';

type MetodoEntrada = 'formulario' | 'pdf';

interface ImportarDeclaracionWizardProps {
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

const currentYear = new Date().getFullYear();

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 30, 63, 0.56)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1100,
  padding: '1rem',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--surface-card, #fff)',
  borderRadius: '16px',
  width: 'min(980px, 100%)',
  maxHeight: 'calc(100vh - 2rem)',
  overflow: 'auto',
  border: '1px solid var(--hz-neutral-300)',
  boxShadow: '0 18px 42px rgba(2, 30, 63, 0.18)',
};

const fieldsetStyle: React.CSSProperties = {
  border: '1px solid var(--hz-neutral-300)',
  borderRadius: '12px',
  padding: '1rem',
  display: 'grid',
  gap: '0.85rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--hz-neutral-700)',
  padding: '0 0.25rem',
};

const actionButtonStyle: React.CSSProperties = {
  border: '1px solid var(--hz-neutral-300)',
  borderRadius: '12px',
  padding: '1rem',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'white',
  display: 'grid',
  gap: '0.35rem',
};

const WizardForm: React.FC<{
  data: ImportacionManualData;
  onChange: (patch: Partial<ImportacionManualData>) => void;
}> = ({ data, onChange }) => {
  const arrastres = data.arrastres ?? [];

  const updateArrastre = (
    index: number,
    patch: Partial<NonNullable<ImportacionManualData['arrastres']>[number]>,
  ) => {
    const next = [...arrastres];
    next[index] = { ...next[index], ...patch };
    onChange({ arrastres: next });
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <fieldset style={fieldsetStyle}>
        <legend style={sectionTitleStyle}>Bases imponibles</legend>
        <CasillaInput casilla="0435" label="Base imponible general" value={data.baseImponibleGeneral} onChange={(value) => onChange({ baseImponibleGeneral: value })} />
        <CasillaInput casilla="0460" label="Base imponible del ahorro" value={data.baseImponibleAhorro} onChange={(value) => onChange({ baseImponibleAhorro: value })} />
        <CasillaInput casilla="0505" label="Base liquidable general" value={data.baseLiquidableGeneral} onChange={(value) => onChange({ baseLiquidableGeneral: value })} />
        <CasillaInput casilla="0510" label="Base liquidable del ahorro" value={data.baseLiquidableAhorro} onChange={(value) => onChange({ baseLiquidableAhorro: value })} />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={sectionTitleStyle}>Cuotas</legend>
        <CasillaInput casilla="0545" label="Cuota íntegra estatal" value={data.cuotaIntegraEstatal} onChange={(value) => onChange({ cuotaIntegraEstatal: value })} />
        <CasillaInput casilla="0546" label="Cuota íntegra autonómica" value={data.cuotaIntegraAutonomica} onChange={(value) => onChange({ cuotaIntegraAutonomica: value })} />
        <CasillaInput casilla="0570" label="Cuota líquida estatal" value={data.cuotaLiquidaEstatal} onChange={(value) => onChange({ cuotaLiquidaEstatal: value })} />
        <CasillaInput casilla="0571" label="Cuota líquida autonómica" value={data.cuotaLiquidaAutonomica} onChange={(value) => onChange({ cuotaLiquidaAutonomica: value })} />
        <CasillaInput casilla="0595" label="Cuota resultante autoliquidación" value={data.cuotaResultante} onChange={(value) => onChange({ cuotaResultante: value })} />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={sectionTitleStyle}>Retenciones y pagos a cuenta</legend>
        <CasillaInput casilla="0596" label="Retenciones del trabajo" value={data.retencionTrabajo} onChange={(value) => onChange({ retencionTrabajo: value })} />
        <CasillaInput casilla="0597" label="Retenciones capital mobiliario" value={data.retencionCapitalMobiliario} onChange={(value) => onChange({ retencionCapitalMobiliario: value })} />
        <CasillaInput casilla="0599" label="Retenciones actividades económicas" value={data.retencionActividadesEcon} onChange={(value) => onChange({ retencionActividadesEcon: value })} />
        <CasillaInput casilla="0604" label="Pagos fraccionados" value={data.pagosFraccionados} onChange={(value) => onChange({ pagosFraccionados: value })} />
        <CasillaInput casilla="0609" label="Total retenciones" value={data.totalRetenciones} onChange={(value) => onChange({ totalRetenciones: value })} />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={sectionTitleStyle}>Resultado y rendimientos opcionales</legend>
        <CasillaInput casilla="0670" label="Resultado (+ a pagar / − a devolver)" value={data.resultado} onChange={(value) => onChange({ resultado: value })} />
        <CasillaInput casilla="0676" label="Regularización rectificativa" value={data.regularizacion} onChange={(value) => onChange({ regularizacion: value })} optional />
        <CasillaInput casilla="0025" label="Rendimientos del trabajo" value={data.rendimientosTrabajo} onChange={(value) => onChange({ rendimientosTrabajo: value })} optional />
        <CasillaInput casilla="0156" label="Rendimientos inmobiliarios" value={data.rendimientosInmuebles} onChange={(value) => onChange({ rendimientosInmuebles: value })} optional />
        <CasillaInput casilla="0226" label="Rendimientos autónomo" value={data.rendimientosAutonomo} onChange={(value) => onChange({ rendimientosAutonomo: value })} optional />
      </fieldset>

      <details style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '12px', padding: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          Arrastres pendientes al cierre (opcional)
        </summary>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          {arrastres.map((arrastre, index) => (
            <div
              key={`${arrastre.tipo}-${index}`}
              style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}
            >
              <select
                value={arrastre.tipo}
                onChange={(event) => updateArrastre(index, { tipo: event.target.value as any })}
                style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)' }}
              >
                <option value="gastos_0105_0106">Gastos 0105/0106</option>
                <option value="perdidas_patrimoniales_ahorro">Pérdidas patrimoniales ahorro</option>
              </select>
              <input
                type="number"
                value={arrastre.ejercicioOrigen}
                onChange={(event) => updateArrastre(index, { ejercicioOrigen: parseInt(event.target.value, 10) || data.ejercicio })}
                placeholder="Año origen"
                style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)' }}
              />
              <input
                type="number"
                step="0.01"
                value={arrastre.importe}
                onChange={(event) => updateArrastre(index, { importe: parseFloat(event.target.value) || 0 })}
                placeholder="Importe"
                style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)' }}
              />
              <button
                type="button"
                onClick={() => onChange({ arrastres: arrastres.filter((_, arrastreIndex) => arrastreIndex !== index) })}
                style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({
              arrastres: [
                ...arrastres,
                { tipo: 'gastos_0105_0106', ejercicioOrigen: data.ejercicio, importe: 0 },
              ],
            })}
            style={{ justifySelf: 'start', border: '1px solid var(--hz-neutral-300)', borderRadius: '8px', padding: '0.55rem 0.8rem', background: 'white', cursor: 'pointer' }}
          >
            + Añadir arrastre
          </button>
        </div>
      </details>
    </div>
  );
};

const ImportarDeclaracionWizard: React.FC<ImportarDeclaracionWizardProps> = ({ onClose, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ejercicio, setEjercicio] = useState(currentYear - 1);
  const [metodo, setMetodo] = useState<MetodoEntrada>('formulario');
  const [data, setData] = useState<ImportacionManualData>(() => crearImportacionManualVacia(currentYear - 1));
  const [casillasExtraidas, setCasillasExtraidas] = useState<CasillaExtraida[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [inmueblesParsed, setInmueblesParsed] = useState<InmuebleParsedFromPDF[]>([]);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData((prev) => ({ ...prev, ejercicio }));
  }, [ejercicio]);

  const resumen = useMemo(() => ({
    cuotaIntegra: data.cuotaIntegraEstatal + data.cuotaIntegraAutonomica,
    cuotaLiquida: data.cuotaLiquidaEstatal + data.cuotaLiquidaAutonomica,
  }), [data]);

  const handleDataPatch = (patch: Partial<ImportacionManualData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setParsing(true);
    try {
      const [extraidas, extractedText] = await Promise.all([
        extraerCasillasDeModeloPDF(file, setProgressMsg),
        extraerTextoDeModeloPDF(file).catch(() => ''),
      ]);
      const parsedInmuebles = extractedText ? parsearInmueblesDesdeTexto(extractedText) : [];
      setCasillasExtraidas(extraidas);
      setInmueblesParsed(parsedInmuebles);
      setData((prev) => ({
        ...prev,
        ...mapearCasillasAImportacion(extraidas, ejercicio),
        ejercicio,
        arrastres: prev.arrastres ?? [],
      }));
      if (extraidas.length > 0) {
        toast.success(`${extraidas.length} casillas extraídas automáticamente`);
      } else {
        toast.error('No se pudieron extraer casillas. Rellena el formulario manualmente.');
      }
    } catch (error) {
      console.error('Error extrayendo casillas del PDF', error);
      toast.error('Error al procesar el PDF');
    } finally {
      setParsing(false);
      setProgressMsg(null);
    }
  };

  const handleConfirmarImportacion = async () => {
    setSaving(true);
    try {
      const casillasMap = casillasExtraidas.length > 0
        ? Object.fromEntries(casillasExtraidas.map((casilla) => [casilla.numero, casilla.valor]))
        : {
            '0435': data.baseImponibleGeneral,
            '0460': data.baseImponibleAhorro,
            '0505': data.baseLiquidableGeneral,
            '0510': data.baseLiquidableAhorro,
            '0545': data.cuotaIntegraEstatal,
            '0546': data.cuotaIntegraAutonomica,
            '0570': data.cuotaLiquidaEstatal,
            '0571': data.cuotaLiquidaAutonomica,
            '0595': data.cuotaResultante,
            '0596': data.retencionTrabajo,
            '0597': data.retencionCapitalMobiliario,
            '0599': data.retencionActividadesEcon,
            '0604': data.pagosFraccionados,
            '0609': data.totalRetenciones,
            '0670': data.resultado,
            ...(typeof data.regularizacion === 'number' ? { '0676': data.regularizacion } : {}),
            ...(typeof data.rendimientosTrabajo === 'number' ? { '0025': data.rendimientosTrabajo } : {}),
            ...(typeof data.rendimientosInmuebles === 'number' ? { '0156': data.rendimientosInmuebles } : {}),
            ...(typeof data.rendimientosAutonomo === 'number' ? { '0226': data.rendimientosAutonomo } : {}),
          };

      const declaracionCompleta = casillasExtraidas.length > 0
        ? reconstruirDeclaracionDesdeCasillas(data.ejercicio, casillasExtraidas, inmueblesParsed)
        : undefined;
      const datosActivos: DatosActivosExtraidos | undefined = casillasExtraidas.length > 0
        ? extraerDatosActivos(data.ejercicio, inmueblesParsed, casillasExtraidas)
        : undefined;

      await importarDeclaracionManual({
        ejercicio: data.ejercicio,
        casillasAEAT: casillasMap,
        resultado: {
          baseImponibleGeneral: declaracionCompleta?.liquidacion.baseImponibleGeneral ?? data.baseImponibleGeneral,
          baseImponibleAhorro: declaracionCompleta?.liquidacion.baseImponibleAhorro ?? data.baseImponibleAhorro,
          cuotaIntegra: declaracionCompleta?.liquidacion.cuotaIntegra ?? resumen.cuotaIntegra,
          cuotaLiquida: declaracionCompleta?.liquidacion.cuotaLiquida ?? resumen.cuotaLiquida,
          deducciones: declaracionCompleta?.liquidacion.deduccionesDobleImposicion ?? 0,
          retencionesYPagosCuenta: declaracionCompleta?.retenciones.total ?? data.totalRetenciones,
          resultado: declaracionCompleta?.resultado ?? data.resultado,
          tipoEfectivo: declaracionCompleta?.tipoEfectivo ?? (
            resumen.cuotaLiquida > 0
              ? Number((((resumen.cuotaLiquida / Math.max(1, data.baseImponibleGeneral + data.baseImponibleAhorro)) * 100)).toFixed(2))
              : 0
          ),
        },
        declaracionCompleta,
        datosActivos,
        inmueblesParsed,
        arrastresPendientes: (data.arrastres ?? []).map((arrastre) => ({
          tipo: arrastre.tipo,
          importePendiente: arrastre.importe,
          ejercicioOrigen: arrastre.ejercicioOrigen,
          ejercicioCaducidad: arrastre.ejercicioOrigen + 4,
        })),
        notasRevision: metodo === 'pdf'
          ? 'Importación desde PDF Modelo 100'
          : 'Importación manual desde wizard histórico IRPF',
      });

      if (uploadedFile) {
        await saveDocumentWithBlob({
          filename: `Declaracion_IRPF_${data.ejercicio}.pdf`,
          type: 'declaracion_irpf',
          content: uploadedFile,
          size: uploadedFile.size,
          lastModified: uploadedFile.lastModified,
          uploadDate: new Date().toISOString(),
          metadata: {
            title: `Declaración IRPF ${data.ejercicio}`,
            description: 'PDF archivado desde el wizard de importación de declaraciones.',
            ejercicio: data.ejercicio,
            origen: 'importacion_wizard',
            fechaImportacion: new Date().toISOString(),
            casillasExtraidas: casillasExtraidas.length,
            metodoExtraccion: casillasExtraidas.some((casilla) => casilla.lineaOriginal.startsWith('[OCR]')) ? 'ocr' : 'texto',
            status: 'Archivado',
          },
        });
      }

      toast.success(`Declaración ${data.ejercicio} importada y archivada`);
      await onImported();
      onClose();
    } catch (error) {
      console.error('Error importando declaración', error);
      toast.error('Error al importar la declaración');
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep2 = metodo === 'formulario' || casillasExtraidas.length > 0 || data.baseImponibleGeneral !== 0 || data.totalRetenciones !== 0 || data.resultado !== 0;

  return (
    <div style={overlayStyle} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--hz-neutral-300)' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)' }}>Importar declaración IRPF</h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--hz-neutral-700)' }}>
              Alimenta el histórico fiscal con declaraciones presentadas o PDFs del Modelo 100.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: step >= item ? 'rgba(4, 44, 94, 0.10)' : 'var(--hz-neutral-100)',
                  color: step >= item ? 'var(--atlas-blue)' : 'var(--hz-neutral-600)',
                  fontWeight: 600,
                }}
              >
                Paso {item}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>Ejercicio fiscal</label>
                <select
                  value={ejercicio}
                  onChange={(event) => setEjercicio(Number(event.target.value))}
                  style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--hz-neutral-300)' }}
                >
                  {Array.from({ length: 10 }, (_, index) => currentYear - index).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 style={{ marginBottom: '0.75rem', color: 'var(--atlas-navy-1)' }}>Método de entrada</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <button type="button" onClick={() => setMetodo('formulario')} style={{ ...actionButtonStyle, borderColor: metodo === 'formulario' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)' }}>
                    <FileText size={24} style={{ color: 'var(--atlas-blue)' }} />
                    <strong>Formulario manual</strong>
                    <span style={{ color: 'var(--hz-neutral-700)' }}>Introduce las casillas clave directamente.</span>
                  </button>
                  <button type="button" onClick={() => setMetodo('pdf')} style={{ ...actionButtonStyle, borderColor: metodo === 'pdf' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)' }}>
                    <Upload size={24} style={{ color: 'var(--atlas-blue)' }} />
                    <strong>Subir PDF del Modelo 100</strong>
                    <span style={{ color: 'var(--hz-neutral-700)' }}>Extracción automática de casillas y revisión previa.</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {metodo === 'pdf' && (
                <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'var(--hz-neutral-100)' }}>
                  <h3 style={{ margin: 0, color: 'var(--atlas-navy-1)' }}>Subir PDF del Modelo 100</h3>
                  <input type="file" accept=".pdf" onChange={handleFileUpload} />
                  {parsing && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-700">{progressMsg || 'Procesando PDF...'}</span>
                    </div>
                  )}
                  {casillasExtraidas.length > 0 && (
                    <p style={{ margin: 0, color: 'var(--hz-neutral-700)' }}>
                      {casillasExtraidas.length} casillas detectadas. Revisa y ajusta los valores antes de guardar.
                    </p>
                  )}
                </div>
              )}

              <WizardForm data={data} onChange={handleDataPatch} />
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--hz-neutral-100)' }}>
                <h3 style={{ marginTop: 0, color: 'var(--atlas-navy-1)' }}>Confirmación</h3>
                <p style={{ marginBottom: '1rem', color: 'var(--hz-neutral-700)' }}>
                  Comprueba el resumen antes de importar. La declaración quedará marcada como declarada e importada en el histórico.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <div><strong>Ejercicio</strong><div>{data.ejercicio}</div></div>
                  <div><strong>Base general</strong><div>{data.baseImponibleGeneral.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div></div>
                  <div><strong>Retenciones</strong><div>{data.totalRetenciones.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div></div>
                  <div><strong>Resultado</strong><div>{data.resultado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div></div>
                </div>
              </div>

              {casillasExtraidas.length > 0 && (
                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--hz-neutral-300)' }}>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>Casillas detectadas</strong>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {casillasExtraidas.slice(0, 18).map((casilla) => (
                      <span key={casilla.numero} style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', background: 'var(--hz-neutral-100)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem' }}>
                        {casilla.numero}: {casilla.valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => step === 1 ? onClose() : setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '10px', padding: '0.8rem 1rem', background: 'white', cursor: 'pointer' }}
            >
              {step === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={step === 2 && !canContinueStep2}
                onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
                style={{
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  background: 'var(--atlas-blue)',
                  color: 'white',
                  cursor: 'pointer',
                  opacity: step === 2 && !canContinueStep2 ? 0.5 : 1,
                }}
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmarImportacion}
                style={{ border: 'none', borderRadius: '10px', padding: '0.8rem 1rem', background: 'var(--ok)', color: 'white', cursor: 'pointer' }}
              >
                {saving ? 'Importando…' : 'Importar declaración'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarDeclaracionWizard;
