import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CardV5,
  MoneyValue,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { computeBudgetProjection12mAsync, type BudgetProjection } from '../services/budgetProjection';
import {
  getSeriePatrimonio,
  invalidateProyeccionCache,
} from '../../horizon/proyeccion/mensual/services/proyeccionMensualService';
import type { PuntoPatrimonioAnual } from '../../horizon/proyeccion/mensual/types/proyeccionMensual';
import CurvaPatrimonio from '../../../components/proyeccion/CurvaPatrimonio';
import SupuestosPanel from '../components/SupuestosPanel';
import {
  getSupuestosProyeccion,
  saveSupuestosProyeccion,
} from '../../../services/escenariosService';
import type { SupuestosProyeccion } from '../../../types/supuestosProyeccion';
import { listarCompromisos } from '../../../services/personal/compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { useProyeccionLibertad } from '../../../hooks/useProyeccionLibertad';

const formatYearLabel = (year: number) => `${year}`;

const ProyeccionPage: React.FC = () => {
  const year = new Date().getFullYear();
  const [projection, setProjection] = useState<BudgetProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [serie, setSerie] = useState<PuntoPatrimonioAnual[] | null>(null);

  // ── Supuestos (B5) · los mandos de la curva · fuente única B1 ─────────────
  // `supuestos` = valor instantáneo de los sliders (UI) · `aplicados` = valor
  // con debounce ya persistido, que alimenta motor y libertad.
  const [supuestos, setSupuestos] = useState<SupuestosProyeccion | null>(null);
  const [aplicados, setAplicados] = useState<SupuestosProyeccion | null>(null);
  const [compromisos, setCompromisos] = useState<CompromisoRecurrente[]>([]);
  const [recalculando, setRecalculando] = useState(false);
  const pendingRef = useRef<Partial<SupuestosProyeccion>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Patrimonio a 20 años (C-PROY-5 · B4/B5) · LA misma salida canónica que
  // leen el héroe del Panel y /proyeccion/escenarios.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSeriePatrimonio(),
      getSupuestosProyeccion(),
      listarCompromisos({ ambito: 'inmueble', soloActivos: true }).catch(
        () => [] as CompromisoRecurrente[],
      ),
    ])
      .then(([s, sup, comps]) => {
        if (cancelled) return;
        setSerie(s);
        setSupuestos(sup);
        setAplicados(sup);
        setCompromisos(comps);
      })
      .catch(() => {
        if (!cancelled) setSerie(null);
      });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Un mando se mueve: la UI responde al instante · a los 500 ms se persiste
  // el patch (solo lo tocado · los defaults siguen siendo visibles como
  // defaults), se invalida la caché del motor y la curva se recalcula.
  const onCambioSupuesto = (campo: keyof SupuestosProyeccion, valor: number) => {
    setSupuestos((prev) => (prev ? { ...prev, [campo]: valor } : prev));
    pendingRef.current[campo] = valor;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const patch = pendingRef.current;
      pendingRef.current = {};
      setRecalculando(true);
      saveSupuestosProyeccion(patch)
        .then((resueltos) => {
          setAplicados(resueltos);
          invalidateProyeccionCache();
          return getSeriePatrimonio();
        })
        .then((s) => setSerie(s))
        .catch((err) => {
          showToastV5(
            err instanceof Error ? err.message : 'No se pudo recalcular la proyección',
            'error',
          );
        })
        .finally(() => setRecalculando(false));
    }, 500);
  };

  // Año de libertad · misma pantalla · responde a los supuestos aplicados
  const { data: libertad } = useProyeccionLibertad({
    supuestos: aplicados
      ? {
          subidaRentasPct: aplicados.subidaRentasPct,
          inflacionGastosPct: aplicados.inflacionGastosPct,
        }
      : undefined,
    enabled: aplicados !== null,
  });

  // T-RECONNECT-1 · Hallazgo 5.A · capturamos errores de la proyección y
  // los exponemos en banner · NO mostramos 0€ silenciosamente.
  useEffect(() => {
    let cancelled = false;
    computeBudgetProjection12mAsync(year)
      .then((p) => {
        if (!cancelled) {
          setProjection(p);
          setProjectionError(null);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[mi-plan/proyeccion] error proyección · banner UI', err);
        if (!cancelled) {
          setProjection(null);
          setProjectionError(
            err instanceof Error ? err.message : 'Error cargando proyección',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const months = useMemo(() => projection?.months ?? [], [projection]);
  const balanceAnual = useMemo(
    () => (projection ? projection.entradasAnuales + projection.salidasAnuales : 0),
    [projection],
  );

  // Para el waterfall · escala según valor abs máximo.
  const maxAbs = useMemo(
    () => months.reduce((m, x) => Math.max(m, Math.abs(x.flujoNeto)), 1),
    [months],
  );

  // Hitos · meses con flujo más positivo y más negativo.
  const mejorMes = months.reduce((best, m) => (m.flujoNeto > (best?.flujoNeto ?? -Infinity) ? m : best), null as null | typeof months[number]);
  const peorMes = months.reduce((worst, m) => (m.flujoNeto < (worst?.flujoNeto ?? Infinity) ? m : worst), null as null | typeof months[number]);

  return (
    <>
      {projectionError && (
        <div
          role="alert"
          style={{
            background: 'var(--s-neg-bg)',
            color: 'var(--s-neg)',
            border: '1px solid var(--s-neg)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          <strong>No se pudo calcular la proyección.</strong>{' '}
          {projectionError} · revisa la consola para más detalle.
        </div>
      )}
      {serie && serie.length > 1 && (
        <CardV5 accent="brand" style={{ marginBottom: 14 }}>
          <CardV5.Title>Patrimonio a 20 años</CardV5.Title>
          <CardV5.Subtitle>
            patrimonio neto a {serie[serie.length - 1].año}:{' '}
            <MoneyValue value={serie[serie.length - 1].patrimonioNeto} size="inline" /> · año de
            libertad:{' '}
            {libertad?.cruceLibertad
              ? libertad.cruceLibertad.anio
              : 'fuera del horizonte'}
            {recalculando ? ' · recalculando…' : ''}
          </CardV5.Subtitle>
          <CardV5.Body>
            <CurvaPatrimonio serie={serie} variante="clara" alto={170} />
          </CardV5.Body>
        </CardV5>
      )}

      {supuestos && (
        <CardV5 accent="brand" style={{ marginBottom: 14 }}>
          <CardV5.Title>Supuestos de la proyección</CardV5.Title>
          <CardV5.Subtitle>
            los mandos de la curva de arriba · cada cambio recalcula patrimonio y año de libertad
          </CardV5.Subtitle>
          <CardV5.Body>
            <SupuestosPanel
              valores={supuestos}
              onCambio={onCambioSupuesto}
              compromisos={compromisos}
            />
          </CardV5.Body>
        </CardV5>
      )}

      <CardV5 accent="brand" style={{ marginBottom: 14 }}>
        <CardV5.Title>Resultado caja · {formatYearLabel(year)}</CardV5.Title>
        <CardV5.Subtitle>
          proyección estructural mes a mes · ingresos − gastos del hogar
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <ProjectionKpi
              label="Entradas anuales"
              value={projection?.entradasAnuales ?? 0}
              tone="pos"
            />
            <ProjectionKpi
              label="Salidas anuales"
              value={projection?.salidasAnuales ?? 0}
              tone="neg"
            />
            <ProjectionKpi
              label="Balance neto"
              value={balanceAnual}
              tone={balanceAnual >= 0 ? 'pos' : 'neg'}
              showSign
            />
            <ProjectionKpi
              label="Mes más positivo"
              value={mejorMes?.flujoNeto ?? 0}
              tone="pos"
              footLabel={mejorMes?.label}
              showSign
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 6,
              alignItems: 'end',
              height: 200,
              padding: '20px 4px 30px',
              borderTop: '1px dashed var(--atlas-v5-line-2)',
              borderBottom: '1px solid var(--atlas-v5-line-2)',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                borderTop: '1px solid var(--atlas-v5-line-2)',
                pointerEvents: 'none',
              }}
            />
            {months.map((m, idx) => {
              const totalH = 70; // % desde la línea 0 hasta extremos
              const heightPct = maxAbs > 0 ? (Math.abs(m.flujoNeto) / maxAbs) * totalH : 0;
              const isPositive = m.flujoNeto >= 0;
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() =>
                    showToastV5(
                      `${m.label} ${year} · entradas ${m.entradas.toFixed(0)} € · salidas ${m.salidas.toFixed(0)} €`,
                    )
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    height: '100%',
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'var(--atlas-v5-font-ui)',
                  }}
                  aria-label={`${m.label} ${year} · flujo ${m.flujoNeto.toFixed(0)} €`}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bottom: isPositive ? '50%' : 'auto',
                      top: isPositive ? 'auto' : '50%',
                      width: '85%',
                      height: `${heightPct}%`,
                      background: isPositive ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
                      borderRadius: isPositive ? '4px 4px 0 0' : '0 0 4px 4px',
                      outline: m.isCurrent ? '2px solid var(--atlas-v5-gold)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -22,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: 10,
                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                      color: m.isCurrent ? 'var(--atlas-v5-ink)' : 'var(--atlas-v5-ink-4)',
                      fontWeight: m.isCurrent ? 700 : 500,
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 18,
              fontSize: 11.5,
              color: 'var(--atlas-v5-ink-3)',
              marginTop: 18,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'var(--atlas-v5-pos)',
                }}
              />
              Mes con superávit · {months.filter((m) => m.flujoNeto >= 0).length}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'var(--atlas-v5-neg)',
                }}
              />
              Mes con déficit · {months.filter((m) => m.flujoNeto < 0).length}
            </span>
            {peorMes && peorMes.flujoNeto < 0 && (
              <span style={{ marginLeft: 'auto', color: 'var(--atlas-v5-neg)' }}>
                <Icons.Warning size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Atención · {peorMes.label} prevé{' '}
                <MoneyValue value={peorMes.flujoNeto} decimals={0} showSign tone="neg" />
              </span>
            )}
          </div>
        </CardV5.Body>
      </CardV5>

      <CardV5>
        <CardV5.Title>Tabla mes a mes</CardV5.Title>
        <CardV5.Body>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--atlas-v5-font-ui)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mes</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Entradas</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Salidas</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Flujo neto</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr
                  key={m.month}
                  style={{
                    borderBottom: '1px solid var(--atlas-v5-line-2)',
                    background: m.isCurrent ? 'var(--atlas-v5-gold-wash)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: m.isCurrent ? 700 : 600 }}>
                    {m.label}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                    <MoneyValue value={m.entradas} decimals={0} tone="pos" />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                    <MoneyValue value={m.salidas} decimals={0} tone="neg" />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 700 }}>
                    <MoneyValue value={m.flujoNeto} decimals={0} showSign tone="auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardV5.Body>
      </CardV5>
    </>
  );
};

interface ProjectionKpiProps {
  label: string;
  value: number;
  tone?: 'pos' | 'neg';
  showSign?: boolean;
  footLabel?: string;
}

const ProjectionKpi: React.FC<ProjectionKpiProps> = ({ label, value, tone, showSign, footLabel }) => (
  <div
    style={{
      background: 'var(--atlas-v5-card-alt)',
      border: '1px solid var(--atlas-v5-line)',
      borderRadius: 10,
      padding: '12px 14px',
    }}
  >
    <div
      style={{
        fontSize: 10.5,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--atlas-v5-ink-4)',
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'var(--atlas-v5-font-mono-num)',
        fontWeight: 700,
        fontSize: 20,
        color:
          tone === 'pos'
            ? 'var(--atlas-v5-pos)'
            : tone === 'neg'
              ? 'var(--atlas-v5-neg)'
              : 'var(--atlas-v5-ink)',
        letterSpacing: '-0.025em',
      }}
    >
      <MoneyValue value={value} decimals={0} showSign={showSign} tone={tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : 'auto'} />
    </div>
    {footLabel && (
      <div
        style={{
          fontSize: 11,
          color: 'var(--atlas-v5-ink-4)',
          marginTop: 4,
          fontFamily: 'var(--atlas-v5-font-mono-num)',
        }}
      >
        {footLabel}
      </div>
    )}
  </div>
);

export default ProyeccionPage;
