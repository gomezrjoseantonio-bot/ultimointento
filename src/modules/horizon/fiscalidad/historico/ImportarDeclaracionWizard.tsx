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
import type { DatosActivosExtraidos } from '../../../../services/declaracionFromCasillasService';
import type { DeclaracionIRPF as DeclaracionCalculadaIRPF } from '../../../../services/irpfCalculationService';
import { importarDeclaracionManual } from '../../../../services/fiscalLifecycleService';

type MetodoEntrada = 'formulario' | 'pdf';
type VerificationTab = 'personal' | 'trabajo' | 'inmuebles' | 'actividad' | 'capital' | 'bases' | 'arrastres' | 'raw';

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
  width: 'min(1120px, 100%)',
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

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid',
  borderColor: active ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)',
  borderRadius: '999px',
  background: active ? 'rgba(24, 95, 165, 0.10)' : 'white',
  color: active ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)',
  padding: '0.5rem 0.9rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
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

const VerificacionExtraccion: React.FC<{ resultado: ExtraccionCompleta }> = ({ resultado }) => {
  const [tab, setTab] = useState<VerificationTab>('personal');
  const { declaracion, casillasRaw, inmueblesDetalle, arrastres, meta } = resultado;

  const tabs: Array<{ key: VerificationTab; label: string }> = [
    { key: 'personal', label: 'Personal' },
    { key: 'trabajo', label: 'Trabajo' },
    { key: 'inmuebles', label: `Inmuebles (${inmueblesDetalle.length})` },
    { key: 'actividad', label: `Actividad (${declaracion.actividades.length})` },
    { key: 'capital', label: 'Capital / G-P' },
    { key: 'bases', label: 'Bases y cuotas' },
    { key: 'arrastres', label: 'Arrastres' },
    { key: 'raw', label: 'Raw (debug)' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={summaryGridStyle}>
        <KpiCard label="Casillas extraídas" value={resultado.totalCasillas} />
        <KpiCard label="Resultado" value={formatCurrency(declaracion.basesYCuotas.resultadoDeclaracion)} />
        <KpiCard label="Inmuebles" value={inmueblesDetalle.length} />
        <KpiCard label="Arrastres" value={arrastres.gastos0105_0106.length + arrastres.perdidasAhorro.length} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {tabs.map((item) => (
          <button key={item.key} type="button" style={tabButtonStyle(tab === item.key)} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '14px', padding: '1rem', background: 'white' }}>
        {tab === 'personal' && (
          <KeyValueGrid rows={[
            { label: 'Ejercicio', value: meta.ejercicio },
            { label: 'Modelo', value: meta.modelo },
            { label: 'NIF', value: meta.nif },
            { label: 'Nombre', value: meta.nombre },
            { label: 'Estado civil', value: declaracion.personal?.estadoCivil },
            { label: 'Comunidad autónoma', value: declaracion.personal?.comunidadAutonoma },
            { label: 'Fecha nacimiento', value: declaracion.personal?.fechaNacimiento },
            { label: 'Presentación', value: meta.fechaPresentacion },
            { label: 'Justificante', value: meta.numeroJustificante },
            { label: 'CSV', value: meta.codigoVerificacion },
          ]} />
        )}

        {tab === 'trabajo' && (
          <KeyValueGrid rows={[
            { label: 'Retribuciones dinerarias', value: formatCurrency(declaracion.trabajo.retribucionesDinerarias) },
            { label: 'Retribución en especie', value: formatCurrency(declaracion.trabajo.retribucionEspecie) },
            { label: 'Ingresos a cuenta', value: formatCurrency(declaracion.trabajo.ingresosACuenta) },
            { label: 'Contribuciones PP empresa', value: formatCurrency(declaracion.trabajo.contribucionesPPEmpresa) },
            { label: 'Total ingresos íntegros', value: formatCurrency(declaracion.trabajo.totalIngresosIntegros) },
            { label: 'Cotización SS', value: formatCurrency(declaracion.trabajo.cotizacionSS) },
            { label: 'Rendimiento neto', value: formatCurrency(declaracion.trabajo.rendimientoNeto) },
            { label: 'Rendimiento neto reducido', value: formatCurrency(declaracion.trabajo.rendimientoNetoReducido) },
            { label: 'Retenciones trabajo', value: formatCurrency(declaracion.trabajo.retencionesTrabajoTotal) },
          ]} />
        )}

        {tab === 'inmuebles' && (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {inmueblesDetalle.length === 0 ? <p style={{ margin: 0 }}>No se detectaron inmuebles.</p> : inmueblesDetalle.map((inmueble) => (
              <div key={inmueble.datos.orden} style={{ border: '1px solid var(--hz-neutral-200)', borderRadius: '12px', padding: '1rem', background: 'var(--hz-neutral-100)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>Inmueble {inmueble.datos.orden}</strong>
                  <span style={{ color: 'var(--hz-neutral-700)' }}>{inmueble.datos.uso}</span>
                </div>
                <KeyValueGrid rows={[
                  { label: 'Referencia catastral', value: inmueble.datos.referenciaCatastral },
                  { label: 'Dirección', value: inmueble.datos.direccion },
                  { label: 'Propiedad', value: `${inmueble.datos.porcentajePropiedad}%` },
                  { label: 'Días arrendado', value: inmueble.datos.diasArrendado },
                  { label: 'Días a disposición', value: inmueble.datos.diasDisposicion },
                  { label: 'Ingresos íntegros', value: formatCurrency(inmueble.datos.ingresosIntegros) },
                  { label: 'Arrastres generados', value: formatCurrency(inmueble.datos.arrastresGenerados) },
                  { label: 'Amortización inmueble', value: formatCurrency(inmueble.datos.amortizacionInmueble) },
                  { label: 'Amortización muebles', value: formatCurrency(inmueble.datos.amortizacionMuebles) },
                  { label: 'Rendimiento neto', value: formatCurrency(inmueble.datos.rendimientoNeto) },
                  { label: 'Reducción', value: formatCurrency(inmueble.datos.reduccion) },
                  { label: 'Rendimiento neto reducido', value: formatCurrency(inmueble.datos.rendimientoNetoReducido) },
                  { label: 'Situación', value: inmueble.extras.situacion },
                  { label: 'Urbana', value: inmueble.extras.urbana ? 'Sí' : 'No' },
                ]} />
              </div>
            ))}
          </div>
        )}

        {tab === 'actividad' && (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {declaracion.actividades.length === 0 ? <p style={{ margin: 0 }}>No se detectaron actividades económicas.</p> : declaracion.actividades.map((actividad, index) => (
              <div key={`${actividad.epigrafeIAE}-${index}`} style={{ border: '1px solid var(--hz-neutral-200)', borderRadius: '12px', padding: '1rem', background: 'var(--hz-neutral-100)' }}>
                <KeyValueGrid rows={[
                  { label: 'Epígrafe IAE', value: actividad.epigrafeIAE },
                  { label: 'Tipo actividad', value: actividad.tipoActividad },
                  { label: 'Modalidad', value: actividad.modalidad },
                  { label: 'Ingresos', value: formatCurrency(actividad.ingresos) },
                  { label: 'Gastos', value: formatCurrency(actividad.gastos) },
                  { label: 'Provisión DJ', value: formatCurrency(actividad.provisionDificilJustificacion) },
                  { label: 'Rendimiento neto', value: formatCurrency(actividad.rendimientoNeto) },
                  { label: 'Rendimiento neto reducido', value: formatCurrency(actividad.rendimientoNetoReducido) },
                  { label: 'Retenciones', value: formatCurrency(actividad.retencionesActividad) },
                ]} />
              </div>
            ))}
          </div>
        )}

        {tab === 'capital' && (
          <KeyValueGrid rows={[
            { label: 'Intereses cuentas', value: formatCurrency(declaracion.capitalMobiliario.interesesCuentas) },
            { label: 'Otros rendimientos', value: formatCurrency(declaracion.capitalMobiliario.otrosRendimientos) },
            { label: 'Total ingresos íntegros', value: formatCurrency(declaracion.capitalMobiliario.totalIngresosIntegros) },
            { label: 'Rendimiento neto', value: formatCurrency(declaracion.capitalMobiliario.rendimientoNeto) },
            { label: 'Retenciones capital', value: formatCurrency(declaracion.capitalMobiliario.retencionesCapital) },
            { label: 'Ganancias no transmisión', value: formatCurrency(declaracion.gananciasPerdidas.gananciasNoTransmision) },
            { label: 'Ganancias transmisión', value: formatCurrency(declaracion.gananciasPerdidas.gananciasTransmision) },
            { label: 'Pérdidas transmisión', value: formatCurrency(declaracion.gananciasPerdidas.perdidasTransmision) },
            { label: 'Saldo neto ahorro', value: formatCurrency(declaracion.gananciasPerdidas.saldoNetoAhorro) },
          ]} />
        )}

        {tab === 'bases' && (
          <KeyValueGrid rows={[
            { label: 'Base imponible general', value: formatCurrency(declaracion.basesYCuotas.baseImponibleGeneral) },
            { label: 'Base imponible ahorro', value: formatCurrency(declaracion.basesYCuotas.baseImponibleAhorro) },
            { label: 'Base liquidable general', value: formatCurrency(declaracion.basesYCuotas.baseLiquidableGeneral) },
            { label: 'Base liquidable ahorro', value: formatCurrency(declaracion.basesYCuotas.baseLiquidableAhorro) },
            { label: 'Cuota íntegra estatal', value: formatCurrency(declaracion.basesYCuotas.cuotaIntegraEstatal) },
            { label: 'Cuota íntegra autonómica', value: formatCurrency(declaracion.basesYCuotas.cuotaIntegraAutonomica) },
            { label: 'Cuota líquida estatal', value: formatCurrency(declaracion.basesYCuotas.cuotaLiquidaEstatal) },
            { label: 'Cuota líquida autonómica', value: formatCurrency(declaracion.basesYCuotas.cuotaLiquidaAutonomica) },
            { label: 'Cuota resultante', value: formatCurrency(declaracion.basesYCuotas.cuotaResultante) },
            { label: 'Retenciones total', value: formatCurrency(declaracion.basesYCuotas.retencionesTotal) },
            { label: 'Cuota diferencial', value: formatCurrency(declaracion.basesYCuotas.cuotaDiferencial) },
            { label: 'Resultado declaración', value: formatCurrency(declaracion.basesYCuotas.resultadoDeclaracion) },
          ]} />
        )}

        {tab === 'arrastres' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <strong style={{ color: 'var(--atlas-navy-1)' }}>Gastos 0105/0106</strong>
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.6rem' }}>
                {arrastres.gastos0105_0106.length === 0 ? <p style={{ margin: 0 }}>Sin arrastres de gastos detectados.</p> : arrastres.gastos0105_0106.map((item) => (
                  <div key={`${item.referenciaCatastral}-${item.ejercicioOrigen}`} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--hz-neutral-100)' }}>
                    Inmueble {item.referenciaCatastral}: inicio {formatCurrency(item.pendienteInicio)} · aplicado {formatCurrency(item.aplicadoEstaDeclaracion)} · pendiente {formatCurrency(item.pendienteFuturo)} · generado {formatCurrency(item.generadoEsteEjercicio)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--atlas-navy-1)' }}>Pérdidas pendientes</strong>
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.6rem' }}>
                {arrastres.perdidasAhorro.length === 0 ? <p style={{ margin: 0 }}>Sin pérdidas pendientes detectadas.</p> : arrastres.perdidasAhorro.map((item) => (
                  <div key={`${item.tipo}-${item.ejercicioOrigen}`} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--hz-neutral-100)' }}>
                    {item.tipo} {item.ejercicioOrigen}: inicio {formatCurrency(item.pendienteInicio)} · aplicado {formatCurrency(item.aplicado)} · pendiente futuro {formatCurrency(item.pendienteFuturo)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--atlas-navy-1)' }}>Detalle de gastos por inmueble</strong>
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.6rem' }}>
                {arrastres.gastosInmuebleDetalle.length === 0 ? <p style={{ margin: 0 }}>Sin detalle adicional de gastos.</p> : arrastres.gastosInmuebleDetalle.map((item) => (
                  <div key={item.referenciaCatastral} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--hz-neutral-100)' }}>
                    {item.referenciaCatastral}: proveedor {item.nifProveedor || '—'} · gasto {formatCurrency(item.importeGasto)} · servicios personales {formatCurrency(item.importeServiciosPersonales)} · mejora {formatCurrency(item.importeMejora)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'raw' && (
          <pre style={{ margin: 0, fontSize: '11px', maxHeight: '420px', overflow: 'auto', background: '#081225', color: '#D8F1FF', borderRadius: '12px', padding: '1rem' }}>
            {JSON.stringify(casillasRaw, null, 2)}
          </pre>
        )}
      </div>
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

function construirCasillasAeat(raw: Record<string, number | string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
  ) as Record<string, number>;
}

function construirDeclaracionCalculada(resultado: ExtraccionCompleta): DeclaracionCalculadaIRPF {
  const { declaracion, meta } = resultado;

  const rendimientosTrabajo = declaracion.trabajo.totalIngresosIntegros > 0
    || declaracion.trabajo.retribucionesDinerarias > 0
    || declaracion.trabajo.retencionesTrabajoTotal > 0
      ? {
          salarioBrutoAnual: declaracion.trabajo.retribucionesDinerarias,
          especieAnual: declaracion.trabajo.retribucionEspecie,
          cotizacionSS: declaracion.trabajo.cotizacionSS,
          irpfRetenido: declaracion.trabajo.retencionesTrabajoTotal,
          rendimientoNeto: declaracion.trabajo.rendimientoNetoReducido || declaracion.trabajo.rendimientoNeto,
          ppEmpleado: declaracion.planPensiones.aportacionesTrabajador,
          ppEmpresa: declaracion.planPensiones.contribucionesEmpresariales,
          ppTotalReduccion: declaracion.planPensiones.totalConDerecho
            || declaracion.planPensiones.aportacionesTrabajador + declaracion.planPensiones.contribucionesEmpresariales,
        }
      : null;

  const rendimientosAutonomo = declaracion.actividades.length > 0
    ? {
        ingresos: declaracion.actividades.reduce((sum, actividad) => sum + actividad.ingresos, 0),
        gastos: declaracion.actividades.reduce((sum, actividad) => sum + actividad.gastos, 0),
        cuotaSS: 0,
        gastoDificilJustificacion: declaracion.actividades.reduce((sum, actividad) => sum + (actividad.provisionDificilJustificacion || 0), 0),
        rendimientoNeto: declaracion.actividades.reduce((sum, actividad) => sum + actividad.rendimientoNetoReducido, 0),
        pagosFraccionadosM130: 0,
        actividades: declaracion.actividades.map((actividad) => ({
          nombre: actividad.epigrafeIAE || actividad.tipoActividad,
          epigrafe: actividad.epigrafeIAE,
          tipo: actividad.tipoActividad,
          modalidad: actividad.modalidad,
          ingresos: actividad.ingresos,
          gastos: actividad.gastos,
          cuotaSS: 0,
        })),
      }
    : null;

  const rendimientosInmuebles = resultado.inmueblesDetalle.map((inmueble) => {
    const gastosDeducibles =
      inmueble.datos.gastosComunidad +
      inmueble.datos.gastosServicios +
      inmueble.datos.gastosSuministros +
      inmueble.datos.gastosSeguros +
      inmueble.datos.gastosTributos +
      inmueble.datos.interesesFinanciacion +
      inmueble.datos.gastosReparacion +
      inmueble.datos.gastos0105_0106Aplicados;
    const amortizacion =
      inmueble.datos.amortizacionInmueble +
      inmueble.datos.amortizacionMuebles +
      (inmueble.datos.accesorio?.amortizacion || 0);
    const rendimientoNetoAlquiler = inmueble.datos.rendimientoNeto || Math.max(0, inmueble.datos.ingresosIntegros - gastosDeducibles - amortizacion);
    const reduccionHabitual = inmueble.datos.reduccion;
    const rendimientoNetoReducido = inmueble.datos.rendimientoNetoReducido || (rendimientoNetoAlquiler - reduccionHabitual);

    return {
      inmuebleId: inmueble.datos.orden,
      alias: inmueble.datos.direccion || `Inmueble ${inmueble.datos.orden}`,
      diasAlquilado: inmueble.datos.diasArrendado || 0,
      diasVacio: inmueble.datos.diasDisposicion || 0,
      diasEnObras: 0,
      diasTotal: 365,
      ingresosIntegros: inmueble.datos.ingresosIntegros || 0,
      gastosDeducibles,
      amortizacion,
      reduccionHabitual,
      rendimientoNetoAlquiler,
      rendimientoNetoReducido,
      porcentajeReduccionHabitual: rendimientoNetoAlquiler > 0 && reduccionHabitual > 0
        ? Math.round((reduccionHabitual / rendimientoNetoAlquiler) * 10000) / 100
        : 0,
      esHabitual: reduccionHabitual > 0,
      imputacionRenta: inmueble.datos.rentaImputada || 0,
      rendimientoNeto: rendimientoNetoReducido + (inmueble.datos.rentaImputada || 0),
      gastosFinanciacionYReparacion: inmueble.datos.interesesFinanciacion + inmueble.datos.gastosReparacion,
      limiteAplicado: inmueble.datos.gastos0105_0106Aplicados || undefined,
      excesoArrastrable: inmueble.datos.arrastresGenerados || undefined,
      arrastresAplicados: inmueble.datos.arrastresAplicados || undefined,
      accesoriosIncluidos: inmueble.datos.accesorio
        ? [{
            id: inmueble.datos.orden,
            alias: `${inmueble.datos.direccion || `Inmueble ${inmueble.datos.orden}`} · accesorio`,
            amortizacion: inmueble.datos.accesorio.amortizacion || 0,
            gastos: 0,
          }]
        : undefined,
    };
  });

  const baseAhorroCapitalTotal = declaracion.capitalMobiliario.rendimientoNetoReducido || declaracion.capitalMobiliario.rendimientoNeto;
  const plusvalias = declaracion.gananciasPerdidas.gananciasTransmision || declaracion.gananciasPerdidas.gananciasNoTransmision;
  const minusvalias = declaracion.gananciasPerdidas.perdidasTransmision + declaracion.gananciasPerdidas.perdidasNoTransmision;

  return {
    ejercicio: meta.ejercicio,
    baseGeneral: {
      rendimientosTrabajo,
      rendimientosAutonomo,
      rendimientosInmuebles,
      imputacionRentas: rendimientosInmuebles
        .filter((inmueble) => inmueble.imputacionRenta > 0)
        .map((inmueble) => ({
          inmuebleId: inmueble.inmuebleId,
          alias: inmueble.alias,
          valorCatastral: 0,
          porcentajeImputacion: 0,
          diasVacio: inmueble.diasVacio,
          imputacion: inmueble.imputacionRenta,
        })),
      total: declaracion.basesYCuotas.baseImponibleGeneral,
    },
    baseAhorro: {
      capitalMobiliario: {
        intereses: declaracion.capitalMobiliario.interesesCuentas,
        dividendos: Math.max(0, declaracion.capitalMobiliario.otrosRendimientos),
        retenciones: declaracion.capitalMobiliario.retencionesCapital,
        total: baseAhorroCapitalTotal,
      },
      gananciasYPerdidas: {
        plusvalias,
        minusvalias,
        minusvaliasPendientes: declaracion.gananciasPerdidas.perdidasPendientes.reduce((sum, perdida) => sum + perdida.importePendiente, 0),
        compensado: declaracion.gananciasPerdidas.saldoNetoAhorro,
      },
      total: declaracion.basesYCuotas.baseImponibleAhorro,
    },
    reducciones: {
      ppEmpleado: declaracion.planPensiones.aportacionesTrabajador,
      ppEmpresa: declaracion.planPensiones.contribucionesEmpresariales,
      ppIndividual: 0,
      planPensiones: declaracion.planPensiones.totalConDerecho,
      total: declaracion.planPensiones.totalConDerecho || declaracion.planPensiones.reduccionAplicada,
    },
    minimoPersonal: {
      contribuyente: 0,
      descendientes: 0,
      ascendientes: 0,
      discapacidad: 0,
      total: 0,
    },
    liquidacion: {
      baseImponibleGeneral: declaracion.basesYCuotas.baseImponibleGeneral,
      baseImponibleAhorro: declaracion.basesYCuotas.baseImponibleAhorro,
      cuotaBaseGeneral: declaracion.basesYCuotas.cuotaIntegraEstatal,
      cuotaBaseAhorro: declaracion.basesYCuotas.cuotaIntegraAutonomica,
      cuotaMinimosBaseGeneral: 0,
      cuotaIntegra: declaracion.basesYCuotas.cuotaIntegra,
      deduccionesDobleImposicion: 0,
      cuotaLiquida: declaracion.basesYCuotas.cuotaLiquida,
    },
    retenciones: {
      trabajo: declaracion.trabajo.retencionesTrabajoTotal,
      autonomoM130: 0,
      capitalMobiliario: declaracion.capitalMobiliario.retencionesCapital,
      total: declaracion.basesYCuotas.retencionesTotal,
    },
    resultado: declaracion.basesYCuotas.resultadoDeclaracion,
    tipoEfectivo: (declaracion.basesYCuotas.baseImponibleGeneral + declaracion.basesYCuotas.baseImponibleAhorro) > 0
      ? Number(((declaracion.basesYCuotas.cuotaLiquida / Math.max(1, declaracion.basesYCuotas.baseImponibleGeneral + declaracion.basesYCuotas.baseImponibleAhorro)) * 100).toFixed(2))
      : 0,
  };
}

function construirDatosActivos(resultado: ExtraccionCompleta): DatosActivosExtraidos {
  return {
    arrastresGastos: resultado.inmueblesDetalle
      .filter((inmueble) => inmueble.datos.arrastresGenerados > 0 && inmueble.datos.referenciaCatastral)
      .map((inmueble) => ({
        inmuebleRefCatastral: inmueble.datos.referenciaCatastral,
        importeArrastrable: inmueble.datos.arrastresGenerados,
        ejercicioOrigen: resultado.meta.ejercicio,
      })),
    perdidasPendientes: resultado.arrastres.perdidasAhorro
      .filter((item) => item.pendienteFuturo > 0)
      .map((item) => ({
        ejercicioOrigen: item.ejercicioOrigen,
        importePendiente: item.pendienteFuturo,
        tipo: 'ahorro' as const,
      })),
    amortizacionesPorInmueble: resultado.inmueblesDetalle
      .filter((inmueble) => inmueble.datos.referenciaCatastral)
      .map((inmueble) => ({
        refCatastral: inmueble.datos.referenciaCatastral,
        baseAmortizacion: inmueble.datos.baseAmortizacion || 0,
        amortizacionEjercicio: inmueble.datos.amortizacionInmueble || 0,
        amortizacionMuebles: inmueble.datos.amortizacionMuebles || 0,
        amortizacionAccesorio: inmueble.datos.accesorio?.amortizacion || 0,
      })),
    inmueblesDatos: resultado.inmueblesDetalle
      .filter((inmueble) => inmueble.datos.referenciaCatastral)
      .map((inmueble) => ({
        refCatastral: inmueble.datos.referenciaCatastral,
        valorCatastral: inmueble.datos.valorCatastral || 0,
        valorCatastralConstruccion: inmueble.datos.valorCatastralConstruccion || 0,
        porcentajeConstruccion: inmueble.datos.porcentajeConstruccion || 0,
        importeAdquisicion: inmueble.datos.importeAdquisicion || 0,
        gastosAdquisicion: inmueble.datos.gastosAdquisicion || 0,
        mejoras: inmueble.datos.mejoras || 0,
      })),
  };
}

const ImportarDeclaracionWizard: React.FC<ImportarDeclaracionWizardProps> = ({ onClose, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ejercicio, setEjercicio] = useState(currentYear - 1);
  const [metodo, setMetodo] = useState<MetodoEntrada>('formulario');
  const [data, setData] = useState<ImportacionManualData>(() => crearImportacionManualVacia(currentYear - 1));
  const [casillasExtraidas, setCasillasExtraidas] = useState<CasillaExtraida[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<ProgresoParseo | null>(null);
  const [resultadoExtraccion, setResultadoExtraccion] = useState<ExtraccionCompleta | null>(null);
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
    setResultadoExtraccion(null);
    setCasillasExtraidas([]);

    try {
      const extraccion = await parsearDeclaracionAEAT(file, (progress) => setProgreso(progress));
      setResultadoExtraccion(extraccion);

      if (!extraccion.exito) {
        toast.error(extraccion.errores[0] || 'No se pudo procesar el PDF');
        return;
      }

      const normalizedCasillas = normalizarCasillasExtraidas(extraccion.casillasRaw);
      setCasillasExtraidas(normalizedCasillas);
      setEjercicio(extraccion.meta.ejercicio || ejercicio);
      setData((prev) => ({
        ...prev,
        ...mapearCasillasAImportacion(normalizedCasillas, extraccion.meta.ejercicio || ejercicio),
        ejercicio: extraccion.meta.ejercicio || ejercicio,
        arrastres: [
          ...extraccion.arrastres.gastos0105_0106.map((item) => ({
            tipo: 'gastos_0105_0106' as const,
            ejercicioOrigen: item.ejercicioOrigen || extraccion.meta.ejercicio,
            importe: item.pendienteFuturo || item.generadoEsteEjercicio,
          })),
          ...extraccion.arrastres.perdidasAhorro.map((item) => ({
            tipo: 'perdidas_patrimoniales_ahorro' as const,
            ejercicioOrigen: item.ejercicioOrigen,
            importe: item.pendienteFuturo,
          })),
        ],
      }));

      toast.success(`${extraccion.totalCasillas} casillas extraídas automáticamente`);
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
      setParsing(false);
      setProgreso(null);
    }
  };

  const handleConfirmarImportacion = async () => {
    setSaving(true);
    try {
      const casillasMap = resultadoExtraccion?.exito
        ? construirCasillasAeat(resultadoExtraccion.casillasRaw)
        : casillasExtraidas.length > 0
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

      const declaracionCompleta = resultadoExtraccion?.exito
        ? construirDeclaracionCalculada(resultadoExtraccion)
        : undefined;

      await importarDeclaracionManual({
        ejercicio: data.ejercicio,
        casillasAEAT: casillasMap,
        resultado: {
          baseImponibleGeneral: declaracionCompleta?.liquidacion.baseImponibleGeneral ?? data.baseImponibleGeneral,
          baseImponibleAhorro: declaracionCompleta?.liquidacion.baseImponibleAhorro ?? data.baseImponibleAhorro,
          cuotaIntegra: declaracionCompleta?.liquidacion.cuotaIntegra ?? resumen.cuotaIntegra,
          cuotaLiquida: declaracionCompleta?.liquidacion.cuotaLiquida ?? resumen.cuotaLiquida,
          deducciones: 0,
          retencionesYPagosCuenta: declaracionCompleta?.retenciones.total ?? data.totalRetenciones,
          resultado: declaracionCompleta?.resultado ?? data.resultado,
          tipoEfectivo: declaracionCompleta
            ? declaracionCompleta.tipoEfectivo
            : (resumen.cuotaLiquida > 0
                ? Number((((resumen.cuotaLiquida / Math.max(1, data.baseImponibleGeneral + data.baseImponibleAhorro)) * 100)).toFixed(2))
                : 0),
        },
        declaracionCompleta,
        datosActivos: resultadoExtraccion?.exito ? construirDatosActivos(resultadoExtraccion) : undefined,
        arrastresPendientes: resultadoExtraccion?.exito
          ? [
              ...resultadoExtraccion.arrastres.gastos0105_0106.map((item) => ({
                tipo: 'gastos_0105_0106' as const,
                importePendiente: item.pendienteFuturo || item.generadoEsteEjercicio,
                ejercicioOrigen: item.ejercicioOrigen || data.ejercicio,
                ejercicioCaducidad: (item.ejercicioOrigen || data.ejercicio) + 4,
              })),
              ...resultadoExtraccion.arrastres.perdidasAhorro.map((item) => ({
                tipo: 'perdidas_patrimoniales_ahorro' as const,
                importePendiente: item.pendienteFuturo,
                ejercicioOrigen: item.ejercicioOrigen,
                ejercicioCaducidad: item.ejercicioOrigen + 4,
              })),
            ]
          : (data.arrastres ?? []).map((arrastre) => ({
              tipo: arrastre.tipo,
              importePendiente: arrastre.importe,
              ejercicioOrigen: arrastre.ejercicioOrigen,
              ejercicioCaducidad: arrastre.ejercicioOrigen + 4,
            })),
        notasRevision: metodo === 'pdf'
          ? 'Importación desde PDF Modelo 100 usando Claude Vision'
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
            casillasExtraidas: resultadoExtraccion?.totalCasillas ?? casillasExtraidas.length,
            metodoExtraccion: metodo === 'pdf' ? 'ocr' : 'texto',
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

  const canContinueStep2 = metodo === 'formulario'
    || Boolean(resultadoExtraccion?.exito)
    || data.baseImponibleGeneral !== 0
    || data.totalRetenciones !== 0
    || data.resultado !== 0;

  const progresoPorcentaje = progreso?.totalPaginas
    ? Math.min(100, Math.round(((progreso.pagina || 0) / progreso.totalPaginas) * 100))
    : undefined;

  return (
    <div style={overlayStyle} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--hz-neutral-300)' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--atlas-navy-1)' }}>Importar declaración IRPF</h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--hz-neutral-700)' }}>
              Alimenta el histórico fiscal con declaraciones presentadas o PDFs del Modelo 100 a partir de 2020.
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
                  {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index)
                    .filter((year) => year >= 2020)
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <span style={{ fontSize: '0.85rem', color: 'var(--hz-neutral-700)' }}>ATLAS solo importa histórico desde 2020.</span>
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
                    <span style={{ color: 'var(--hz-neutral-700)' }}>Renderiza el PDF, analiza todas las páginas con Claude y te deja validar el resultado.</span>
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

                  {parsing && progreso && (
                    <div style={{ display: 'grid', gap: '0.65rem', padding: '1rem', borderRadius: '12px', background: 'white', border: '1px solid rgba(24, 95, 165, 0.18)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>{progreso.mensaje}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--hz-neutral-700)', textTransform: 'capitalize' }}>{progreso.fase}</div>
                        </div>
                      </div>
                      {typeof progresoPorcentaje === 'number' && (
                        <div style={{ height: '6px', background: '#dfe6ee', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progresoPorcentaje}%`, background: 'var(--atlas-blue)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {resultadoExtraccion && !resultadoExtraccion.exito && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', borderRadius: '12px', background: '#FDECEC', color: '#8B1E1E' }}>
                      <AlertTriangle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                      <div>
                        <strong>No se pudo extraer la declaración</strong>
                        <div style={{ marginTop: '0.2rem' }}>{resultadoExtraccion.errores[0]}</div>
                      </div>
                    </div>
                  )}

                  {resultadoExtraccion?.exito && (
                    <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'white', border: '1px solid var(--hz-neutral-300)' }}>
                      <div style={summaryGridStyle}>
                        <KpiCard label="Casillas" value={resultadoExtraccion.totalCasillas} />
                        <KpiCard label="Páginas" value={resultadoExtraccion.paginasProcesadas} />
                        <KpiCard label="Ejercicio" value={resultadoExtraccion.meta.ejercicio} />
                        <KpiCard label="Resultado" value={formatCurrency(resultadoExtraccion.declaracion.basesYCuotas.resultadoDeclaracion)} />
                      </div>
                      {resultadoExtraccion.warnings.length > 0 && (
                        <div style={{ background: '#FAEEDA', padding: '12px', borderRadius: '8px', marginTop: '0.25rem' }}>
                          <p style={{ fontWeight: 700, margin: 0, marginBottom: '0.4rem' }}>Avisos</p>
                          {resultadoExtraccion.warnings.map((warning, index) => (
                            <p key={`${warning}-${index}`} style={{ margin: '0.2rem 0', fontSize: '13px' }}>⚠ {warning}</p>
                          ))}
                        </div>
                      )}
                    </div>
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
                <div style={summaryGridStyle}>
                  <div><strong>Ejercicio</strong><div>{data.ejercicio}</div></div>
                  <div><strong>Base general</strong><div>{formatCurrency(resultadoExtraccion?.declaracion.basesYCuotas.baseImponibleGeneral ?? data.baseImponibleGeneral)}</div></div>
                  <div><strong>Retenciones</strong><div>{formatCurrency(resultadoExtraccion?.declaracion.basesYCuotas.retencionesTotal ?? data.totalRetenciones)}</div></div>
                  <div><strong>Resultado</strong><div>{formatCurrency(resultadoExtraccion?.declaracion.basesYCuotas.resultadoDeclaracion ?? data.resultado)}</div></div>
                </div>
              </div>

              {resultadoExtraccion?.exito ? (
                <VerificacionExtraccion resultado={resultadoExtraccion} />
              ) : casillasExtraidas.length > 0 ? (
                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--hz-neutral-300)' }}>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>Casillas detectadas</strong>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {casillasExtraidas.slice(0, 24).map((casilla) => (
                      <span key={casilla.numero} style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', background: 'var(--hz-neutral-100)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem' }}>
                        {casilla.numero}: {casilla.valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
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
