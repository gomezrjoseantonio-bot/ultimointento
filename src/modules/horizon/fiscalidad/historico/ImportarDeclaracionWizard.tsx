import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, CheckCircle2 } from 'lucide-react';
import { parseIrpfXml } from '../../../../services/irpfXmlParserService';
import { distribuirDeclaracion, acortarDireccion } from '../../../../services/declaracionDistributorService';
import type { DeclaracionCompleta, InmuebleDeclarado } from '../../../../types/declaracionCompleta';
import type { InformeDistribucion } from '../../../../types/informeDistribucion';

type MetodoEntrada = 'formulario' | 'pdf' | 'xml';

interface ImportarDeclaracionWizardProps {
  onClose: () => void;
  onImported: () => void | Promise<void>;
  defaultMethod?: MetodoEntrada;
  embedded?: boolean;
  onBack?: () => void;
}

// ─── Design tokens V4 ────────────────────────────────────────────────────────
const NAVY = '#042C5E';      // --navy-900: botones primarios, texto principal
const TEAL = '#1DA0BA';      // --teal-600: acento UI, a devolver
const TEAL_100 = '#E6F7FA';  // --teal-100: fondo badge teal
const GREY_900 = '#1A2332';  // --grey-900: texto principal
const GREY_700 = '#303A4C';  // --grey-700: texto cuerpo
const GREY_400 = '#9CA3AF';  // --grey-400: texto deshabilitado
const GREY_300 = '#C8D0DC';  // --grey-300: bordes
const GREY_200 = '#DDE3EC';  // --grey-200: separadores
const GREY_100 = '#EEF1F5';  // --grey-100: fondo sección, zebra rows
const GREY_50 = '#F8F9FA';   // --grey-50: fondo de página
const fontSans = "'IBM Plex Sans', system-ui, sans-serif";
const fontMono = "'IBM Plex Mono', monospace";

const CASILLAS_PRINCIPALES = ['0505', '0510', '0545', '0546', '0570', '0571', '0595', '0609', '0695'];

const CCAA_NOMBRES: Record<string, string> = {
  '01': 'Andalucía', '02': 'Aragón', '03': 'Asturias', '04': 'Baleares',
  '05': 'Canarias', '06': 'Cantabria', '07': 'Castilla y León', '08': 'Castilla-La Mancha',
  '09': 'Cataluña', '10': 'Extremadura', '11': 'Galicia', '12': 'Madrid',
  '13': 'Murcia', '14': 'Navarra', '15': 'País Vasco', '16': 'La Rioja',
  '17': 'Comunidad Valenciana', '18': 'Ceuta', '19': 'Melilla',
};

// ─── Utility ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ─── construirDetalleInmueble ─────────────────────────────────────────────────
function construirDetalleInmueble(inm: InmuebleDeclarado): string[] {
  const lineas: string[] = [];

  if (inm.fechaAdquisicion || inm.precioAdquisicion) {
    let linea = 'Adquisición:';
    if (inm.fechaAdquisicion) linea += ` ${inm.fechaAdquisicion}`;
    if (inm.precioAdquisicion) linea += ` · ${fmt(inm.precioAdquisicion)} €`;
    if (inm.gastosAdquisicion) linea += ` + ${fmt(inm.gastosAdquisicion)} € gastos`;
    lineas.push(linea);
  }

  if (inm.amortizacionAnualInmueble) {
    lineas.push(
      `Amortización: ${fmt(inm.amortizacionAnualInmueble)} €/año (base ${fmt(inm.baseAmortizacion ?? 0)} €)`,
    );
  }

  if (inm.mejorasAnteriores || inm.mejorasEjercicio.length > 0) {
    let linea = 'Mejoras:';
    if (inm.mejorasAnteriores) linea += ` ${fmt(inm.mejorasAnteriores)} € anteriores`;
    for (const m of inm.mejorasEjercicio) {
      linea += ` + ${fmt(m.importe)} € en ejercicio`;
      if (m.nifProveedor) linea += ` (${m.nifProveedor})`;
    }
    lineas.push(linea);
  }

  for (const arr of inm.arrendamientos) {
    if (arr.nifArrendatarios.length > 0) {
      let linea = `Inquilino: ${arr.nifArrendatarios.join(', ')}`;
      if (arr.fechaContrato) linea += ` · Contrato: ${arr.fechaContrato}`;
      if (arr.tipoArrendamiento === 'vivienda') linea += ' · Vivienda';
      if (arr.tieneReduccion) linea += ' · Con reducción';
      lineas.push(linea);
    }
  }

  for (const prov of inm.proveedores.filter((p) => p.concepto === 'reparacion')) {
    let linea = `Reparación: ${fmt(prov.importe)} € (NIF ${prov.nif})`;
    if (inm.gastosPendientesGenerados > 0) {
      linea += ` \u2014 excedente: ${fmt(inm.gastosPendientesGenerados)} € \u2192 arrastre`;
    }
    lineas.push(linea);
  }

  if (inm.gastos.interesesFinanciacion > 0) {
    lineas.push(`Intereses préstamo: ${fmt(inm.gastos.interesesFinanciacion)} €`);
  }

  const gastosLinea: string[] = [];
  if (inm.gastos.comunidad > 0) gastosLinea.push(`Comunidad: ${fmt(inm.gastos.comunidad)} €`);
  if (inm.gastos.suministros > 0) gastosLinea.push(`Suministros: ${fmt(inm.gastos.suministros)} €`);
  if (inm.gastos.seguros > 0) gastosLinea.push(`Seguros: ${fmt(inm.gastos.seguros)} €`);
  if (inm.gastos.ibiTasas > 0) gastosLinea.push(`IBI: ${fmt(inm.gastos.ibiTasas)} €`);
  if (gastosLinea.length > 0) lineas.push(gastosLinea.join(' · '));

  for (const prov of inm.proveedores.filter((p) => p.concepto === 'gestion')) {
    lineas.push(`Gestión delegada: ${prov.nif} · ${fmt(prov.importe)} €/año`);
  }

  if (inm.amortizacionMobiliario) {
    lineas.push(`Mobiliario: ${fmt(inm.amortizacionMobiliario)} € amortización`);
  }

  if (inm.accesorio) {
    lineas.push(
      `Accesorio: ${inm.accesorio.refCatastral} (${fmt(inm.accesorio.precioAdquisicion ?? 0)} €, amort. ${fmt(
        inm.accesorio.amortizacionAnual ?? 0,
      )} €/año)`,
    );
  }

  for (const uso of inm.usos.filter((u) => u.tipo === 'disposicion')) {
    if (uso.rentaImputada) {
      lineas.push(
        `VC: ${fmt(inm.valorCatastral ?? 0)} €${inm.catastralRevisado ? ' (revisado)' : ''} · Renta imputada: ${fmt(uso.rentaImputada)} €`,
      );
    }
  }

  return lineas;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Fuente', 'Verificar', 'Resultado'];

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '1.5rem 2rem 0', fontFamily: fontSans }}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isCompleted = step > num;
        const isActive = step === num;
        const circleColor = isActive || isCompleted ? NAVY : GREY_300;
        return (
          <React.Fragment key={num}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: isActive || isCompleted ? NAVY : 'white',
                  border: `2px solid ${circleColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: isActive || isCompleted ? 'white' : GREY_400,
                  flexShrink: 0,
                }}
              >
                {isCompleted ? '\u2713' : num}
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? NAVY : isCompleted ? GREY_700 : GREY_400,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: step > num ? NAVY : GREY_300,
                  margin: '0 0.5rem',
                  marginBottom: '1.1rem',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────
function AccordionSection({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${GREY_200}`, borderRadius: 12, overflow: 'hidden', fontFamily: fontSans }}>
      <button
        onClick={() => onToggle(id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: open ? GREY_50 : 'white',
          border: 'none',
          cursor: 'pointer',
          fontFamily: fontSans,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: NAVY,
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '0.7rem', color: GREY_400 }}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && (
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${GREY_200}` }}>{children}</div>
      )}
    </div>
  );
}

// ─── KVRow ────────────────────────────────────────────────────────────────────
function KVRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0.3rem 0',
        borderBottom: `1px solid ${GREY_100}`,
        fontFamily: fontSans,
        fontSize: '0.85rem',
      }}
    >
      <span style={{ color: GREY_700 }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? fontMono : fontSans,
          fontFeatureSettings: mono ? "'tnum'" : undefined,
          color: GREY_900,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: GREY_50,
        border: `1px solid ${GREY_200}`,
        borderRadius: 12,
        padding: '1rem',
        fontFamily: fontSans,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: fontMono, fontFeatureSettings: "'tnum'", fontSize: '1.5rem', fontWeight: 700, color: NAVY }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: GREY_700, marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

// ─── PropuestaRow ─────────────────────────────────────────────────────────────
function PropuestaRow({ text, buttonLabel, onAction }: { text: string; buttonLabel: string; onAction: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.6rem 0',
        borderBottom: `1px solid ${GREY_100}`,
        fontFamily: fontSans,
        fontSize: '0.85rem',
      }}
    >
      <span style={{ color: GREY_700, flex: 1 }}>{text}</span>
      <button
        onClick={onAction}
        style={{
          padding: '0.35rem 0.85rem',
          border: `1px solid ${GREY_300}`,
          borderRadius: 8,
          background: 'white',
          color: NAVY,
          fontSize: '0.78rem',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: fontSans,
          whiteSpace: 'nowrap',
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

// ─── PASO 1 ───────────────────────────────────────────────────────────────────
function Paso1({
  metodo,
  setMetodo,
  file,
  error,
  onFile,
}: {
  metodo: MetodoEntrada;
  setMetodo: (m: MetodoEntrada) => void;
  file: File | null;
  error: string | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.xml')) setMetodo('xml');
    else if (f.name.toLowerCase().endsWith('.pdf')) setMetodo('pdf');
    onFile(f);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onFile(f);
  };

  const cardStyle = (selected: boolean, disabled = false): React.CSSProperties => ({
    border: `2px solid ${selected ? NAVY : GREY_200}`,
    borderRadius: 12,
    padding: '1rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: selected ? '#F0F4FA' : disabled ? GREY_50 : 'white',
    opacity: disabled ? 0.6 : 1,
    flex: 1,
    minWidth: 0,
    fontFamily: fontSans,
    position: 'relative' as const,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Source cards */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        {/* XML card */}
        <div style={cardStyle(metodo === 'xml')} onClick={() => setMetodo('xml')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem' }}>XML de la AEAT</span>
            <span
              style={{
                background: TEAL_100,
                color: TEAL,
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              Recomendado
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: GREY_700, margin: 0, lineHeight: 1.5 }}>
            Descárgalo de la Sede Electrónica. Inmediato, completo, sin errores.
          </p>
        </div>

        {/* PDF card */}
        <div style={cardStyle(metodo === 'pdf')} onClick={() => setMetodo('pdf')}>
          <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            PDF de la declaración
          </div>
          <p style={{ fontSize: '0.8rem', color: GREY_700, margin: 0, lineHeight: 1.5 }}>
            El PDF que te guardaste. Lectura con IA (~15 seg.)
          </p>
        </div>

        {/* Manual card */}
        <div style={cardStyle(false, true)}>
          <div style={{ fontWeight: 600, color: GREY_400, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Entrada manual
          </div>
          <p style={{ fontSize: '0.8rem', color: GREY_400, margin: 0, lineHeight: 1.5 }}>Próximamente</p>
        </div>
      </div>

      {/* PDF notice */}
      {metodo === 'pdf' && (
        <div
          style={{
            background: GREY_100,
            border: `1px solid ${GREY_300}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: GREY_700,
            fontFamily: fontSans,
          }}
        >
          La importación por PDF se habilitará próximamente. Usa el XML descargándolo de la Sede Electrónica.
        </div>
      )}

      {/* Dropzone */}
      {(metodo === 'xml' || metodo === 'pdf') && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? TEAL : GREY_300}`,
            borderRadius: 12,
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? TEAL_100 : GREY_50,
            transition: 'all 0.15s',
            fontFamily: fontSans,
          }}
        >
          {file ? (
            <div>
              <CheckCircle2 size={28} color={TEAL} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem' }}>{file.name}</div>
              <div style={{ fontSize: '0.78rem', color: GREY_400, marginTop: '0.25rem' }}>
                {(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar
              </div>
            </div>
          ) : (
            <div>
              <Upload size={28} color={GREY_400} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 500, color: GREY_700, fontSize: '0.88rem' }}>
                Arrastra tu fichero {metodo === 'xml' ? '.xml' : '.pdf'} aquí o haz clic
              </div>
              <div style={{ fontSize: '0.75rem', color: GREY_400, marginTop: '0.25rem' }}>
                {metodo === 'xml' ? 'Fichero XML de la AEAT (Modelo 100)' : 'Fichero PDF de la declaración'}
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={metodo === 'xml' ? '.xml' : '.pdf'}
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            background: GREY_100,
            border: `1px solid ${GREY_300}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: GREY_700,
            fontFamily: fontSans,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─── PASO 2 ───────────────────────────────────────────────────────────────────
function Paso2({
  declaracion,
  onNext,
  distribuyendo,
}: {
  declaracion: DeclaracionCompleta;
  onNext: () => void;
  distribuyendo: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    perfil: true,
    inmuebles: true,
    arrastres: true,
    trabajo: false,
    capitalMobiliario: false,
    actividad: false,
    casillas: false,
  });
  const [inmExpanded, setInmExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleInm = (ref: string) => setInmExpanded((prev) => ({ ...prev, [ref]: !prev[ref] }));

  const { meta, resultado, declarante, trabajo, capitalMobiliario, actividadEconomica, inmuebles, arrastres, casillas } = declaracion;
  const res = resultado.resultadoDeclaracion;
  const esDevolver = res < 0;

  const estadoCivilMap: Record<string, string> = {
    soltero: 'Soltero/a', casado: 'Casado/a', viudo: 'Viudo/a', divorciado: 'Divorciado/a', separado: 'Separado/a',
  };

  const confianzaLabel: Record<string, string> = { total: 'Confianza total', alta: 'Alta confianza', media: 'Confianza media' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header result */}
      <div
        style={{
          background: GREY_50,
          border: `1px solid ${GREY_200}`,
          borderRadius: 12,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontFamily: fontSans,
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: GREY_700, marginBottom: '0.2rem' }}>
            IRPF {meta.ejercicio}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: fontMono,
                fontFeatureSettings: "'tnum'",
                fontSize: '1.75rem',
                fontWeight: 700,
                color: esDevolver ? TEAL : NAVY,
              }}
            >
              {fmt(Math.abs(res))} €
            </span>
            <span style={{ fontSize: '0.85rem', color: esDevolver ? TEAL : NAVY, fontWeight: 600 }}>
              {esDevolver ? 'a devolver' : 'a ingresar'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              background: GREY_100,
              color: GREY_700,
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              fontFamily: fontSans,
            }}
          >
            {meta.fuenteImportacion.toUpperCase()}
          </span>
          <span
            style={{
              background: GREY_100,
              color: GREY_700,
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              fontFamily: fontSans,
            }}
          >
            {confianzaLabel[meta.confianza] ?? meta.confianza}
          </span>
        </div>
      </div>

      {/* Perfil */}
      <AccordionSection id="perfil" title="Perfil del declarante" open={!!open.perfil} onToggle={toggle}>
        <KVRow label="NIF" value={declarante.nif} />
        <KVRow label="Nombre" value={declarante.nombreCompleto} />
        <KVRow label="Nacimiento" value={declarante.fechaNacimiento ?? '\u2014'} />
        <KVRow label="Estado civil" value={estadoCivilMap[declarante.estadoCivil ?? ''] ?? '\u2014'} />
        <KVRow label="Residencia" value={declarante.nombreCCAA ?? (declarante.codigoCCAA ? (CCAA_NOMBRES[declarante.codigoCCAA] ?? declarante.codigoCCAA) : '—')} />
        <KVRow label="Tributación" value={declarante.tributacion === 'individual' ? 'Individual' : 'Conjunta'} />
        <p style={{ fontSize: '0.75rem', color: GREY_400, fontStyle: 'italic', margin: '0.5rem 0 0', fontFamily: fontSans }}>
          Primera importación — todos los campos son nuevos. En importaciones posteriores, solo se completan campos vacíos. Nunca se sobreescribe lo que hayas editado.
        </p>
      </AccordionSection>

      {/* Trabajo */}
      {trabajo && (
        <AccordionSection id="trabajo" title="Rendimientos del trabajo" open={!!open.trabajo} onToggle={toggle}>
          {trabajo.empleador && (
            <KVRow label="Empleador" value={`${trabajo.empleador.nombre ?? ''} (${trabajo.empleador.nif})`} />
          )}
          <KVRow label="Salario bruto" value={`${fmt(trabajo.retribucionesDinerarias)} €`} mono />
          {trabajo.valoracionEspecie > 0 && (
            <KVRow label="Especie" value={`${fmt(trabajo.valoracionEspecie)} €`} mono />
          )}
          <KVRow label="Total íntegros" value={`${fmt(trabajo.totalIngresosIntegros)} €`} mono />
          <KVRow label="Cotización SS" value={`${fmt(trabajo.cotizacionesSS)} €`} mono />
          <KVRow label="Rendimiento neto" value={`${fmt(trabajo.rendimientoNeto)} €`} mono />
          <KVRow label="Retenciones" value={`${fmt(trabajo.retenciones)} €`} mono />
        </AccordionSection>
      )}

      {/* Inmuebles */}
      <AccordionSection
        id="inmuebles"
        title={`Inmuebles detectados (${inmuebles.filter((inm) => !inm.esAccesorioDe).length})`}
        open={!!open.inmuebles}
        onToggle={toggle}
      >
        {inmuebles.filter((inm) => !inm.esAccesorioDe).length === 0 && (
          <p style={{ fontSize: '0.85rem', color: GREY_400, margin: 0, fontFamily: fontSans }}>
            No se han detectado inmuebles en esta declaración.
          </p>
        )}
        {inmuebles.filter((inm) => !inm.esAccesorioDe).map((inm) => {
          const expanded = !!inmExpanded[inm.refCatastral];
          const diasArr = inm.usos.find((u) => u.tipo === 'arrendado')?.dias ?? 0;
          const diasVac = inm.usos.find((u) => u.tipo === 'disposicion')?.dias ?? 0;
          const ingBrutos = inm.arrendamientos.reduce((s, a) => s + a.ingresos, 0);
          return (
            <div
              key={inm.refCatastral}
              style={{
                border: `1px solid ${GREY_200}`,
                borderRadius: 10,
                marginBottom: '0.5rem',
                overflow: 'hidden',
                fontFamily: fontSans,
              }}
            >
              <div
                onClick={() => toggleInm(inm.refCatastral)}
                style={{
                  padding: '0.65rem 0.85rem',
                  cursor: 'pointer',
                  background: expanded ? GREY_50 : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acortarDireccion(inm.direccion) || inm.refCatastral}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: GREY_400, fontFamily: fontMono }}>
                    {inm.refCatastral}
                    {diasArr > 0 && ` · ${diasArr}d arr.`}
                    {diasVac > 0 && ` + ${diasVac}d vacío`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {ingBrutos > 0 && (
                    <div style={{ fontSize: '0.82rem', color: GREY_700, fontFamily: fontMono, fontFeatureSettings: "'tnum'" }}>
                      {fmt(ingBrutos)} € ing.
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontFamily: fontMono,
                      fontFeatureSettings: "'tnum'",
                      color: inm.rendimientoNeto < 0 ? TEAL : NAVY,
                      fontWeight: 600,
                    }}
                  >
                    {inm.rendimientoNeto === 0 && ingBrutos === 0 ? '—' : `${fmt(inm.rendimientoNeto)} €`}
                  </div>
                </div>
                <span style={{ fontSize: '0.65rem', color: GREY_400, flexShrink: 0 }}>{expanded ? '\u25b2' : '\u25bc'}</span>
              </div>
              {expanded && (
                <div style={{ padding: '0.65rem 0.85rem', borderTop: `1px solid ${GREY_200}`, background: GREY_50 }}>
                  {construirDetalleInmueble(inm).map((linea, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: GREY_700, padding: '0.15rem 0', fontFamily: fontSans }}>
                      · {linea}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </AccordionSection>

      {/* Capital mobiliario */}
      {capitalMobiliario && (
        <AccordionSection id="capitalMobiliario" title="Capital mobiliario" open={!!open.capitalMobiliario} onToggle={toggle}>
          <KVRow label="Total bruto" value={`${fmt(capitalMobiliario.totalBruto)} €`} mono />
          <KVRow label="Gastos deducibles" value={`${fmt(capitalMobiliario.gastosDeducibles)} €`} mono />
          <KVRow label="Rendimiento neto" value={`${fmt(capitalMobiliario.rendimientoNeto)} €`} mono />
          <KVRow label="Retenciones" value={`${fmt(capitalMobiliario.retenciones)} €`} mono />
        </AccordionSection>
      )}

      {/* Arrastres */}
      <AccordionSection id="arrastres" title={`Arrastres para ${meta.ejercicio + 1}`} open={!!open.arrastres} onToggle={toggle}>
        {arrastres.perdidasPatrimoniales.length === 0 && arrastres.gastosPendientes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: GREY_400, margin: 0 }}>No hay arrastres en esta declaración.</p>
        ) : (
          <>
            {arrastres.perdidasPatrimoniales.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: GREY_700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pérdidas patrimoniales del ahorro
                </div>
                {arrastres.perdidasPatrimoniales.map((p, i) => {
                  const añoReal = meta.ejercicio - p.añoOrigen;
                  const caducidad = añoReal + 4;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.25rem 0', borderBottom: `1px solid ${GREY_100}`, fontFamily: fontSans }}>
                      <span style={{ color: GREY_700 }}>De {añoReal} · caduca {caducidad}</span>
                      <span style={{ fontFamily: fontMono, fontFeatureSettings: "'tnum'", color: NAVY }}>{fmt(p.importePendiente)} €</span>
                    </div>
                  );
                })}
              </div>
            )}
            {arrastres.gastosPendientes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: GREY_700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Gastos pendientes por inmueble
                </div>
                {arrastres.gastosPendientes.map((g, i) => {
                  const añoReal = meta.ejercicio - g.añoOrigen;
                  const caducidad = añoReal + 4;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.25rem 0', borderBottom: `1px solid ${GREY_100}`, fontFamily: fontSans }}>
                      <span style={{ color: GREY_700, fontFamily: fontMono, fontSize: '0.75rem' }}>{g.refCatastral} · De {añoReal} · caduca {caducidad}</span>
                      <span style={{ fontFamily: fontMono, fontFeatureSettings: "'tnum'", color: NAVY }}>{fmt(g.importePendiente)} €</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AccordionSection>

      {/* Actividad económica */}
      {actividadEconomica && (
        <AccordionSection id="actividad" title="Actividad económica" open={!!open.actividad} onToggle={toggle}>
          <KVRow label="IAE" value={actividadEconomica.iae} />
          <KVRow label="Modalidad" value={actividadEconomica.modalidad} />
          <KVRow label="Total ingresos" value={`${fmt(actividadEconomica.totalIngresos)} €`} mono />
          <KVRow label="Total gastos" value={`${fmt(actividadEconomica.totalGastos)} €`} mono />
          <KVRow label="Rendimiento neto" value={`${fmt(actividadEconomica.rendimientoNeto)} €`} mono />
          <KVRow label="Retenciones" value={`${fmt(actividadEconomica.retenciones)} €`} mono />
          {actividadEconomica.pagosFraccionados > 0 && (
            <KVRow label="Pagos fraccionados (M130)" value={`${fmt(actividadEconomica.pagosFraccionados)} €`} mono />
          )}
        </AccordionSection>
      )}

      {/* Casillas principales */}
      <AccordionSection id="casillas" title="Casillas principales del Modelo 100" open={!!open.casillas} onToggle={toggle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
          {CASILLAS_PRINCIPALES.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.3rem 0.5rem',
                background: GREY_50,
                borderRadius: 6,
                fontSize: '0.82rem',
                fontFamily: fontSans,
              }}
            >
              <span style={{ color: GREY_700 }}>{c}</span>
              <span style={{ fontFamily: fontMono, fontFeatureSettings: "'tnum'", color: NAVY }}>
                {casillas[c] !== undefined ? `${fmt(casillas[c])} €` : '\u2014'}
              </span>
            </div>
          ))}
        </div>
      </AccordionSection>

      {distribuyendo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: GREY_700, fontFamily: fontSans }}>
          <span>Procesando declaración en ATLAS…</span>
        </div>
      )}
    </div>
  );
}

// ─── PASO 3 ───────────────────────────────────────────────────────────────────
function Paso3({
  informe,
  onConfirm,
  confirming,
}: {
  informe: InformeDistribucion;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const { stats, contratosDetectados, prestamosDetectados, proveedores, cuentaBancaria } = informe;

  const contratosConNif = contratosDetectados.filter((c) => c.nifInquilinos.length > 0);
  const prestamosConIntereses = prestamosDetectados.filter((p) => p.interesesAnuales > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: fontSans }}>
      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatCard label="Inmuebles creados" value={stats.inmueblesCreados} />
        <StatCard label="Arrastres guardados" value={stats.arrastresGuardados} />
        <StatCard label="Proveedores" value={stats.proveedoresNuevos} />
        <StatCard label="Ejercicio" value="Declarado" />
      </div>

      {/* Contratos */}
      {contratosConNif.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY_700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Contratos de alquiler
          </div>
          {contratosConNif.map((c, i) => (
            <PropuestaRow
              key={i}
              text={`${c.direccionCorta} · NIF ${c.nifInquilinos.join(', ')} · desde ${c.fechaContrato ?? '\u2014'} · ${fmt(c.ingresosAnuales)} €/año · ${c.tipoArrendamiento ?? '\u2014'}`}
              buttonLabel="Crear contrato"
              onAction={() => toast('Próximamente: esta acción creará el contrato en Alquileres')}
            />
          ))}
        </div>
      )}

      {/* Préstamos */}
      {prestamosConIntereses.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY_700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Préstamos de inversión
          </div>
          {prestamosConIntereses.map((p, i) => (
            <PropuestaRow
              key={i}
              text={`${p.direccionCorta} · ${fmt(p.interesesAnuales)} €/año en intereses`}
              buttonLabel="Crear préstamo"
              onAction={() => toast('Próximamente: esta acción creará el préstamo en Financiación')}
            />
          ))}
        </div>
      )}

      {/* Proveedores */}
      {proveedores.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY_700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Proveedores
          </div>
          {proveedores.map((p, i) => (
            <PropuestaRow
              key={i}
              text={`NIF ${p.nif} · ${p.concepto} · ${fmt(p.importe)} €${p.inmuebleRef ? ` · ${p.inmuebleRef}` : ''}`}
              buttonLabel="Registrar proveedor"
              onAction={() => toast('Próximamente: esta acción registrará el proveedor')}
            />
          ))}
        </div>
      )}

      {/* Cuenta bancaria */}
      {cuentaBancaria && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY_700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Cuenta bancaria
          </div>
          <PropuestaRow
            text={`${cuentaBancaria} (cuenta de devolución/ingreso)`}
            buttonLabel="Crear en Cuentas"
            onAction={() => toast('Próximamente: esta acción creará la cuenta en Cuentas')}
          />
        </div>
      )}

      {/* Footer note */}
      <p style={{ fontSize: '0.78rem', color: GREY_400, fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
        Nada de lo anterior se crea automáticamente. Pulsa cada botón para activar lo que quieras. Puedes importar otra declaración para seguir enriqueciendo ATLAS.
      </p>
    </div>
  );
}

// ─── MAIN WIZARD ─────────────────────────────────────────────────────────────
const ImportarDeclaracionWizard: React.FC<ImportarDeclaracionWizardProps> = ({
  onClose,
  onImported,
  defaultMethod = 'xml',
  embedded = false,
  onBack,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [metodo, setMetodo] = useState<MetodoEntrada>(defaultMethod === 'formulario' ? 'xml' : defaultMethod);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declaracion, setDeclaracion] = useState<DeclaracionCompleta | null>(null);
  const [informe, setInforme] = useState<InformeDistribucion | null>(null);
  const [distribuyendo, setDistribuyendo] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (metodo === 'pdf') {
        // PDF not yet available — already shown inline, just return
        return;
      }
      if (!file) {
        setError('Selecciona un fichero antes de continuar.');
        return;
      }
      // Parse XML synchronously via FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsed = parseIrpfXml(content);
          setDeclaracion(parsed);
          setError(null);
          setStep(2);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Error al leer el XML: ${msg}`);
        }
      };
      reader.onerror = () => setError('No se pudo leer el fichero.');
      reader.readAsText(file);
      return;
    }

    if (step === 2) {
      if (!declaracion) return;
      setDistribuyendo(true);
      try {
        const inf = await distribuirDeclaracion(declaracion);
        setInforme(inf);
        setStep(3);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error al procesar la declaración: ${msg}`);
      } finally {
        setDistribuyendo(false);
      }
      return;
    }

    // step 3 — handled by Confirmar button
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onImported();
      onClose();
    } catch {
      toast.error('Error al cerrar. Inténtalo de nuevo.');
    } finally {
      setConfirming(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      if (onBack) onBack();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3);
  };

  const nextDisabled =
    (step === 1 && metodo === 'xml' && !file) ||
    (step === 1 && metodo === 'pdf') ||
    distribuyendo;

  const panelContent = (
    <div
      style={{
        background: 'white',
        borderRadius: embedded ? 0 : 24,
        width: embedded ? '100%' : 'min(860px, 100%)',
        maxHeight: embedded ? undefined : 'calc(100vh - 2rem)',
        overflowY: embedded ? undefined : 'auto',
        border: embedded ? 'none' : `1px solid ${GREY_200}`,
        boxShadow: embedded ? 'none' : '0 18px 42px rgba(10,22,40,0.15)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fontSans,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2rem 0',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: NAVY, fontFamily: fontSans }}>
          Importar declaración IRPF
        </h2>
        {!embedded && (
          <button
            onClick={onClose}
            aria-label="Cancelar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: GREY_400,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontFamily: fontSans,
              padding: '0.25rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>\u00d7</span>
            <span style={{ fontSize: '0.82rem' }}>Cancelar</span>
          </button>
        )}
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      {/* Content */}
      <div style={{ padding: '1.5rem 2rem', flex: 1, overflowY: 'auto' }}>
        {step === 1 && (
          <Paso1
            metodo={metodo}
            setMetodo={setMetodo}
            file={file}
            error={error}
            onFile={handleFile}
          />
        )}
        {step === 2 && declaracion && (
          <Paso2
            declaracion={declaracion}
            onNext={handleNext}
            distribuyendo={distribuyendo}
          />
        )}
        {step === 3 && informe && (
          <Paso3 informe={informe} onConfirm={handleConfirm} confirming={confirming} />
        )}
      </div>

      {/* Navigation footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 2rem',
          borderTop: `1px solid ${GREY_200}`,
          flexShrink: 0,
          background: 'white',
          borderRadius: embedded ? 0 : '0 0 24px 24px',
        }}
      >
        <div>
          {(step > 1 || onBack) && (
            <button
              onClick={handleBack}
              disabled={distribuyendo}
              style={{
                padding: '0.6rem 1.25rem',
                border: `1px solid ${GREY_300}`,
                borderRadius: 10,
                background: 'white',
                color: GREY_700,
                fontSize: '0.88rem',
                fontWeight: 500,
                cursor: distribuyendo ? 'not-allowed' : 'pointer',
                fontFamily: fontSans,
                opacity: distribuyendo ? 0.5 : 1,
              }}
            >
              Anterior
            </button>
          )}
        </div>
        <div>
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={nextDisabled}
              style={{
                padding: '0.6rem 1.5rem',
                border: 'none',
                borderRadius: 10,
                background: nextDisabled ? GREY_300 : NAVY,
                color: 'white',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
                fontFamily: fontSans,
                transition: 'background 0.15s',
              }}
            >
              {distribuyendo ? 'Procesando…' : 'Siguiente'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                padding: '0.6rem 1.5rem',
                border: 'none',
                borderRadius: 10,
                background: confirming ? GREY_300 : NAVY,
                color: 'white',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: confirming ? 'not-allowed' : 'pointer',
                fontFamily: fontSans,
              }}
            >
              {confirming ? 'Confirmando…' : 'Confirmar importación'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return panelContent;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,40,0.56)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {panelContent}
    </div>
  );
};

export default ImportarDeclaracionWizard;
