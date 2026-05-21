// BloqueProyeccion · P1 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.2).
// PR 4 · cableado · usa `proyeccionActivoService` + escenario Mi Plan +
// personal + benchmarks. Tipo-aware (PPA garantizado, PPE informativo).
// Componente GENÉRICO · prop `tipoActivo` agnostic (checklist §12 ✔).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeTwrRolling5y,
  proyectarInversion,
  type ProyeccionInputs,
  type ProyeccionResult,
  type TipoActivoProyectable,
} from '../../../../services/proyeccionActivoService';
import { listBenchmarks } from '../../../../services/benchmarksReferenciaService';
import { getEscenarioActivo } from '../../../../services/escenariosService';
import { personalDataService } from '../../../../services/personalDataService';
import type { BenchmarkReferencia } from '../../../../types/benchmarksReferencia';
import styles from './bloques.module.css';

export type EscenarioProyeccion = 'actual' | 'benchmark' | 'maxAportacion';

export interface BloqueProyeccionProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  saldoActual: number;
  aportadoActual: number;
  /** Aportación anual estimada hacia adelante en €. */
  aportacionAnualEstimada: number;
  /** TWR histórico anualizado (decimal). null si <2 años. */
  twrHistorico: number | null;
  /** Años transcurridos desde la apertura. */
  anosTranscurridos: number;
  /** Política de inversión declarada · matching benchmark. */
  politicaInversion?: string;
  /** Modo del mensaje principal (§5.4 · tipo-aware). */
  modoCopy?: 'accionable' | 'informativo';
  /**
   * Sólo PPA · si el plan tiene rentabilidad mínima garantizada · pasa el
   * decimal. Cambia el copy a "tendrás Y € garantizados".
   */
  garantiaMinima?: number;
}

interface ProyeccionViewState {
  data: ProyeccionResult | null;
  edadRescate: number;
  inflacion: number;
  benchmarkUsado: BenchmarkReferencia | null;
}

// Matching simple política → códigos benchmark relevantes (§5.3).
function pickBenchmarkParaPolitica(
  benchmarks: BenchmarkReferencia[],
  politica?: string,
): BenchmarkReferencia | null {
  if (benchmarks.length === 0) return null;
  const byCodigo = (cod: string) =>
    benchmarks.find((b) => b.codigo === cod && Object.keys(b.valoresAnuales).length > 0);
  switch (politica) {
    case 'renta_variable':
      return byCodigo('MSCI_WORLD_EUR') ?? byCodigo('SP500_EUR') ?? null;
    case 'renta_fija_corto':
    case 'renta_fija_largo':
      return byCodigo('BONDS_AGG_EUR') ?? null;
    case 'renta_mixta':
    case 'ciclo_vida':
      return byCodigo('MSCI_WORLD_EUR') ?? byCodigo('BONDS_AGG_EUR') ?? null;
    default:
      // Sin clasificar · usa MSCI World como genérico si tiene datos · si no, primer benchmark con datos.
      return (
        byCodigo('MSCI_WORLD_EUR') ??
        benchmarks.find((b) => Object.keys(b.valoresAnuales).length > 0) ??
        null
      );
  }
}

function fmtEur(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M €`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k €`;
  return `${Math.round(n)} €`;
}

const BloqueProyeccion = ({
  posicionId,
  tipoActivo,
  saldoActual,
  aportadoActual,
  aportacionAnualEstimada,
  twrHistorico,
  anosTranscurridos,
  politicaInversion,
  modoCopy = 'accionable',
  garantiaMinima,
}: BloqueProyeccionProps) => {
  const navigate = useNavigate();
  const [escenario, setEscenario] = useState<EscenarioProyeccion>('actual');
  const [view, setView] = useState<ProyeccionViewState>({
    data: null,
    edadRescate: 65,
    inflacion: 2,
    benchmarkUsado: null,
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [esc, benchmarks, personal] = await Promise.all([
          getEscenarioActivo(),
          listBenchmarks().catch(() => [] as BenchmarkReferencia[]),
          personalDataService.getPersonalData().catch(() => null),
        ]);
        const benchmarkUsado = pickBenchmarkParaPolitica(benchmarks, politicaInversion);
        const inputs: ProyeccionInputs = {
          saldoActual,
          aportadoActual,
          aportacionAnualEstimada,
          anosTranscurridos,
          twrHistorico,
          fechaNacimientoUsuario: personal?.fechaNacimiento ?? null,
          edadObjetivoRescate: esc.edadObjetivoRescate ?? 65,
          inflacionAnualAsumida: esc.inflacionAnualAsumida ?? 2,
          benchmarkReferencia: benchmarkUsado,
        };
        const data = proyectarInversion(inputs);
        if (!cancelado) {
          setView({
            data,
            edadRescate: esc.edadObjetivoRescate ?? 65,
            inflacion: esc.inflacionAnualAsumida ?? 2,
            benchmarkUsado,
          });
        }
      } catch {
        // Sin datos · placeholder · el render maneja `data === null`.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [
    saldoActual,
    aportadoActual,
    aportacionAnualEstimada,
    anosTranscurridos,
    twrHistorico,
    politicaInversion,
  ]);

  const escenarioActivo = useMemo(() => {
    if (!view.data) return null;
    if (escenario === 'benchmark') return view.data.escenarioConBenchmark ?? view.data.escenarioActual;
    if (escenario === 'maxAportacion') return view.data.escenarioConMaxAportacion;
    return view.data.escenarioActual;
  }, [view.data, escenario]);

  // Mensaje principal · tipo-aware (§5.2).
  const mensajePrincipal: { prefix: string; valor: string; suffix?: string } = (() => {
    if (!view.data) return { prefix: 'Calculando proyección…', valor: '' };
    const valorEscenario = escenarioActivo?.valorFinal ?? view.data.valorFinalNominal;
    const edadFinal = view.data.anoRescate - new Date().getFullYear() + view.edadRescate;
    if (garantiaMinima != null) {
      return {
        prefix: `A vencimiento tendrás`,
        valor: fmtEur(valorEscenario),
        suffix: 'garantizados',
      };
    }
    return {
      prefix: `A los ${view.edadRescate} años tendrás`,
      valor: fmtEur(valorEscenario),
      suffix: edadFinal !== view.edadRescate ? `(año ${view.data.anoRescate})` : undefined,
    };
  })();

  const subCopy: string = (() => {
    if (!view.data) return 'shell · datos cargando';
    const twr = view.data.escenarioActual.twrAplicado;
    const twrPct = (twr * 100).toFixed(1);
    if (modoCopy === 'informativo') {
      return `proyección informativa · cálculo desde tu TWR histórico (${twrPct} %) · inflación asumida ${view.inflacion} %.`;
    }
    return `cálculo desde tu TWR histórico (${twrPct} %) · ${view.benchmarkUsado ? `benchmark referencia ${view.benchmarkUsado.codigo}` : 'sin benchmark configurado'} · inflación ${view.inflacion} %.`;
  })();

  return (
    <section
      className={styles.bloque}
      data-bloque="P1"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      aria-label="Proyección"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Proyección</div>
          <div className={styles.bloqueMensaje}>
            {mensajePrincipal.prefix}{' '}
            <span className={`${styles.big} mono`}>{mensajePrincipal.valor}</span>
            {mensajePrincipal.suffix && <> · {mensajePrincipal.suffix}</>}
          </div>
          <div className={styles.bloqueSub}>{subCopy}</div>
          <div className={styles.srcChips}>
            <button
              type="button"
              className={styles.srcChip}
              onClick={() => navigate('/mi-plan/hitos-vitales')}
              aria-label="Editar edad de rescate en Mi Plan"
            >
              Edad rescate · {view.edadRescate} · Mi Plan ↗
            </button>
            <button
              type="button"
              className={styles.srcChip}
              onClick={() => navigate('/mi-plan/hitos-vitales')}
              aria-label="Editar inflación asumida en Mi Plan"
            >
              Inflación · {view.inflacion} % · Mi Plan ↗
            </button>
            <button
              type="button"
              className={styles.srcChip}
              onClick={() => navigate('/ajustes/datos-mercado')}
              aria-label="Configurar benchmarks en Ajustes"
            >
              Benchmarks · Ajustes ↗
            </button>
          </div>
        </div>
        <div
          className={styles.toggle}
          role="group"
          aria-label="Cambiar escenario de proyección"
        >
          <button
            type="button"
            className={escenario === 'actual' ? styles.active : ''}
            onClick={() => setEscenario('actual')}
          >
            Escenario actual
          </button>
          <button
            type="button"
            className={escenario === 'benchmark' ? styles.active : ''}
            onClick={() => setEscenario('benchmark')}
            disabled={!view.data?.escenarioConBenchmark}
            aria-disabled={!view.data?.escenarioConBenchmark}
          >
            Si cambias gestora
          </button>
          <button
            type="button"
            className={escenario === 'maxAportacion' ? styles.active : ''}
            onClick={() => setEscenario('maxAportacion')}
          >
            Si aportas el máximo
          </button>
        </div>
      </div>

      {view.data && escenarioActivo ? (
        <div className={styles.bloqueBody}>
          <SerieMiniSparkline puntos={escenarioActivo.puntos} />
          <div className={styles.minisRow}>
            <Mini
              lab="Valor final nominal"
              val={fmtEur(view.data.valorFinalNominal)}
              tone="ink"
            />
            <Mini
              lab="Poder adquisitivo real"
              val={fmtEur(view.data.valorFinalReal)}
              tone="ink"
              sub={`descontada inflación ${view.inflacion} %`}
            />
            {view.data.diferenciaConBenchmark != null && (
              <Mini
                lab="Si cambias gestora"
                val={`${view.data.diferenciaConBenchmark >= 0 ? '+' : ''}${fmtEur(view.data.diferenciaConBenchmark)}`}
                tone={view.data.diferenciaConBenchmark >= 0 ? 'pos' : 'neg'}
                // Bug #5 · explicar el contraste: "vs MSCI_WORLD_EUR" se leía
                // como rentabilidad esperada · ahora dejamos claro que es
                // diferencia frente a continuar con la rentabilidad histórica
                // del propio plan, usando el benchmark sólo como referencia.
                sub={`vs continuar con tu TWR histórico (${(view.data.escenarioActual.twrAplicado * 100).toFixed(1)} %)`}
                detail={
                  view.benchmarkUsado
                    ? `Hipotético · si movieras a una gestora cuya rentabilidad coincidiese con el benchmark ${view.benchmarkUsado.codigo}. Mismo capital y horizonte de rescate.`
                    : 'Hipotético · si movieras a una gestora más eficiente.'
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className={styles.bloquePlaceholder}>
          Cargando proyección · necesitas tener saldo actual + supuestos en Mi Plan.
        </div>
      )}
    </section>
  );
};

// ── Mini sparkline simple · 1 línea + área de cono ─────────────────────────

function SerieMiniSparkline({ puntos }: { puntos: { ano: number; valor: number }[] }) {
  if (puntos.length < 2) return null;
  const W = 720;
  const H = 140;
  const PAD = 28;
  const xs = puntos.map((p) => p.ano);
  const ys = puntos.map((p) => p.valor);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Bug #3 · escala Y dinámica · arrancar en 0 hace que la curva 2026→2045
  // se aplaste contra el techo. Usamos rango ajustado al dato (±5 %) para
  // que la curva ocupe ~90 % del espacio vertical y se vea el crecimiento.
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const spread = Math.max(1, dataMax - dataMin);
  const minY = Math.max(0, dataMin - spread * 0.05);
  const maxY = dataMax + spread * 0.05;

  // Ticks anuales · cada ~5 años para no saturar.
  const yearSpan = maxX - minX;
  const tickStep = yearSpan <= 5 ? 1 : yearSpan <= 12 ? 2 : 5;
  const ticksX: number[] = [];
  for (let y = minX; y <= maxX; y += tickStep) ticksX.push(y);
  if (ticksX[ticksX.length - 1] !== maxX) ticksX.push(maxX);

  const px = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
  const py = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);
  const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.ano)} ${py(p.valor)}`).join(' ');
  const last = puntos[puntos.length - 1];

  // Ticks Y · 3 niveles (min, medio, max) para dar referencia de magnitud.
  const ticksY = [minY, (minY + maxY) / 2, maxY];
  const fmtTickY = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M €`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} k €`;
    return `${Math.round(v)} €`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label="Curva de proyección anual"
    >
      {/* Grid horizontal · referencias de Y */}
      {ticksY.map((v) => (
        <g key={`y-${v}`}>
          <line
            x1={PAD}
            y1={py(v)}
            x2={W - PAD}
            y2={py(v)}
            stroke="var(--atlas-v5-line)"
            strokeWidth="1"
            strokeDasharray={v === minY ? undefined : '2 3'}
          />
          <text
            x={PAD - 4}
            y={py(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--atlas-v5-ink-4)"
            fontFamily="JetBrains Mono"
          >
            {fmtTickY(v)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--atlas-v5-gold)" strokeWidth="2" />
      <circle cx={px(last.ano)} cy={py(last.valor)} r="4" fill="var(--atlas-v5-gold-ink)" />
      {/* Ticks X · años legibles */}
      {ticksX.map((y) => (
        <text
          key={`x-${y}`}
          x={px(y)}
          y={H - PAD + 14}
          textAnchor={y === maxX ? 'end' : y === minX ? 'start' : 'middle'}
          fontSize="10"
          fill="var(--atlas-v5-ink-4)"
          fontFamily="JetBrains Mono"
        >
          {y}
        </text>
      ))}
    </svg>
  );
}

function Mini({
  lab,
  val,
  tone = 'ink',
  sub,
  detail,
}: {
  lab: string;
  val: string;
  tone?: 'ink' | 'pos' | 'neg';
  sub?: string;
  /** Tooltip nativo con detalle largo · accesible por hover/focus. */
  detail?: string;
}) {
  const colorVar =
    tone === 'pos'
      ? 'var(--atlas-v5-pos)'
      : tone === 'neg'
        ? 'var(--atlas-v5-neg)'
        : 'var(--atlas-v5-ink)';
  return (
    <div className={styles.mini} title={detail}>
      <div className={styles.miniLab}>{lab}</div>
      <div className={styles.miniVal} style={{ color: colorVar }}>{val}</div>
      {sub && <div className={styles.miniSub}>{sub}</div>}
    </div>
  );
}

export default BloqueProyeccion;
// Re-export helper para tests que verifican selección de benchmark.
export const __test__ = { pickBenchmarkParaPolitica, computeTwrRolling5y };
