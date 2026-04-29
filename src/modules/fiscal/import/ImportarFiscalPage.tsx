// Importador de declaración AEAT · ruta `/fiscal/importar/:anio`.
// Permite subir el PDF/XML de la declaración oficial · usa los parsers
// existentes (`aeatParserService` PDF · `aeatXmlParserService` XML) para
// extraer las casillas automáticamente y rellenar el formulario.
//
// Los parsers son deterministas (extracción textual · OCR fallback solo
// para PDF). Si el documento no se puede parsear automáticamente, el
// usuario puede introducir manualmente las casillas principales.

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import { saveEjercicio } from '../../../services/ejercicioFiscalService';
import { parsearDeclaracionAEAT } from '../../../services/aeatParserService';
import {
  parseDeclaracionXml,
  isAeatXml,
  xmlResultToCasillasMap,
} from '../../../services/aeatXmlParserService';
import type { OrigenDeclaracion } from '../../../types/fiscal';
import type { FiscalOutletContext } from '../FiscalContext';
import styles from './ImportarFiscalPage.module.css';

const ImportarFiscalPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const { ejercicios, reload } = useOutletContext<FiscalOutletContext>();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const ejercicio = useMemo(
    () => ejercicios.find((e) => String(e.ejercicio) === String(anio)),
    [ejercicios, anio],
  );

  const [origen, setOrigen] = useState<OrigenDeclaracion>('pdf_importado');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [fechaPresentacion, setFechaPresentacion] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<string>('');
  const [parseSummary, setParseSummary] = useState<{
    detectadas: number;
    ejercicio?: number;
    warnings?: string[];
  } | null>(null);

  // Casillas principales del Modelo 100 · captura manual mínima.
  const [c0019, setC0019] = useState(0); // Rendimiento neto trabajo
  const [c0085, setC0085] = useState(0); // Rendimiento neto capital inmobiliario
  const [c0140, setC0140] = useState(0); // Rendimiento neto actividades económicas
  const [c0044, setC0044] = useState(0); // Rendimiento neto capital mobiliario
  const [c0435, setC0435] = useState(0); // Base imponible general
  const [c0460, setC0460] = useState(0); // Base imponible ahorro
  const [c0500, setC0500] = useState(0); // Base liquidable general
  const [c0510, setC0510] = useState(0); // Base liquidable ahorro
  const [c0595, setC0595] = useState(0); // Cuota íntegra total
  const [c0620, setC0620] = useState(0); // Cuota líquida
  const [c0630, setC0630] = useState(0); // Retenciones
  const [c0670, setC0670] = useState(0); // Cuota resultado autoliquidación

  if (!ejercicio) {
    return (
      <div className={styles.notFound}>
        Ejercicio {anio} no encontrado.{' '}
        <button
          type="button"
          style={{
            color: 'var(--atlas-v5-gold-ink)',
            cursor: 'pointer',
            fontWeight: 600,
            background: 'none',
            border: 0,
            padding: 0,
            font: 'inherit',
          }}
          onClick={() => navigate('/fiscal/ejercicios')}
        >
          Volver a ejercicios
        </button>
      </div>
    );
  }

  // Aplica las casillas extraídas a los campos del formulario.
  const aplicarCasillasExtraidas = (casillas: Record<string, number | string>) => {
    const num = (k: string): number | undefined => {
      const v = casillas[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v.replace(',', '.'));
        if (Number.isFinite(n)) return n;
      }
      return undefined;
    };
    if (num('0019') !== undefined) setC0019(num('0019')!);
    if (num('0085') !== undefined) setC0085(num('0085')!);
    if (num('0140') !== undefined) setC0140(num('0140')!);
    if (num('0044') !== undefined) setC0044(num('0044')!);
    if (num('0435') !== undefined) setC0435(num('0435')!);
    if (num('0460') !== undefined) setC0460(num('0460')!);
    if (num('0500') !== undefined) setC0500(num('0500')!);
    if (num('0510') !== undefined) setC0510(num('0510')!);
    if (num('0595') !== undefined) setC0595(num('0595')!);
    if (num('0620') !== undefined) setC0620(num('0620')!);
    if (num('0630') !== undefined) setC0630(num('0630')!);
    if (num('0670') !== undefined) setC0670(num('0670')!);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setParseSummary(null);

    const isXml = file.name.toLowerCase().endsWith('.xml');
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    setOrigen(isXml ? 'xml_importado' : 'pdf_importado');

    setParsing(true);
    try {
      if (isXml) {
        setParseProgress('Leyendo XML…');
        const text = await file.text();
        if (!isAeatXml(text)) {
          showToastV5('El XML no parece un fichero DeclaVisor AEAT · introduce las casillas manualmente.');
          return;
        }
        setParseProgress('Parseando declaración XML…');
        const result = await parseDeclaracionXml(text);
        const casillas = xmlResultToCasillasMap(result);
        aplicarCasillasExtraidas(casillas);
        setParseSummary({
          detectadas: Object.keys(casillas).length,
          ejercicio: result.ejercicio,
          warnings: [],
        });
        showToastV5(`XML parseado · ${Object.keys(casillas).length} casillas extraídas.`);
      } else if (isPdf) {
        setParseProgress('Preparando PDF…');
        const result = await parsearDeclaracionAEAT(file, (p) => {
          if (p.mensaje) setParseProgress(p.mensaje);
        });
        if (!result.exito) {
          showToastV5(
            result.errores[0] ??
              'No se pudo extraer automáticamente · introduce las casillas manualmente.',
          );
          setParseSummary({ detectadas: 0, warnings: result.errores });
          return;
        }
        aplicarCasillasExtraidas(result.casillasRaw);
        setParseSummary({
          detectadas: result.totalCasillas,
          ejercicio: result.meta.ejercicio,
          warnings: result.warnings,
        });
        showToastV5(`PDF parseado · ${result.totalCasillas} casillas extraídas.`);
      } else {
        // .txt u otros · sin parser dedicado · sólo guardamos referencia.
        showToastV5('Formato sin parser automático · introduce las casillas manualmente.');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal-import] parse', err);
      showToastV5('Error al parsear el documento · introduce los datos manualmente.');
    } finally {
      setParsing(false);
      setParseProgress('');
    }
  };

  const handleGuardar = async () => {
    try {
      const updated = {
        ...ejercicio,
        estado: 'declarado' as const,
        declaracionAeatOrigen: origen,
        declaracionAeatFecha: fechaPresentacion,
        declaracionAeatPdfRef: fileName ?? undefined,
        declaradoAt: new Date(fechaPresentacion).toISOString(),
        casillasRaw: {
          ...(ejercicio.casillasRaw ?? {}),
          ...(c0019 ? { '0019': c0019 } : {}),
          ...(c0085 ? { '0085': c0085 } : {}),
          ...(c0140 ? { '0140': c0140 } : {}),
          ...(c0044 ? { '0044': c0044 } : {}),
          ...(c0435 ? { '0435': c0435 } : {}),
          ...(c0460 ? { '0460': c0460 } : {}),
          ...(c0500 ? { '0500': c0500 } : {}),
          ...(c0510 ? { '0510': c0510 } : {}),
          ...(c0595 ? { '0595': c0595 } : {}),
          ...(c0620 ? { '0620': c0620 } : {}),
          ...(c0630 ? { '0630': c0630 } : {}),
          ...(c0670 ? { '0670': c0670 } : {}),
        },
        updatedAt: new Date().toISOString(),
      };
      await saveEjercicio(updated);
      showToastV5(`Declaración ${ejercicio.ejercicio} importada · ejercicio marcado como declarado.`);
      await reload();
      navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal-import] guardar', err);
      showToastV5('Error al importar la declaración.');
    }
  };

  const totalRendimientos = c0019 + c0085 + c0140 + c0044;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </button>
        <button type="button" className={styles.crumbBtn} onClick={() => navigate('/fiscal')}>
          Fiscal
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <button
          type="button"
          className={styles.crumbBtn}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
        >
          Ejercicio {ejercicio.ejercicio}
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span className={styles.current} aria-current="page">
          Importar declaración
        </span>
      </div>

      <div className={styles.title}>Importar declaración IRPF {ejercicio.ejercicio}</div>
      <div className={styles.sub}>
        Sube el PDF · XML del Modelo 100 oficial y rellena las casillas principales.
        Atlas marcará el ejercicio como declarado y archivará el documento.
      </div>

      <div className={`${styles.banner} ${styles.info}`}>
        <Icons.Info size={18} strokeWidth={1.8} />
        <div>
          Sube el PDF o XML del Modelo 100 · Atlas extrae las casillas
          automáticamente (XML DeclaVisor · extracción determinista · PDF con
          fallback OCR). Si la extracción falla, puedes rellenar manualmente
          las casillas principales antes de guardar.
        </div>
      </div>

      <div
        className={`${styles.dropzone} ${fileName ? styles.uploaded : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !fileName && fileInput.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !fileName) fileInput.current?.click();
        }}
      >
        {parsing ? (
          <div>
            <div className={styles.dropzoneTitle}>
              <Icons.Refresh size={16} strokeWidth={1.8} style={{ verticalAlign: -3, marginRight: 6 }} />
              {parseProgress || 'Procesando…'}
            </div>
            <div className={styles.dropzoneSub}>
              {fileName} · {(fileSize / 1024).toFixed(0)} KB
            </div>
          </div>
        ) : fileName ? (
          <div>
            <span className={styles.fileBadge}>
              <Icons.Success size={14} strokeWidth={1.8} />
              {fileName} · {(fileSize / 1024).toFixed(0)} KB
              <button
                type="button"
                style={{
                  marginLeft: 8,
                  color: 'var(--atlas-v5-neg)',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setFileName(null);
                  setFileSize(0);
                  setParseSummary(null);
                }}
                aria-label="Eliminar archivo"
              >
                <Icons.Close size={14} strokeWidth={1.8} />
              </button>
            </span>
            {parseSummary && parseSummary.detectadas > 0 && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: 'var(--atlas-v5-pos)',
                  fontWeight: 600,
                }}
              >
                ✓ {parseSummary.detectadas} casillas extraídas
                {parseSummary.ejercicio ? ` · ejercicio ${parseSummary.ejercicio}` : ''}
              </div>
            )}
            {parseSummary && parseSummary.warnings && parseSummary.warnings.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11.5,
                  color: 'var(--atlas-v5-gold-ink)',
                }}
              >
                {parseSummary.warnings[0]}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={styles.dropzoneTitle}>
              <Icons.Upload size={16} strokeWidth={1.8} style={{ verticalAlign: -3, marginRight: 6 }} />
              Sube el PDF o XML del Modelo 100
            </div>
            <div className={styles.dropzoneSub}>
              o haz clic para seleccionar · PDF · XML (Renta Web · DeclaVisor)
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.xml,application/pdf,application/xml"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <div className={styles.formCard}>
        <div className={styles.formCardTitle}>Datos de la presentación</div>
        <div className={styles.formCardSub}>fecha y origen del documento</div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="origen">Origen</label>
            <select
              id="origen"
              value={origen}
              onChange={(e) => setOrigen(e.target.value as OrigenDeclaracion)}
            >
              <option value="pdf_importado">PDF importado</option>
              <option value="xml_importado">XML importado</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className={styles.row}>
            <label htmlFor="fpres">Fecha de presentación</label>
            <input
              id="fpres"
              type="date"
              value={fechaPresentacion}
              onChange={(e) => setFechaPresentacion(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formCardTitle}>Rendimientos netos</div>
        <div className={styles.formCardSub}>desglose por origen · casillas Modelo 100</div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0019">
              Rendimiento neto trabajo
              <span className={styles.casilla}>· 0019</span>
            </label>
            <input
              id="c0019"
              type="number"
              step="0.01"
              value={c0019 || ''}
              onChange={(e) => setC0019(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0085">
              Rendimiento neto capital inmobiliario
              <span className={styles.casilla}>· 0085</span>
            </label>
            <input
              id="c0085"
              type="number"
              step="0.01"
              value={c0085 || ''}
              onChange={(e) => setC0085(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0140">
              Rendimiento actividades económicas
              <span className={styles.casilla}>· 0140</span>
            </label>
            <input
              id="c0140"
              type="number"
              step="0.01"
              value={c0140 || ''}
              onChange={(e) => setC0140(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0044">
              Rendimiento capital mobiliario
              <span className={styles.casilla}>· 0044</span>
            </label>
            <input
              id="c0044"
              type="number"
              step="0.01"
              value={c0044 || ''}
              onChange={(e) => setC0044(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)', textAlign: 'right', marginTop: 6 }}>
          Total rendimientos ·{' '}
          <strong style={{ color: 'var(--atlas-v5-ink)' }}>
            <MoneyValue value={totalRendimientos} decimals={2} tone="ink" />
          </strong>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formCardTitle}>Bases y cuota</div>
        <div className={styles.formCardSub}>tras reducciones · cuota líquida y resultado</div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0435">
              Base imponible general<span className={styles.casilla}>· 0435</span>
            </label>
            <input
              id="c0435"
              type="number"
              step="0.01"
              value={c0435 || ''}
              onChange={(e) => setC0435(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0460">
              Base imponible ahorro<span className={styles.casilla}>· 0460</span>
            </label>
            <input
              id="c0460"
              type="number"
              step="0.01"
              value={c0460 || ''}
              onChange={(e) => setC0460(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0500">
              Base liquidable general<span className={styles.casilla}>· 0500</span>
            </label>
            <input
              id="c0500"
              type="number"
              step="0.01"
              value={c0500 || ''}
              onChange={(e) => setC0500(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0510">
              Base liquidable ahorro<span className={styles.casilla}>· 0510</span>
            </label>
            <input
              id="c0510"
              type="number"
              step="0.01"
              value={c0510 || ''}
              onChange={(e) => setC0510(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0595">
              Cuota íntegra total<span className={styles.casilla}>· 0595</span>
            </label>
            <input
              id="c0595"
              type="number"
              step="0.01"
              value={c0595 || ''}
              onChange={(e) => setC0595(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0620">
              Cuota líquida<span className={styles.casilla}>· 0620</span>
            </label>
            <input
              id="c0620"
              type="number"
              step="0.01"
              value={c0620 || ''}
              onChange={(e) => setC0620(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.row}>
            <label htmlFor="c0630">
              Retenciones e ingresos<span className={styles.casilla}>· 0630</span>
            </label>
            <input
              id="c0630"
              type="number"
              step="0.01"
              value={c0630 || ''}
              onChange={(e) => setC0630(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className={styles.row}>
            <label htmlFor="c0670">
              Resultado autoliquidación<span className={styles.casilla}>· 0670</span>
            </label>
            <input
              id="c0670"
              type="number"
              step="0.01"
              value={c0670 || ''}
              onChange={(e) => setC0670(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className={`${styles.banner} ${styles.warn}`}>
        <Icons.Warning size={18} strokeWidth={1.8} />
        <div>
          Al guardar, el ejercicio <strong>{ejercicio.ejercicio}</strong> queda marcado como
          <strong> declarado</strong>. Si necesitas modificar valores, hazlo desde el detalle
          del ejercicio o aplica una paralela.
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.ghost}`}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
        >
          Cancelar
        </button>
        <button type="button" className={`${styles.btn} ${styles.gold}`} onClick={handleGuardar}>
          <Icons.Check size={13} strokeWidth={2} />
          Importar y marcar declarado
        </button>
      </div>
    </div>
  );
};

export default ImportarFiscalPage;
