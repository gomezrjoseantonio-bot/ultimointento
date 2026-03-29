import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
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
import ConflictReviewStep from '../../../../components/fiscal/ConflictReviewStep';
import type { ConflictResolutions } from '../../../../components/fiscal/ConflictReviewStep';
import { declararEjercicio } from '../../../../services/ejercicioFiscalService';
import {
  importarDeclaracionAEAT,
  getEjercicio,
} from '../../../../services/ejercicioResolverService';
import { importarDeclaracionManual } from '../../../../services/fiscalLifecycleService';
import type { ReconciliacionCompleta } from '../../../../services/reconciliacionService';
import { generarReconciliacion, requiereReconciliacion } from '../../../../services/reconciliacionService';
import { parseDeclaracionXml, isAeatXml } from '../../../../services/aeatXmlParserService';
import type { DeclaracionXmlResult } from '../../../../services/aeatXmlParserService';

type MetodoEntrada = 'formulario' | 'pdf' | 'xml';

interface ImportarDeclaracionWizardProps {
  onClose: () => void;
  onImported: () => void | Promise<void>;
  defaultMethod?: MetodoEntrada;
  embedded?: boolean;
  onBack?: () => void;
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
  avisoOrden?: string | null;
  analisis?: ResultadoAnalisis | null;
  fuenteImportacion?: 'xml' | 'pdf';
}> = ({ resultado, avisoOrden, analisis, fuenteImportacion }) => {
  const { declaracion, casillasRaw, inmueblesDetalle, arrastres } = resultado;
  const validacion = useMemo(
    () => validarDeclaracionExtraida(declaracion, casillasRaw),
    [casillasRaw, declaracion],
  );

  const arrastresCount = arrastres.gastos0105_0106.length + arrastres.perdidasAhorro.length;
  const resultadoDecl = declaracion.basesYCuotas.resultadoDeclaracion;
  const esDevolver = resultadoDecl < 0;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* ═══ RESUMEN FISCAL PROMINENTE ═══ */}
      <div style={{
        border: '1px solid var(--hz-neutral-200, #DEE2E6)',
        borderRadius: 'var(--r-lg, 16px)',
        padding: '1.5rem',
        background: 'white',
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--hz-neutral-700)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Ejercicio {resultado.meta.ejercicio}
          {fuenteImportacion === 'xml' && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6, color: '#0d9488', background: '#ccfbf1' }}>
              XML AEAT
            </span>
          )}
        </div>

        {/* Big result number */}
        <div style={{
          fontSize: '2rem',
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono, monospace',
          color: esDevolver ? 'var(--s-pos, #042C5E)' : 'var(--s-neg, #303A4C)',
          marginBottom: '1rem',
        }}>
          {formatCurrency(resultadoDecl)}
          <span style={{ fontSize: '0.9rem', fontWeight: 500, marginLeft: '0.5rem', color: 'var(--hz-neutral-700)' }}>
            ({esDevolver ? 'a devolver' : 'a pagar'})
          </span>
        </div>

        {/* Key metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--n-500, #6C757D)', fontFamily: 'IBM Plex Sans, sans-serif' }}>Base general</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(declaracion.basesYCuotas.baseImponibleGeneral)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--n-500, #6C757D)', fontFamily: 'IBM Plex Sans, sans-serif' }}>Base ahorro</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(declaracion.basesYCuotas.baseImponibleAhorro)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--n-500, #6C757D)', fontFamily: 'IBM Plex Sans, sans-serif' }}>Cuota íntegra</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(declaracion.basesYCuotas.cuotaIntegra)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--n-500, #6C757D)', fontFamily: 'IBM Plex Sans, sans-serif' }}>Retenciones</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              {formatCurrency(declaracion.basesYCuotas.retencionesTotal)}
            </div>
          </div>
        </div>

        {/* Detection summary */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--hz-neutral-200)',
          fontSize: '0.9rem',
          color: 'var(--hz-neutral-700)',
        }}>
          ATLAS ha detectado: <strong>{inmueblesDetalle.length} inmueble{inmueblesDetalle.length !== 1 ? 's' : ''}</strong>
          {arrastresCount > 0 && <> · <strong>{arrastresCount} arrastre{arrastresCount !== 1 ? 's' : ''}</strong></>}
        </div>
      </div>

      {/* ═══ AVISO DE ORDEN DE IMPORTACIÓN ═══ */}
      {avisoOrden && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--s-warn-bg, #EEF1F5)', color: 'var(--s-warn, #6C757D)', fontSize: '0.9rem' }}>
          {avisoOrden}
        </div>
      )}

      {/* ═══ AVISOS DE VALIDACIÓN ═══ */}
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

      {/* ═══ INMUEBLES DETECTADOS ═══ */}
      {inmueblesDetalle.length > 0 && (
        <div style={{
          border: '1px solid var(--hz-neutral-200)',
          borderRadius: 'var(--r-lg, 16px)',
          overflow: 'hidden',
          background: 'white',
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--hz-neutral-100)',
            borderBottom: '1px solid var(--hz-neutral-200)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            fontSize: '0.9rem',
          }}>
            Inmuebles detectados ({inmueblesDetalle.length})
          </div>
          {inmueblesDetalle.map((inmueble, index) => {
            // Determine badge using analysis results: check if ref catastral matches an existing property
            const ref = (inmueble.datos.referenciaCatastral ?? '').replace(/[\s\-.]/g, '').toUpperCase();
            const existeEnAtlas = analisis
              ? (analisis.inmuebles.coinciden.some((c) => c.referenciaCatastral.replace(/[\s\-.]/g, '').toUpperCase() === ref)
                || analisis.inmuebles.actualizar.some((a) => a.referenciaCatastral.replace(/[\s\-.]/g, '').toUpperCase() === ref))
              : false;
            const isNew = !existeEnAtlas;
            const badgeLabel = inmueble.datos.esAccesorio ? 'Accesorio' : existeEnAtlas ? 'Existente' : 'Nuevo';
            return (
              <div key={index} style={{
                padding: '0.75rem 1rem',
                borderBottom: index < inmueblesDetalle.length - 1 ? '1px solid var(--hz-neutral-100)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)', fontSize: '0.9rem' }}>
                    {inmueble.datos.direccion || inmueble.datos.referenciaCatastral || `Inmueble ${inmueble.datos.orden}`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--hz-neutral-700)', marginTop: '0.15rem', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {[
                      inmueble.datos.referenciaCatastral,
                      inmueble.datos.valorCatastral ? `VC: ${formatCurrency(inmueble.datos.valorCatastral)}` : null,
                      inmueble.datos.porcentajeConstruccion ? `${inmueble.datos.porcentajeConstruccion}% constr.` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  ...(isNew
                    ? { background: 'var(--s-pos-bg, #E8EFF7)', color: 'var(--s-pos, #042C5E)' }
                    : { background: 'var(--n-100, #F0F2F5)', color: 'var(--n-600, #6C757D)' }),
                }}>
                  {badgeLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ARRASTRES DETECTADOS ═══ */}
      {arrastresCount > 0 && (
        <div style={{
          border: '1px solid var(--hz-neutral-200)',
          borderRadius: 'var(--r-lg, 16px)',
          overflow: 'hidden',
          background: 'white',
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--hz-neutral-100)',
            borderBottom: '1px solid var(--hz-neutral-200)',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            fontSize: '0.9rem',
          }}>
            Arrastres fiscales ({arrastresCount})
          </div>
          {arrastres.gastos0105_0106.map((item, i) => (
            <div key={`g-${i}`} style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--hz-neutral-100)',
              fontSize: '0.85rem',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
                Gastos 0105+0106 · {item.referenciaCatastral || 'Sin referencia'}
              </div>
              <div style={{ color: 'var(--hz-neutral-700)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '0.15rem' }}>
                {formatCurrency(item.generadoEsteEjercicio || item.pendienteFuturo)} pendientes · Caduca {item.ejercicioOrigen + 4}
              </div>
            </div>
          ))}
          {arrastres.perdidasAhorro.map((item, i) => (
            <div key={`p-${i}`} style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--hz-neutral-100)',
              fontSize: '0.85rem',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
                Pérdidas {item.tipo} {item.ejercicioOrigen}
              </div>
              <div style={{ color: 'var(--hz-neutral-700)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '0.15rem' }}>
                {formatCurrency(item.pendienteFuturo)} pendientes · Caduca {item.ejercicioOrigen + 4}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CASILLAS RAW (colapsado) ═══ */}
      <details style={{ border: '1px solid var(--hz-neutral-200)', borderRadius: '12px', overflow: 'hidden' }}>
        <summary style={{
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          fontWeight: 600,
          color: 'var(--hz-neutral-700)',
          fontSize: '0.85rem',
          background: 'var(--hz-neutral-100)',
        }}>
          Ver casillas ({resultado.totalCasillas})
        </summary>
        <pre style={{ margin: 0, fontSize: '11px', maxHeight: '420px', overflow: 'auto', background: '#081225', color: '#D8F1FF', padding: '1rem' }}>
          {JSON.stringify(casillasRaw, null, 2)}
        </pre>
      </details>
    </div>
  );
};

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

const ImportarDeclaracionWizard: React.FC<ImportarDeclaracionWizardProps> = ({ onClose, onImported, defaultMethod = 'pdf', embedded = false, onBack }) => {
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
  const [xmlResult, setXmlResult] = useState<DeclaracionXmlResult | null>(null);
  const [avisoOrden, setAvisoOrden] = useState<string | null>(null);
  const [showConflictReview, setShowConflictReview] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolutions>({});

  useEffect(() => {
    setData((prev) => ({ ...prev, ejercicio }));
  }, [ejercicio]);

  // T1B.4: Check for missing years in the import chain
  useEffect(() => {
    if (ejercicio <= 2020) { setAvisoOrden(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const añosFaltantes: number[] = [];
        for (let a = ejercicio - 1; a >= 2020; a--) {
          const ej = await getEjercicio(a);
          if (ej.aeat || ej.estado === 'declarado' || ej.estado === 'prescrito') break;
          añosFaltantes.push(a);
        }
        if (cancelled) return;
        if (añosFaltantes.length > 0) {
          const listaAños = añosFaltantes.sort((a, b) => a - b).join(', ');
          setAvisoOrden(
            `Faltan las declaraciones de ${listaAños}. Los arrastres se propagarán automáticamente cuando las importes.`,
          );
        } else {
          setAvisoOrden(null);
        }
      } catch {
        if (!cancelled) setAvisoOrden(null);
      }
    })();
    return () => { cancelled = true; };
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

  const handleXmlFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setStep(2);
    setResultadoExtraccion(null);
    setResultadoAnalisis(null);
    setReconciliacion(null);
    setReconciliacionPreview(null);
    setCasillasExtraidas([]);
    setXmlResult(null);

    try {
      const text = await file.text();

      if (!isAeatXml(text)) {
        toast.error('El archivo no parece ser un XML de declaración AEAT (DeclaVisor).');
        return;
      }

      const result = await parseDeclaracionXml(text);
      setXmlResult(result);

      const ejercicioDetectado = result.ejercicio > 0 ? result.ejercicio : ejercicio;
      setEjercicio(ejercicioDetectado);

      // Build casillasRaw and ExtraccionCompleta-compatible result
      const casillasRaw: Record<string, number | string> = { ...result.casillas };
      const normalizedCasillas = Object.entries(result.casillas)
        .map(([numero, valor]) => ({
          numero,
          valor,
          confianza: 'alta' as const,
          lineaOriginal: '[XML AEAT]',
        }))
        .sort((a, b) => a.numero.localeCompare(b.numero));

      setCasillasExtraidas(normalizedCasillas);

      // Build a minimal ExtraccionCompleta from XML data
      const extraccion: ExtraccionCompleta = {
        exito: true,
        errores: [],
        warnings: [],
        meta: {
          ejercicio: ejercicioDetectado,
          modelo: result.modelo,
          nif: result.declarante.nif,
          nombre: result.declarante.nombre,
          fechaPresentacion: result.metadatos.fechaPresentacion,
          numeroJustificante: result.metadatos.nroJustificante,
          codigoVerificacion: result.metadatos.csv,
          esRectificativa: false,
        },
        declaracion: {
          personal: {
            nif: result.declarante.nif,
            nombre: result.declarante.nombre,
            estadoCivil: result.declarante.estadoCivil === 1 ? 'soltero' : 'casado',
            comunidadAutonoma: String(result.ccaa),
            fechaNacimiento: result.declarante.fechaNacimiento,
          },
          trabajo: {
            retribucionesDinerarias: result.casillas['0003'] || 0,
            retribucionEspecie: result.casillas['0007'] || 0,
            ingresosACuenta: result.casillas['0005'] || 0,
            contribucionesPPEmpresa: 0,
            totalIngresosIntegros: result.casillas['0008'] || 0,
            cotizacionSS: result.casillas['0013'] || 0,
            rendimientoNetoPrevio: result.casillas['0017'] || 0,
            otrosGastosDeducibles: result.casillas['0019'] || 0,
            rendimientoNeto: result.casillas['0022'] || 0,
            rendimientoNetoReducido: result.casillas['0025'] || 0,
            retencionesTrabajoTotal: result.casillas['0596'] || 0,
          },
          inmuebles: result.inmuebles.map((inm, idx) => ({
            orden: idx + 1,
            referenciaCatastral: inm.refCatastral,
            direccion: inm.direccion,
            porcentajePropiedad: inm.porcentajePropiedad,
            uso: inm.usoDisposicion === 1 ? 'arrendamiento' as const : 'disposicion' as const,
            esAccesorio: false,
            derechoReduccion: false,
            diasArrendado: 0,
            diasDisposicion: inm.diasDisposicion,
            rentaImputada: inm.rentaImputada,
            ingresosIntegros: 0,
            arrastresRecibidos: 0,
            arrastresAplicados: 0,
            interesesFinanciacion: 0,
            gastosReparacion: 0,
            gastos0105_0106Aplicados: 0,
            arrastresGenerados: 0,
            gastosComunidad: 0,
            gastosServicios: 0,
            gastosSuministros: 0,
            gastosSeguros: 0,
            gastosTributos: 0,
            amortizacionMuebles: 0,
            amortizacionInmueble: 0,
            valorCatastral: inm.valorCatastral,
            rendimientoNeto: 0,
            reduccion: 0,
            rendimientoNetoReducido: 0,
          })),
          actividades: [],
          capitalMobiliario: {
            interesesCuentas: result.casillas['0027'] || 0,
            otrosRendimientos: result.casillas['0029'] || 0,
            totalIngresosIntegros: result.casillas['0036'] || 0,
            rendimientoNeto: result.casillas['0037'] || 0,
            rendimientoNetoReducido: result.casillas['0041'] || 0,
            retencionesCapital: result.casillas['0597'] || 0,
          },
          gananciasPerdidas: {
            gananciasNoTransmision: result.casillas['0304'] || 0,
            perdidasNoTransmision: 0,
            saldoNetoGeneral: result.casillas['0420'] || 0,
            gananciasTransmision: result.casillas['0316'] || 0,
            perdidasTransmision: 0,
            saldoNetoAhorro: 0,
            compensacionPerdidasAnteriores: 0,
            perdidasPendientes: [],
          },
          planPensiones: {
            aportacionesTrabajador: result.reduccionesPrevisionSocial.aportacionesIndividuales,
            contribucionesEmpresariales: result.reduccionesPrevisionSocial.contribucionesEmpresariales,
            totalConDerecho: result.reduccionesPrevisionSocial.total,
            reduccionAplicada: result.reduccionesPrevisionSocial.total,
          },
          basesYCuotas: {
            baseImponibleGeneral: result.casillas['0435'] || 0,
            baseImponibleAhorro: result.casillas['0460'] || 0,
            baseLiquidableGeneral: result.casillas['0505'] || 0,
            baseLiquidableAhorro: result.casillas['0510'] || 0,
            cuotaIntegraEstatal: result.casillas['0545'] || 0,
            cuotaIntegraAutonomica: result.casillas['0546'] || 0,
            cuotaIntegra: (result.casillas['0545'] || 0) + (result.casillas['0546'] || 0),
            cuotaLiquidaEstatal: result.casillas['0570'] || 0,
            cuotaLiquidaAutonomica: result.casillas['0571'] || 0,
            cuotaLiquida: (result.casillas['0570'] || 0) + (result.casillas['0571'] || 0),
            cuotaResultante: result.casillas['0595'] || 0,
            retencionesTotal: result.casillas['0609'] || 0,
            cuotaDiferencial: result.casillas['0610'] || 0,
            resultadoDeclaracion: result.casillas['0670'] || result.resultado,
          },
          rentasImputadas: {
            sumaImputaciones: result.casillas['0155'] || 0,
          },
        },
        casillasRaw,
        inmueblesDetalle: result.inmuebles.map((inm, idx) => ({
          datos: {
            orden: idx + 1,
            referenciaCatastral: inm.refCatastral,
            direccion: inm.direccion,
            porcentajePropiedad: inm.porcentajePropiedad,
            uso: inm.usoDisposicion === 1 ? 'arrendamiento' as const : 'disposicion' as const,
            esAccesorio: false,
            derechoReduccion: false,
            diasArrendado: 0,
            diasDisposicion: inm.diasDisposicion,
            rentaImputada: inm.rentaImputada,
            ingresosIntegros: 0,
            arrastresRecibidos: 0,
            arrastresAplicados: 0,
            interesesFinanciacion: 0,
            gastosReparacion: 0,
            gastos0105_0106Aplicados: 0,
            arrastresGenerados: 0,
            gastosComunidad: 0,
            gastosServicios: 0,
            gastosSuministros: 0,
            gastosSeguros: 0,
            gastosTributos: 0,
            amortizacionMuebles: 0,
            amortizacionInmueble: 0,
            valorCatastral: inm.valorCatastral,
            rendimientoNeto: 0,
            reduccion: 0,
            rendimientoNetoReducido: 0,
          },
          extras: {
            situacion: String(inm.situacion),
            urbana: inm.urbana,
          },
        })),
        arrastres: {
          gastos0105_0106: [],
          perdidasAhorro: [],
          gastosInmuebleDetalle: [],
        },
        paginasProcesadas: 0,
        totalCasillas: Object.keys(result.casillas).length,
      };

      setResultadoExtraccion(extraccion);
      setData((prev) => ({
        ...prev,
        ...mapearCasillasAImportacion(normalizedCasillas, ejercicioDetectado),
        ejercicio: ejercicioDetectado,
      }));

      try {
        const analisis = await analizarDeclaracionParaOnboarding(extraccion);
        setResultadoAnalisis(analisis);
      } catch (analysisError) {
        console.warn('Error analizando entidades detectadas en la declaración XML:', analysisError);
        setResultadoAnalisis(null);
      }

      toast.success(`XML importado: ${Object.keys(result.casillas).length} casillas extraídas`);
      setStep(3);
    } catch (error) {
      console.error('Error procesando XML AEAT', error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar el XML');
    }
  };

  const handleConfirmarImportacion = async () => {
    // Check for conflicts first — show review step if needed and not yet reviewed
    if (
      resultadoAnalisis
      && !showConflictReview
      && resultadoAnalisis.resumen.tieneConflictos
    ) {
      setShowConflictReview(true);
      return;
    }

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

        // Persist casillasRaw alongside the declaration for direct view access
        const casillasRawSanitizado = sanitizarParaIndexedDB(resultadoExtraccion.casillasRaw);

        await declararEjercicio(
          ejercicioImportacion,
          declaracionSanitizada,
          metodo === 'xml' ? 'xml_importado' : 'pdf_importado',
          resultadoExtraccion.meta.fechaPresentacion,
          pdfRef,
          casillasRawSanitizado,
        );

        // Sync con ejercicioResolverService (store coordinador)
        const casillasNumericas: Record<string, number> = {};
        for (const [k, v] of Object.entries(resultadoExtraccion.casillasRaw)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            casillasNumericas[k] = v;
          }
        }

        let inmuebleIdsCreados: number[] = [];

        if (resultadoAnalisis) {
          try {
            const resumenEjecucion = await ejecutarImportacion(resultadoAnalisis, {
              crearInmueblesNuevos: true,
              actualizarInmueblesExistentes: true,
              crearPrestamos: true,
              crearContratos: true,
              importarArrastres: true,
              guardarDeclaracion: false,
              guardarDatosPersonales: true,
              resolucionesConflicto: showConflictReview ? conflictResolutions : undefined,
            });

            inmuebleIdsCreados = resumenEjecucion.inmuebleIdsCreados ?? [];

            if (!resumenEjecucion.exito) {
              toast('Declaración importada, pero hubo incidencias creando entidades en ATLAS.', { icon: '⚠️' });
            }
          } catch (importError) {
            console.error('Error creando entidades detectadas durante la importación', importError);
            toast('Declaración importada, pero hubo un error creando inmuebles o contratos.', { icon: '⚠️' });
          }
        }

        // Registrar en el resolver coordinador (arrastres + inmuebles + estado)
        try {
          await importarDeclaracionAEAT({
            año: ejercicioImportacion,
            casillas: casillasNumericas,
            pdfDocumentId: pdfRef,
            inmuebleIds: inmuebleIdsCreados.length > 0 ? inmuebleIdsCreados : undefined,
          });
        } catch (resolverError) {
          console.warn('Error sincronizando con resolver coordinador:', resolverError);
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
    if (step !== 3 || !resultadoExtraccion?.exito || (metodo !== 'pdf' && metodo !== 'xml') || reconciliacionPreview || generandoReconciliacion) return undefined;

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

  const handleBack = () => {
    if (showConflictReview) {
      setShowConflictReview(false);
      return;
    }
    if (step === 1) {
      if (embedded && onBack) onBack();
      else onClose();
    } else {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const navigationFooter = showConflictReview ? null : (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={handleBack}
        style={embedded
          ? { background: 'transparent', color: 'var(--n-700)', border: 'none', borderRadius: 'var(--r-md, 10px)', padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }
          : { border: '1px solid var(--hz-neutral-300)', borderRadius: '14px', padding: '0.95rem 1.2rem', background: 'white', cursor: 'pointer', minWidth: '140px' }
        }
      >
        {step === 1 ? 'Cancelar' : 'Atrás'}
      </button>

      {step === 1 && (metodo === 'pdf' || metodo === 'xml') ? (
        <div style={{ color: 'var(--hz-neutral-700)', display: 'flex', alignItems: 'center', fontSize: '0.95rem' }}>
          {metodo === 'xml' ? 'Selecciona un XML para comenzar.' : 'Selecciona un PDF para comenzar.'}
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
  );

  const embeddedDropzoneStyle: React.CSSProperties = {
    border: '1.5px dashed var(--n-300)',
    borderRadius: 'var(--r-lg, 16px)',
    background: 'transparent',
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const embeddedBtnPrimary: React.CSSProperties = {
    background: 'var(--blue)', color: 'var(--white, #fff)',
    border: 'none', borderRadius: 'var(--r-md, 10px)',
    padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer',
  };

  const ejercicioSelectEmbedded = (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', fontSize: 'var(--t-sm, 0.875rem)', fontWeight: 500, color: 'var(--n-700)', marginBottom: '0.5rem' }}>
        Ejercicio fiscal
      </label>
      <select
        value={ejercicio}
        onChange={(event) => setEjercicio(Number(event.target.value))}
        style={{
          border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 10px)',
          padding: '0.5rem 0.75rem', fontSize: '0.9rem', color: 'var(--n-700)',
          background: 'white', outline: 'none',
        }}
      >
        {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index)
          .filter((year) => year >= 2020)
          .map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
      </select>
    </div>
  );

  // ── Embedded render (used inside unified wizard) ──────────
  if (embedded) {
    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {step === 1 && (
          <>
            {ejercicioSelectEmbedded}

            {metodo === 'xml' ? (
              <label htmlFor="aeat-xml-input-embedded" style={embeddedDropzoneStyle}>
                <input id="aeat-xml-input-embedded" type="file" accept=".xml" onChange={handleXmlFileUpload} style={{ display: 'none' }} />
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <Upload size={42} style={{ justifySelf: 'center', color: 'var(--n-300)' }} />
                  <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-500)', margin: 0 }}>
                    Arrastra el XML aquí o haz clic para seleccionar
                  </p>
                  <p style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-400)', margin: 0 }}>
                    DeclaVisor XML · Sede electrónica AEAT
                  </p>
                </div>
              </label>
            ) : metodo === 'pdf' ? (
              <label htmlFor="aeat-pdf-input-embedded" style={embeddedDropzoneStyle}>
                <input id="aeat-pdf-input-embedded" type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <Upload size={42} style={{ justifySelf: 'center', color: 'var(--n-300)' }} />
                  <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-500)', margin: 0 }}>
                    Arrastra el PDF aquí o haz clic para seleccionar
                  </p>
                  <p style={{ fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--n-400)', margin: 0 }}>
                    Modelo 100 · Ejercicios 2020 a 2025
                  </p>
                </div>
              </label>
            ) : (
              <div style={{ padding: '1rem', borderRadius: 'var(--r-md, 10px)', border: '1px solid var(--n-200)', background: 'var(--n-50)' }}>
                <p style={{ margin: 0, fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-500)' }}>
                  Continúa para introducir bases, cuotas, retenciones y arrastres manualmente.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => { if (onBack) onBack(); else onClose(); }} style={{ background: 'transparent', color: 'var(--n-700)', border: 'none', borderRadius: 'var(--r-md, 10px)', padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              {metodo === 'formulario' && (
                <button type="button" onClick={() => setStep(2)} style={embeddedBtnPrimary}>
                  Continuar
                </button>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {metodo === 'xml' ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent', margin: '0 auto 1.5rem' }} />
                <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-700)', margin: '0 0 1rem' }}>
                  Procesando XML de AEAT…
                </p>
              </div>
            ) : metodo === 'pdf' ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent', margin: '0 auto 1.5rem' }} />
                <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--n-700)', margin: '0 0 1rem' }}>
                  {progreso?.mensaje || 'Extrayendo casillas del Modelo 100…'}
                </p>
                {progresoPorcentaje !== undefined && (
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 6px)', height: '8px', overflow: 'hidden', maxWidth: '300px', margin: '0 auto' }}>
                    <div style={{ background: 'var(--blue)', height: '100%', borderRadius: 'var(--r-sm, 6px)', width: `${progresoPorcentaje}%`, transition: 'width 0.3s' }} />
                  </div>
                )}

                {resultadoExtraccion && !resultadoExtraccion.exito && (
                  <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', borderRadius: 'var(--r-md, 10px)', background: 'var(--s-neg-bg)', color: 'var(--s-neg)' }}>
                      <AlertTriangle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                      <div>
                        <strong>No se pudo extraer la declaración</strong>
                        <div style={{ marginTop: '0.2rem', fontSize: 'var(--t-sm, 0.875rem)' }}>{resultadoExtraccion.errores[0]}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMetodo('formulario'); setResultadoExtraccion(null); setResultadoAnalisis(null); setProgreso(null); setStep(2); }}
                      style={{ border: '1px solid var(--n-200)', borderRadius: 'var(--r-md, 10px)', padding: '0.75rem 1rem', background: 'white', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <strong style={{ color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>Continuar con formulario manual</strong>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <WizardForm data={data} onChange={handleDataPatch} />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', color: 'var(--n-700)', border: 'none', borderRadius: 'var(--r-md, 10px)', padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }}>
                Atrás
              </button>
              {metodo === 'formulario' && (
                <button type="button" disabled={!canContinueStep2} onClick={() => setStep(3)} style={{ ...embeddedBtnPrimary, opacity: !canContinueStep2 ? 0.5 : 1 }}>
                  Confirmar extracción
                </button>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {showConflictReview && resultadoAnalisis ? (
              <ConflictReviewStep
                analisis={resultadoAnalisis}
                resoluciones={conflictResolutions}
                onResolve={(campo, valor) => setConflictResolutions((prev) => ({ ...prev, [campo]: valor }))}
                onConfirm={handleConfirmarImportacion}
                onCancel={() => setShowConflictReview(false)}
                saving={saving}
              />
            ) : (
              <>
                {resultadoExtraccion?.exito ? (
                  <VerificacionExtraccion
                    resultado={resultadoExtraccion}
                    reconciliacion={reconciliacionPreview}
                    reconciliacionDisponible={Boolean(reconciliacion)}
                    onAbrirReconciliacion={() => setStep(4)}
                    avisoOrden={avisoOrden}
                    analisis={resultadoAnalisis}
                    fuenteImportacion={metodo === 'xml' ? 'xml' : 'pdf'}
                  />
                ) : (
                  <div style={{ padding: '1rem', borderRadius: 'var(--r-md, 10px)', border: '1px solid var(--n-200)' }}>
                    <strong style={{ color: 'var(--n-900)', fontSize: 'var(--t-sm, 0.875rem)' }}>Resumen manual</strong>
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
                  <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm, 0.875rem)' }}>
                    Generando la reconciliación con ATLAS…
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setStep(2)} style={{ background: 'transparent', color: 'var(--n-700)', border: 'none', borderRadius: 'var(--r-md, 10px)', padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }}>
                    Atrás
                  </button>
                  <button type="button" disabled={saving} onClick={handleConfirmarImportacion} style={embeddedBtnPrimary}>
                    {saving ? 'Importando…' : 'Importar y crear entidades'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Standalone render (original full-screen wizard) ───────
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
            {step === 1 && (metodo === 'xml' ? 'PASO 1 — SUBIR XML' : 'PASO 1 — SUBIR PDF')}
            {step === 2 && 'PASO 2 — PROCESANDO (AUTOMÁTICO)'}
            {(step === 3 || step === 4) && 'PASO 3 — CONFIRMAR E IMPORTAR'}
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setMetodo('xml')} style={{ ...actionButtonStyle, borderColor: metodo === 'xml' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)', borderRadius: '999px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--atlas-blue)' }} />
                  <strong>XML AEAT</strong>
                </button>
                <button type="button" onClick={() => setMetodo('pdf')} style={{ ...actionButtonStyle, borderColor: metodo === 'pdf' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)', borderRadius: '999px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} style={{ color: 'var(--atlas-blue)' }} />
                  <strong>PDF AEAT</strong>
                </button>
                <button type="button" onClick={() => setMetodo('formulario')} style={{ ...actionButtonStyle, borderColor: metodo === 'formulario' ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)', borderRadius: '999px', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--atlas-blue)' }} />
                  <strong>Formulario manual</strong>
                </button>
              </div>

              {metodo === 'xml' ? (
                <>
                  <label htmlFor="aeat-xml-input" style={uploadDropzoneStyle}>
                    <input id="aeat-xml-input" type="file" accept=".xml" onChange={handleXmlFileUpload} style={{ display: 'none' }} />
                    <div style={{ display: 'grid', gap: '0.9rem' }}>
                      <Upload size={42} style={{ justifySelf: 'center', color: '#C5D2E2' }} />
                      <strong style={{ fontSize: '1.15rem' }}>Arrastra el XML aquí o haz clic para seleccionar</strong>
                      <span style={{ color: 'var(--hz-neutral-700)' }}>DeclaVisor XML · Sede electrónica AEAT</span>
                    </div>
                  </label>
                  <p style={{ margin: 0, textAlign: 'center', color: 'var(--hz-neutral-700)' }}>
                    Importación determinista desde el XML de AEAT — sin OCR, sin ambigüedad.
                  </p>
                </>
              ) : metodo === 'pdf' ? (
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
                <p style={sectionSubtitleStyle}>
                  {showConflictReview
                    ? 'Revisa las diferencias encontradas antes de importar.'
                    : 'Revisa lo extraído y confirma qué crear en ATLAS.'}
                </p>
              </div>

              <div style={progressRailStyle}>
                {[1, 2, 3].map((item) => (
                  <div key={item} style={{ height: '5px', borderRadius: '999px', background: item === 3 ? '#27B7D6' : 'var(--atlas-blue)' }} />
                ))}
              </div>

              {showConflictReview && resultadoAnalisis ? (
                <ConflictReviewStep
                  analisis={resultadoAnalisis}
                  resoluciones={conflictResolutions}
                  onResolve={(campo, valor) => setConflictResolutions((prev) => ({ ...prev, [campo]: valor }))}
                  onConfirm={handleConfirmarImportacion}
                  onCancel={() => setShowConflictReview(false)}
                  saving={saving}
                />
              ) : (
                <>
                  {resultadoExtraccion?.exito ? (
                    <VerificacionExtraccion
                      resultado={resultadoExtraccion}
                      reconciliacion={reconciliacionPreview}
                      reconciliacionDisponible={Boolean(reconciliacion)}
                      onAbrirReconciliacion={() => setStep(4)}
                      analisis={resultadoAnalisis}
                      fuenteImportacion={metodo === 'xml' ? 'xml' : 'pdf'}
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
                </>
              )}
            </div>
          )}

          {navigationFooter}
        </div>
      </div>
    </div>
  );
};

export default ImportarDeclaracionWizard;
