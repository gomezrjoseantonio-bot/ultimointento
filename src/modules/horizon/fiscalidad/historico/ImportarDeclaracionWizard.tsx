import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Home, RefreshCw, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CasillaInput from '../../../../components/fiscal/ui/CasillaInput';
import { saveDocumentWithBlob } from '../../../../services/db';
import type { CasillaExtraida, ImportacionManualData } from '../../../../services/aeatPdfParserService';
import {
  crearImportacionManualVacia,
  mapearCasillasAImportacion,
} from '../../../../services/aeatPdfParserService';
import type {
  ExtraccionCompleta,
  ProgresoParseo,
} from '../../../../services/aeatParserService';
import { parsearDeclaracionAEAT } from '../../../../services/aeatParserService';
import {
  analizarDeclaracionParaOnboarding,
  ejecutarImportacion,
} from '../../../../services/declaracionOnboardingService';
import type { ResultadoAnalisis } from '../../../../services/declaracionOnboardingService';
import { declararEjercicio } from '../../../../services/ejercicioFiscalService';
import { importarDeclaracionManual } from '../../../../services/fiscalLifecycleService';
import type { ReconciliacionCompleta } from '../../../../services/reconciliacionService';
import { generarReconciliacion, requiereReconciliacion } from '../../../../services/reconciliacionService';
import ReconciliacionPanel from '../importar/ReconciliacionPanel';

type MetodoEntrada = 'formulario' | 'pdf';
type ReviewTab = 'entidades' | 'reconciliacion' | 'raw';
type SectionStatusTone = 'info' | 'success' | 'warning' | 'muted';

interface ImportarDeclaracionWizardProps {
  onClose: () => void;
  onImported: () => void | Promise<void>;
  defaultMethod?: MetodoEntrada;
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
  borderRadius: '24px',
  width: 'min(1280px, 100%)',
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

const kpiCardStyle: React.CSSProperties = {
  border: '1px solid var(--hz-neutral-300)',
  borderRadius: '12px',
  background: 'white',
  padding: '0.9rem 1rem',
  display: 'grid',
  gap: '0.2rem',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '0.75rem',
};

const shellCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #D7E1EC',
  borderRadius: '24px',
  padding: '2rem',
  display: 'grid',
  gap: '1.5rem',
};

const stepEyebrowStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.85rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--hz-neutral-700)',
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: '0.35rem 0 0',
  color: 'var(--hz-neutral-700)',
  fontSize: '0.95rem',
};

const progressRailStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.4rem',
};

const uploadDropzoneStyle: React.CSSProperties = {
  border: '2px dashed #91A4BC',
  borderRadius: '20px',
  minHeight: '260px',
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  padding: '2rem',
  color: 'var(--atlas-navy-1)',
  background: 'linear-gradient(180deg, rgba(246,249,252,0.9) 0%, rgba(255,255,255,1) 100%)',
  cursor: 'pointer',
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: 'none',
  borderBottom: active ? '3px solid var(--atlas-blue)' : '3px solid transparent',
  background: 'transparent',
  color: active ? 'var(--atlas-blue)' : 'var(--hz-neutral-700)',
  padding: '0.7rem 0.2rem',
  cursor: 'pointer',
  fontWeight: active ? 700 : 500,
  fontSize: '1rem',
});

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

const formatCurrency = (value: number | undefined): string =>
  (value ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

function sanitizarParaIndexedDB<T>(value: T): T {
  if (value === null || value === undefined) return null as T;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizarParaIndexedDB(item)) as T;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, sanitizarParaIndexedDB(entryValue)]),
  ) as T;
}

const KpiCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={kpiCardStyle}>
    <span style={{ fontSize: '0.78rem', color: 'var(--hz-neutral-700)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
    <strong style={{ fontSize: '1.15rem', color: 'var(--atlas-navy-1)' }}>{value}</strong>
  </div>
);

const KeyValueGrid: React.FC<{ rows: Array<{ label: string; value: React.ReactNode }> }> = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ border: '1px solid var(--hz-neutral-200)', borderRadius: '10px', padding: '0.8rem', background: 'var(--hz-neutral-100)' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--hz-neutral-700)' }}>{row.label}</div>
        <div style={{ marginTop: '0.25rem', color: 'var(--atlas-navy-1)', fontWeight: 600 }}>{row.value || '—'}</div>
      </div>
    ))}
  </div>
);

function obtenerNumeroCasilla(
  casillasRaw: ExtraccionCompleta['casillasRaw'],
  numero: string,
): number {
  const value = casillasRaw[numero];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function validarDeclaracionExtraida(
  declaracion: ExtraccionCompleta['declaracion'],
  casillasRaw: ExtraccionCompleta['casillasRaw'],
): { valida: boolean; avisos: string[] } {
  const avisos: string[] = [];
  const baseGeneralRaw = obtenerNumeroCasilla(casillasRaw, '0435');
  const resultadoRaw = obtenerNumeroCasilla(casillasRaw, '0670');
  const retencionesRaw = obtenerNumeroCasilla(casillasRaw, '0609');

  if (baseGeneralRaw > 0 && declaracion.basesYCuotas.baseImponibleGeneral === 0) {
    avisos.push(`La casilla 0435 tiene valor ${formatCurrency(baseGeneralRaw)} pero la base imponible general aparece a cero.`);
  }

  if (resultadoRaw !== 0 && declaracion.basesYCuotas.resultadoDeclaracion === 0) {
    avisos.push(`La casilla 0670 tiene valor ${formatCurrency(resultadoRaw)} pero el resultado de la declaración aparece a cero.`);
  }

  if (retencionesRaw > 0 && declaracion.basesYCuotas.retencionesTotal === 0) {
    avisos.push(`Las retenciones de la casilla 0609 (${formatCurrency(retencionesRaw)}) no se han mapeado a la declaración final.`);
  }

  if (
    declaracion.basesYCuotas.cuotaIntegra > 0
    && declaracion.basesYCuotas.cuotaLiquida === 0
  ) {
    avisos.push(
      `La cuota íntegra es ${formatCurrency(declaracion.basesYCuotas.cuotaIntegra)} pero la cuota líquida aparece a cero. Revisa las casillas 0570 y 0571.`,
    );
  }

  return {
    valida: avisos.length === 0,
    avisos,
  };
}

const VerificacionExtraccion: React.FC<{
  resultado: ExtraccionCompleta;
  reconciliacion: ReconciliacionCompleta | null;
  reconciliacionDisponible: boolean;
  onAbrirReconciliacion: () => void;
}> = ({ resultado, reconciliacion, reconciliacionDisponible, onAbrirReconciliacion }) => {
  const [tab, setTab] = useState<ReviewTab | null>(null);
  const { declaracion, casillasRaw, inmueblesDetalle, arrastres } = resultado;
  const validacion = useMemo(
    () => validarDeclaracionExtraida(declaracion, casillasRaw),
    [casillasRaw, declaracion],
  );

  const arrastresCount = arrastres.gastos0105_0106.length + arrastres.perdidasAhorro.length;
  const reconciliacionCount = reconciliacion
    ? reconciliacion.estadisticas.diferencias + reconciliacion.estadisticas.sinDatosAtlas
    : 0;
  const inmueblesPrincipales = inmueblesDetalle.filter((item) => !item.datos.esAccesorio);
  const inmueblesAccesorios = inmueblesDetalle.filter((item) => item.datos.esAccesorio);
  const inmuebleItems: Array<{ title: string; subtitle: string; statusLabel: string; statusTone: SectionStatusTone }> = [
    ...inmueblesPrincipales.map((inmueble) => ({
      title: inmueble.datos.direccion || inmueble.datos.referenciaCatastral || `Inmueble ${inmueble.datos.orden}`,
      subtitle: [inmueble.datos.referenciaCatastral, formatCurrency(inmueble.datos.ingresosIntegros), `${inmueble.datos.diasArrendado} días`].filter(Boolean).join(' · '),
      statusLabel: inmueble.datos.ingresosIntegros > 0 ? 'Crear' : 'Revisar',
      statusTone: inmueble.datos.ingresosIntegros > 0 ? 'info' as const : 'warning' as const,
    })),
    ...inmueblesAccesorios.map((inmueble) => ({
      title: inmueble.datos.direccion || inmueble.datos.referenciaCatastral || `Accesorio ${inmueble.datos.orden}`,
      subtitle: `Accesorio → ${inmueble.datos.refCatastralPrincipal || 'principal por resolver'}`,
      statusLabel: 'Accesorio',
      statusTone: 'muted' as const,
    })),
  ];
  const arrastreItems: Array<{ title: string; subtitle: string; statusLabel: string; statusTone: SectionStatusTone }> = [
    ...arrastres.gastos0105_0106.map((item) => ({
      title: `Gastos 0105+0106 · ${item.referenciaCatastral || 'Sin referencia'}`,
      subtitle: `${formatCurrency(item.generadoEsteEjercicio || item.pendienteFuturo)} generados · Caduca ${item.ejercicioOrigen + 4}`,
      statusLabel: 'Pendiente',
      statusTone: 'warning' as const,
    })),
    ...arrastres.perdidasAhorro.map((item) => ({
      title: `Pérdidas ${item.tipo} ${item.ejercicioOrigen}`,
      subtitle: `${formatCurrency(item.pendienteFuturo)} pendientes · Caduca ${item.ejercicioOrigen + 4}`,
      statusLabel: 'Pendiente',
      statusTone: 'warning' as const,
    })),
  ];

  const tabs: Array<{ key: ReviewTab; label: string }> = [
    { key: 'entidades', label: `Entidades (${inmueblesDetalle.length + arrastresCount})` },
    { key: 'reconciliacion', label: `Reconciliación (${reconciliacionCount})` },
    { key: 'raw', label: 'Casillas raw' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={summaryGridStyle}>
        <KpiCard label="Casillas" value={resultado.totalCasillas} />
        <KpiCard label="Inmuebles" value={inmueblesDetalle.length} />
        <KpiCard label="Arrastres" value={arrastresCount} />
        <KpiCard label="Resultado" value={<span style={{ color: '#C52828' }}>{formatCurrency(declaracion.basesYCuotas.resultadoDeclaracion)}</span>} />
      </div>

      <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '18px', overflow: 'hidden', background: 'white' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--hz-neutral-100)', borderBottom: '1px solid var(--hz-neutral-300)' }}>
          <strong style={{ color: 'var(--atlas-navy-1)' }}>
            Datos fiscales extraídos — Ejercicio {resultado.meta.ejercicio}
          </strong>
        </div>
        <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '1rem' }}>
          <KeyValueGrid rows={[
            { label: 'Base imponible general (0435)', value: formatCurrency(declaracion.basesYCuotas.baseImponibleGeneral) },
            { label: 'Base imponible ahorro (0460)', value: formatCurrency(declaracion.basesYCuotas.baseImponibleAhorro) },
            { label: 'Cuota íntegra', value: formatCurrency(declaracion.basesYCuotas.cuotaIntegra) },
            { label: 'Cuota líquida', value: formatCurrency(declaracion.basesYCuotas.cuotaLiquida) },
            { label: 'Total retenciones (0609)', value: formatCurrency(declaracion.basesYCuotas.retencionesTotal) },
            { label: 'Resultado declaración (0670)', value: formatCurrency(declaracion.basesYCuotas.resultadoDeclaracion) },
          ]} />

          {(declaracion.trabajo.rendimientoNeto > 0
            || declaracion.inmuebles.length > 0
            || declaracion.actividades.length > 0) && (
            <div style={{ marginTop: '0.25rem', paddingTop: '1rem', borderTop: '1px solid var(--hz-neutral-200)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--hz-neutral-700)', marginBottom: '0.5rem' }}>
                RENDIMIENTOS
              </div>
              <KeyValueGrid
                rows={[
                  ...(declaracion.trabajo.rendimientoNeto > 0
                    ? [{ label: 'Trabajo', value: formatCurrency(declaracion.trabajo.rendimientoNeto) }]
                    : []),
                  ...(declaracion.inmuebles.length > 0
                    ? [{
                        label: `Inmuebles (${declaracion.inmuebles.length})`,
                        value: formatCurrency(declaracion.inmuebles.reduce((sum, item) => sum + item.rendimientoNeto, 0)),
                      }]
                    : []),
                  ...(declaracion.actividades.length > 0
                    ? [{
                        label: 'Actividades económicas',
                        value: formatCurrency(declaracion.actividades.reduce((sum, item) => sum + item.rendimientoNeto, 0)),
                      }]
                    : []),
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {validacion.avisos.length > 0 && (
        <div style={{ padding: '1rem', borderRadius: '12px', background: '#FFF1CF', color: '#A36B00', display: 'grid', gap: '0.5rem' }}>
          <strong>Avisos de validación</strong>
          {validacion.avisos.map((aviso) => (
            <div key={aviso} style={{ fontSize: '0.92rem' }}>{aviso}</div>
          ))}
          <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
            Puedes importar igualmente o usar el formulario manual si prefieres corregir los datos antes.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--hz-neutral-300)' }}>
        {tabs.map((item) => (
          <button key={item.key} type="button" style={tabButtonStyle(tab === item.key)} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === null && (
        <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'var(--hz-neutral-100)', color: 'var(--hz-neutral-700)' }}>
          Selecciona una pestaña si quieres revisar entidades detectadas, la reconciliación con ATLAS o las casillas raw. El resumen fiscal de arriba es lo principal para validar la importación.
        </div>
      )}

      {tab === 'entidades' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SectionListCard
            title="Inmuebles"
            Icon={Home}
            badge={`${inmueblesPrincipales.length} principales · ${inmueblesAccesorios.length} accesorios`}
            items={inmuebleItems}
            emptyText="No se detectaron inmuebles."
          />

          <SectionListCard
            title="Arrastres fiscales"
            Icon={RefreshCw}
            badge={arrastresCount > 0 ? `${formatCurrency(
              arrastres.gastos0105_0106.reduce((acc, item) => acc + item.pendienteFuturo, 0)
              + arrastres.perdidasAhorro.reduce((acc, item) => acc + item.pendienteFuturo, 0),
            )} pendientes` : 'Sin pendientes'}
            items={arrastreItems}
            emptyText="No se detectaron arrastres pendientes."
          />
        </div>
      )}

      {tab === 'reconciliacion' && (
        <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '18px', background: 'white', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--hz-neutral-100)', borderBottom: '1px solid var(--hz-neutral-300)' }}>
            <div>
              <strong style={{ color: 'var(--atlas-navy-1)' }}>Reconciliación AEAT ↔ ATLAS</strong>
              <div style={{ marginTop: '0.25rem', color: 'var(--hz-neutral-700)', fontSize: '0.92rem' }}>
                {reconciliacionDisponible
                  ? 'Hay diferencias o entidades nuevas detectadas. Revisa qué aplicar antes de importar.'
                  : 'No se detectaron diferencias pendientes o aún no se ha generado la reconciliación avanzada.'}
              </div>
            </div>
            {reconciliacionDisponible && (
              <button
                type="button"
                onClick={onAbrirReconciliacion}
                style={{ border: 'none', borderRadius: '12px', background: 'var(--atlas-blue)', color: 'white', padding: '0.8rem 1rem', cursor: 'pointer', fontWeight: 700 }}
              >
                Abrir conciliación
              </button>
            )}
          </div>
          <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
            <KeyValueGrid rows={[
              { label: 'Coincidencias', value: reconciliacion?.estadisticas.coincidencias ?? 0 },
              { label: 'Diferencias', value: reconciliacion?.estadisticas.diferencias ?? 0 },
              { label: 'Solo en AEAT', value: reconciliacion?.estadisticas.sinDatosAtlas ?? 0 },
              { label: 'Pendientes', value: reconciliacion?.estadisticas.pendientesDeDecision ?? 0 },
            ]} />
          </div>
        </div>
      )}

      {tab === 'raw' && (
        <pre style={{ margin: 0, fontSize: '11px', maxHeight: '420px', overflow: 'auto', background: '#081225', color: '#D8F1FF', borderRadius: '12px', padding: '1rem' }}>
          {JSON.stringify(casillasRaw, null, 2)}
        </pre>
      )}
    </div>
  );
};

function SectionListCard({
  title,
  Icon,
  badge,
  items,
  emptyText,
}: {
  title: string;
  Icon: typeof Home;
  badge?: string;
  items: Array<{ title: string; subtitle: string; statusLabel: string; statusTone: SectionStatusTone }>;
  emptyText: string;
}) {
  return (
    <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '18px', overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'var(--hz-neutral-100)', borderBottom: '1px solid var(--hz-neutral-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'var(--atlas-blue)', color: 'white' }}>
            <Icon size={18} />
          </div>
          <strong style={{ fontSize: '1.05rem', color: 'var(--atlas-navy-1)' }}>{title}</strong>
        </div>
        {badge ? (
          <span style={{ borderRadius: '999px', background: '#E9F2FF', color: 'var(--atlas-blue)', padding: '0.35rem 0.8rem', fontSize: '0.9rem', fontWeight: 600 }}>
            {badge}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid' }}>
        {items.length === 0 ? (
          <div style={{ padding: '1rem 1.25rem', color: 'var(--hz-neutral-700)' }}>{emptyText}</div>
        ) : items.map((item, index) => (
          <div key={`${item.title}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '1rem 1.25rem', borderTop: index === 0 ? 'none' : '1px solid var(--hz-neutral-200)' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <strong style={{ color: 'var(--atlas-navy-1)', fontSize: '1rem' }}>{item.title}</strong>
              <span style={{ color: 'var(--hz-neutral-700)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.92rem' }}>{item.subtitle}</span>
            </div>
            <EntityStatusBadge tone={item.statusTone}>{item.statusLabel}</EntityStatusBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityStatusBadge({ tone, children }: { tone: SectionStatusTone; children: React.ReactNode }) {
  const palette = {
    info: { background: '#E9F2FF', color: 'var(--atlas-blue)' },
    success: { background: '#E9F8EE', color: '#157347' },
    warning: { background: '#FFF1CF', color: '#A36B00' },
    muted: { background: '#F0F2F5', color: 'var(--hz-neutral-600)' },
  } satisfies Record<string, { background: string; color: string }>;

  return (
    <span style={{ ...palette[tone], borderRadius: '999px', padding: '0.45rem 0.9rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function normalizarCasillasExtraidas(raw: Record<string, number | string>): CasillaExtraida[] {
  return Object.entries(raw)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([numero, value]) => ({
      numero,
      valor: value as number,
      confianza: 'alta' as const,
      lineaOriginal: '[Claude Vision]',
    }))
    .sort((a, b) => a.numero.localeCompare(b.numero));
}

async function archivarPdfImportado(
  uploadedFile: File | null,
  ejercicioImportacion: number,
  metodo: MetodoEntrada,
  totalCasillas: number,
): Promise<string | undefined> {
  if (!uploadedFile) return undefined;

  const documentId = await saveDocumentWithBlob({
    filename: `Declaracion_IRPF_${ejercicioImportacion}.pdf`,
    type: 'declaracion_irpf',
    content: uploadedFile,
    size: uploadedFile.size,
    lastModified: uploadedFile.lastModified,
    uploadDate: new Date().toISOString(),
    metadata: {
      title: `Declaración IRPF ${ejercicioImportacion}`,
      description: 'PDF archivado desde el wizard de importación de declaraciones.',
      ejercicio: ejercicioImportacion,
      origen: 'importacion_wizard',
      fechaImportacion: new Date().toISOString(),
      casillasExtraidas: totalCasillas,
      metodoExtraccion: metodo === 'pdf' ? 'ocr' : 'texto',
      status: 'Archivado',
    },
  });

  return `document:${documentId}`;
}

const ImportarDeclaracionWizard: React.FC<ImportarDeclaracionWizardProps> = ({ onClose, onImported, defaultMethod = 'pdf' }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [ejercicio, setEjercicio] = useState(currentYear - 1);
  const [metodo, setMetodo] = useState<MetodoEntrada>(defaultMethod);
  const [data, setData] = useState<ImportacionManualData>(() => crearImportacionManualVacia(currentYear - 1));
  const [casillasExtraidas, setCasillasExtraidas] = useState<CasillaExtraida[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<ProgresoParseo | null>(null);
  const [resultadoExtraccion, setResultadoExtraccion] = useState<ExtraccionCompleta | null>(null);
  const [resultadoAnalisis, setResultadoAnalisis] = useState<ResultadoAnalisis | null>(null);
  const [reconciliacion, setReconciliacion] = useState<ReconciliacionCompleta | null>(null);
  const [reconciliacionPreview, setReconciliacionPreview] = useState<ReconciliacionCompleta | null>(null);
  const [generandoReconciliacion, setGenerandoReconciliacion] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData((prev) => ({ ...prev, ejercicio }));
  }, [ejercicio]);

  useEffect(() => {
    setMetodo(defaultMethod);
  }, [defaultMethod]);

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
    setStep(2);
    setResultadoExtraccion(null);
    setResultadoAnalisis(null);
    setReconciliacion(null);
    setReconciliacionPreview(null);
    setCasillasExtraidas([]);

    try {
      const extraccion = await parsearDeclaracionAEAT(
        file,
        (progress) => setProgreso(progress),
        ejercicio,
      );
      setResultadoExtraccion(extraccion);

      if (!extraccion.exito) {
        toast.error(extraccion.errores[0] || 'No se pudo procesar el PDF');
        return;
      }

      const normalizedCasillas = normalizarCasillasExtraidas(extraccion.casillasRaw);
      const ejercicioDetectado = extraccion.meta.ejercicio > 0 ? extraccion.meta.ejercicio : ejercicio;
      setCasillasExtraidas(normalizedCasillas);
      setEjercicio(ejercicioDetectado);
      setData((prev) => ({
        ...prev,
        ...mapearCasillasAImportacion(normalizedCasillas, ejercicioDetectado),
        ejercicio: ejercicioDetectado,
        arrastres: [
          ...extraccion.arrastres.gastos0105_0106.map((item) => ({
            tipo: 'gastos_0105_0106' as const,
            ejercicioOrigen: item.ejercicioOrigen || ejercicioDetectado,
            importe: item.pendienteFuturo || item.generadoEsteEjercicio,
          })),
          ...extraccion.arrastres.perdidasAhorro.map((item) => ({
            tipo: 'perdidas_patrimoniales_ahorro' as const,
            ejercicioOrigen: item.ejercicioOrigen,
            importe: item.pendienteFuturo,
          })),
        ],
      }));

      try {
        const analisis = await analizarDeclaracionParaOnboarding(extraccion);
        setResultadoAnalisis(analisis);
      } catch (analysisError) {
        console.warn('Error analizando entidades detectadas en la declaración:', analysisError);
        setResultadoAnalisis(null);
      }

      toast.success(`${extraccion.totalCasillas} casillas extraídas automáticamente`);
      setStep(3);
      if (extraccion.warnings.length > 0) {
        toast((t) => (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <strong>Extracción completada con avisos</strong>
            <span style={{ fontSize: '0.85rem' }}>{extraccion.warnings[0]}</span>
            <button type="button" onClick={() => toast.dismiss(t.id)} style={{ border: 'none', background: 'transparent', color: 'var(--atlas-blue)', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              Cerrar
            </button>
          </div>
        ), { duration: 5000 });
      }
    } catch (error) {
      console.error('Error extrayendo casillas del PDF', error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar el PDF');
    } finally {
      setProgreso(null);
    }
  };

  const handleConfirmarImportacion = async () => {
    setSaving(true);
    try {
      const ejercicioImportacion = resultadoExtraccion?.exito && resultadoExtraccion.meta.ejercicio > 0
        ? resultadoExtraccion.meta.ejercicio
        : data.ejercicio;

      const pdfRef = await archivarPdfImportado(
        uploadedFile,
        ejercicioImportacion,
        metodo,
        resultadoExtraccion?.totalCasillas ?? casillasExtraidas.length,
      );

      if (resultadoExtraccion?.exito) {
        const declaracionSanitizada = sanitizarParaIndexedDB(resultadoExtraccion.declaracion);

        await declararEjercicio(
          ejercicioImportacion,
          declaracionSanitizada,
          'pdf_importado',
          resultadoExtraccion.meta.fechaPresentacion,
          pdfRef,
        );

        if (resultadoAnalisis) {
          try {
            const resumenEjecucion = await ejecutarImportacion(resultadoAnalisis, {
              crearInmueblesNuevos: true,
              actualizarInmueblesExistentes: true,
              crearPrestamos: true,
              crearContratos: true,
              importarArrastres: true,
              guardarDeclaracion: false,
            });

            if (!resumenEjecucion.exito) {
              toast('Declaración importada, pero hubo incidencias creando entidades en ATLAS.', { icon: '⚠️' });
            }
          } catch (importError) {
            console.error('Error creando entidades detectadas durante la importación', importError);
            toast('Declaración importada, pero hubo un error creando inmuebles o contratos.', { icon: '⚠️' });
          }
        }
      } else {
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

        await importarDeclaracionManual({
          ejercicio: data.ejercicio,
          casillasAEAT: casillasMap,
          resultado: {
            baseImponibleGeneral: data.baseImponibleGeneral,
            baseImponibleAhorro: data.baseImponibleAhorro,
            cuotaIntegra: resumen.cuotaIntegra,
            cuotaLiquida: resumen.cuotaLiquida,
            deducciones: 0,
            retencionesYPagosCuenta: data.totalRetenciones,
            resultado: data.resultado,
            tipoEfectivo: resumen.cuotaLiquida > 0
              ? Number((((resumen.cuotaLiquida / Math.max(1, data.baseImponibleGeneral + data.baseImponibleAhorro)) * 100)).toFixed(2))
              : 0,
          },
          arrastresPendientes: (data.arrastres ?? []).map((arrastre) => ({
            tipo: arrastre.tipo,
            importePendiente: arrastre.importe,
            ejercicioOrigen: arrastre.ejercicioOrigen,
            ejercicioCaducidad: arrastre.ejercicioOrigen + 4,
          })),
          notasRevision: 'Importación manual desde wizard histórico IRPF',
        });
      }

      toast.success(`Declaración ${ejercicioImportacion} importada y archivada`);
      await onImported();
      onClose();
    } catch (error) {
      console.error('Error importando declaración', error);
      toast.error(`Error al importar: ${error instanceof Error ? error.message : 'desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep2 = metodo === 'formulario'
    || Boolean(resultadoExtraccion?.exito)
    || data.baseImponibleGeneral !== 0
    || data.totalRetenciones !== 0
    || data.resultado !== 0;

  const progresoPorcentaje = progreso?.totalPaginas
    ? Math.min(100, Math.round(((progreso.pagina || 0) / progreso.totalPaginas) * 100))
    : undefined;

  useEffect(() => {
    let cancelled = false;
    if (step !== 3 || !resultadoExtraccion?.exito || metodo !== 'pdf' || reconciliacionPreview || generandoReconciliacion) return undefined;

    setGenerandoReconciliacion(true);
    generarReconciliacion(resultadoExtraccion.declaracion, resultadoExtraccion.meta.ejercicio)
      .then((resultado) => {
        if (cancelled) return;
        setReconciliacionPreview(resultado);
        setReconciliacion(requiereReconciliacion(resultado) ? resultado : null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error generando reconciliación', error);
        }
      })
      .finally(() => {
        if (!cancelled) setGenerandoReconciliacion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, resultadoExtraccion, metodo, reconciliacionPreview, generandoReconciliacion]);

  const navigationFooter = step < 4 ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={() => step === 1 ? onClose() : setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
        style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '14px', padding: '0.95rem 1.2rem', background: 'white', cursor: 'pointer', minWidth: '140px' }}
      >
        {step === 1 ? 'Cancelar' : 'Atrás'}
      </button>

      {step === 1 && metodo === 'pdf' ? (
        <div style={{ color: 'var(--hz-neutral-700)', display: 'flex', alignItems: 'center', fontSize: '0.95rem' }}>
          Selecciona un PDF para comenzar.
        </div>
      ) : step < 3 ? (
        <button
          type="button"
          disabled={step === 2 && !canContinueStep2}
          onClick={async () => {
            setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
          }}
          style={{
            border: 'none',
            borderRadius: '14px',
            padding: '0.95rem 1.2rem',
            background: 'var(--atlas-blue)',
            color: 'white',
            cursor: 'pointer',
            opacity: step === 2 && !canContinueStep2 ? 0.5 : 1,
            minWidth: '180px',
            fontWeight: 700,
          }}
        >
          {step === 1 ? 'Continuar' : 'Confirmar extracción'}
        </button>
      ) : reconciliacion ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => setStep(4)}
          style={{ border: 'none', borderRadius: '14px', padding: '0.95rem 1.2rem', background: 'var(--atlas-blue)', color: 'white', cursor: 'pointer', minWidth: '220px', fontWeight: 700 }}
        >
          Revisar reconciliación
        </button>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={handleConfirmarImportacion}
          style={{ border: 'none', borderRadius: '14px', padding: '0.95rem 1.2rem', background: 'var(--atlas-blue)', color: 'white', cursor: 'pointer', minWidth: '220px', fontWeight: 700 }}
        >
          {saving ? 'Importando…' : 'Importar y crear entidades'}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div style={overlayStyle} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1rem 0' }}>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '0 2rem 2rem', display: 'grid', gap: '1.5rem', background: '#FAFBFD' }}>
          <div style={stepEyebrowStyle}>
            {step === 1 && 'PASO 1 — SUBIR PDF'}
            {step === 2 && 'PASO 2 — PROCESANDO (AUTOMÁTICO)'}
            {step === 3 && 'PASO 3 — CONFIRMAR E IMPORTAR'}
            {step === 4 && 'PASO 4 — TAB: RECONCILIACIÓN'}
          </div>

          {step === 1 && (
            <div style={shellCardStyle}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)', fontSize: '2rem' }}>Importar declaración IRPF</h2>
                <p style={sectionSubtitleStyle}>Sube el PDF del Modelo 100 para extraer automáticamente los datos fiscales.</p>
              </div>

              <div style={progressRailStyle}>
                {[1, 2, 3].map((item) => (
                  <div key={item} style={{ height: '5px', borderRadius: '999px', background: item === 1 ? '#27B7D6' : '#D8DFE8' }} />
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button type="button" onClick={() => setMetodo('pdf')} style={{ ...actionButtonStyle, borderColor: metodo === 'pdf' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)', borderRadius: '999px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} style={{ color: 'var(--atlas-blue)' }} />
                  <strong>PDF AEAT</strong>
                </button>
                <button type="button" onClick={() => setMetodo('formulario')} style={{ ...actionButtonStyle, borderColor: metodo === 'formulario' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)', borderRadius: '999px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--atlas-blue)' }} />
                  <strong>Formulario manual</strong>
                </button>
              </div>

              {metodo === 'pdf' ? (
                <>
                  <label htmlFor="aeat-pdf-input" style={uploadDropzoneStyle}>
                    <input id="aeat-pdf-input" type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                    <div style={{ display: 'grid', gap: '0.9rem' }}>
                      <Upload size={42} style={{ justifySelf: 'center', color: '#C5D2E2' }} />
                      <strong style={{ fontSize: '1.15rem' }}>Arrastra el PDF aquí o haz clic para seleccionar</strong>
                      <span style={{ color: 'var(--hz-neutral-700)' }}>Modelo 100 · Ejercicios 2020 a 2025</span>
                    </div>
                  </label>
                  <p style={{ margin: 0, textAlign: 'center', color: 'var(--hz-neutral-700)' }}>
                    ATLAS analiza el PDF con IA para extraer todas las casillas, inmuebles, arrastres y datos fiscales.
                  </p>
                </>
              ) : (
                <div style={{ padding: '1rem 1.2rem', borderRadius: '16px', border: '1px solid var(--hz-neutral-300)', background: 'var(--hz-neutral-100)' }}>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>Modo manual</strong>
                  <p style={{ ...sectionSubtitleStyle, marginTop: '0.4rem' }}>
                    Continúa al siguiente paso para introducir bases, cuotas, retenciones y arrastres manualmente.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.4rem', maxWidth: '280px' }}>
                <label style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>Ejercicio fiscal</label>
                <select
                  value={ejercicio}
                  onChange={(event) => setEjercicio(Number(event.target.value))}
                  style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid var(--hz-neutral-300)' }}
                >
                  {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index)
                    .filter((year) => year >= 2020)
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <span style={{ fontSize: '0.85rem', color: 'var(--hz-neutral-700)' }}>ATLAS solo importa histórico desde 2020.</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={shellCardStyle}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)', fontSize: '2rem' }}>Importar declaración IRPF</h2>
                <p style={sectionSubtitleStyle}>{metodo === 'pdf' ? 'Analizando el PDF con inteligencia artificial.' : 'Introduce manualmente los datos fiscales.'}</p>
              </div>

              <div style={progressRailStyle}>
                {[1, 2, 3].map((item) => (
                  <div key={item} style={{ height: '5px', borderRadius: '999px', background: item <= 2 ? (item === 2 ? '#27B7D6' : 'var(--atlas-blue)') : '#D8DFE8' }} />
                ))}
              </div>

              {metodo === 'pdf' ? (
                <>
                  <div style={{ minHeight: '260px', display: 'grid', alignItems: 'center', gap: '1.25rem', padding: '2rem 1rem' }}>
                    <div style={{ textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--atlas-navy-1)' }}>{progreso?.mensaje || 'Extrayendo casillas del Modelo 100…'}</strong>
                      <span style={{ color: 'var(--hz-neutral-700)' }}>
                        {progreso?.pagina && progreso?.totalPaginas ? `Analizando página ${progreso.pagina} de ${progreso.totalPaginas}` : uploadedFile?.name || 'Preparando el archivo'}
                      </span>
                    </div>
                    <div style={{ width: '100%', maxWidth: '86%', justifySelf: 'center', display: 'grid', gap: '0.65rem' }}>
                      <div style={{ height: '6px', background: '#D9E3ED', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progresoPorcentaje ?? (resultadoExtraccion?.exito ? 100 : 12)}%`, background: '#27B7D6', borderRadius: '999px', transition: 'width 0.35s ease' }} />
                      </div>
                      <span style={{ textAlign: 'center', color: 'var(--hz-neutral-700)' }}>
                        {resultadoExtraccion?.exito ? `${resultadoExtraccion.totalCasillas} casillas encontradas` : `${Object.keys(resultadoExtraccion?.casillasRaw ?? {}).length} casillas encontradas hasta ahora`}
                      </span>
                    </div>
                  </div>

                  {resultadoExtraccion && !resultadoExtraccion.exito && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', borderRadius: '12px', background: '#FDECEC', color: '#8B1E1E' }}>
                        <AlertTriangle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                        <div>
                          <strong>No se pudo extraer la declaración</strong>
                          <div style={{ marginTop: '0.2rem' }}>{resultadoExtraccion.errores[0]}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMetodo('formulario');
                          if (resultadoExtraccion.meta.ejercicio > 0) {
                            setEjercicio(resultadoExtraccion.meta.ejercicio);
                          }
                          setResultadoExtraccion(null);
                          setResultadoAnalisis(null);
                          setProgreso(null);
                          setStep(2);
                        }}
                        style={{
                          border: '1px solid var(--hz-neutral-300)',
                          borderRadius: '14px',
                          padding: '1rem',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: '0.35rem',
                          textAlign: 'left',
                        }}
                      >
                        <strong style={{ color: 'var(--atlas-navy-1)' }}>
                          Continuar con formulario manual
                        </strong>
                        <span style={{ color: 'var(--hz-neutral-700)', fontSize: '0.92rem' }}>
                          Introduce las casillas clave manualmente. Solo necesitas ~20 valores para completar la importación.
                        </span>
                      </button>

                      {resultadoExtraccion.warnings.length > 0 && (
                        <div style={{ padding: '0.9rem 1rem', borderRadius: '12px', background: '#FFF7E1', color: '#946200', display: 'grid', gap: '0.35rem' }}>
                          <strong>Avisos de extracción</strong>
                          {resultadoExtraccion.warnings.map((warning) => (
                            <div key={warning} style={{ fontSize: '0.92rem' }}>{warning}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <WizardForm data={data} onChange={handleDataPatch} />
              )}
            </div>
          )}

          {step === 3 && (
            <div style={shellCardStyle}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)', fontSize: '2rem' }}>
                  Importar declaración IRPF {resultadoExtraccion?.meta.ejercicio || data.ejercicio}
                </h2>
                <p style={sectionSubtitleStyle}>Revisa lo extraído y confirma qué crear en ATLAS.</p>
              </div>

              <div style={progressRailStyle}>
                {[1, 2, 3].map((item) => (
                  <div key={item} style={{ height: '5px', borderRadius: '999px', background: item === 3 ? '#27B7D6' : 'var(--atlas-blue)' }} />
                ))}
              </div>

              {resultadoExtraccion?.exito ? (
                <VerificacionExtraccion
                  resultado={resultadoExtraccion}
                  reconciliacion={reconciliacionPreview}
                  reconciliacionDisponible={Boolean(reconciliacion)}
                  onAbrirReconciliacion={() => setStep(4)}
                />
              ) : (
                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--hz-neutral-300)' }}>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>Resumen manual</strong>
                  <div style={{ marginTop: '1rem' }}>
                    <KeyValueGrid rows={[
                      { label: 'Ejercicio', value: data.ejercicio },
                      { label: 'Base general', value: formatCurrency(data.baseImponibleGeneral) },
                      { label: 'Retenciones', value: formatCurrency(data.totalRetenciones) },
                      { label: 'Resultado', value: formatCurrency(data.resultado) },
                    ]} />
                  </div>
                </div>
              )}

              {generandoReconciliacion && (
                <div style={{ color: 'var(--hz-neutral-700)', fontSize: '0.92rem' }}>
                  Generando la reconciliación con ATLAS…
                </div>
              )}
            </div>
          )}

          {step === 4 && reconciliacion && (
            <div style={shellCardStyle}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)', fontSize: '2rem' }}>
                  Importar declaración IRPF {resultadoExtraccion?.meta.ejercicio || data.ejercicio}
                </h2>
                <p style={sectionSubtitleStyle}>Revisa las diferencias entre ATLAS y la declaración antes de importar.</p>
              </div>
              <ReconciliacionPanel
                reconciliacion={reconciliacion}
                onCancel={() => setStep(3)}
                onComplete={handleConfirmarImportacion}
              />
            </div>
          )}

          {navigationFooter}
        </div>
      </div>
    </div>
  );
};

export default ImportarDeclaracionWizard;
